#!/usr/bin/env bash
# One-command deploy of the AO Intelligence backend to Cloudflare Workers (free plan is fine).
#
#   CLOUDFLARE_API_TOKEN=...  CLOUDFLARE_ACCOUNT_ID=...  ./deploy.sh
#
# What it does, in order (safe to re-run any time):
#   1. creates the encryption ("sealing") secret once and keeps it in backend/.secrets/seal-key (git-ignored)
#   2. makes sure your account has a workers.dev address (creates one if it doesn't)
#   3. deploys the Worker, then stores the sealing secret on it
#   4. checks /health, and writes the Worker's address into ../js/config.js (backendUrl)
# It never touches Cloudflare resources other than the Worker "ao-intelligence-api".
# Set DRY_RUN=1 to see the plan without calling Cloudflare.
set -euo pipefail
cd "$(dirname "$0")"

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN (see backend/README.md for the token to create)}"
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID (the 32-character Account ID from the Cloudflare dashboard)}"
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
NAME="ao-intelligence-api"
API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}"
say() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a==null?a:a[k],j);console.log(v==null?"":v)}catch(e){console.log("")}})' "$1"; }

say "1/4  Sealing secret"
mkdir -p .secrets
if [ ! -s .secrets/seal-key ]; then
  (umask 077; openssl rand -base64 48 | tr -d '\n' > .secrets/seal-key)
  echo "Generated a new sealing secret in backend/.secrets/seal-key — keep a copy; losing it disconnects everyone."
else
  echo "Using the existing sealing secret."
fi

if [ "${DRY_RUN:-0}" = "1" ]; then
  say "DRY RUN — would: ensure a workers.dev subdomain, 'wrangler deploy', 'wrangler secret put SEAL_KEY', check /health, patch ../js/config.js"
  npx --yes wrangler deploy --dry-run --outdir /tmp/ao-dry >/dev/null && echo "Worker bundle builds fine."
  exit 0
fi

[ -d node_modules/wrangler ] || npm install --no-audit --no-fund

say "2/4  workers.dev address"
SUB="$(curl -fsS -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "${API}/workers/subdomain" | jget result.subdomain || true)"
if [ -z "$SUB" ]; then
  SUB="ao-$(openssl rand -hex 4)"
  echo "No workers.dev subdomain yet — registering '${SUB}'."
  curl -fsS -X PUT -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "content-type: application/json" \
    --data "{\"subdomain\":\"${SUB}\"}" "${API}/workers/subdomain" >/dev/null
fi
URL="https://${NAME}.${SUB}.workers.dev"
echo "Address: ${URL}"

say "3/4  Deploy"
npx wrangler deploy
npx wrangler secret put SEAL_KEY < .secrets/seal-key
# Optional extras, only if you set them in the environment when running this script:
for v in TRUELAYER_CLIENT_ID TRUELAYER_CLIENT_SECRET STRIPE_CONNECT_CLIENT_ID STRIPE_SECRET_KEY SHOPIFY_API_KEY SHOPIFY_API_SECRET AI_API_URL AI_API_KEY AI_MODEL; do
  if [ -n "${!v:-}" ]; then printf '%s' "${!v}" | npx wrangler secret put "$v"; fi
done

say "4/4  Check"
ok=""
for i in 1 2 3 4 5 6 7 8; do
  H="$(curl -fsS -m 10 "${URL}/health" 2>/dev/null || true)"
  if [ "$(printf '%s' "$H" | jget ok)" = "true" ]; then ok=1; break; fi
  sleep 4
done
if [ -z "$ok" ]; then echo "The Worker deployed but /health isn't answering yet (new workers.dev addresses can take a minute). Try: curl ${URL}/health"; fi
echo "$H"

CONFIG="../js/config.js"
if [ -f "$CONFIG" ]; then
  sed -i.bak -E "s#backendUrl: \"[^\"]*\"#backendUrl: \"${URL}\"#" "$CONFIG" && rm -f "${CONFIG}.bak"
  echo "Updated ${CONFIG} → backendUrl: \"${URL}\""
fi
say "Done. Backend: ${URL}"
echo "Next: commit and push js/config.js so the website uses it:  git add js/config.js && git commit -m 'Point the app at the backend' && git push"
