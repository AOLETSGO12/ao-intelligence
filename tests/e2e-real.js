/* End-to-end check of the REAL app (default mode) with fake providers: IMAP, ICS link, Stripe, Google, Microsoft.
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


const STATE = (selected, extra) => JSON.stringify(Object.assign({ v: 1, step: "w-item", cursor: 0, real: true, account: { name: "Archie Owen", email: "archie@example.com" }, business: { name: "Archie Owen Racing", industry: "motorsport", size: "solo" }, selected, connected: {}, skipped: [], requests: {}, doneTasks: [], replied: [], edits: {}, userTasks: [], userTargets: [] }, extra || {}));
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
    for (const [prefix, fn] of mocks || []) { if (url.startsWith(prefix)) { const r = fn(url, req); if (r) return req.respond(r); } }
    return req.abort();
  });
  await page.evaluateOnNewDocument((config, state) => {
    try {
      if (!sessionStorage.getItem("__seeded")) {
        sessionStorage.setItem("__seeded", "1");
        if (config) localStorage.setItem("ao-config-override", JSON.stringify(config));
        if (state) localStorage.setItem("ao-app-v1", state);
      }
    } catch (e) { /* ignore */ }
  }, config || null, state || null);
  return { page, errors, requests };
}
const text = (page) => page.evaluate(() => document.body.innerText);
async function clickText(page, sel, label, opts = {}) {
  try { await page.waitForFunction((sel, label) => [...document.querySelectorAll(sel)].some((e) => e.textContent.trim().includes(label) && !e.disabled), { timeout: 8000 }, sel, label); }
  catch (e) { console.log("    [debug] waiting for " + sel + " / " + label + "; page says: " + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 300)); throw e; }
  await page.evaluate((sel, label) => { [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(label) && !e.disabled).click(); }, sel, label);
  await sleep(opts.wait || 300);
}
async function waitText(page, needle, ms) { await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout: ms || 8000 }, needle); }
async function typeInto(page, sel, value) { await page.waitForSelector(sel); await page.click(sel, { clickCount: 3 }); await page.type(sel, value); }

const BACKEND = "https://api.test";
const caps = { ok: true, service: "ao-intelligence-api", caps: { sealed: true, imap: true, ics: true, caldav: true, calendly: true, stripe: true, stripe_oauth: false, shopify: true, shopify_oauth: false, truelayer: false, ai: false } };
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function backendMocks(calls, over) {
  over = over || {};
  return [
    [BACKEND + "/health", () => J(caps)],
    [BACKEND + "/imap/connect", (u, req) => { calls.imap = JSON.parse(req.postData()); return over.imap ? over.imap() : J({ sealed: "SEALED-IMAP", account: calls.imap.address }); }],
    [BACKEND + "/data/mail", () => J({ other: 4, emails: [{ id: "i1", from: "Sam Hill", org: "Apex Lube", subject: "Sponsor renewal for 2027?", snippet: "Can we talk through the 2027 package?", when: "Today", when_iso: new Date().toISOString(), drafts: [], live: true, meta: { provider: "imap", address: "sam@apexlube.co.uk", subject: "Sponsor renewal for 2027?", rfcId: "<abc@x>", refs: "" } }] })],
    [BACKEND + "/mail/draft", (u, req) => { calls.draft = JSON.parse(req.postData()); return J({ ok: true }); }],
    [BACKEND + "/ics/connect", (u, req) => { calls.ics = JSON.parse(req.postData()); return J({ sealed: "SEALED-ICS", account: "calendar.google.com" }); }],
    [BACKEND + "/data/calendar", () => J({ events: [{ id: "c1", date: today(), start: "23:30", end: "23:59", title: "Pit-lane walk", kind: "business", place: "Silverstone" }] })],
    [BACKEND + "/stripe/connect", (u, req) => { calls.stripe = JSON.parse(req.postData()); return J({ sealed: "SEALED-ST", account: "Stripe" }); }],
    [BACKEND + "/data/sales", () => J({ orders: [{ id: "ch_1", date: today(), time: "10:00", ref: "ch_1", desc: "Hoodie", total: 55, channel: "online" }], summary: { available: 1200.5, pending: 300, currency: "GBP", payouts: [{ date: today(), amount: 900, status: "paid" }] } })],
  ];
}

