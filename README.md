# AO Intelligence — front-end prototype

A static preview of a white-label “managed AI agent” service for small businesses. A public copy is hosted at [https://aoletsgo12.github.io/ao-intelligence/](https://aoletsgo12.github.io/ao-intelligence/). There is no backend, no real email or payments linking, and no connection to any live assistant, shop, or bank account. Open the files in a browser to walk through the marketing site, a sample inbox overview, and a sample business (money) dashboard.

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

## The get-started journey (demo)

`start.html` runs the whole consumer journey with no backend:

1. **Create an account** — name, email, password. Demo only: the password is never stored or sent; name and email stay in `localStorage`.
2. **Tell us about your business** — name, industry (including *Motorsport / Sports & athletes*) and rough size. A tailored sample dataset is generated from these (`generateUniverse` in `src/engine/generator.ts`): orders, bank lines, invoices, emails with drafted replies, calendar events. Any name + industry works.
3. **Connect your business** — welcome (about 3 minutes), then *pick what you use*: only **Your bank** is pre-selected, nothing is required, and there is an *I don’t use any of these* path plus *Something else? Tell us*. Each chosen item gets one step with a time estimate, *What we’ll see*, *Skip for now*, and *Need help? Send this step to someone* (copies a link that opens a small helper page). Email, calendar and bank use searchable provider pickers (including *My bank isn’t listed — tell us*). A progress bar shows roughly how many minutes are left. The “Allow access” sheet is a simulation; **Simulate a problem** shows the friendly error and retry state.
4. **Setting up your agent** — a short animated moment, then **Your day** (`app.html`).

Your day has separate tabs: **Today** (briefing, schedule, tasks, targets, one-line teasers), **Inbox** (emails needing a reply, each with two editable drafts: copy, or open in your mail app), **Money** (KPIs, chart, income/cost breakdown, invoices, recent activity), **Calendar** (two-week strip and agenda) and **Connections** (everything, plus *Finish setup (N left)*). Every screen works with any combination of services, including none — missing pieces show a plain empty state, and with no sales tool, revenue falls back to bank money-in.

**Start over:** use *Reset demo* in the header (or on Connections) to clear the account, business and connections on this device and rerun the journey. State lives under the `ao-intelligence-journey-v2` localStorage key.

The setup wizard only talks to two functions on `window.Connectors`: `startConnection(itemKey, options)` and `completeConnection(session)`. Today they delegate to the demo implementation in `js/engine.js`.

## Going live: checklist

Replace these demo pieces with real services, keeping the same function shapes:

- [ ] **Accounts and sessions** — real sign-up/sign-in (passwords hashed server-side, email verification, secure sessions). Today nothing is authenticated and the password is discarded.
- [ ] **A backend that holds connections** — store each customer’s connections and tokens server-side, encrypted at rest. The browser/app should only ever receive a connection record, never tokens. Add a way to disconnect and to delete all data.
- [ ] **`startConnection` / `completeConnection`** — implement in `js/connectors.js` (website) and `src/engine/model.ts` (apps): `start` creates a server-side session and returns the provider’s real authorisation URL; the redirect URI exchanges `code` + `state` for tokens.
- [ ] **OAuth providers** — register an app with Stripe, PayPal, SumUp, Square, Xero, QuickBooks, FreeAgent, Google (Gmail and Calendar), Microsoft (Outlook/365 mail and calendar), Zoho and Calendly. Request read-only scopes only. Several (Google, Microsoft, Xero, Intuit) need a verification or security review before public use.
- [ ] **Shopify** — create a Shopify app, validate the shop domain, run the OAuth install, request read-only order scopes.
- [ ] **Banking (UK Open Banking)** — use a regulated provider (an authorised AISP, or an aggregator that holds the licence) to create bank consents for the banks in `BANKS`; handle consent expiry (re-consent every 90 days), and store only what you need.
- [ ] **IMAP / CalDAV** — collect app passwords or credentials over TLS on your server only, never in the client; prefer OAuth where the provider offers it.
- [ ] **Real data in place of the generator** — swap `generateUniverse` for adapters that read orders, bank lines, invoices, email and events, mapped to the shapes in `src/engine/generator.ts`. `buildView` in `src/engine/model.ts` then drives every screen unchanged.
- [ ] **The agent** — the daily briefing and email drafts are templates today. Replace them with real generation, keep a human approval step before anything is sent, and never send mail on someone’s behalf without it.
- [ ] **Compliance** — privacy policy, terms, data-processing terms, data retention, cookie/consent handling, and ICO registration (UK).
- [ ] **Remove the demo labels** (*Sample data*, *Demo*) and the *Simulate a problem* link once real connections exist.
- [ ] **PWA** — bump `CACHE_VERSION` in `sw.js` whenever cached files change.

## Installable app (PWA)

The site can be installed as a standalone app when it is served over HTTP (for example from the local server above).

- `manifest.webmanifest` names the app **AO Intelligence** (short name **AO**), uses the teal theme colour `#1b5f56`, the site’s warm background, `display: standalone`, and starts at `dashboard.html`.
- App icons live in `assets/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`).
- `sw.js` precaches the pages and assets into a versioned cache (`ao-intelligence-v1`) so a later visit can work offline. Bump that version string when you change cached files.
- An **Install app** button appears in the header when the browser can install the app (Chrome/Android). On iPhone and iPad Safari, the same button opens a short sheet explaining Share → Add to Home Screen.
- In standalone mode on a small screen, a bottom tab bar links Overview, Business, and Settings.

## What this prototype does not include

Linking a real Gmail, Outlook, Shopify, NatWest, Stripe, Square, or Xero account, sending or reading live email, and wiring an agent backend are a separate next step. The “Link” and “Connect” buttons only open a mock confirmation dialog. Dashboard figures, inboxes, sales, and bank lines are clearly marked as demo data and live in `js/data.js` and `js/business-data.js`.
