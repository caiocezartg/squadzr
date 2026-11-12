#!/usr/bin/env bash
# Runs the load test's data script (data.ts) inside the Railway `api` service, where DATABASE_URL and
# BETTER_AUTH_SECRET already exist, so neither leaves the service. Usage:
#   railway-data.sh provision --tag <tag> --count <N>
#   railway-data.sh cleanup [--tag <tag>]
#   railway-data.sh verify [--tag <tag>]
# Run it from a directory linked to the project (`railway link`); RAILWAY_BIN names the CLI if it is not
# `railway` on the PATH. The script is bundled here, sent over stdin and deleted from the container after.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
railway="${RAILWAY_BIN:-railway}"
bundle="$(mktemp)"
trap 'rm -f "$bundle"' EXIT

bun build "$here/data.ts" --target bun --external pg --external zod --outfile "$bundle" > /dev/null

remote='f=server/.load-test-data.js; trap "rm -f $f" EXIT; cat > $f && cd server && bun --no-env-file .load-test-data.js '"$*"
"$railway" ssh --service api -- "$remote" < "$bundle"
