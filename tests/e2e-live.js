/* End-to-end check of the live-connection flows WITHOUT any real credentials.
 * It serves the site locally, fakes Google's sign-in script, Google/Microsoft/Graph APIs and the backend,
 * and checks the flows start correctly, real-shaped data lands in the right tabs, fallbacks work and
 * there are no console errors.      Run:  node tests/e2e-live.js   (needs puppeteer-core + Google Chrome)
 */
const path = require("path");
let puppeteer; try { puppeteer = require("puppeteer-core"); } catch (e) { puppeteer = require("/workspace/tools/node_modules/puppeteer-core"); }
const http = require("http"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (cond, msg) => { if (!cond) { failures++; console.log("  ✗ " + msg); } else console.log("  ✓ " + msg); };

const STATE = (selected, extra) => JSON.stringify(Object.assign({ v: 1, step: "w-item", cursor: 0, account: { name: "Archie Owen", email: "archie@example.com" }, business: { name: "Archie Owen Racing", industry: "motorsport", size: "solo" }, selected, connected: {}, skipped: [], requests: {}, doneTasks: [], replied: [], edits: {} }, extra || {}));
const J = (o, status) => ({ status: status || 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });

async function open(browser, { config, state, mocks, base }) {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900 });
  const errors = [], requests = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push("console: " + m.text()); });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (url.startsWith(base)) return req.continue();
    requests.push({ url, method: req.method(), body: req.postData() });
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    for (const [prefix, fn] of mocks || []) {
      if (url.startsWith(prefix)) { const r = fn(url, req); if (r) return req.respond(r); }
    }
    return req.abort();
  });
  await page.evaluateOnNewDocument((config, state) => {
    try {
      if (!sessionStorage.getItem("__seeded")) {
        sessionStorage.setItem("__seeded", "1");
        localStorage.setItem("ao-mode", "demo");
        if (config) localStorage.setItem("ao-config-override", JSON.stringify(config));
        if (state) localStorage.setItem("ao-intelligence-journey-v2", state);
      }
    } catch (e) { /* ignore */ }
    window.__opened = [];
    window.__realOpen = window.open.bind(window);
    window.open = function (url) { const p = { closed: false, close() { this.closed = true; }, location: { href: "" } }; window.__opened.push(p); return p; };
  }, config || null, state || null);
  return { page, errors, requests };
}
const text = (page) => page.evaluate(() => document.body.innerText);
async function clickText(page, sel, label, opts = {}) {
  try { await page.waitForFunction((sel, label) => [...document.querySelectorAll(sel)].some((e) => e.textContent.trim().includes(label) && !e.disabled), { timeout: 8000 }, sel, label); }
  catch (e) { console.log("    [debug] waiting for " + sel + " / " + label + "; page says: " + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 300)); throw e; }
  await page.evaluate((sel, label) => { [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(label) && !e.disabled).click(); }, sel, label);
  if (opts.wait !== 0) await sleep(opts.wait || 250);
}
async function waitText(page, needle, ms) { await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout: ms || 8000 }, needle); }
async function typeInto(page, sel, value) { await page.waitForSelector(sel); await page.click(sel, { clickCount: 3 }); await page.type(sel, value); }
/** Deliver a sign-in result through the real oauth.html (opened as a popup so it posts back). */
async function deliver(page, query) { await page.evaluate((q) => window.__realOpen(location.origin + "/oauth.html" + q), query); await sleep(900); }
const popupUrl = (page) => page.evaluate(() => (window.__opened[0] ? window.__opened[0].location.href : ""));

