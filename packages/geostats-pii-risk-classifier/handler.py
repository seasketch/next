"""
Lambda handler: classify a pruned GeostatsLayer for PII risk, attaching
piiRisk (0–1) and piiRiskCategories to each string attribute.

Values are NOT removed from the response.  The decision to strip values before
sending to an LLM is the responsibility of the caller, using piiRisk together
with a consumer-defined threshold (see ai-data-analyst PII_REDACTION_THRESHOLD).

Event shape:
  { "geostats": <pruned GeostatsLayer object> }

Response shape (same JSON envelope):
  { "geostats": <annotated GeostatsLayer> }

where the layer-level flag is set:
  "piiRiskWasAssessed": true

and each assessed string attribute gains zero or more of:
  "piiRisk":           <float 0–1>   # always present after assessment
  "piiRiskCategories": [<reason>]    # present when piiRisk > 0

piiRisk interpretation
  • Pattern PII (email, phone, SSN …):
      piiRisk = hit_rate (fraction of non-blank values matching the pattern).
      A column of 15 emails scores piiRisk ≈ 1.0; 1 email in 20 values gives
      piiRisk ≈ 0.05.  Noise floor: if total pattern hits < PATTERN_MIN_HITS,
      piiRisk = 0.

  • Name PII (NER):
      piiRisk = max(0, min(1, name_risk)), where name_risk is a discriminative
      signal built on the fraction of values containing a PER entity, penalised
      for location/organisation/binomial-nomenclature noise.  Negative scores
      collapse to 0.  Noise floor: if per_rate < NAME_RISK_MIN_PER_RATE,
      name piiRisk = 0.

  • Final: piiRisk = max(pattern_pii_risk, name_pii_risk).

reason values match PiiRiskCategory in @seasketch/geostats-types:
  "email" | "phone" | "government_id" | "financial" | "name" | "other"
"""

import bisect
import json
import logging
import random
import re
from typing import Any

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Lazy singletons — loaded on first warm invocation (not at import time)
# ---------------------------------------------------------------------------
_analyzer = None
_nlp_xx = None


def _get_analyzer():
    """Return a lazy-initialised Presidio AnalyzerEngine with en_core_web_sm."""
    global _analyzer
    if _analyzer is None:
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        provider = NlpEngineProvider(
            nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
            }
        )
        _analyzer = AnalyzerEngine(nlp_engine=provider.create_engine())
    return _analyzer


def _get_nlp_xx():
    """Return a lazy-initialised spaCy xx_ent_wiki_sm pipeline for multilingual NER."""
    global _nlp_xx
    if _nlp_xx is None:
        import spacy

        _nlp_xx = spacy.load("xx_ent_wiki_sm")
    return _nlp_xx


# ---------------------------------------------------------------------------
# Configuration constants (tune as needed)
# ---------------------------------------------------------------------------

# Presidio entity types to check via regex recognizers (no NER needed for these).
# PERSON is intentionally excluded; name risk is handled by NER path below.
PATTERN_ENTITIES = [
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "CREDIT_CARD",
    "IBAN_CODE",
    "US_SSN",
    "US_ITIN",
    "US_BANK_NUMBER",
    "MEDICAL_LICENSE",
    "US_PASSPORT",
    "US_DRIVER_LICENSE",
    "UK_NHS",
    "SG_NRIC_FIN",
    "AU_ABN",
    "AU_ACN",
    "AU_TFN",
    "AU_MEDICARE",
    "IP_ADDRESS",
]

ENTITY_TO_REASON: dict[str, str] = {
    "EMAIL_ADDRESS": "email",
    "PHONE_NUMBER": "phone",
    "CREDIT_CARD": "financial",
    "IBAN_CODE": "financial",
    "US_BANK_NUMBER": "financial",
    "US_SSN": "government_id",
    "US_ITIN": "government_id",
    "MEDICAL_LICENSE": "government_id",
    "US_PASSPORT": "government_id",
    "US_DRIVER_LICENSE": "government_id",
    "UK_NHS": "government_id",
    "SG_NRIC_FIN": "government_id",
    "AU_ABN": "government_id",
    "AU_ACN": "government_id",
    "AU_TFN": "government_id",
    "AU_MEDICARE": "government_id",
    "IP_ADDRESS": "other",
}

REASON_PRIORITY: dict[str, int] = {
    "email": 10,
    "financial": 9,
    "government_id": 9,
    "phone": 8,
    "name": 5,
    "other": 3,
}

# A string column must have at least this many distinct values to run NER
# (low-cardinality columns like "Yes"/"No" are not person-name columns).
HIGH_CARDINALITY_THRESHOLD = 12