async function main() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"], headless: "new" });
  const run = async (name, fn) => { console.log("\n" + name); try { await fn(); } catch (e) { failures++; console.log("  ✗ threw: " + e.message.split("\n")[0]); } };

  await run("R1 · nothing configured: no OAuth buttons, honest notices, nothing breaks", async () => {
    const { page, errors } = await open(browser, { state: STATE(["mail"]), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Gmail");
    let t = await text(page);
    ok(!/Sign in with (Google|Microsoft)/.test(t), "no Google/Microsoft sign-in buttons without client IDs");
    ok(/isn’t been set up|hasn’t been set up|Connection service not switched on/.test(t), "service notice shown");
    await clickText(page, ".j-result", "Outlook.com");
    t = await text(page); ok(/One-time setup needed/.test(t) && !/Sign in with Microsoft\n/.test(t), "Outlook says what it needs");
    ok(errors.length === 0, "no console errors" + (errors.length ? ": " + errors.join(" | ") : ""));
    await page.close();
  });

  await run("R2 · backend: Gmail by app password, calendar by private link, Stripe key → real data everywhere", async () => {
    const calls = {};
    const { page, errors, requests } = await open(browser, { config: { backendUrl: BACKEND }, state: STATE(["mail", "calendar", "sales:stripe"]), mocks: backendMocks(calls), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Gmail");
    await typeInto(page, "#real-addr", "archie@gmail.com"); await typeInto(page, "#real-pass", "abcd efgh ijkl mnop");
    await clickText(page, ".btn-primary", "Connect Gmail", { wait: 800 });
    await waitText(page, "Gmail is connected");
    ok(calls.imap && calls.imap.password === "abcdefghijklmnop" && calls.imap.host === "imap.gmail.com" && calls.imap.address === "archie@gmail.com", "IMAP connect sent address, de-spaced app password and imap.gmail.com");
    await clickText(page, ".btn-primary", "Continue");
    await clickText(page, ".j-result", "Google Calendar");
    await typeInto(page, "#real-url", "https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc123/basic.ics");
    await clickText(page, ".btn-primary", "Connect Google Calendar", { wait: 800 });
    await waitText(page, "Google Calendar is connected");
    ok(calls.ics && /private-abc123/.test(calls.ics.url), "private .ics link sent to the backend");
    await clickText(page, ".btn-primary", "Continue");
    await typeInto(page, "#real-key", "sk_live_dangerous");
    await clickText(page, ".btn-primary", "Connect Stripe");
    await waitText(page, "restricted read-only key");
    ok(!calls.stripe, "a full secret key is refused client-side");
    await typeInto(page, "#real-key", "rk_test_abc123");
    await clickText(page, ".btn-primary", "Connect Stripe", { wait: 800 });
    await waitText(page, "Stripe is connected");
    ok(calls.stripe && calls.stripe.key === "rk_test_abc123", "restricted key sent");
    const st = JSON.parse(await page.evaluate(() => localStorage.getItem("ao-app-v1")));
    ok(!JSON.stringify(st).includes("abcdefgh") && !JSON.stringify(st).includes("rk_test"), "no password or key in the saved app state");
    const tok = await page.evaluate(() => localStorage.getItem("ao-live-tokens-v1"));
    ok(tok.includes("SEALED-IMAP") && !tok.includes("abcdefgh"), "only the sealed token is stored");
    await page.goto(base + "/app.html#inbox", { waitUntil: "networkidle2" });
    await waitText(page, "Sponsor renewal for 2027?");
    let t = await text(page);
    ok(/Sam Hill/.test(t) && /Quick reply/.test(t) && /Save as draft in your mailbox/.test(t), "Inbox shows the real message with template drafts and a save-draft button");
    ok(!/Sample|Demo|Live\b/.test(t.replace(/Live data/g, "")), "no sample/demo/live-pill wording");
    await clickText(page, "button", "Save as draft in your mailbox", { wait: 600 });
    await waitText(page, "Nothing has been sent");
    ok(calls.draft && calls.draft.to === "sam@apexlube.co.uk" && /Hi Sam/.test(calls.draft.body), "draft saved through the backend (never sent)");
    await page.goto(base + "/app.html#today", { waitUntil: "networkidle2" });
    await waitText(page, "Pit-lane walk"); ok(true, "Today shows the real calendar event");
    await page.goto(base + "/app.html#money", { waitUntil: "networkidle2" });
    await waitText(page, "Stripe balance"); t = await text(page);
    ok(/£1,200\.50/.test(t) && /Hoodie/.test(t), "Money shows the Stripe balance and orders");
    ok(errors.length === 0, "no console errors" + (errors.length ? ": " + errors.join(" | ") : ""));
    await page.close();
  });

  await run("R3 · wrong app password → friendly message, button works again", async () => {
    const calls = {};
    const { page } = await open(browser, { config: { backendUrl: BACKEND }, state: STATE(["mail"]), mocks: backendMocks(calls, { imap: () => J({ error: "The mail server didn’t accept those details. Check the address and app password.", code: "login" }, 401) }), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Yahoo");
    await typeInto(page, "#real-addr", "a@yahoo.com"); await typeInto(page, "#real-pass", "nope");
    await clickText(page, ".btn-primary", "Connect Yahoo", { wait: 600 });
    await waitText(page, "didn’t accept those details");
    const label = await page.evaluate(() => [...document.querySelectorAll(".btn-primary")].map((b) => b.textContent).join("|"));
    ok(/Connect Yahoo/.test(label), "button is back to “Connect Yahoo” and can be pressed again");
    await page.close();
  });

  await run("R4 · Google client ID configured → Google sign-in appears and works", async () => {
    const gm = { m1: { id: "m1", threadId: "t1", internalDate: String(Date.now() - 3600e3), snippet: "Hi Archie, can we talk?", payload: { headers: [{ name: "From", value: "Sam Hill <sam@apexlube.co.uk>" }, { name: "Subject", value: "Sponsor renewal for 2027?" }, { name: "Message-ID", value: "<abc@x>" }] } } };
    const mocks = [
      ["https://accounts.google.com/gsi/client", () => ({ status: 200, contentType: "text/javascript", body: "window.google={accounts:{oauth2:{initTokenClient:function(c){return{requestAccessToken:function(o){setTimeout(function(){c.callback({access_token:'tok-g',expires_in:3600,scope:c.scope})},30)}}},revoke:function(t,cb){cb&&cb()}}}};" })],
      ["https://gmail.googleapis.com/gmail/v1/users/me/profile", () => J({ emailAddress: "archie@gmail.com" })],
      ["https://gmail.googleapis.com/gmail/v1/users/me/messages?", () => J({ messages: [{ id: "m1" }] })],
      ["https://gmail.googleapis.com/gmail/v1/users/me/messages/", (u) => J(gm[u.split("/messages/")[1].split("?")[0]])],
      ["https://gmail.googleapis.com/gmail/v1/users/me/threads/", () => J({ messages: [{ labelIds: ["INBOX"] }] })],
    ];
    const { page, errors } = await open(browser, { config: { google: { clientId: "123-test.apps.googleusercontent.com" } }, state: STATE(["mail"]), mocks, base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Gmail");
    await waitText(page, "Sign in with Google instead");
    await clickText(page, ".btn", "Sign in with Google instead", { wait: 800 });
    await waitText(page, "Gmail is connected");
    await page.goto(base + "/app.html#inbox", { waitUntil: "networkidle2" });
    await waitText(page, "Sponsor renewal for 2027?");
    ok((await text(page)).includes("Save as draft in Gmail"), "Gmail drafts offered");
    ok(errors.length === 0, "no console errors" + (errors.length ? ": " + errors.join(" | ") : ""));
    await page.close();
  });

  await run("R5 · Microsoft client ID configured → Outlook shows Sign in with Microsoft", async () => {
    const { page } = await open(browser, { config: { microsoft: { clientId: "00000000-test" } }, state: STATE(["mail"]), base });
    await page.goto(base + "/start.html", { waitUntil: "networkidle2" });
    await clickText(page, ".j-result", "Outlook.com");
    await waitText(page, "Sign in with Microsoft");
    ok(!/One-time setup needed/.test(await text(page)), "no setup warning once configured");
    await page.close();
  });

  await run("R6 · demo mode only on purpose (?demo=1)", async () => {
    const { page } = await open(browser, { base });
    await page.goto(base + "/start.html?demo=1", { waitUntil: "networkidle2" });
    ok(/Demo mode/.test(await text(page)) && /Password/.test(await text(page)), "?demo=1 turns on the sample walkthrough");
    await page.goto(base + "/start.html?demo=0", { waitUntil: "networkidle2" });
    ok(!/Demo mode/.test(await text(page)), "?demo=0 returns to the real app");
    await page.close();
  });

  await browser.close(); server.close();
  console.log(failures ? "\n" + failures + " check(s) FAILED" : "\nAll real-app checks passed");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