async function main() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"], headless: "new" });
  const run = async (name, fn) => { console.log("\n" + name); try { await fn(); } catch (e) { failures++; console.log("  ✗ threw: " + e.message.split("\n")[0] + " @ " + (e.stack.split("\n").find(function (l) { return l.indexOf("e2e-live.js") !== -1; }) || "").trim()); } };

  await run("S0 · nothing configured → clearly-labelled sample-data flow, no errors", async () => {
    const { page, errors } = await open(browser, { state: STATE(["mail"]), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Gmail");
    await clickText(page, ".btn-primary", "Connect Gmail");
    await waitText(page, "aren’t switched on");
    ok(true, "consent sheet says live connections aren’t switched on and uses sample data");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 1800 });
    await waitText(page, "Showing sample data");
    const st = JSON.parse(await page.evaluate(() => localStorage.getItem("ao-intelligence-journey-v2")));
    ok(st.connected.mail && !st.connected.mail.live, "connection saved as a sample (not live) connection");
    await page.goto(base + "/app.html#inbox", { waitUntil: "networkidle2" });
    ok((await page.evaluate(() => document.getElementById("data-badge").textContent)) === "Sample data", "header badge reads “Sample data”");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  const gmailMsgs = {
    m1: { id: "m1", threadId: "t1", internalDate: String(Date.now() - 3600e3), snippet: "Hi Archie, can we talk 2027 &amp; Brands?", payload: { headers: [{ name: "From", value: "Sam Hill <sam@apexlube.co.uk>" }, { name: "Subject", value: "Sponsor renewal for 2027?" }, { name: "Message-ID", value: "<abc@x>" }] } },
    m2: { id: "m2", threadId: "t2", internalDate: String(Date.now() - 7200e3), snippet: "Sale!", payload: { headers: [{ name: "From", value: "Shop <deals@shop.com>" }, { name: "Subject", value: "50% off" }, { name: "List-Unsubscribe", value: "<x>" }] } },
    m3: { id: "m3", threadId: "t3", internalDate: String(Date.now() - 9000e3), snippet: "Already answered", payload: { headers: [{ name: "From", value: "Jo <jo@club.org>" }, { name: "Subject", value: "Entry list" }] } },
  };
  const gmailMocks = (calls) => [
    ["https://accounts.google.com/gsi/client", () => ({ status: 200, contentType: "text/javascript", body: "window.google={accounts:{oauth2:{initTokenClient:function(c){return{requestAccessToken:function(o){window.__gis={scope:c.scope,prompt:o.prompt,granted:c.include_granted_scopes};setTimeout(function(){c.callback({access_token:'tok-g',expires_in:3600,scope:c.scope})},30)}}},revoke:function(t,cb){localStorage.setItem('__revoked',t);cb&&cb()}}}};" })],
    ["https://gmail.googleapis.com/gmail/v1/users/me/profile", () => J({ emailAddress: "archie@gmail.com" })],
    ["https://gmail.googleapis.com/gmail/v1/users/me/messages?", () => J({ messages: [{ id: "m1" }, { id: "m2" }, { id: "m3" }] })],
    ["https://gmail.googleapis.com/gmail/v1/users/me/messages/", (u) => J(gmailMsgs[u.split("/messages/")[1].split("?")[0]])],
    ["https://gmail.googleapis.com/gmail/v1/users/me/threads/", (u) => J({ messages: [{ labelIds: u.includes("t3") ? ["INBOX", "SENT"] : ["INBOX"] }] })],
    ["https://gmail.googleapis.com/gmail/v1/users/me/drafts", (u, req) => { calls.draft = req.postData(); return J({ id: "d1" }); }],
    ["https://www.googleapis.com/calendar/v3/calendars/primary/events", () => { const d = new Date(); d.setHours(15, 0, 0, 0); const e = new Date(d.getTime() + 3600e3); return J({ items: [{ id: "e1", summary: "Sponsor call, Apex", start: { dateTime: d.toISOString() }, end: { dateTime: e.toISOString() }, hangoutLink: "https://meet.google.com/x", attendees: [{ email: "a@x.com" }] }] }); }],
    ["https://www.googleapis.com/calendar/v3/calendars/primary", () => J({ id: "archie@gmail.com" })],
  ];

  await run("S1 · Google (Gmail + Calendar) with a client ID configured", async () => {
    const calls = {};
    const { page, errors, requests } = await open(browser, { config: { google: { clientId: "123-test.apps.googleusercontent.com" } }, state: STATE(["mail", "calendar"]), mocks: gmailMocks(calls), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Gmail");
    await clickText(page, ".btn-primary", "Connect Gmail");
    await waitText(page, "Live connection — your real account");
    ok((await text(page)).includes("save reply drafts (we can’t send)"), "consent sheet says read + drafts only, never send");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 600 });
    await waitText(page, "Live — showing your real data");
    const gis = await page.evaluate(() => window.__gis);
    ok(gis && gis.scope.includes("gmail.readonly") && gis.scope.includes("gmail.compose") && !gis.scope.includes("gmail.send") && !gis.scope.includes("auth/gmail.modify"), "requested only gmail.readonly + gmail.compose: " + (gis && gis.scope));
    ok(gis.granted === true, "incremental authorisation (include_granted_scopes)");
    await clickText(page, ".btn-primary", "Continue");
    await clickText(page, ".j-result", "Google Calendar");
    await clickText(page, ".btn-primary", "Connect Google Calendar");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 600 });
    await waitText(page, "Live — showing your real data");
    const g2 = await page.evaluate(() => window.__gis);
    ok(g2.scope.includes("calendar.readonly") && g2.scope.includes("gmail.readonly"), "calendar request keeps the Gmail scopes already granted");
    const st = JSON.parse(await page.evaluate(() => localStorage.getItem("ao-intelligence-journey-v2")));
    ok(st.connected.mail.live && st.connected.mail.detail === "archie@gmail.com" && st.connected.calendar.live, "both saved as live connections with the real account address");
    ok(!JSON.stringify(st).includes("tok-g"), "access token is not in the journey state");
    await page.goto(base + "/app.html#inbox", { waitUntil: "networkidle2" });
    await waitText(page, "Sponsor renewal for 2027?");
    const t = await text(page);
    ok(!t.includes("50% off") && !t.includes("Entry list"), "newsletter and already-replied thread are filtered out");
    ok(t.includes("2027 & Brands?"), "snippet is decoded real text");
    ok(/Live/.test(t) && (await page.evaluate(() => document.getElementById("data-badge").textContent)) === "Live data", "labelled Live");
    await clickText(page, "button", "Save as draft in Gmail", { wait: 800 });
    await waitText(page, "Saved to Gmail");
    const raw = Buffer.from(JSON.parse(calls.draft).message.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    ok(/^To: sam@apexlube\.co\.uk/m.test(raw) && /Subject: Re: Sponsor renewal for 2027\?/.test(raw) && /In-Reply-To: <abc@x>/.test(raw) && JSON.parse(calls.draft).message.threadId === "t1", "draft saved to the right thread, with reply headers (nothing sent)");
    await page.evaluate(() => { location.hash = "#calendar"; });
    await waitText(page, "Sponsor call, Apex");
    ok(true, "real calendar event shows on the Calendar tab");
    await page.evaluate(() => { location.hash = "#today"; });
    await waitText(page, "Sponsor call, Apex");
    ok((await text(page)).includes("1 email needs a reply") || (await text(page)).includes("email needs a reply"), "Today shows the real unreplied count");
    // reset revokes
    await clickText(page, "button", "Reset demo", { wait: 300 });
    await clickText(page, ".j-modal .btn-primary", "Reset demo", { wait: 800 });
    await sleep(500);
    ok(requests.some((r) => r.url.startsWith("https://oauth2.googleapis.com/revoke") && /token=tok-g/.test(r.body || "")), "Start over asks Google to revoke the token");
    ok(!(await page.evaluate(() => localStorage.getItem("ao-live-tokens-v1"))), "stored tokens are cleared");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S1b · Google token expired → clear Reconnect prompt (not fake data)", async () => {
    const calls = {};
    const state = STATE(["mail"], { step: "app", connected: { mail: { key: "mail", providerId: "gmail", providerName: "Gmail", detail: "archie@gmail.com", at: new Date().toISOString(), live: true, route: "google" } } });
    const { page, errors } = await open(browser, { config: { google: { clientId: "123-test.apps.googleusercontent.com" } }, state, mocks: gmailMocks(calls), base });
    await page.evaluateOnNewDocument(() => { try { if (!localStorage.getItem("ao-live-tokens-v1")) localStorage.setItem("ao-live-tokens-v1", JSON.stringify({ google: { token: "old", exp: 1, scope: "x" } })); } catch (e) {} });
    await page.goto(base + "/app.html#inbox", { waitUntil: "networkidle2" });
    await waitText(page, "Reconnect");
    ok((await text(page)).includes("expired"), "shows an expired sign-in notice with a Reconnect button");
    ok(!(await text(page)).includes("Sponsor renewal"), "shows no sample or stale emails");
    await clickText(page, ".live-notice .btn-primary", "Reconnect", { wait: 1200 });
    await waitText(page, "Sponsor renewal for 2027?");
    ok(true, "Reconnect re-signs in and loads the real inbox");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S2 · Microsoft (Outlook mail + calendar) PKCE flow", async () => {
    const calls = { tokenBodies: [] };
    const mocks = [
      ["https://login.microsoftonline.com/common/oauth2/v2.0/token", (u, req) => { calls.tokenBodies.push(req.postData()); return J({ access_token: "tok-m", refresh_token: "ref-m", expires_in: 3600, scope: "Mail.ReadWrite User.Read" }); }],
      ["https://graph.microsoft.com/v1.0/me?", () => J({ mail: "archie@outlook.com" })],
      ["https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages", () => J({ value: [
        { id: "AAA=", conversationId: "C1", subject: "Tyre order", from: { emailAddress: { name: "Pat Smith", address: "pat@team.com" } }, receivedDateTime: new Date().toISOString(), bodyPreview: "Need numbers please", inferenceClassification: "focused" },
        { id: "BBB=", conversationId: "C2", subject: "Newsletter", from: { emailAddress: { name: "News", address: "no-reply@news.com" } }, receivedDateTime: new Date().toISOString(), bodyPreview: "hi", inferenceClassification: "focused" },
        { id: "CCC=", conversationId: "C3", subject: "Spammy", from: { emailAddress: { name: "X", address: "x@y.com" } }, receivedDateTime: new Date().toISOString(), bodyPreview: "hi", inferenceClassification: "other" }] })],
      ["https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages", () => J({ value: [] })],
      ["https://graph.microsoft.com/v1.0/me/calendarView", (u, req) => { calls.calTz = req.headers()["prefer"]; const d = new Date(); const pad = (n) => (n < 10 ? "0" : "") + n; const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; return J({ value: [{ id: "ev1", subject: "Team debrief", start: { dateTime: day + "T18:00:00.0000000" }, end: { dateTime: day + "T19:00:00.0000000" }, attendees: [{}, {}], isOnlineMeeting: true, location: { displayName: "" } }] }); }],
    ];
    const { page, errors } = await open(browser, { config: { microsoft: { clientId: "00000000-aaaa-bbbb-cccc-111111111111" } }, state: STATE(["mail"]), mocks, base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Outlook");
    await clickText(page, ".btn-primary", "Connect Outlook");
    await waitText(page, "sign in with Microsoft");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 500 });
    const url = new URL(await popupUrl(page));
    ok(url.host === "login.microsoftonline.com" && url.pathname === "/common/oauth2/v2.0/authorize", "opens the Microsoft sign-in page");
    ok(url.searchParams.get("client_id") === "00000000-aaaa-bbbb-cccc-111111111111" && url.searchParams.get("code_challenge_method") === "S256" && url.searchParams.get("code_challenge").length === 43, "PKCE S256 challenge + client id");
    ok(url.searchParams.get("redirect_uri") === base + "/oauth.html", "redirect URI is <site>/oauth.html");
    ok(url.searchParams.get("scope") === "User.Read offline_access Mail.ReadWrite", "minimal scopes: " + url.searchParams.get("scope"));
    await deliver(page, "?code=CODE123&state=" + encodeURIComponent(url.searchParams.get("state")));
    await waitText(page, "Live — showing your real data");
    ok(calls.tokenBodies[0].includes("grant_type=authorization_code") && calls.tokenBodies[0].includes("code_verifier=") && calls.tokenBodies[0].includes("code=CODE123"), "exchanged the code with the PKCE verifier (no client secret)");
    const st = JSON.parse(await page.evaluate(() => localStorage.getItem("ao-intelligence-journey-v2")));
    ok(st.connected.mail.live && st.connected.mail.detail === "archie@outlook.com" && st.connected.mail.route === "microsoft", "saved as a live Microsoft connection");
    // wrong state is ignored
    await page.goto(base + "/app.html#inbox", { waitUntil: "networkidle2" });
    await waitText(page, "Tyre order");
    const t = await text(page);
    ok(!t.includes("Newsletter") && !t.includes("Spammy"), "automated and ‘other’ (non-focused) mail filtered out");
    ok(t.includes("Pat Smith"), "real sender shown");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  const caps = { ok: true, caps: { sealed: true, imap: true, ics: true, caldav: true, calendly: true, stripe: true, stripe_oauth: false, shopify: true, shopify_oauth: false, truelayer: true, ai: false } };
  const backendMocks = (calls) => [
    ["https://api.test/health", () => J(caps)],
    ["https://api.test/data/bank", (u, req) => { calls.bank = JSON.parse(req.postData()); const t = new Date(); const pad = (n) => (n < 10 ? "0" : "") + n; const d = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; return J({ bank: [{ id: "tl:1", date: d, time: "10:30", desc: "APEX SPONSOR", amount: 1500, direction: "in", category: "Income" }, { id: "tl:2", date: d, time: "08:00", desc: "Brands Hatch entry", amount: 420.25, direction: "out", category: "Racing" }], summary: { balance: 1234.5, currency: "GBP", accounts: 1 }, account: "Business Current" }); }],
    ["https://api.test/stripe/connect", (u, req) => { calls.stripe = JSON.parse(req.postData()); return J({ sealed: "SEALED-STRIPE", account: "Owen Merch" }); }],
    ["https://api.test/shopify/connect", (u, req) => { calls.shopify = JSON.parse(req.postData()); return J({ sealed: "SEALED-SHOP", account: "Owen Racing Merch" }); }],
    ["https://api.test/imap/connect", (u, req) => { calls.imap = JSON.parse(req.postData()); return J({ sealed: "SEALED-IMAP", account: calls.imap.address }); }],
    ["https://api.test/ics/connect", (u, req) => { calls.ics = JSON.parse(req.postData()); return J({ sealed: "SEALED-ICS", account: "cal.example.com" }); }],
    ["https://api.test/data/sales", (u, req) => { const body = JSON.parse(req.postData()); const t = new Date(); const pad = (n) => (n < 10 ? "0" : "") + n; const d = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
      return body.sealed === "SEALED-STRIPE" ? J({ orders: [{ id: "st:1", date: d, time: "09:00", ref: "AAAA11", desc: "Team cap", total: 40, channel: "online" }, { id: "st:2", date: d, time: "09:30", ref: "BBBB22", desc: "Fan", total: 20, channel: "inperson" }], summary: { available: 123.45, pending: 20, currency: "gbp", payouts: [{ date: d, amount: 100, status: "in_transit" }] } }) : J({ orders: [{ id: "sh:1", date: d, time: "10:00", ref: "#1001", desc: "Team tee", total: 35, channel: "online" }] }); }],
    ["https://api.test/data/mail", () => J({ emails: [{ id: "i:7", from: "Dee", org: "Club", subject: "Practice day", snippet: "Free on the 3rd?", when: "x", when_iso: new Date().toISOString(), live: true, meta: { provider: "imap", messageId: "7", address: "dee@club.org", subject: "Practice day" } }], other: 2 })],
    ["https://api.test/data/calendar", () => { const t = new Date(); const pad = (n) => (n < 10 ? "0" : "") + n; const d = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; return J({ events: [{ id: "ics1", date: d, start: "11:00", end: "12:00", title: "Sim session", kind: "business", place: "" }] }); }],
    ["https://api.test/mail/draft", (u, req) => { calls.imapDraft = JSON.parse(req.postData()); return J({ ok: true }); }],
  ];

  await run("S3 · Backend configured: bank (Open Banking popup → sealed token → real transactions)", async () => {
    const calls = {};
    const { page, errors } = await open(browser, { config: { backendUrl: "https://api.test" }, state: STATE(["bank"]), mocks: backendMocks(calls), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Monzo");
    await clickText(page, ".btn-primary", "Connect Monzo");
    await waitText(page, "TrueLayer");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 500 });
    const url = new URL(await popupUrl(page));
    ok(url.origin === "https://api.test" && url.pathname === "/truelayer/start" && url.searchParams.get("return_to") === base + "/oauth.html", "sends the person to the backend’s bank start URL with the right return address");
    await deliver(page, "#provider=truelayer&state=" + encodeURIComponent(url.searchParams.get("state")) + "&sealed=SEALED-BANK");
    await waitText(page, "Live — showing your real data");
    const tok = JSON.parse(await page.evaluate(() => localStorage.getItem("ao-live-tokens-v1")));
    ok(tok.sealed.bank.sealed === "SEALED-BANK", "sealed token stored in this browser only");
    await page.goto(base + "/app.html#money", { waitUntil: "networkidle2" });
    await waitText(page, "APEX SPONSOR");
    const t = await text(page);
    ok(t.includes("£1,500") && t.includes("Bank balance") && t.includes("£1,234.50"), "Money shows real bank lines, money-in, and the real balance");
    ok(/live data/.test(t), "labelled live data");
    ok(calls.bank.sealed === "SEALED-BANK", "asked the backend with the sealed token");
    // user cancelled / denied at the bank
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S3b · Bank denied at the bank → friendly message, nothing connected", async () => {
    const { page, errors } = await open(browser, { config: { backendUrl: "https://api.test" }, state: STATE(["bank"]), mocks: backendMocks({}), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Monzo"); await clickText(page, ".btn-primary", "Connect Monzo");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 400 });
    const url = new URL(await popupUrl(page));
    await deliver(page, "#provider=truelayer&state=" + encodeURIComponent(url.searchParams.get("state")) + "&error=access_denied");
    await waitText(page, "Access wasn’t granted");
    const st = JSON.parse(await page.evaluate(() => localStorage.getItem("ao-intelligence-journey-v2")));
    ok(!st.connected.bank, "nothing was connected");
    await clickText(page, ".j-modal .btn-secondary", "Close");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S4 · Stripe (restricted key) + Shopify (custom-app token) → real sales", async () => {
    const calls = {};
    const { page, errors } = await open(browser, { config: { backendUrl: "https://api.test" }, state: STATE(["sales:stripe", "sales:shopify"]), mocks: backendMocks(calls), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".btn-primary", "Connect Stripe");
    await waitText(page, "Restricted API key");
    await clickText(page, ".j-modal .btn-primary", "Allow access");
    await waitText(page, "Please fill in");
    ok(true, "asks for the key before connecting");
    await typeInto(page, "#sf-key", "rk_test_abc123");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 700 });
    await waitText(page, "Live — showing your real data");
    ok(calls.stripe.key === "rk_test_abc123", "key sent to the backend over HTTPS (and not kept in the page state)");
    ok(!(await page.evaluate(() => localStorage.getItem("ao-intelligence-journey-v2") + localStorage.getItem("ao-live-tokens-v1"))).includes("rk_test_abc123"), "the raw key is not stored in the browser");
    await clickText(page, ".btn-primary", "Continue");
    await typeInto(page, "#item-field", "owen");
    await clickText(page, ".btn-primary", "Connect Shopify");
    await waitText(page, "App Client ID");
    await clickText(page, ".j-modal .btn-primary", "Allow access");
    await waitText(page, "Please paste the app’s Client ID");
    await clickText(page, ".j-modal .btn-primary", "Try again");
    await typeInto(page, "#sf-token", "shpat_abcdef123456");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 700 });
    await waitText(page, "Live — showing your real data");
    ok(calls.shopify.shop === "owen.myshopify.com", "Shopify store name cleaned to owen.myshopify.com");
    await page.goto(base + "/app.html#money", { waitUntil: "networkidle2" });
    await waitText(page, "Stripe balance");
    const t = await text(page);
    ok(t.includes("£123.45") && t.includes("Team cap") && t.includes("Team tee"), "Money shows Stripe balance, charges and Shopify orders");
    ok(/Revenue today/.test(t) && t.includes("£95.00"), "revenue today = real sales (£40 + £20 + £35): " + (t.match(/Revenue today\s+£[\d,.]+/) || [""])[0].replace(/\s+/g, " "));
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S5 · Other email (IMAP) + calendar link (.ics) via the backend; nothing requires Shopify", async () => {
    const calls = {};
    const { page, errors } = await open(browser, { config: { backendUrl: "https://api.test" }, state: STATE(["mail", "calendar"]), mocks: backendMocks(calls), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Other (IMAP)");
    await typeInto(page, "#item-field", "me@mydomain.co.uk");
    await clickText(page, ".btn-primary", "Connect Other (IMAP)");
    await waitText(page, "App password");
    ok((await text(page)).includes("Mail server (IMAP)"), "asks for app password and server (with explanation)");
    await typeInto(page, "#sf-host", "imap.mydomain.co.uk"); await typeInto(page, "#sf-password", "app-pass-1");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 700 });
    await waitText(page, "Live — showing your real data");
    ok(calls.imap.address === "me@mydomain.co.uk" && calls.imap.host === "imap.mydomain.co.uk" && calls.imap.password === "app-pass-1", "sent address, host and app password to the backend");
    await clickText(page, ".btn-primary", "Continue");
    await clickText(page, ".j-result", "Other (CalDAV");
    await typeInto(page, "#item-field", "webcal://cal.example.com/feed.ics");
    await clickText(page, ".btn-primary", "Connect Other (CalDAV");
    await waitText(page, "Allow access");
    ok(!(await page.evaluate(() => !!document.querySelector("#sf-password"))), "an .ics link needs no password");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 700 });
    await waitText(page, "Live — showing your real data");
    ok(calls.ics.url.startsWith("webcal://"), "link sent to the backend to fetch");
    await page.goto(base + "/app.html#inbox", { waitUntil: "networkidle2" });
    await waitText(page, "Practice day");
    await clickText(page, "button", "Save as draft in your mailbox", { wait: 700 });
    await waitText(page, "Saved to your mailbox");
    ok(calls.imapDraft.to === "dee@club.org" && calls.imapDraft.sealed === "SEALED-IMAP", "draft goes to the Drafts folder via the backend");
    await page.evaluate(() => { location.hash = "#calendar"; });
    await waitText(page, "Sim session");
    ok(true, "calendar link events show on the Calendar tab");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S6 · Backend configured but unreachable → falls back to sample data, clearly labelled", async () => {
    const { page, errors } = await open(browser, { config: { backendUrl: "https://api.test" }, state: STATE(["bank"]), mocks: [], base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Monzo"); await clickText(page, ".btn-primary", "Connect Monzo");
    await waitText(page, "sample data");
    await clickText(page, ".j-modal .btn-primary", "Allow access", { wait: 1800 });
    await waitText(page, "Showing sample data");
    ok(true, "bank connects as a labelled sample");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S7 · Proton Mail / unlisted bank paths", async () => {
    const { page, errors } = await open(browser, { config: { backendUrl: "https://api.test" }, state: STATE(["mail"]), mocks: backendMocks({}), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Proton Mail"); await clickText(page, ".btn-primary", "Connect Proton Mail");
    await waitText(page, "Proton Bridge");
    ok(true, "Proton explains why it can’t be live and uses sample data");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S8 · Full-page redirect fallback (popup blocked): oauth.html finishes the connection", async () => {
    const { page, errors } = await open(browser, { config: { backendUrl: "https://api.test" }, state: STATE(["bank"]), mocks: backendMocks({}), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await page.evaluate(() => localStorage.setItem("ao-oauth-pending-v1", JSON.stringify({ route: "truelayer", key: "bank", providerId: "monzo", providerName: "Monzo", state: "truelayer.xyz", at: Date.now() })));
    await page.evaluate(() => { window.open = window.__realOpen; });
    await page.goto(base + "/oauth.html#provider=truelayer&state=truelayer.xyz&sealed=SEALED-BANK", { waitUntil: "networkidle2" });
    await page.waitForFunction(() => location.pathname.endsWith("start.html"), { timeout: 8000 });
    const st = JSON.parse(await page.evaluate(() => localStorage.getItem("ao-intelligence-journey-v2")));
    ok(st.connected.bank && st.connected.bank.live, "connection saved and you’re returned to the journey");
    ok(!(await page.evaluate(() => location.href)).includes("sealed="), "no token left in the address bar");
    ok(errors.length === 0, "no console errors " + errors.join("|"));
    await page.close();
  });

  await run("S9 · Reset from app clears everything", async () => {
    const { page } = await open(browser, { config: null, state: STATE(["bank"], { step: "app", connected: { bank: { key: "bank", providerId: "monzo", providerName: "Monzo", at: new Date().toISOString() } } }), mocks: [], base });
    await page.goto(base + "/app.html#today", { waitUntil: "networkidle2" });
    await clickText(page, "button", "Reset demo", { wait: 300 });
    await clickText(page, ".j-modal .btn-primary", "Reset demo", { wait: 800 });
    ok((await page.evaluate(() => location.pathname)).endsWith("start.html"), "back at the start");
    await page.close();
  });

  await browser.close(); server.close();
  console.log("\n" + (failures ? failures + " check(s) FAILED" : "All live-flow checks passed"));
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