# Pattern PII noise floor: require at least this many value hits before
# assigning any piiRisk, to avoid spurious signals from incidental matches.
PATTERN_MIN_HITS = 2

# Presidio confidence score floor for counting a recognition result.
# PhoneRecognizer in presidio-analyzer 2.2.x emits a flat score of 0.4 for all
# recognised phone numbers (it does not do is_valid_number() scoring in this
# release).  Pattern recognizers like EMAIL_ADDRESS score ~1.0 and US_SSN ~0.85,
# so 0.35 accepts phones while still providing a meaningful noise floor.
PRESIDIO_MIN_SCORE = 0.35

# Name risk (NER) noise floor: require at least this fraction of values to have
# a PER entity before assigning any name piiRisk.  Suppresses noise from columns
# where PER tagging is sporadic.
NAME_RISK_MIN_PER_RATE = 0.30

# Maximum number of non-blank distinct values sampled per column for analysis.
# Caps runtime for large raw geostats files (the Lambda normally receives
# pruned geostats with at most 64 values, but callers can bypass pruning).
MAX_VALUES_PER_ATTRIBUTE = 100

# Skip Presidio pattern analysis entirely when the longest non-blank value in
# a column is shorter than this.  The shortest recognisable PII pattern is an
# email address (e.g. "a@b.c" = 5 chars).  Columns of ISO codes, CJK city
# names, short classification codes, etc. are therefore skipped cheaply.
PRESIDIO_MIN_VALUE_LENGTH = 5

# Cross-column anchor boost: when True, a second analysis pass uses email
# usernames extracted from high-confidence email columns to boost the name_risk
# score of adjacent columns whose values correspond to those identities.
# Set to False to revert to single-pass, per-column-only analysis.
ENABLE_CROSS_COLUMN_ANCHOR_BOOST = True

# Minimum piiRisk for an email column to contribute anchors in the two-pass
# system.  Kept separate from any consumer-side redaction threshold.
ANCHOR_EMAIL_MIN_RISK = 0.40

# Minimum normalised token length for anchor matching (avoids short false positives).
ANCHOR_MIN_TOKEN_LEN = 5

# Weight applied to the anchor match rate when boosting name_risk.
ANCHOR_BOOST_WEIGHT = 0.50


# ---------------------------------------------------------------------------
# Pattern PII scoring
# ---------------------------------------------------------------------------


def _score_pattern_pii(keys: list[str], analyzer) -> dict[str, Any]:
    """
    Run Presidio pattern recognizers against all value keys in a single call.

    All values are joined with a newline separator into one string so that
    Presidio's spaCy NLP pipeline runs once instead of once per value.
    Character offsets are used to map each result back to the originating
    value line; results that span a newline boundary are discarded to prevent
    cross-value false positives.

    Blank / whitespace-only keys are excluded from both the numerator and the
    denominator so that null-heavy columns are not artificially down-scored.

    Returns {"hit_rate": float, "hits": int, "reason": str | None}.
    """
    # Filter blanks before computing the denominator.
    keys = [k for k in keys if k and k.strip()]
    total = len(keys)
    if total == 0:
        return {"hit_rate": 0.0, "hits": 0, "reason": None}

    # Build a concatenated text and record the start offset of each value.
    # line_starts[i] = character offset of keys[i] within combined.
    combined = "\n".join(keys)
    line_starts: list[int] = []
    pos = 0
    for k in keys:
        line_starts.append(pos)
        pos += len(k) + 1  # +1 for the '\n' separator

    try:
        results = analyzer.analyze(
            text=combined,
            entities=PATTERN_ENTITIES,
            language="en",
        )
    except Exception as exc:
        logger.warning("Presidio analyze error: %s", exc)
        return {"hit_rate": 0.0, "hits": 0, "reason": None}

    # entity_type → set of line indices that contained a match
    entity_hits: dict[str, set[int]] = {}

    for r in results:
        if r.score < PRESIDIO_MIN_SCORE:
            continue
        # Locate the line this result starts on via binary search.
        line_idx = bisect.bisect_right(line_starts, r.start) - 1
        if line_idx < 0 or line_idx >= len(keys):
            continue
        # Discard results that cross a newline boundary to prevent false positives
        # from adjacent values being read as one token (e.g. "555\n1234" ≠ phone).
        line_end = line_starts[line_idx] + len(keys[line_idx])
        if r.end > line_end:
            continue
        if r.entity_type not in entity_hits:
            entity_hits[r.entity_type] = set()
        entity_hits[r.entity_type].add(line_idx)

    if not entity_hits:
        return {"hit_rate": 0.0, "hits": 0, "reason": None}

    # Pick the entity type with the most distinct-value hits; break ties by priority.
    best_type, best_lines = max(
        entity_hits.items(),
        key=lambda kv: (
            len(kv[1]),
            REASON_PRIORITY.get(ENTITY_TO_REASON.get(kv[0], "other"), 0),
        ),
    )
    best_count = len(best_lines)
    return {
        "hit_rate": best_count / total,
        "hits": best_count,
        "reason": ENTITY_TO_REASON.get(best_type, "other"),
    }


