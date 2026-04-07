#!/usr/bin/env bash
# Run a geostats JSON file through the PII risk classifier and print a summary.
#
# Usage:
#   ./classify.sh <path-to-geostats.json>
#
# The file may be:
#   - A raw GeostatsLayer:         { "layer": "...", "attributes": [...] }
#   - An ai-data-analyst fixture:  { "filename": "...", "geostats": { ... } }
#
# A human-readable score summary is printed to stderr.
# stdout is the full Lambda response JSON: { "geostats": <annotated GeostatsLayer> }.
# Pipe examples:
#   ./classify.sh foo.json | jq '[.geostats.attributes[] | {name:.attribute, risk:.piiRisk}]'
#
# Requires the production image to be built first (make build).

set -euo pipefail

FILE="${1:-}"
if [[ -z "$FILE" ]]; then
  echo "Usage: $0 <geostats-json-file>" >&2
  exit 1
fi
if [[ ! -f "$FILE" ]]; then
  echo "Error: file not found: $FILE" >&2
  exit 1
fi

ABS="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"

docker run --rm -i \
  -v "${ABS}:/input.json:ro" \
  --entrypoint python \
  geostats-pii-classifier:local - << 'PYEOF'
import json, sys
sys.path.insert(0, '/var/task')
from handler import lambda_handler

with open('/input.json') as f:
    payload = json.load(f)

# Accept both a raw GeostatsLayer and the ai-data-analyst fixture wrapper
geostats = payload.get('geostats', payload)
# fixture wrapper may contain a list
if isinstance(geostats, list):
    geostats = geostats[0]

result = lambda_handler({'geostats': geostats}, None)

# Human-readable summary → stderr
output = result.get('geostats', result)
if isinstance(output, dict) and 'attributes' in output:
    attrs = output['attributes']
    layer = output.get('layer', '(unknown)')
    assessed = output.get('piiRiskWasAssessed', False)

    scored = [(a['attribute'], a.get('piiRisk', 0), a.get('piiRiskCategories', []))
              for a in attrs if 'piiRisk' in a]
    scored.sort(key=lambda x: x[1], reverse=True)
    unscored = [a['attribute'] for a in attrs if 'piiRisk' not in a]

    print(f'\n  Layer   : {layer}', file=sys.stderr)
    print(f'  Assessed: {assessed}', file=sys.stderr)
    print(f'  Columns : {len(attrs)} total, {len(scored)} scored, {len(unscored)} skipped (non-string/empty)\n', file=sys.stderr)

    if scored:
        print(f'  {"Column":<32s}  {"piiRisk":>8}  Categories', file=sys.stderr)
        print(f'  {"-"*32}  {"-"*8}  {"-"*20}', file=sys.stderr)
        for name, risk, cats in scored:
            bar = '█' * int(risk * 10)
            cats_str = ', '.join(cats) if cats else ''
            flag = '  ← HIGH' if risk >= 0.5 else ('  ← moderate' if risk >= 0.3 else '')
            print(f'  {name:<32s}  {risk:>8.3f}  {bar:<10s} {cats_str}{flag}', file=sys.stderr)

    if unscored:
        print(f'\n  Skipped (non-string or no values): {", ".join(unscored[:10])}{"…" if len(unscored) > 10 else ""}', file=sys.stderr)

    print('', file=sys.stderr)

# Full annotated JSON → stdout
print(json.dumps(result, indent=2))
PYEOF
