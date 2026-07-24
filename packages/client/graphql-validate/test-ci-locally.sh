#!/usr/bin/env bash
# Simulate the GitHub Actions api_ready_gate GraphQL validation step as closely
# as possible on a developer machine.
#
# Usage (from repo root or this directory):
#   packages/client/graphql-validate/test-ci-locally.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GATE="$ROOT/packages/client/graphql-validate"
CLIENT_NM="$ROOT/packages/client/node_modules"
ENDPOINT="${GRAPHQL_ENDPOINT:-https://api.seasket.ch/graphql}"

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

echo "==> Simulating api_ready_gate (endpoint=$ENDPOINT)"
echo

echo "=== 1) Preconditions ==="
[[ -f "$GATE/package.json" ]] || fail "missing package.json"
[[ -f "$GATE/package-lock.json" ]] || fail "missing package-lock.json"
[[ -f "$GATE/validate.js" ]] || fail "missing validate.js"
rg -q "cache-dependency-path: packages/client/graphql-validate/package-lock.json" \
  "$ROOT/.github/workflows/deploy.yml" || fail "workflow missing cache-dependency-path"
rg -q "working-directory: ./packages/client/graphql-validate" \
  "$ROOT/.github/workflows/deploy.yml" || fail "workflow missing working-directory"
rg -q "npm ci" "$ROOT/.github/workflows/deploy.yml" || fail "workflow missing npm ci"
rg -q "node ./validate.js" "$ROOT/.github/workflows/deploy.yml" || fail "workflow missing node ./validate.js"
pass "files and workflow paths look correct"

echo
echo "=== 2) Clean npm ci (like Actions after cache restore) ==="
rm -rf "$GATE/node_modules"
(
  cd "$GATE"
  npm ci
)
[[ -d "$GATE/node_modules/graphql" ]] || fail "graphql not installed by npm ci"
GATE_GQL_VERSION="$(node -e "console.log(require('$GATE/node_modules/graphql/package.json').version)")"
[[ "$GATE_GQL_VERSION" == "15.3.0" ]] || fail "expected graphql 15.3.0, got $GATE_GQL_VERSION"
pass "npm ci installed graphql@$GATE_GQL_VERSION"

echo
echo "=== 3) Hide client node_modules to match a fresh CI checkout ==="
HIDE_DIR=""
if [[ -d "$CLIENT_NM" ]]; then
  HIDE_DIR="$(mktemp -d)"
  mv "$CLIENT_NM" "$HIDE_DIR/node_modules"
  trap 'mv "$HIDE_DIR/node_modules" "$CLIENT_NM"; rmdir "$HIDE_DIR" 2>/dev/null || true' EXIT
  pass "moved packages/client/node_modules aside"
else
  pass "packages/client/node_modules already absent"
fi

echo
echo "=== 4) Run validator exactly as workflow ==="
(
  cd "$GATE"
  GRAPHQL_ENDPOINT="$ENDPOINT" node ./validate.js
)
RESOLVED="$(
  cd "$GATE"
  node -e "console.log(require.resolve('graphql'))"
)"
[[ "$RESOLVED" == *"/graphql-validate/node_modules/graphql"* ]] \
  || fail "graphql resolved outside gate package: $RESOLVED"
pass "validator succeeded using $RESOLVED"

echo
echo "=== 5) Failure mode: unknown field must exit non-zero ==="
BAD_ROOT="$(mktemp -d)"
mkdir -p "$BAD_ROOT/src/queries"
cp "$ROOT/packages/client/src/queries/isSuperuser.graphql" "$BAD_ROOT/src/queries/"
cat > "$BAD_ROOT/src/queries/__gate_probe_bad.graphql" <<'EOF'
query GateProbeShouldFail {
  __typename
  thisFieldDefinitelyDoesNotExistOnQuery
}
EOF
# Point DOCUMENTS_ROOT at BAD_ROOT/src by running a copy with patched __dirname layout:
# graphql-validate/validate.js uses ../src relative to itself, so place a copy
# next to a fake src/.
mkdir -p "$BAD_ROOT/graphql-validate"
cp "$GATE/validate.js" "$BAD_ROOT/graphql-validate/validate.js"
ln -s "$GATE/node_modules" "$BAD_ROOT/graphql-validate/node_modules"
set +e
(
  cd "$BAD_ROOT/graphql-validate"
  GRAPHQL_ENDPOINT="$ENDPOINT" node ./validate.js
)
BAD_EXIT=$?
set -e
rm -rf "$BAD_ROOT"
[[ "$BAD_EXIT" -ne 0 ]] || fail "expected non-zero exit for invalid query, got 0"
pass "invalid query failed as expected (exit=$BAD_EXIT)"

echo
echo "=== 6) Endpoint smoke ==="
curl -sS -o /tmp/gql-introspect.json -w "http=%{http_code} time=%{time_total}\n" \
  -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ __schema { queryType { name } } }"}' \
  | tee /tmp/gql-curl.out
node -e "const j=require('/tmp/gql-introspect.json'); if(!j.data?.__schema?.queryType) process.exit(1);"
pass "live endpoint introspection ok"

echo
echo "=== 7) Second npm ci (idempotent / warm cache path) ==="
(
  cd "$GATE"
  npm ci
  GRAPHQL_ENDPOINT="$ENDPOINT" node ./validate.js
)
pass "second npm ci + validate ok"

echo
echo "ALL LOCAL api_ready_gate CHECKS PASSED"