# ---------------------------------------------------------------------------
# Name-risk NER scoring
# ---------------------------------------------------------------------------


def _score_name_risk(keys: list[str], nlp) -> dict[str, Any]:
    """
    Use spaCy xx_ent_wiki_sm NER to compute per-column PER/LOC/ORG rates and a
    combined name_risk score.

    Blank / whitespace-only keys are already excluded by the caller.
    Uses nlp.pipe() for batch processing — significantly faster than calling
    nlp(key) in a loop because spaCy can amortise model overhead across texts.

    Returns {"name_risk": float, "per_rate": float, "loc_rate": float,
             "org_rate": float}.
    """
    if not keys:
        return {"name_risk": 0.0, "per_rate": 0.0, "loc_rate": 0.0, "org_rate": 0.0}

    per_hits = 0
    loc_hits = 0
    org_hits = 0

    try:
        docs = list(nlp.pipe(keys))
    except Exception as exc:
        logger.warning("spaCy pipe error: %s", exc)
        return {"name_risk": 0.0, "per_rate": 0.0, "loc_rate": 0.0, "org_rate": 0.0}

    for doc in docs:
        labels = {ent.label_ for ent in doc.ents}
        if "PER" in labels:
            per_hits += 1
        if "LOC" in labels:
            loc_hits += 1
        if "ORG" in labels:
            org_hits += 1

    total = len(keys)

    per_rate = per_hits / total
    loc_rate = loc_hits / total
    org_rate = org_hits / total

    # Shape priors: title-case typical for names; digits/commas typical for places.
    title_case_rate = sum(1 for k in keys if k and k.istitle()) / total
    digit_rate = sum(1 for k in keys if k and any(c.isdigit() for c in k)) / total

    shape_bonus = 0.10 * title_case_rate - 0.10 * digit_rate

    # Binomial nomenclature prior (taxonomy): values matching "Genus species"
    # — first token Capitalized + alpha-only, second token lowercase + alpha-only —
    # are very unlikely to be person names.  Person names ("John Smith") never
    # match because surnames are Title-Case, not all-lowercase.
    binomial_hits = 0
    for k in keys:
        parts = k.split()
        if (
            len(parts) == 2
            and parts[0][0].isupper()
            and parts[0].isalpha()
            and parts[1].islower()
            and parts[1].isalpha()
        ):
            binomial_hits += 1
    binomial_rate = binomial_hits / total

    # Discount by location and org rates to avoid flagging geographic columns.
    # Discount strongly when column looks like taxonomic binomials.
    name_risk = (
        per_rate
        - 0.70 * loc_rate
        - 0.40 * org_rate
        + shape_bonus
        - 0.80 * binomial_rate
    )

    return {
        "name_risk": name_risk,
        "per_rate": per_rate,
        "loc_rate": loc_rate,
        "org_rate": org_rate,
    }


# ---------------------------------------------------------------------------
# Cross-column anchor helpers
# ---------------------------------------------------------------------------


def _norm_for_anchor(s: str) -> str:
    """Lowercase and strip all non-alpha characters for fuzzy comparison."""
    return re.sub(r"[^a-z]", "", s.lower())


