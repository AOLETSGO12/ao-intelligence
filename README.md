# AO Intelligence — front-end prototype

A white-label “managed AI agent” service for small businesses, as a static website you can host free on GitHub Pages. A public copy is hosted at [https://aoletsgo12.github.io/ao-intelligence/](https://aoletsgo12.github.io/ao-intelligence/).

**It is a working app, not a demo.** `app.html` / `start.html` start empty and show only what you connect or type in. There is no sample data, and no fake numbers. If a source isn't connected, the screen says so. (Add `?demo=1` to the URL for the old sample-data tour, and `?demo=0` to go back.)

### What works today

| Area | How you connect it |
| --- | --- |
| Gmail and Google Calendar | **One sign-in** (press Connect, sign in, press Allow). Needs `google.clientId` in `js/config.js`. Until it's set, the button says "Sign-in is being switched on" and Gmail offers an **app password** (IMAP) and Google Calendar a **secret iCal link**. Both fallbacks hide themselves once the client ID is set. |
| Outlook, Hotmail, Microsoft 365 | **One sign-in** for mail and calendar (Microsoft Graph). Needs `microsoft.clientId`. Microsoft no longer allows passwords for Outlook mail, so mail waits for this sign-in. The calendar can use a published ICS link meanwhile. |
| iCloud | One form: iCloud address + **app-specific password** (account.apple.com → Sign-In and Security) connects mail (IMAP) and calendar (CalDAV). |
| Yahoo, AOL, Zoho, Fastmail, GMX, BT, Sky, Virgin Media | Address + app password (or password for BT and Virgin Media), servers pre-filled, with step-by-step guides. Yahoo and Fastmail calendars use CalDAV; Zoho and the rest use a private .ics link. |
| Any other provider | "Find my settings" looks up the mail server from the address (built-in list, Mozilla's ISP database, then MX records), or type the server. Calendars: any CalDAV server or .ics link. |
| Money | Upload a bank **CSV or OFX statement** (parsed in the browser, kept on the device). A **Stripe restricted key** (`rk_…`) also works through the backend. |
| Tasks and targets | Add, edit and tick off your own. Suggestions come from real emails and events. |

Email passwords, calendar links and Stripe keys go through the AO backend (`backend/`, a Cloudflare Worker), which seals them and never stores them.

**Register the sign-in apps (once):**

- **Google** (console.cloud.google.com): create a project, enable the *Gmail API* and *Google Calendar API*, configure the OAuth consent screen (External, Testing, add your own Google address as a test user), then create an OAuth client ID of type *Web application*.
  - Authorised JavaScript origin: `https://aoletsgo12.github.io` (no path, no trailing slash).
  - Authorised redirect URI: none is needed for this sign-in (it uses Google Identity Services in a popup). `https://aoletsgo12.github.io/ao-intelligence/oauth.html` is harmless if the form insists.
  - Scopes: `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.compose`, `https://www.googleapis.com/auth/calendar.readonly`.
- **Microsoft** (entra.microsoft.com → App registrations → New registration): supported account types *Accounts in any organizational directory and personal Microsoft accounts*. Then Authentication → Add a platform → **Single-page application**.
  - Redirect URI: `https://aoletsgo12.github.io/ao-intelligence/oauth.html` (exactly).
  - Delegated Microsoft Graph permissions: `User.Read`, `offline_access`, `Mail.ReadWrite`, `Calendars.Read`.
- Paste the two client IDs into `js/config.js`, then commit and push.

The Expo/Snack copy in `ao-intelligence-app` is unchanged and still uses sample data.

The backend is described in [backend/README.md](backend/README.md).

## Live site

The published preview is here (no account needed):

- Landing page: https://aoletsgo12.github.io/ao-intelligence/
- Inbox overview: https://aoletsgo12.github.io/ao-intelligence/dashboard.html
- Business dashboard: https://aoletsgo12.github.io/ao-intelligence/business.html
- **Start of the full journey (sign-up → business → connect → dashboard):** https://aoletsgo12.github.io/ao-intelligence/start.html
- Your day (after setup): https://aoletsgo12.github.io/ao-intelligence/app.html

## How to open it locally

The simplest option is to open the HTML files directly:

1. Open `index.html` in a browser for the marketing page.
2. Open `dashboard.html` for the inbox overview.
3. Open `business.html` for the business (sales and money in) dashboard.

If you prefer a local web server (useful if a browser blocks JavaScript from `file://` pages, and required for the installable app and offline cache):

```bash
cd /path/to/agent-dashboard-site
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`, `http://localhost:8080/dashboard.html`, and `http://localhost:8080/business.html`.

## Files

- `index.html` — landing and marketing page
- `dashboard.html` — per-business inbox overview
- `business.html` — per-business money dashboard (sales, money in, and a daily overview)
- `css/styles.css` — shared styles and colour palette
- `js/brand.js` — product name and tagline (the place to rename the brand)
- `js/data.js` — all inbox-dashboard demo data, in a shape a real backend could later replace
- `js/business-data.js` — all business-dashboard demo data (sales, bank lines, and service status)
- `js/connectors.js` — adapter layer between the business page and data sources (see below)
- `js/landing.js` — marketing page behaviour (navigation, enquiry form)
- `js/dashboard.js` — business switcher, overview rendering, mock email-linking modal, settings
- `js/business.js` — business switcher, KPIs, chart, daily overview template, mock connect modal
- `js/pwa.js` — service worker registration, install button, iOS install sheet, standalone tab bar
- `manifest.webmanifest` — installable app metadata
- `sw.js` — versioned offline cache of the site’s pages and assets
- `start.html`, `js/journey.js` — the get-started journey (account, business, connect wizard, “setting up”)
- `app.html`, `js/app.js` — “Your day” with Today, Inbox, Money, Calendar and Connections tabs
- `js/engine.js` — generated from `src/engine` in the Expo project (providers, sample-data generator, view-model, demo connection calls)
- `js/ui.js` — tiny DOM and localStorage helpers; `css/journey.css` — styles for the two pages above
- `screenshots/` — captures of the main pages (`setup-*.png` cover every step of the journey, desktop and mobile)

## How to rename the brand

Edit `js/brand.js` and change `name` and `tagline`. Both pages fill any `data-brand` and `data-brand-tagline` labels from that file. You may also want to update the fallback text already in the HTML (used before the script runs) and the comments at the top of `css/styles.css`.

The accent colour and palette live in the `:root` variables at the top of `css/styles.css`.

## Business dashboard and the connector adapter

`business.html` never reads `js/business-data.js` directly. It calls functions on `window.Connectors` in `js/connectors.js`, and each function returns a `Promise`. Today those functions resolve with demo data from `js/business-data.js`. A later step can replace the body of each function with a real API call, as long as the resolved shape stays the same.

| Function | Source | Resolved payload (summary) |
| --- | --- | --- |
| `listBusinesses()` | catalogue | ids, names, and agent labels for the switcher |
| `listServices(businessId)` | catalogue | Shopify, NatWest, Stripe, Square, Xero and their demo status |
| `connectService(businessId, serviceId)` | session only | marks a service as “Connected (demo)” until the page is refreshed |
| `getShopifySales(businessId)` | Shopify | 30-day daily totals plus a sample of recent orders |
| `getBankTransactions(businessId)` | NatWest | 30-day money-in totals plus a sample of transactions |
| `getStripePayments(businessId)` | Stripe | payments array (empty in the default demo) |
| `getSquareSales(businessId)` | Square | payments array (empty in the default demo) |
| `getXeroInvoices(businessId)` | Xero | invoices array (empty in the default demo) |

The “Daily overview by your AI agent” on this page is written by a template function in `js/business.js` (`buildDailyOverview`). It is built from the current demo numbers so it updates when you switch businesses. Currency is GBP (£). The three sample businesses match the inbox dashboard, and both pages remember the same selection.

## The get-started journey

`start.html` runs the whole consumer journey. With nothing configured it runs on sample data and needs no backend; with credentials configured, the connect step makes a real, read-only connection:

1. **Create an account** — name, email, password. Demo only: the password is never stored or sent; name and email stay in `localStorage`.
2. **Tell us about your business** — name, industry (including *Motorsport / Sports & athletes*) and rough size. A tailored sample dataset is generated from these (`generateUniverse` in `src/engine/generator.ts`): orders, bank lines, invoices, emails with drafted replies, calendar events. Any name + industry works.
3. **Connect your business** — welcome (about 3 minutes), then *pick what you use*: only **Your bank** is pre-selected, nothing is required, and there is an *I don’t use any of these* path plus *Something else? Tell us*. Each chosen item gets one step with a time estimate, *What we’ll see*, *Skip for now*, and *Need help? Send this step to someone* (copies a link that opens a small helper page). Email, calendar and bank use searchable provider pickers (including *My bank isn’t listed — tell us*). A progress bar shows roughly how many minutes are left. The “Allow access” sheet either starts the real sign-in (live connection) or, when that provider isn’t configured, runs a simulation labelled as sample data; **Simulate a problem** (sample connections only) shows the friendly error and retry state.
4. **Setting up your agent** — a short animated moment, then **Your day** (`app.html`).

Your day has separate tabs: **Today** (briefing, schedule, tasks, targets, one-line teasers), **Inbox** (emails needing a reply, each with two editable drafts: copy, or open in your mail app), **Money** (KPIs, chart, income/cost breakdown, invoices, recent activity), **Calendar** (two-week strip and agenda) and **Connections** (everything, plus *Finish setup (N left)*). Every screen works with any combination of services, including none — missing pieces show a plain empty state, and with no sales tool, revenue falls back to bank money-in.

**Start over:** use *Start over* in the header (it also revokes any live Google connection and wipes stored tokens) (or on Connections) to clear the account, business and connections on this device and rerun the journey. State lives under the `ao-intelligence-journey-v2` localStorage key.

The setup wizard only talks to two functions on `window.Connectors`: `startConnection(itemKey, options)` and `completeConnection(session, values)`. They ask `AOLive.route()` (in `js/live.js`) whether that provider has a live route (Google/Microsoft in the browser, or the backend) and otherwise delegate to the sample implementation in `js/engine.js`.

## Going live: step by step

### How it fits together

```
 Browser (GitHub Pages site)                    Backend (Cloudflare Worker, optional)
 ┌──────────────────────────────┐               ┌──────────────────────────────────┐
 │ Google  → straight to Gmail/ │               │ Other email (IMAP) · bank (TrueLayer)│
 │           Calendar APIs      │   sealed      │ Stripe · Shopify · CalDAV · .ics     │
 │ Microsoft → straight to Graph│ ◄──token────► │ Calendly · optional AI drafts        │
 └──────────────────────────────┘               └──────────────────────────────────┘
```

- **Google and Microsoft run entirely in the browser.** Sign-in happens in a popup and the data comes straight from Google/Microsoft to the person’s own browser. No server of ours ever sees it. You only need a *client ID* in `js/config.js` (client IDs are public, not secrets).
- **Everything that needs a secret or a server runs in the Worker** in `backend/` (not deployed yet — see `backend/README.md`). The Worker stores nothing: it hands the browser an encrypted (“sealed”) token, and the browser sends it back on each request.
- **Nothing is ever sent.** The product reads, and saves **drafts** in the person’s own mailbox (Gmail/Outlook/IMAP Drafts folder). It never sends email.
- If a client ID or the backend URL is empty, that connection shows the labelled **sample data** flow instead.

**Important — whose name goes on the registrations:** Archie is 15. Google Cloud, Microsoft Azure/Entra, TrueLayer, Stripe and Shopify all require the person or business registering to be an adult (typically 18+) and to accept their terms. Check each one’s current terms, but plan on registering in the name of **James Owen** or **Owen Motorsport Ltd**. Archie can then be added as a user/test user. For banking in particular, a registered company is effectively required (see TrueLayer).

**The values to use everywhere** (this site’s address on GitHub Pages):

| What | Value |
| --- | --- |
| Website origin (“Authorised JavaScript origin”) | `https://aoletsgo12.github.io` |
| Redirect URI for Google and Microsoft | `https://aoletsgo12.github.io/ao-intelligence/oauth.html` |
| Worker callback, TrueLayer | `https://<your-worker>.workers.dev/truelayer/callback` |
| Worker callback, Stripe Connect | `https://<your-worker>.workers.dev/stripe/callback` |
| Worker callback, Shopify OAuth | `https://<your-worker>.workers.dev/shopify/callback` |

Everything below that says “paste into `js/config.js`” means: edit the file, commit, push. GitHub Pages republishes in about a minute. (`js/config.js` is fetched network-first, so changes appear without clearing the cache.)

### 1. Google — Gmail (read + drafts) and Calendar (read)

*Who:* James or Owen Motorsport Ltd, with a Google account. Free. *Time:* about 15 minutes.

1. Go to <https://console.cloud.google.com/> → create a project (e.g. “AO Intelligence”).
2. **APIs & Services → Library**: enable **Gmail API** and **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** (now called *Google Auth Platform*): choose **External**, fill in the app name, support email and developer email.
4. **Data access / Scopes** → add exactly these three:
   - `https://www.googleapis.com/auth/gmail.readonly` (read the inbox)
   - `https://www.googleapis.com/auth/gmail.compose` (save reply drafts; it cannot send as the app uses no send scope)
   - `https://www.googleapis.com/auth/calendar.readonly`
5. **Audience**: leave it in **Testing** and add every person who will try it under **Test users** (Archie, James, anyone helping). Or, if only one person will ever use it, use *Personal mode* if Google offers it for your project, which skips verification and the “unverified app” warning.
6. **Clients → Create client → Web application**:
   - Authorised JavaScript origins: `https://aoletsgo12.github.io`
   - Authorised redirect URIs: `https://aoletsgo12.github.io/ao-intelligence/oauth.html`
   - Copy the **Client ID** (`…apps.googleusercontent.com`). There is no client secret to use.
7. Paste into `js/config.js`: `google: { clientId: "…apps.googleusercontent.com" }`. Commit and push.
8. Try it: open `start.html` → connect email → Gmail → *Allow access*. Google’s popup appears (“Google hasn’t verified this app” is expected in Testing; *Advanced → Go to AO Intelligence*).

**Verification limits (important for going beyond family):**
- **Testing mode:** up to **100 test users**, no verification needed. Gmail scopes here are *restricted*; Google shows an “unverified” screen to everyone, and in Testing mode sign-ins can be reset after 7 days.
- **Under 100 users in production** (“limited audience”): you can publish without full verification; users see the unverified-app warning, and the 100-user cap applies for the life of the project.
- **Over 100 users or no warning:** needs Google’s **restricted-scope verification** (privacy policy, domain ownership, demo video). Google also requires an annual third-party **CASA security assessment** (paid) for apps that *store or transmit restricted Gmail data on servers*. This site keeps Gmail data in the user’s own browser only (nothing goes to a server of ours), which should fall under Google’s exemption for client-side-only apps. Confirm that with Google at verification time, and expect the assessment as soon as email ever passes through a server.
- Access tokens last about **1 hour** and the browser flow can’t renew them silently. The app then shows a **Reconnect** banner; one click re-authorises.

### 2. Microsoft — Outlook.com / Microsoft 365 mail and calendar

*Who:* James or Owen Motorsport Ltd, with a Microsoft account. The app registration itself is free, though Azure may ask for a card when creating a new Azure account. *Time:* about 10 minutes.

1. Go to <https://entra.microsoft.com/> (or Azure portal → Microsoft Entra ID) → **App registrations → New registration**.
2. Name: “AO Intelligence”. **Supported account types: “Accounts in any organizational directory and personal Microsoft accounts”** (multi-tenant + personal, so Outlook.com *and* work accounts can sign in).
3. **Redirect URI**: platform **Single-page application (SPA)** (not “Web”), value `https://aoletsgo12.github.io/ao-intelligence/oauth.html`. SPA is what enables the no-secret PKCE sign-in.
4. **API permissions → Add → Microsoft Graph → Delegated**: `User.Read`, `offline_access`, `Mail.ReadWrite`, `Calendars.Read`. (`Mail.ReadWrite` is needed to save drafts; if you want read-only you may use `Mail.Read` but drafting then won’t work. The app never sends — there’s no `Mail.Send`.)
5. Copy the **Application (client) ID** from the Overview page.
6. Paste into `js/config.js`: `microsoft: { clientId: "…", authority: "https://login.microsoftonline.com/common" }`. Commit and push.
7. Try it: connect email → Outlook, or calendar → Outlook calendar.

**Limits:** a multi-tenant SPA is fine for any number of users. Personal accounts work immediately. Some work/school organisations require an admin to approve the app, and unverified publishers see a “not verified” note; to remove it, complete **Publisher verification** (needs a Microsoft Partner Network account tied to a registered business). The app renews tokens using a refresh token (browser-held, 24-hour SPA refresh lifetime), after which the user sees **Reconnect**.

### 3. The backend (needed for everything below)

Do this once; see `backend/README.md` for the full commands.

1. A free Cloudflare account (<https://dash.cloudflare.com/sign-up>), under James’s or the company’s email.
2. `cd backend && npm install && npx wrangler login`
3. `npx wrangler secret put SEAL_KEY` → paste a long random string (e.g. `openssl rand -base64 48`). **Keep it safe; changing it disconnects everyone.**
4. Check `wrangler.toml` (`ALLOWED_ORIGIN` and `FRONTEND_URL` already point at the GitHub Pages site).
5. `npx wrangler deploy` → note the URL it prints, e.g. `https://ao-intelligence-api.<name>.workers.dev`.
6. Paste into `js/config.js`: `backendUrl: "https://ao-intelligence-api.<name>.workers.dev"`. Commit and push.
7. Visit `<backend URL>/health` — it lists which features are on.

With just `SEAL_KEY` set, these work immediately: **other email (IMAP), .ics calendar links, CalDAV (iCloud/Zoho/Fastmail/…), Calendly, Stripe (pasted key), Shopify (pasted credentials)**. The rest need the extra secrets below.

### 4. “Other” email (any IMAP mailbox) — works with the backend alone

How the **Other / unlisted email provider** path works: the person picks *Other* and enters their email address, an **app password** and their mail server (the server is pre-filled for common providers such as Gmail, iCloud, Yahoo, AOL and Zoho; for *Other* the person types it, e.g. `imap.fastmail.com`). The Worker checks the login over TLS (port 993 only), seals the credentials and returns them to the browser. Messages are then read **read-only**, and reply drafts are saved to the mailbox’s Drafts folder. There’s no SMTP and no sending.

- A Cloudflare Worker *can* speak IMAP (it has outbound TCP sockets), so no other runtime is needed. The IMAP client is a small hand-written one in `backend/src/imap.js` and is tested against a fake server, **but has not been tried against real mail servers yet**, so expect small compatibility fixes.
- Gmail/Outlook.com/Yahoo/iCloud need an **app password** (needs 2-step verification on). Proton Mail has no direct IMAP — it needs Proton Bridge on a computer, so it isn’t supported live (the screen says so).
- Credentials are encrypted with `SEAL_KEY` in the Worker and held in the browser’s storage. Fine for a trial; for many customers move to server-side storage (e.g. Cloudflare D1 or KV).

### 5. Calendars other than Google/Outlook — backend only

- **.ics link** (works for any calendar with a “secret address in iCal format”, including Google, Outlook, Apple and school/club calendars): paste the link. Recurring events, exceptions and time zones are handled.
- **iCloud / Zoho / Fastmail / other CalDAV:** enter the CalDAV server URL, username and an app-specific password (iCloud: <https://account.apple.com> → Sign-In and Security → App-Specific Passwords; server `https://caldav.icloud.com`).
- **Calendly:** paste a personal access token (Calendly → Integrations → API & Webhooks).

### 6. Banking — TrueLayer Open Banking (sandbox first)

*Who:* James or Owen Motorsport Ltd. *Needs the backend.*

1. Sign up at <https://console.truelayer.com/> (free). Create an application. The sandbox gives you a mock bank (provider `uk-cs-mock`; sign in with TrueLayer’s published sandbox test credentials) — no real money or account.
2. In the application settings add the redirect URI `https://<your-worker>.workers.dev/truelayer/callback`.
3. Scopes requested: `info accounts balance transactions offline_access` (read-only account information. The product cannot move money).
4. Copy the Client ID and Secret, then run:
   `npx wrangler secret put TRUELAYER_CLIENT_ID` and `npx wrangler secret put TRUELAYER_CLIENT_SECRET`, then `npx wrangler deploy`.
5. Try it: connect bank → pick any bank → *Allow access*. You’re sent to TrueLayer’s sandbox login, then back with the balance and 30 days of transactions on the Money tab.

**Going to real bank accounts (production) is the hard part.** TrueLayer production requires a commercial agreement and, to access *other people’s* accounts, either your own FCA authorisation as an Account Information Service Provider (AISP) or operating under a regulated partner’s licence (an “agent” of an authorised firm). Realistically that means an **FCA-regulated partner** and a registered business: **Owen Motorsport Ltd** (or similar), not a 15-year-old individual. To use only *your own family’s* accounts there may be a lighter route (some banks offer personal/business API access, or TrueLayer may allow a limited live mode). Ask TrueLayer sales. Set `TRUELAYER_ENV = "live"` in `wrangler.toml` only once that’s agreed. Consents expire after 90 days and need re-approval. Other aggregators (e.g. GoCardless Bank Account Data, Plaid UK, Yapily) have similar licence rules.

### 7. Stripe — sales, balance, payouts

*Who:* whoever owns the Stripe account (for a business, an adult account holder). *Needs the backend.*

- **Quickest (own account): restricted read-only key.** Stripe Dashboard → Developers → API keys → **Create restricted key** → give it **Read** on *Balance*, *Charges* (and *PaymentIntents* if offered), *Payouts* and nothing else → copy the `rk_live_…` key. In the product: connect sales → Stripe → paste the key. Use `rk_test_…` to try it with test data.
- **For other businesses signing in themselves: Stripe Connect OAuth.** Dashboard → Connect → settings → enable OAuth for Standard accounts; add the redirect URI `https://<your-worker>.workers.dev/stripe/callback`. Then `npx wrangler secret put STRIPE_CONNECT_CLIENT_ID` (the `ca_…` value) and `npx wrangler secret put STRIPE_SECRET_KEY` (your platform’s secret key), redeploy. The pasted-key box then switches to a *Continue with Stripe* button. Connect needs a Stripe platform account and its review.

### 8. Shopify — orders and sales (optional, never required)

*Who:* the shop owner. *Needs the backend.* Read-only (`read_orders`). By default Shopify only returns the last **60 days** of orders unless the app is granted `read_all_orders`.

**Note:** Shopify **stopped allowing new “legacy custom apps”** (the old *Settings → Apps → Develop apps* admin tokens) from **1 January 2026**. Existing ones still work. For a new setup use one of:

- **Own store, easiest — Dev Dashboard app with client credentials.** In the Shopify **Dev Dashboard** create an app, give it the `read_orders` scope, release a version, and install it on the store (the app and store must belong to the **same Shopify organisation**). Copy its **Client ID** and **Client secret** (Settings). In the product: connect sales → Shopify → shop name → paste Client ID and secret. The Worker swaps them for a short-lived (24-hour) token on every request.
- **An existing legacy custom app:** paste its `shpat_…` Admin API token instead.
- **Other people’s stores — OAuth install.** Create an app in the Dev Dashboard with the `read_orders` scope and redirect URL `https://<your-worker>.workers.dev/shopify/callback`, then `npx wrangler secret put SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`, redeploy. The pasted-credentials box then becomes a *Continue with Shopify* button. Public distribution needs Shopify’s app review.

### 9. Optional: smarter reply drafts

By default drafts come from simple built-in templates (`templateDrafts` in `src/engine/model.ts`). To use an AI service instead, either (a) set Worker secrets `AI_API_URL`, `AI_API_KEY` and optionally `AI_MODEL` (any chat-completions-style endpoint), or (b) set `draftEndpoint` in `js/config.js` to your own URL that accepts `POST {from, subject, snippet, business, owner}` and returns `{drafts:[{label, body}]}`. If it fails, the templates are used. Email content is sent to that service, so only enable it if the privacy policy says so.

### Everything else (PayPal, SumUp, Square, Xero, QuickBooks, FreeAgent, …)

These stay on the labelled sample-data flow for now. Each needs its own app registration, and Xero and Intuit need a review before public use. They would be added to the Worker in the same way as Stripe.

### Security and privacy notes

- Read-only by design: no scope or code path can send email or move money. Drafts only.
- Tokens live in the browser’s `localStorage` on the device (`ao-live-tokens-v1`) and are wiped by **Start over** or *Disconnect* (which also revokes Google access). Anyone with access to that browser profile could use them, so don’t try it on a shared computer. For a multi-user product, move tokens server-side (see `backend/README.md`).
- Before more than a handful of people use it: a privacy policy, terms, data-retention, ICO registration (UK), and a real sign-in system (the current sign-up is a local profile only).

### How to test

```bash
node --test backend/test/*.test.js     # Worker: IMAP (fake server), sealing, Stripe, Shopify, CalDAV, ICS, routes
node --test tests/*.test.js            # browser-side data mapping
node tests/e2e-live.js                 # headless browser: fallbacks, flow start, no console errors (needs Chrome and puppeteer-core; start `python3 -m http.server 8099` first)
```

None of these need real credentials, which means **live sign-in with real accounts is untested until you add a client ID**. When you do, test with a throwaway Google/Microsoft account first.

### The Expo (phone app) preview

The Snack preview stays on sample data. Adding live sign-in there would take: `expo-auth-session`, `expo-web-browser` and `expo-crypto` added to the Snack’s dependencies (it currently keeps none), a native redirect scheme registered with Google/Microsoft (Google uses an iOS/Android client type there, not the web client), and a proxy or custom dev build since the Snack runner’s `exp://` redirect can’t be registered. The simplest route for a phone is the PWA: install this website from the browser (see below) and it has the live connections already.

### Remaining go-live checklist

- [ ] Accounts and sessions — real sign-up and sign-in (hashed passwords, email verification) and server-side storage of connections.
- [ ] Register the providers above, in James’s or Owen Motorsport Ltd’s name.
- [ ] Google restricted-scope verification (and a CASA assessment if Gmail data is ever stored on a server) before going beyond 100 users.
- [ ] A regulated route for production bank access.
- [ ] Real, human-approved agent drafting if AI drafts are enabled. Never send mail without a person approving it.
- [ ] Privacy policy, terms, data retention, ICO registration.
- [ ] Remove the *Sample data* labels and *Simulate a problem* link once everything is live.
- [ ] Bump `CACHE_VERSION` in `sw.js` whenever cached files change.


## Installable app (PWA)

The site can be installed as a standalone app when it is served over HTTP (for example from the local server above).

- `manifest.webmanifest` names the app **AO Intelligence** (short name **AO**), uses the teal theme colour `#1b5f56`, the site’s warm background, `display: standalone`, and starts at `dashboard.html`.
- App icons live in `assets/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`).
- `sw.js` precaches the pages and assets into a versioned cache (`ao-intelligence-v5` at the time of writing) so a later visit can work offline. Bump that version string when you change cached files.
- An **Install app** button appears in the header when the browser can install the app (Chrome/Android). On iPhone and iPad Safari, the same button opens a short sheet explaining Share → Add to Home Screen.
- In standalone mode on a small screen, a bottom tab bar links Overview, Business, and Settings.
