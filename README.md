# AO Intelligence — front-end prototype

A static preview of a white-label “managed AI agent” service for small businesses. A public copy is hosted at [https://aoletsgo12.github.io/ao-intelligence/](https://aoletsgo12.github.io/ao-intelligence/). There is no backend, no real email or payments linking, and no connection to any live assistant, shop, or bank account. Open the files in a browser to walk through the marketing site, a sample inbox overview, and a sample business (money) dashboard.

## Live site

The published preview is here (no account needed):

- Landing page: https://aoletsgo12.github.io/ao-intelligence/
- Inbox overview: https://aoletsgo12.github.io/ao-intelligence/dashboard.html
- Business dashboard: https://aoletsgo12.github.io/ao-intelligence/business.html

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
- `screenshots/` — captures of the main pages

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

## Installable app (PWA)

The site can be installed as a standalone app when it is served over HTTP (for example from the local server above).

- `manifest.webmanifest` names the app **AO Intelligence** (short name **AO**), uses the teal theme colour `#1b5f56`, the site’s warm background, `display: standalone`, and starts at `dashboard.html`.
- App icons live in `assets/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`).
- `sw.js` precaches the pages and assets into a versioned cache (`ao-intelligence-v1`) so a later visit can work offline. Bump that version string when you change cached files.
- An **Install app** button appears in the header when the browser can install the app (Chrome/Android). On iPhone and iPad Safari, the same button opens a short sheet explaining Share → Add to Home Screen.
- In standalone mode on a small screen, a bottom tab bar links Overview, Business, and Settings.

## What this prototype does not include

Linking a real Gmail, Outlook, Shopify, NatWest, Stripe, Square, or Xero account, sending or reading live email, and wiring an agent backend are a separate next step. The “Link” and “Connect” buttons only open a mock confirmation dialog. Dashboard figures, inboxes, sales, and bank lines are clearly marked as demo data and live in `js/data.js` and `js/business-data.js`.
