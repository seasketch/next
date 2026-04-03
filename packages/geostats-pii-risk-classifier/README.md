# geostats-pii-risk-classifier

A Python Lambda (container-based) that scans a `GeostatsLayer` for PII risk before it is sent to OpenAI by `@seasketch/ai-data-analyst`. It uses [Microsoft Presidio](https://microsoft.github.io/presidio/) for pattern-based detection (emails, phone numbers, SSNs, credit cards, etc.) and spaCy's multilingual NER model for person-name columns. Each string attribute is annotated with a `piiRisk` score (0–1) and a list of `piiRiskCategories`. Actual redaction of `values` from the LLM payload is a separate policy decision made by `ai-data-analyst` based on a configurable threshold (default 0.5). The classifier also does a cross-column pass: if a column is confirmed as email PII, columns whose values match the local-part of those email addresses get a boosted name-risk score.

---

## Run locally

Requires Docker. Your system Python may be too new for spaCy — the Makefile handles everything inside the container.

```bash
cd packages/geostats-pii-risk-classifier

make build        # build production image (~5–10 min first time; cached after)
make test         # run Python pytest suite + ai-data-analyst Vitest suite
```

Try it against any geostats file:

```bash
./classify.sh path/to/geostats.json          # score summary to stderr, annotated JSON to stdout
./classify.sh path/to/geostats.json > /dev/null  # summary only

# Or via make (auto-builds the image first):
make classify FILE=../ai-data-analyst/__tests__/geostats/mangrove-planting.json
```

Start a local Lambda endpoint for interactive testing:

```bash
make serve   # starts RIE at http://localhost:9000/...
make invoke  # sends tests/fixtures/email-layer.json in another terminal
```

---

## Deploy

The Lambda is deployed as part of the SeaSketch CDK app. It is wired up in `packages/infra` — `GeostatsPiiClassifierLambdaStack` builds the Docker image from this directory and `UploadHandlerLambdaStack` receives the function ARN as `GEOSTATS_PII_CLASSIFIER_ARN` with an `InvokeFunction` IAM grant.

```bash
cd packages/infra
npx cdk deploy SeaSketchGeostatsPiiClassifier
npx cdk deploy SpatialUploadHandler
```

If Lambda logs show **`Runtime.InvalidEntrypoint`**, the usual cause is an **arm64** image deployed to the default **x86_64** Lambda runtime (common when the Docker image is built on Apple Silicon). The Dockerfile pins `linux/amd64`; redeploy so CDK rebuilds the asset.

The PII classifier is opt-in at runtime: the upload handler only calls it when `GEOSTATS_PII_CLASSIFIER_ARN` is set. Removing that env var (or not deploying the stack) disables classification entirely without affecting uploads.

### Response shape (persisting / backfill)

The Lambda returns a complete `GeostatsLayer` JSON object under `geostats`, not a delta—persist it as the layer you store. The **upload** pipeline sends the full computed geostats; the classifier limits how many distinct values it *scores* per column internally (`MAX_VALUES_PER_ATTRIBUTE` in `handler.py`).

### Enabling from the API server (`packages/api`)

The graphile-worker jobs that process uploads run inside the API server, so the same env var works there too. Add it to `packages/api/.env` alongside the other Lambda ARNs:

```bash
# packages/api/.env
GEOSTATS_PII_CLASSIFIER_ARN=arn:aws:lambda:us-west-2:<account-id>:function:GeostatsPiiClassifier
```

The ARN is printed by `cdk deploy SeaSketchGeostatsPiiClassifier` and is also visible in the AWS Lambda console. The API server's IAM role needs `lambda:InvokeFunction` on the classifier — this grant is already wired in `UploadHandlerLambdaStack`, but if you're running the API server locally against a deployed Lambda you'll need the credentials in your environment to have that permission (`AWS_REGION` is already set to `us-west-2` in the template).

---

## Tuning

All thresholds are named constants at the top of `handler.py`. The most useful ones:

| Constant | Default | Effect |
|---|---|---|
| `PATTERN_MIN_HITS` | `2` | Minimum number of pattern-matched values before pattern risk is non-zero |
| `NAME_RISK_MIN_PER_RATE` | `0.30` | Minimum fraction of values containing a PERSON entity before name risk is non-zero |
| `ANCHOR_EMAIL_MIN_RISK` | `0.40` | Minimum email `piiRisk` before a column can act as an anchor for cross-column boost |
| `ENABLE_CROSS_COLUMN_ANCHOR_BOOST` | `True` | Toggle the two-pass email-anchor boost |
| `MAX_VALUES_PER_ATTRIBUTE` | `100` | Maximum number of distinct non-blank values analyzed per column |
