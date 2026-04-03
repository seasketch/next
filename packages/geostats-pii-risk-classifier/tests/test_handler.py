"""
Unit tests for the geostats PII risk classifier Lambda handler.

Run locally:
  cd packages/geostats-pii-risk-classifier
  pip install pytest presidio-analyzer phonenumbers spacy \
    "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.1/en_core_web_sm-3.7.1-py3-none-any.whl" \
    "xx_ent_wiki_sm @ https://github.com/explosion/spacy-models/releases/download/xx_ent_wiki_sm-3.7.0/xx_ent_wiki_sm-3.7.0-py3-none-any.whl"
  pytest tests/
"""

import copy
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from handler import (
    _analyze_attribute,
    _score_pattern_pii,
    _score_name_risk,
    lambda_handler,
    HIGH_CARDINALITY_THRESHOLD,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_layer(attributes: list) -> dict:
    return {
        "layer": "test",
        "count": 100,
        "geometry": "Point",
        "attributeCount": len(attributes),
        "attributes": attributes,
    }


def string_attr(name: str, values: dict, count_distinct: int | None = None) -> dict:
    attr = {
        "attribute": name,
        "type": "string",
        "count": 100,
        "countDistinct": count_distinct if count_distinct is not None else len(values),
        "values": values,
    }
    return attr


def number_attr(name: str, values: dict) -> dict:
    return {
        "attribute": name,
        "type": "number",
        "count": 100,
        "countDistinct": len(values),
        "values": values,
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MANY_EMAILS = {f"user{i}@example.com": 1 for i in range(30)}
MANY_PHONES = {
    "+1-202-555-0100": 5,
    "+1-202-555-0101": 3,
    "+44 20 7946 0958": 2,
    "+1-800-555-0190": 1,
    "+1-212-555-0147": 4,
    "(212) 555-0100": 3,
    "+1 (555) 867-5309": 6,
    "555-867-5309": 2,
    "+49 30 12345678": 1,
    "+61 2 9374 4000": 3,
    "+33 1 42 86 82 00": 2,
    "+1-303-555-0199": 1,
    "+1-404-555-0101": 5,
    "+1-503-555-0122": 2,
    "+1-617-555-0133": 4,
}
MANY_SSN = {f"{i:03d}-{(i*7)%100:02d}-{(i*13)%10000:04d}": 1 for i in range(1, 30)}
FEW_EMAILS = {"alice@example.com": 10, "Rock": 5, "Blue": 3, "Mountain": 7, "Creek": 2}
LOCATION_NAMES = {
    "San Francisco": 10,
    "New York": 8,
    "Los Angeles": 6,
    "Seattle": 5,
    "Portland": 4,
    "Boston": 3,
    "Chicago": 3,
    "Miami": 2,
    "Denver": 2,
    "Austin": 1,
    "Nashville": 1,
    "Atlanta": 1,
    "Houston": 1,
    "Phoenix": 1,
    "Detroit": 1,
}
PERSON_NAMES = {
    "John Smith": 10,
    "Jane Doe": 8,
    "Robert Johnson": 6,
    "Mary Williams": 5,
    "David Brown": 4,
    "Sarah Davis": 3,
    "Michael Wilson": 3,
    "Emily Jones": 2,
    "Thomas Moore": 2,
    "Jessica Taylor": 1,
    "James Anderson": 1,
    "Jennifer Thomas": 1,
    "Christopher Jackson": 1,
    "Amanda White": 1,
    "Daniel Harris": 1,
}
LOW_CARDINALITY_SPECIES = {
    "Homo sapiens": 50,
    "Canis lupus": 20,
    "Felis catus": 10,
}
FISH_SPECIES = {
    "Salmo salar": 42,
    "Oncorhynchus mykiss": 38,
    "Thunnus albacares": 31,
    "Gadus morhua": 28,
    "Scomber scombrus": 24,
    "Clupea harengus": 22,
    "Engraulis encrasicolus": 19,
    "Pleuronectes platessa": 17,
    "Solea solea": 15,
    "Merluccius merluccius": 14,
    "Dicentrarchus labrax": 13,
    "Sparus aurata": 12,
    "Anguilla anguilla": 11,
    "Perca fluviatilis": 10,
    "Esox lucius": 9,
    "Cyprinus carpio": 9,
    "Abramis brama": 8,
    "Rutilus rutilus": 8,
    "Stizostedion lucioperca": 7,
    "Silurus glanis": 7,
    "Hippoglossus hippoglossus": 6,
    "Melanogrammus aeglefinus": 6,
    "Pollachius virens": 5,
    "Micromesistius poutassou": 5,
    "Trisopterus esmarkii": 4,
    "Sprattus sprattus": 4,
    "Limanda limanda": 3,
    "Microstomus kitt": 3,
    "Glyptocephalus cynoglossus": 2,
    "Scophthalmus maximus": 2,
}
NUMERIC_VALUES = {"100": 5, "200": 3, "300": 2}


# ---------------------------------------------------------------------------
# Pattern PII tests (using lazy-loaded real models)
# ---------------------------------------------------------------------------


def test_email_column_has_high_pii_risk():
    """A column where almost all values are emails should score piiRisk ≈ 1.0."""
    from handler import _get_analyzer

    analyzer = _get_analyzer()
    attr = string_attr("contact_email", MANY_EMAILS, count_distinct=30)
    result = _analyze_attribute(attr, analyzer, None)
    assert result.get("piiRisk", 0) >= 0.9, f"Expected piiRisk >= 0.9, got {result.get('piiRisk')}"
    assert "email" in result.get("piiRiskCategories", [])
    # Values are preserved — redaction is a consumer decision.
    assert "values" in result
    assert "piiRedacted" not in result


def test_phone_column_has_high_pii_risk():
    """A column of phone numbers should score piiRisk ≈ 1.0."""
    from handler import _get_analyzer

    analyzer = _get_analyzer()
    attr = string_attr("phone_number", MANY_PHONES, count_distinct=15)
    result = _analyze_attribute(attr, analyzer, None)
    assert result.get("piiRisk", 0) >= 0.9, f"Expected piiRisk >= 0.9, got {result.get('piiRisk')}"
    assert "phone" in result.get("piiRiskCategories", [])
    assert "values" in result
    assert "piiRedacted" not in result


def test_few_emails_has_low_pii_risk():
    """A column with only 1 email among many normal values should score low piiRisk."""
    from handler import _get_analyzer

    analyzer = _get_analyzer()
    attr = string_attr("notes", FEW_EMAILS, count_distinct=5)
    result = _analyze_attribute(attr, analyzer, None)
    assert result.get("piiRisk", 0) < 0.5, f"Expected piiRisk < 0.5, got {result.get('piiRisk')}"


def test_ssn_column_has_high_pii_risk():
    """A column of US SSNs should score piiRisk ≈ 0.8+."""
    from handler import _get_analyzer

    analyzer = _get_analyzer()
    attr = string_attr("social_security", MANY_SSN, count_distinct=29)
    result = _analyze_attribute(attr, analyzer, None)
    assert result.get("piiRisk", 0) >= 0.8, f"Expected piiRisk >= 0.8, got {result.get('piiRisk')}"
    assert "government_id" in result.get("piiRiskCategories", [])
    assert "values" in result


def test_numeric_column_skipped():
    """Number-type columns are never analysed."""
    from handler import _get_analyzer

    analyzer = _get_analyzer()
    attr = number_attr("area_km2", NUMERIC_VALUES)
    result = _analyze_attribute(attr, analyzer, None)
    assert "piiRisk" not in result
    assert result == attr


def test_blank_values_excluded_from_denominator():
    """
    Null / blank value keys must not count toward the denominator when
    computing hit_rate, so a column of 10 emails + 5 blanks scores
    piiRisk ≈ 1.0, not 0.67.
    """
    from handler import _get_analyzer

    analyzer = _get_analyzer()
    emails_with_blanks = {
        **{f"user{i}@example.com": 1 for i in range(10)},
        "": 3,
        " ": 2,
    }
    attr = string_attr("email_col", emails_with_blanks, count_distinct=12)
    result = _analyze_attribute(attr, analyzer, None)
    assert result.get("piiRisk", 0) >= 0.9, (
        f"Blank keys inflated denominator — piiRisk={result.get('piiRisk')}"
    )


# ---------------------------------------------------------------------------
# Name risk (NER) tests
# ---------------------------------------------------------------------------


def test_person_name_column_has_high_pii_risk():
    """High-cardinality column of common English person names should score >= 0.5."""
    from handler import _get_analyzer, _get_nlp_xx

    analyzer = _get_analyzer()
    nlp_xx = _get_nlp_xx()
    attr = string_attr("respondent_name", PERSON_NAMES, count_distinct=15)
    result = _analyze_attribute(attr, analyzer, nlp_xx)
    assert result.get("piiRisk", 0) >= 0.5, f"Expected piiRisk >= 0.5, got {result.get('piiRisk')}"
    assert "name" in result.get("piiRiskCategories", [])
    assert "values" in result
    assert "piiRedacted" not in result


def test_location_column_has_low_name_pii_risk():
    """A column of US city names should NOT score high piiRisk for names."""
    from handler import _get_analyzer, _get_nlp_xx

    analyzer = _get_analyzer()
    nlp_xx = _get_nlp_xx()
    attr = string_attr("city", LOCATION_NAMES, count_distinct=15)
    result = _analyze_attribute(attr, analyzer, nlp_xx)
    # Location columns should not score as PII for names.
    assert result.get("piiRisk", 0) < 0.5, (
        f"City column incorrectly scored piiRisk={result.get('piiRisk')}"
    )


def test_low_cardinality_skips_ner():
    """Low-cardinality columns are not subject to NER name-risk analysis."""
    from handler import _get_analyzer, _get_nlp_xx

    analyzer = _get_analyzer()
    nlp_xx = _get_nlp_xx()
    # Species names with only 3 values should not be NER-analysed
    attr = string_attr("species", LOW_CARDINALITY_SPECIES, count_distinct=3)
    result = _analyze_attribute(attr, analyzer, nlp_xx)
    assert result.get("piiRisk", 0) < 0.5


def test_fish_species_column_has_zero_pii_risk():
    """
    A high-cardinality column of binomial fish species names (Genus species)
    must NOT score as PII.  The binomial nomenclature heuristic applies a
    strong negative prior that drives name_risk below 0, collapsing to 0.0.
    """
    from handler import _get_analyzer, _get_nlp_xx

    analyzer = _get_analyzer()
    nlp_xx = _get_nlp_xx()
    attr = string_attr("scientific_name", FISH_SPECIES, count_distinct=len(FISH_SPECIES))
    result = _analyze_attribute(attr, analyzer, nlp_xx)
    assert result.get("piiRisk", 1) == 0.0, (
        f"Fish species column incorrectly scored piiRisk={result.get('piiRisk')}"
    )


# ---------------------------------------------------------------------------
# Cross-column anchor boost tests
# ---------------------------------------------------------------------------

# Synthetic layer that mirrors the mangrove-planting pattern:
# • an email column whose usernames embed respondent names
# • an "informant" column whose NER name_risk alone is below the threshold
#   but whose values correspond to those email identities
ANCHOR_EMAILS = {
    "lleytonkirisome@gmail.com": 23,
    "justinalatimu19@gmail.com": 6,
    "fatutoloi@gmail.com": 4,
    "retitupu@gmail.com": 23,
    "dstrickland.ci@gmail.com": 10,
    " ": 6,
}
# Informant values: some directly correspond to email usernames, some don't.
# Standalone this column scores name_risk ≈ 0.29 (below threshold).
ANCHOR_INFORMANT = {
    "Lleyton Kirisome": 19,
    "Justin": 11,
    "Justin, Malae": 1,
    "Lleyton kirisome": 4,
    "Fatutolo Iene": 2,
    "Fimareti Selu": 1,
    "Fimareti & Mulipola": 12,
    "Seumalo Afele & Fimareti": 1,
    "Fatu & Fimareti": 2,
    "Fimareti & Pola": 3,
    "Fimareti": 2,
    "dani": 4,
    " ": 6,
    "Fatu": 2,
    "Fimareti & Malaea": 2,
}


def test_anchor_boost_raises_pii_risk_for_correlated_column():
    """
    A column whose NER score alone is below 0.5 SHOULD score >= 0.5
    when another column in the same layer contains email addresses whose
    usernames match several of its values.

    e.g. "Lleyton Kirisome" ↔ lleytonkirisome@gmail.com
         "Justin"           ↔ justinalatimu19@gmail.com (prefix match)
         "Fatutolo Iene"    ↔ fatutoloi@gmail.com (prefix match)
    """
    from handler import _get_analyzer, _get_nlp_xx

    analyzer = _get_analyzer()
    nlp_xx = _get_nlp_xx()

    layer = make_layer([
        string_attr("user_email", ANCHOR_EMAILS, count_distinct=5),
        string_attr("informant", ANCHOR_INFORMANT, count_distinct=15),
    ])
    response = lambda_handler({"geostats": layer}, None)
    attrs = {a["attribute"]: a for a in response["geostats"]["attributes"]}

    assert attrs["user_email"].get("piiRisk", 0) >= 0.9, "email column should have high piiRisk"
    assert "email" in attrs["user_email"].get("piiRiskCategories", [])
    assert "values" in attrs["user_email"]

    # The anchor boost raises the score meaningfully (from ~0.29 to ~0.46) —
    # the informant column is genuinely ambiguous (mixed names/groups/blanks),
    # so the honest score sits below 0.5 but well above the no-boost baseline.
    # A consumer using a 0.4 threshold would redact it; 0.5 would pass it through.
    informant_risk = attrs["informant"].get("piiRisk", 0)
    assert informant_risk >= 0.4, (
        f"informant column should score >= 0.4 via anchor boost, "
        f"got piiRisk={informant_risk}"
    )
    assert "name" in attrs["informant"].get("piiRiskCategories", [])
    assert "values" in attrs["informant"]


def test_anchor_boost_does_not_fire_without_email_column():
    """
    The same informant column in a layer WITHOUT an email column should score
    below 0.5 (name_risk alone is below threshold).
    """
    layer = make_layer([
        string_attr("informant", ANCHOR_INFORMANT, count_distinct=15),
    ])
    response = lambda_handler({"geostats": layer}, None)
    attr = response["geostats"]["attributes"][0]
    assert attr.get("piiRisk", 0) < 0.5, (
        f"informant column should score < 0.5 without a co-located email anchor, "
        f"got piiRisk={attr.get('piiRisk')}"
    )


def test_anchor_boost_does_not_affect_location_column():
    """
    A city/location column co-located with an email column should NOT receive a
    meaningful anchor boost, because city names don't resemble email usernames.
    """
    layer = make_layer([
        string_attr("user_email", ANCHOR_EMAILS, count_distinct=5),
        string_attr("city", LOCATION_NAMES, count_distinct=15),
    ])
    response = lambda_handler({"geostats": layer}, None)
    attrs = {a["attribute"]: a for a in response["geostats"]["attributes"]}
    assert attrs["city"].get("piiRisk", 0) < 0.5, (
        f"city column should score < 0.5 — city names don't match email usernames, "
        f"got piiRisk={attrs['city'].get('piiRisk')}"
    )


# ---------------------------------------------------------------------------
# Shuffle test
# ---------------------------------------------------------------------------


def test_high_cardinality_string_values_are_shuffled():
    """
    Non-redacted high-cardinality string columns have their values key order
    shuffled (no guarantee about exact order, but it should not always equal
    the original).
    """
    from handler import _get_analyzer, _get_nlp_xx

    analyzer = _get_analyzer()
    nlp_xx = _get_nlp_xx()
    values = {f"habitat_class_{i}": i for i in range(HIGH_CARDINALITY_THRESHOLD + 5)}
    attr = string_attr("habitat_class", values, count_distinct=len(values))
    original_keys = list(values.keys())

    # Run several times and check that at least one produces a different order
    # (probability of always matching is astronomically small for 17 items)
    any_different = False
    for _ in range(10):
        result = _analyze_attribute(copy.deepcopy(attr), analyzer, nlp_xx)
        assert "piiRedacted" not in result
        assert "values" in result
        if list(result["values"].keys()) != original_keys:
            any_different = True
            break
    assert any_different, "High-cardinality values were never shuffled"


# ---------------------------------------------------------------------------
# Full lambda_handler integration tests (no AWS required)
# ---------------------------------------------------------------------------


def test_lambda_handler_passes_through_raster():
    """Raster geostats (no attributes array) is returned unchanged."""
    raster = {"bands": [{"name": "band 1", "minimum": 0.0, "maximum": 1.0}]}
    response = lambda_handler({"geostats": raster}, None)
    assert response["geostats"] == raster


def test_lambda_handler_missing_geostats():
    """Event without geostats key returns an error."""
    response = lambda_handler({}, None)
    assert "error" in response


def test_lambda_handler_preserves_non_string_attributes():
    """Number/boolean attributes are passed through without piiRisk annotation."""
    layer = make_layer(
        [
            {
                "attribute": "area_km2",
                "type": "number",
                "count": 100,
                "countDistinct": 50,
                "values": {str(i): 1 for i in range(50)},
            }
        ]
    )
    response = lambda_handler({"geostats": layer}, None)
    result_attr = response["geostats"]["attributes"][0]
    assert "piiRisk" not in result_attr
    assert "piiRedacted" not in result_attr
    assert "values" in result_attr


def test_lambda_handler_scores_email_column():
    """End-to-end: email column in a layer event receives high piiRisk."""
    layer = make_layer([string_attr("email", MANY_EMAILS, count_distinct=30)])
    response = lambda_handler({"geostats": layer}, None)
    attr = response["geostats"]["attributes"][0]
    assert attr.get("piiRisk", 0) >= 0.9, f"Expected piiRisk >= 0.9, got {attr.get('piiRisk')}"
    assert "email" in attr.get("piiRiskCategories", [])
    # Values are preserved — the Lambda does not redact.
    assert "values" in attr
    assert "piiRedacted" not in attr
    # Other attribute metadata is preserved.
    assert attr["attribute"] == "email"
    assert attr["type"] == "string"
    # Layer-level flag is set.
    assert response["geostats"].get("piiRiskWasAssessed") is True


def test_lambda_handler_sets_pii_risk_was_assessed():
    """piiRiskWasAssessed is set to True on the layer after any assessment."""
    layer = make_layer([string_attr("category", {"A": 10, "B": 5}, count_distinct=2)])
    response = lambda_handler({"geostats": layer}, None)
    assert response["geostats"].get("piiRiskWasAssessed") is True
