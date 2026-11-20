# AO Intelligence backend (Cloudflare Worker)

Handles everything that needs a secret or a server: other email (IMAP), TrueLayer Open Banking, Stripe, Shopify, CalDAV, `.ics` links, Calendly and optional AI drafts. **Not deployed yet.** The website works without it (those connections show sample data). Provider-by-provider setup is in the main `../README.md`.

## Design

- **Stateless.** The Worker stores nothing. After a successful connect it returns an encrypted **sealed** string (AES-GCM, key = `SEAL_KEY`). The browser keeps it and sends it back with each `/data/*` call.
- **Read-only.** IMAP is opened with `EXAMINE`, there is no SMTP, and drafts are saved with `APPEND` into the Drafts folder. Stripe/Shopify/TrueLayer use read scopes only.
- **Locked down.** CORS answers only `ALLOWED_ORIGIN`. OAuth `state` is HMAC-signed and expires in 15 minutes. `return_to` must be under `FRONTEND_URL`. Outbound hosts are checked (no private/loopback addresses). IMAP is TLS port 993 only.
- IMAP works in a Worker through `cloudflare:sockets` (outbound TCP). The client is hand-written (`src/imap.js`) and tested against a fake server only.

## Deploy (one command)

You need a free Cloudflare account and two values:

1. **Account ID**: Cloudflare dashboard → Workers & Pages → the "Account ID" shown on the right (32 characters).
2. **API token**: dashboard → My Profile → API Tokens → Create Token → use the **"Edit Cloudflare Workers"** template. Account Resources: Include → your account. Zone Resources: **All zones** (the template asks; you have none). Needed permissions in that template: Workers Scripts: Edit, Workers Routes: Edit (not used), Account Settings: Read, and User Details: Read. If you build a custom token instead, grant at least Account → Workers Scripts: Edit and Account → Account Settings: Read. The workers.dev address is created through the same token (Workers Scripts: Edit covers it).

```bash
cd backend
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... ./deploy.sh
```

`deploy.sh` generates the sealing secret once (`.secrets/seal-key`, git-ignored; keep a copy because changing it disconnects everyone), registers a workers.dev address if the account has none, deploys the Worker, stores the secret, checks `/health` and writes `backendUrl` into `../js/config.js`. Commit and push `js/config.js` afterwards. Run it again at any time to update the Worker. `DRY_RUN=1 ./deploy.sh` builds without calling Cloudflare.

Optional extras (TrueLayer, Stripe Connect, Shopify OAuth, AI drafts) are picked up from the environment when you run the script, e.g. `TRUELAYER_CLIENT_ID=… TRUELAYER_CLIENT_SECRET=… ./deploy.sh`. None are needed for email, calendar links, Stripe keys or statements.

Local dev: `npx wrangler dev` (put `SEAL_KEY=...` and `ALLOW_LOCALHOST=1` in `.dev.vars`). Outbound IMAP needs real network access to port 993.

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
