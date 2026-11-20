# AO Intelligence backend (Cloudflare Worker)

Handles everything that needs a secret or a server: other email (IMAP), TrueLayer Open Banking, Stripe, Shopify, CalDAV, `.ics` links, Calendly and optional AI drafts. **Not deployed yet.** The website works without it (those connections show sample data). Provider-by-provider setup is in the main `../README.md`.

## Design

- **Stateless.** The Worker stores nothing. After a successful connect it returns an encrypted **sealed** string (AES-GCM, key = `SEAL_KEY`). The browser keeps it and sends it back with each `/data/*` call.
- **Read-only.** IMAP is opened with `EXAMINE`, there is no SMTP, and drafts are saved with `APPEND` into the Drafts folder. Stripe/Shopify/TrueLayer use read scopes only.
- **Locked down.** CORS answers only `ALLOWED_ORIGIN`. OAuth `state` is HMAC-signed and expires in 15 minutes. `return_to` must be under `FRONTEND_URL`. Outbound hosts are checked (no private/loopback addresses). IMAP is TLS port 993 only.
- IMAP works in a Worker through `cloudflare:sockets` (outbound TCP). The client is hand-written (`src/imap.js`) and tested against a fake server only.

## Deploy

```bash
cd backend
npm install
npx wrangler login
npx wrangler secret put SEAL_KEY            # openssl rand -base64 48 — keep it; changing it disconnects everyone
# optional, per provider:
npx wrangler secret put TRUELAYER_CLIENT_ID
npx wrangler secret put TRUELAYER_CLIENT_SECRET
npx wrangler secret put STRIPE_CONNECT_CLIENT_ID   # + STRIPE_SECRET_KEY (Connect OAuth)
npx wrangler secret put SHOPIFY_API_KEY            # + SHOPIFY_API_SECRET (OAuth install)
npx wrangler secret put AI_API_URL                 # + AI_API_KEY, AI_MODEL (optional drafts)
npx wrangler deploy
curl https://<worker>.workers.dev/health          # shows which features are on
```

Then put the URL in `../js/config.js` as `backendUrl`. Local dev: `npx wrangler dev` with `ALLOW_LOCALHOST=1`.

## Secrets and variables

| Name | Needed for |
| --- | --- |
| `SEAL_KEY` (secret, ≥16 chars) | everything |
| `TRUELAYER_CLIENT_ID`, `TRUELAYER_CLIENT_SECRET` | bank connections; `TRUELAYER_ENV` var = `sandbox` or `live` |
| `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_SECRET_KEY` | Stripe Connect sign-in (not needed for pasted restricted keys) |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` | Shopify OAuth install (not needed for Dev Dashboard client credentials or pasted tokens) |
| `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` | optional smarter drafts |
| `ALLOWED_ORIGIN`, `FRONTEND_URL`, `ALLOW_LOCALHOST` | already set in `wrangler.toml` |

## Endpoints

`GET /health` · `POST /imap/connect` · `/ics/connect` · `/caldav/connect` · `/calendly/connect` · `/stripe/connect` · `/shopify/connect` (pasted credentials, client credentials or token) · `GET /stripe/start|callback` · `/shopify/start|callback` · `/truelayer/start|callback` (OAuth, redirect back with the sealed token in the URL fragment) · `POST /data/mail|calendar|bank|sales` · `/mail/draft` (IMAP drafts) · `/ai/draft`.

## Tests

`npm test` (or `node --test test/*.test.js` from here). Uses a fake IMAP server and injected `fetch`, so no network or credentials are needed.

## Limits and next steps

- Free Worker plan: 100,000 requests/day and a short CPU limit per request. IMAP fetches are capped at a small number of recent messages to stay inside it.
- Sealed tokens in the browser are fine for a trial. For many customers store them server-side (Cloudflare D1/KV) keyed to real user accounts.
- TrueLayer live mode requires a licence or FCA-regulated partner (see the main README).
