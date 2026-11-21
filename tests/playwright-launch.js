// Launch-ready checks: old demo URLs go to the real app, no DEMO DATA,
// and a Safari → Home Screen code handoff works in a standalone WebKit session.
// Usage: node tests/playwright-launch.js <base-url>
const { chromium, webkit, devices } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:8099/").replace(/\/?$/, "/");
const PROXY_LIVE = /^https:/.test(BASE);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("  ✗ " + m); } else console.log("  ✓ " + m); };

const FORBIDDEN = /DEMO DATA|Demo data|Rise & Crumb|Managed by your AI agent/i;

const SEED = `(() => {
  const account = { name: "Archie Owen", email: "archie@archieowenracing.com" };
  const racing = {
    v: 1, step: "app", cursor: 0, selected: ["mail","calendar"],
    connected: { calendar: { live: true, route: "caldav", providerName: "iCloud Calendar", providerId: "icloud", detail: "archie@archieowenracing.com", at: new Date().toISOString() } },
    skipped: [], requests: {}, doneTasks: [], replied: [], edits: {}, userTasks: [], userTargets: [],
    places: [], eventPlaces: {}, activityLog: [], dismissedActions: [], actionEdits: {}, dailyOverview: null,
    overviewPrefs: { time: "07:00", showReply: true, showInvoices: true, showBookings: true, showNewsletters: true },
    account, business: { name: "Owen Motorsport LTD", type: "business", industry: "motorsport", size: "solo" }, real: true
  };
  localStorage.setItem("ao-dash-dash-racing-state", JSON.stringify(racing));
  localStorage.setItem("ao-dash-dash-racing-tokens", JSON.stringify({ sealed: { calendar: { route: "caldav", sealed: "sealed-cal-blob" } } }));
  localStorage.setItem("ao-meta-v1", JSON.stringify({
    v: 1, account, current: "dash-racing",
    dashboards: [{ id: "dash-racing", name: "Owen Motorsport LTD", type: "business", industry: "motorsport", size: "solo", created: new Date().toISOString() }]
  }));
})();`;

const HOOK = `(() => {
  const store = new Map();
  const orig = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const u = String(url);
    if (/\\/handoff(\\/redeem)?$/.test(u)) {
      return Promise.resolve().then(() => {
        const body = JSON.parse((opts && opts.body) || "{}");
        if (u.indexOf("/handoff/redeem") !== -1) {
          const id = String(body.id || "").toUpperCase();
          if (!store.has(id)) return new Response(JSON.stringify({ error: "That code has expired or has already been used." }), { status: 404, headers: { "content-type": "application/json" } });
          const blob = store.get(id); store.delete(id);
          return new Response(JSON.stringify({ blob: blob }), { status: 200, headers: { "content-type": "application/json" } });
        }
        const id = "AB3DH7K4";
        store.set(id, body.blob);
        window.__handoffStore = store;
        return new Response(JSON.stringify({ id: id, expiresIn: 600 }), { status: 200, headers: { "content-type": "application/json" } });
      });
    }
    return orig(url, opts);
  };
})();`;

const STANDALONE = `(() => {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = function (q) {
    if (/display-mode:\\s*standalone/.test(q)) {
      return { matches: true, media: q, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } };
    }
    return orig(q);
  };
  try { Object.defineProperty(navigator, "standalone", { configurable: true, get: function () { return true; } }); } catch (e) { navigator.standalone = true; }
})();`;

async function launch(kind, mobile) {
  const browserType = kind === "webkit" ? webkit : chromium;
  const opts = kind === "chromium" ? { executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] } : {};
  const browser = await browserType.launch(opts);
  const device = mobile ? (kind === "chromium" ? { ...devices["iPhone 14"], defaultBrowserType: undefined } : devices["iPhone 14"]) : null;
  const contextOpts = device ? { ...device, serviceWorkers: "block" } : { serviceWorkers: "block", viewport: { width: 1280, height: 800 } };
  return { browser, contextOpts };
}