def _anchor_boost(keys: list[str], email_usernames: set[str]) -> float:
    """
    Return a [0, 1] score: the fraction of non-blank column values whose
    normalised tokens match (or are a substantial prefix of) a confirmed email
    username from another column in the same layer.

    Matching logic for each value:
      1. Concatenate all alpha-only tokens (length >= ANCHOR_MIN_TOKEN_LEN).
      2. Accept if the concatenation equals an anchor exactly.
      3. Accept if the concatenation is a prefix of an anchor, or vice-versa —
         this handles "Lleyton" matching "lleytonkirisome".
      4. Accept if any individual long token is a prefix of an anchor or
         vice-versa — catches "Fatutolo" matching "fatutoloi".

    Short tokens (< ANCHOR_MIN_TOKEN_LEN) are ignored to avoid matching common
    words that happen to appear in longer email usernames.
    """
    if not email_usernames or not keys:
        return 0.0

    non_blank = [k for k in keys if k and k.strip()]
    if not non_blank:
        return 0.0

    hits = 0
    for key in non_blank:
        tokens = [
            _norm_for_anchor(t)
            for t in key.split()
            if len(_norm_for_anchor(t)) >= ANCHOR_MIN_TOKEN_LEN
        ]
        if not tokens:
            continue

        cat = "".join(tokens)
        matched = False
        for anchor in email_usernames:
            # Exact concatenated match
            if cat == anchor:
                matched = True
                break
            # Prefix match on concatenated form
            if anchor.startswith(cat) or cat.startswith(anchor):
                matched = True
                break
            # Prefix match on any individual long token
            for tok in tokens:
                if anchor.startswith(tok) or tok.startswith(anchor):
                    matched = True
                    break
            if matched:
                break

        if matched:
            hits += 1

    return hits / len(non_blank)


# ---------------------------------------------------------------------------
# Per-attribute analysis
# ---------------------------------------------------------------------------


def _analyze_attribute(
    attr: dict, analyzer, nlp_xx, email_usernames: set[str] | None = None
) -> dict:
    """
    Inspect a single pruned GeostatsAttribute and attach piiRisk /
    piiRiskCategories.  Values are always preserved.

    Only string-type attributes with at least one non-blank value key are
    candidates for analysis.

    High-cardinality non-flagged columns have their values key order shuffled
    so that entry order cannot be used to reconstruct original row data.
    """
    if not isinstance(attr, dict):
        return attr

    if attr.get("type") != "string":
        return attr

    values_dict = attr.get("values")
    if not isinstance(values_dict, dict) or not values_dict:
        return attr

    all_keys = list(values_dict.keys())
    # Non-blank keys are the honest denominator for all scoring.
    # Cap to MAX_VALUES_PER_ATTRIBUTE so runtime is bounded when the Lambda
    # receives raw (unpruned) geostats with many distinct values.
    keys = [k for k in all_keys if k and k.strip()][:MAX_VALUES_PER_ATTRIBUTE]

    count_distinct = attr.get("countDistinct", len(all_keys))
    is_high_cardinality = count_distinct >= HIGH_CARDINALITY_THRESHOLD

    pii_risk = 0.0
    categories: list[str] = []

    # ------------------------------------------------------------------
    # 1. Pattern-based structured PII (email, phone, SSN, credit card …)
    #    Run on all string attributes regardless of cardinality.
    #    Skip entirely when no value is long enough to hold any pattern
    #    (e.g. ISO-2 codes, CJK city names, short classification codes).
    # ------------------------------------------------------------------
    max_val_len = max((len(k) for k in keys), default=0)
    if max_val_len >= PRESIDIO_MIN_VALUE_LENGTH:
        pattern = _score_pattern_pii(keys, analyzer)
    else:
        pattern = {"hit_rate": 0.0, "hits": 0, "reason": None}

    if pattern["hits"] >= PATTERN_MIN_HITS:
        # hit_rate is the honest fraction of non-blank values matching the pattern.
        pattern_risk = pattern["hit_rate"]
        if pattern_risk > pii_risk:
            pii_risk = pattern_risk
            categories = [pattern["reason"]]

    # ------------------------------------------------------------------
    # 2. Name risk via multilingual NER — high-cardinality columns only.
    # ------------------------------------------------------------------
    name = None
    if is_high_cardinality and nlp_xx is not None:
        name = _score_name_risk(keys, nlp_xx)

        boosted_name_risk = name["name_risk"]

        # 2b. Cross-column anchor boost.
        #     If NER ran but name_risk is modest, check whether this column's
        #     values correspond to email usernames confirmed as PII in another
        #     column of the same layer.  This catches cases like an "informant"
        #     column whose values ("Lleyton Kirisome", "Justin…") identify the
        #     same individuals as a co-located email column.
        if email_usernames and name["per_rate"] >= NAME_RISK_MIN_PER_RATE:
            boost = _anchor_boost(keys, email_usernames)
            if boost > 0:
                boosted_name_risk = name["name_risk"] + ANCHOR_BOOST_WEIGHT * boost
                logger.info(
                    "Column %r: cross-column anchor boost applied "
                    "(name_risk=%.2f + %.2f*%.2f → %.2f, per=%.2f)",
                    attr.get("attribute"),
                    name["name_risk"],
                    ANCHOR_BOOST_WEIGHT,
                    boost,
                    boosted_name_risk,
                    name["per_rate"],
                )

        # Honest name piiRisk: clamp discriminative signal to [0, 1].
        # Apply noise floor: suppress signal when PER tagging is too sparse.
        if name["per_rate"] >= NAME_RISK_MIN_PER_RATE:
            name_pii_risk = max(0.0, min(1.0, boosted_name_risk))
        else:
            name_pii_risk = 0.0

        if name_pii_risk > pii_risk:
            pii_risk = name_pii_risk
            categories = ["name"]
        elif name_pii_risk > 0 and "name" not in categories:
            categories.append("name")

    if pii_risk > 0:
        logger.info(
            "Column %r: piiRisk=%.3f categories=%s",
            attr.get("attribute"),
            pii_risk,
            categories,
        )

    # ------------------------------------------------------------------
    # 3. Attach scores; shuffle key order for high-cardinality columns.
    # ------------------------------------------------------------------
    result = dict(attr)
    result["piiRisk"] = round(pii_risk, 3)
    if categories:
        result["piiRiskCategories"] = categories

    if is_high_cardinality:
        items = list(values_dict.items())
        random.shuffle(items)
        result["values"] = dict(items)

    return result


