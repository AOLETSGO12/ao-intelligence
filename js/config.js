/* AO Intelligence — live connection settings. This is the ONLY file you need to edit on the website side.
 *
 * Leave a value empty and that connection simply uses the clearly-labelled sample-data demo instead,
 * so the site never breaks. Nothing in here is a secret: Google and Microsoft client IDs are public by
 * design, and the backend URL is just an address. Secrets (TrueLayer, Stripe, Shopify, ...) live in the
 * backend (see /backend and README.md), never in this file.
 *
 * Step-by-step setup for each value is in README.md ("Going live").
 */
window.AO_CONFIG = {
  // Google: ONE sign-in for Gmail (read + save drafts) and Google Calendar (read), via Google Identity Services.
  // Create a "Web application" OAuth client. Authorised JavaScript origin: https://aoletsgo12.github.io (no path).
  // Scopes: gmail.readonly, gmail.compose, calendar.readonly. Paste its client ID, e.g. "1234-abc.apps.googleusercontent.com".
  // While this is empty the Google button says sign-in isn’t switched on yet, and the app-password fallback is shown.
  google: { clientId: "" },

  // Microsoft (Outlook.com / Microsoft 365 mail + calendar via Microsoft Graph). Browser-only PKCE sign-in.
  // ONE sign-in for mail and calendar. Register a "Single-page application" with the redirect URI
  // https://aoletsgo12.github.io/ao-intelligence/oauth.html and delegated permissions User.Read, offline_access,
  // Mail.ReadWrite, Calendars.Read. Paste the Application (client) ID. Empty = sign-in isn’t switched on yet; Outlook calendar can still use a published ICS link.
  microsoft: { clientId: "", authority: "https://login.microsoftonline.com/common" },

  // Address of the deployed backend (Cloudflare Worker) that handles anything needing a secret or a server:
  // other email (IMAP), bank connections (Open Banking), Stripe, Shopify, CalDAV / .ics, Calendly.
  // e.g. "https://ao-intelligence-api.your-name.workers.dev" (no trailing slash).
  backendUrl: "https://ao-intelligence-api.ao-446557ec.workers.dev",

  // Optional: a URL that writes reply drafts (POST {from, subject, snippet, business, owner} -> {drafts:[{label, body}]}).
  // Leave empty to use simple built-in templates. If the backend has drafting switched on it is used automatically.
  draftEndpoint: "",

  // Optional overrides. Normally leave these alone.
  redirectUri: "",            // defaults to <this site>/oauth.html — register exactly this with Google/Microsoft.
  timezone: ""                // defaults to the browser's time zone
};