async function attachLiveProxy(ctx, kind) {
  if (!(PROXY_LIVE && kind === "webkit")) return;
  await ctx.route(/^https:\/\/(aoletsgo12\.github\.io|ao-intelligence-api\.ao-446557ec\.workers\.dev)\//, async (route) => {
    const rq = route.request(); const h = { "cache-control": "no-cache" }; const hd = rq.headers();
    for (const k of ["content-type", "origin", "access-control-request-method", "access-control-request-headers"]) if (hd[k]) h[k] = hd[k];
    const r = await fetch(rq.url(), { method: rq.method(), headers: h, body: ["GET", "HEAD", "OPTIONS"].includes(rq.method()) ? undefined : rq.postDataBuffer() });
    const out = {}; r.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding|connection)$/.test(k)) out[k] = v; });
    route.fulfill({ status: r.status, headers: out, body: Buffer.from(await r.arrayBuffer()) });
  });
}

async function noDemoText(page, label) {
  const t = await page.evaluate(() => document.body ? document.body.innerText : "");
  const html = await page.content();
  ok(!FORBIDDEN.test(t) && !FORBIDDEN.test(html), label + " has no DEMO DATA / Rise & Crumb / Managed by your AI agent");
}

async function checkDemoGone(kind) {
  console.log("\n" + kind + " · mobile · demo routes");
  const { browser, contextOpts } = await launch(kind, true);
  const context = await browser.newContext(contextOpts);
  await attachLiveProxy(context, kind);
  const page = await context.newPage();
  await page.goto(BASE + "index.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await noDemoText(page, "Landing page");
  const hrefs = await page.$$eval("a[href]", as => as.map(a => a.getAttribute("href")));
  ok(!hrefs.some(h => /dashboard\.html|business\.html/i.test(h || "")), "Landing page has no links to the old demo pages");

  await page.goto(BASE + "dashboard.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  const url1 = page.url();
  ok(/start\.html|app\.html/i.test(url1), "dashboard.html redirected to the real app (got " + url1 + ")");
  await noDemoText(page, "dashboard.html destination");
  const title1 = await page.title();
  ok(!/DEMO/i.test(title1), "destination title is not the demo dashboard");

  await page.goto(BASE + "business.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(500);
  const url2 = page.url();
  ok(/start\.html|app\.html/i.test(url2), "business.html redirected to the real app (got " + url2 + ")");
  await noDemoText(page, "business.html destination");

  await page.addInitScript(SEED);
  await page.goto(BASE + "dashboard.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  ok(/app\.html/i.test(page.url()), "dashboard.html with an account goes to app.html");
  const t = await page.evaluate(() => document.body && document.body.innerText || "");
  ok(/Owen Motorsport LTD/i.test(t), "real dashboard shows the seeded business");
  ok(!FORBIDDEN.test(t), "real dashboard has no demo wording");
  ok(!(await page.$(".app-tabbar")), "no leftover demo tab bar");

  await context.close();
  await browser.close();
}

async function checkHandoff() {
  console.log("\nwebkit · standalone handoff");
  const { browser, contextOpts } = await launch("webkit", true);
  // Safari context: has dashboards, creates a code
  const safari = await browser.newContext(contextOpts);
  await attachLiveProxy(safari, "webkit");
  await safari.addInitScript(SEED);
  await safari.addInitScript(HOOK);
  const sPage = await safari.newPage();
  await sPage.goto(BASE + "app.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sPage.waitForTimeout(800);
  const started = await sPage.evaluate(() => document.body && document.body.innerText || "");
  ok(/Owen Motorsport LTD/i.test(started), "Safari session shows the real dashboard");
  // open settings
  const settingsBtn = sPage.locator("#app-settings");
  ok(await settingsBtn.count(), "Settings button is in the header");
  await settingsBtn.click();
  await sPage.waitForTimeout(400);
  const settingsText = await sPage.evaluate(() => document.body && document.body.innerText || "");
  ok(/Use on Home Screen/i.test(settingsText), "Settings has Use on Home Screen");
  await sPage.getByRole("button", { name: "Create a code" }).click();
  await sPage.waitForTimeout(600);
  const code = await sPage.locator(".handoff-code").textContent();
  ok(code && /[A-Z0-9]{4}-[A-Z0-9]{4}/.test(code), "a one-time code is shown (" + code + ")");

  // grab the stub store blob so the other context can redeem (fetch hook is per-document)
  const blob = await sPage.evaluate(() => {
    const s = window.__handoffStore;
    return s && s.get("AB3DH7K4");
  });
  ok(!!blob, "encrypted blob was stored (Worker never given plaintext in this walk)");

  // Home Screen context: empty storage, standalone, enter the code
  const home = await browser.newContext(contextOpts);
  await attachLiveProxy(home, "webkit");
  await home.addInitScript(STANDALONE);
  await home.addInitScript(`(() => {
    const blob = ${JSON.stringify(blob)};
    const orig = window.fetch.bind(window);
    window.fetch = function (url, opts) {
      const u = String(url);
      if (u.indexOf("/handoff/redeem") !== -1) {
        const body = JSON.parse((opts && opts.body) || "{}");
        const id = String(body.id || "").toUpperCase();
        if (id !== "AB3DH7K4" || !blob) {
          return Promise.resolve(new Response(JSON.stringify({ error: "That code has expired or has already been used." }), { status: 404, headers: { "content-type": "application/json" } }));
        }
        window.__redeemed = id;
        return Promise.resolve(new Response(JSON.stringify({ blob: blob }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (/\\/handoff$/.test(u)) {
        return Promise.resolve(new Response(JSON.stringify({ error: "not used" }), { status: 400, headers: { "content-type": "application/json" } }));
      }
      return orig(url, opts);
    };
  })();`);
  const hPage = await home.newPage();
  await hPage.goto(BASE + "start.html", { waitUntil: "domcontentloaded", timeout: 60000 });
  await hPage.waitForTimeout(700);
  const first = await hPage.evaluate(() => document.body && document.body.innerText || "");
  ok(/Already set up in Safari/i.test(first), "first-run screen offers to enter a Safari code");
  ok(!FORBIDDEN.test(first), "first-run has no demo wording");
  await hPage.locator("#handoff-code").fill(code.trim());
  await hPage.getByRole("button", { name: "Bring my dashboards" }).click();
  await hPage.waitForTimeout(1200);
  ok(/app\.html/i.test(hPage.url()), "after entering the code, the Home Screen app opens the real dashboard");
  const homeText = await hPage.evaluate(() => document.body && document.body.innerText || "");
  ok(/Owen Motorsport LTD/i.test(homeText), "imported dashboard is on the Home Screen app");
  ok(!FORBIDDEN.test(homeText), "Home Screen app has no demo wording");
  const hasSealed = await hPage.evaluate(() => {
    try { return /sealed-cal-blob/.test(localStorage.getItem("ao-dash-dash-racing-tokens") || ""); }
    catch (e) { return false; }
  });
  ok(hasSealed, "sealed connection blob was imported");
  ok(!(await hPage.$(".app-tabbar")), "standalone session has no leftover demo tab bar");

  await safari.close();
  await home.close();
  await browser.close();
}

(async () => {
  try {
    await checkDemoGone("chromium");
    await checkDemoGone("webkit");
    await checkHandoff();
  } catch (e) {
    fails++;
    console.log("  ✗ unexpected error: " + (e && e.stack || e));
  }
  if (fails) {
    console.log("\n" + fails + " launch-walk checks failed");
    process.exit(1);
  }
  console.log("\nall launch-walk checks passed");
})();