# ---------------------------------------------------------------------------
# Lambda entry point
# ---------------------------------------------------------------------------


def lambda_handler(event: dict, context: Any) -> dict:
    """
    AWS Lambda entry point.

    Accepts either:

    • ``{ "warm": true }`` — load Presidio + spaCy (cold-start mitigation); returns
      ``{ "warm": true, "ok": true }``.

    • ``{ "geostats": <GeostatsLayer dict> }`` — full PII classification (see below).

    Returns the **full** layer document (not a patch):

      { "geostats": { ...input layer keys..., "attributes": [...updated...],
                      "piiRiskWasAssessed": true } }

    Each analysed string attribute includes ``piiRisk`` (always) and
    ``piiRiskCategories`` when non-empty. ``values`` are preserved; high-cardinality
    columns may have shuffled value-key order. Callers should persist
    ``response["geostats"]`` as the layer source of truth (upload pipeline and
    backfills). Scoring uses at most ``MAX_VALUES_PER_ATTRIBUTE`` distinct
    non-blank keys per column; the full ``values`` map is still returned.
    """
    if event.get("warm") is True:
        _get_analyzer()
        _get_nlp_xx()
        logger.info("Warm invocation: Presidio + spaCy initialised")
        return {"warm": True, "ok": True}

    geostats = event.get("geostats")
    if geostats is None:
        logger.error("No 'geostats' key in event")
        return {"error": "Missing 'geostats' in event payload"}

    # Raster shapes have a `bands` array instead of `attributes`; pass through.
    if not isinstance(geostats, dict) or "attributes" not in geostats:
        return {"geostats": geostats}

    attributes = geostats.get("attributes", [])
    if not isinstance(attributes, list):
        return {"geostats": geostats}

    analyzer = _get_analyzer()
    nlp_xx = _get_nlp_xx()

    if ENABLE_CROSS_COLUMN_ANCHOR_BOOST:
        # Pass 1 — analyse each attribute independently.
        first_pass: list[tuple[dict, dict]] = [
            (attr, _analyze_attribute(attr, analyzer, nlp_xx)) for attr in attributes
        ]

        # Collect email usernames from columns that scored as high-confidence
        # email PII.  These become cross-column anchors for pass 2.
        email_usernames: set[str] = set()
        for orig_attr, result in first_pass:
            if (
                result.get("piiRisk", 0) >= ANCHOR_EMAIL_MIN_RISK
                and "email" in result.get("piiRiskCategories", [])
            ):
                for k in orig_attr.get("values", {}):
                    if k and "@" in k:
                        raw = k.split("@")[0].rstrip("0123456789")
                        normed = _norm_for_anchor(raw)
                        if len(normed) >= 5:
                            email_usernames.add(normed)

        # Pass 2 — re-evaluate columns that weren't scored as high-confidence PII
        # in pass 1, now supplying the email anchor set for the cross-column boost.
        if email_usernames:
            modified_attributes = []
            for orig_attr, first_result in first_pass:
                if first_result.get("piiRisk", 0) >= ANCHOR_EMAIL_MIN_RISK:
                    modified_attributes.append(first_result)
                else:
                    modified_attributes.append(
                        _analyze_attribute(orig_attr, analyzer, nlp_xx, email_usernames)
                    )
        else:
            modified_attributes = [result for _, result in first_pass]
    else:
        modified_attributes = [
            _analyze_attribute(attr, analyzer, nlp_xx) for attr in attributes
        ]

    result = {**geostats, "attributes": modified_attributes, "piiRiskWasAssessed": True}
    return {"geostats": result}
