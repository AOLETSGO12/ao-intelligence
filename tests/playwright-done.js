// Mark-as-done: stubbed inbox, Chromium + WebKit, mobile + desktop.
// Usage: node tests/playwright-done.js <base-url>
const { chromium, webkit, devices } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8099/";
const PROXY_LIVE = /^https:/.test(BASE);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("  ✗ " + m); } else console.log("  ✓ " + m); };

const SEED = `(() => {
  if (localStorage.getItem("ao-meta-v1")) return;
  const account = { name: "Archie Owen", email: "archie@archieowenracing.com" };
  const racing = {
    v: 1, step: "app", cursor: 0, selected: ["mail"],
    connected: { mail: { live: true, route: "imap", providerName: "Zoho", providerId: "zoho", detail: "archie@archieowenracing.com", at: new Date().toISOString() } },
    skipped: [], requests: {}, doneTasks: [], replied: [], edits: {}, userTasks: [], userTargets: [],
    places: [], eventPlaces: {}, activityLog: [], dismissedActions: [], actionEdits: {}, dailyOverview: null,
    overviewPrefs: { time: "07:00", showReply: true, showInvoices: true, showBookings: true, showNewsletters: true },
    account, business: { name: "Archie Owen Racing", type: "business", industry: "motorsport", size: "solo" }, real: true
  };
  const personal = Object.assign({}, racing, {
    connected: {}, selected: [],
    business: { name: "Personal", type: "personal", industry: "other", size: "solo" }
  });
  localStorage.setItem("ao-dash-dash-racing-state", JSON.stringify(racing));
  localStorage.setItem("ao-dash-dash-personal-state", JSON.stringify(personal));
  localStorage.setItem("ao-meta-v1", JSON.stringify({
    v: 1, account, current: "dash-racing",
    dashboards: [
      { id: "dash-racing", name: "Archie Owen Racing", type: "business", industry: "motorsport", size: "solo", created: new Date().toISOString() },
      { id: "dash-personal", name: "Personal", type: "personal", created: new Date().toISOString() }
    ]
  }));
})();`;

const HOOK = `(() => {
  const mail = [{
    id: "i:17", from: "Sam Hill", org: "Apex Lube", subject: "Sponsorship call",
    snippet: "Can we talk about next season?", when: "Today", when_iso: new Date().toISOString(),
    drafts: [{ label: "Draft", body: "Hi Sam,\\n\\nThanks for getting in touch.\\n\\nArchie" }],
    live: true, meta: { provider: "imap", messageId: 17, address: "sam@apexlube.co.uk", subject: "Sponsorship call", rfcId: "<abc@mail.x>" }
  }];
  const payload = { mail, filed: [], otherMessages: 3, accounts: { mail: "archie@archieowenracing.com" }, errors: {}, extras: {}, calendar: [] };
  let live;
  Object.defineProperty(window, "AOLive", {
    configurable: true, enumerable: true,
    get() { return live; },
    set(v) {
      live = v;
      if (!v) return;
      v.load = function () { return Promise.resolve(JSON.parse(JSON.stringify(payload))); };
      v.fetchOverview = function (body) {
        window.__overviewSent = body;
        const ids = (body.emails || []).map((e) => e.id);
        return Promise.resolve({
          summary: ids.length ? "One message needs a reply." : "A quiet day so far — nothing waiting that needs you.",
          categories: {
            reply: { count: ids.length, ids, blurb: ids.length ? "A message is waiting for a reply." : "Nothing needs a reply." },
            invoices: { count: 0, ids: [] }, bookings: { count: 0, ids: [] }, newsletters: { count: 0, ids: [] }
          },
          actions: ids.map((id) => ({ id: "reply:" + id, title: "Reply to Sam Hill", tab: "inbox" }))
        });
      };
      v.saveDraft = function () { return Promise.resolve({ where: "mailbox" }); };
      v.rewriteDraft = function () { return Promise.resolve({ drafts: [] }); };
    }
  });
})();`;

async function run(engineName, engine, label, ctxOpts) {
  console.log(`\n${engineName} · ${label}`);
  const launch = engineName === "chromium" ? { executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] } : {};
  const b = await engine.launch(launch);
  const ctx = await b.newContext({ ...ctxOpts, serviceWorkers: "block" });
  await ctx.addInitScript(SEED);
  await ctx.addInitScript(HOOK);
  const p = await ctx.newPage();
  if (PROXY_LIVE && engineName === "webkit") {
    await ctx.route(/^https:\/\/(aoletsgo12\.github\.io|ao-intelligence-api\.ao-446557ec\.workers\.dev)\//, async (route) => {
      const rq = route.request(); const h = { "cache-control": "no-cache" }; const hd = rq.headers();
      for (const k of ["content-type", "origin", "access-control-request-method", "access-control-request-headers"]) if (hd[k]) h[k] = hd[k];
      const r = await fetch(rq.url(), { method: rq.method(), headers: h, body: ["GET", "HEAD", "OPTIONS"].includes(rq.method()) ? undefined : rq.postDataBuffer() });
      const out = {}; r.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding|connection)$/.test(k)) out[k] = v; });
      route.fulfill({ status: r.status, headers: out, body: Buffer.from(await r.arrayBuffer()) });
    });
  }
  const tap = async (loc) => {
    for (let i = 0; i < 4; i++) {
      try {
        await loc.waitFor({ state: "visible", timeout: 8000 });
        await loc.scrollIntoViewIfNeeded();
        await (ctxOpts.hasTouch ? loc.tap({ timeout: 5000 }) : loc.click({ timeout: 5000 }));
        await p.waitForTimeout(400);
        return;
      } catch (e) { if (i === 3) throw e; await p.waitForTimeout(400); }
    }
  };
  const txt = () => p.evaluate(() => document.body.innerText);
  const base = BASE.replace(/\/?$/, "/");
  await p.goto(base + "app.html#today", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => /Sponsorship call|Sam Hill/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);

  let t = await txt();
  ok(/Sam Hill/.test(t) && /Sponsorship call/.test(t), "Today/inbox data shows the stub email");
  const before = await p.evaluate(() => {
    const card = Array.from(document.querySelectorAll(".overview-card")).find((el) => /Needs a reply/i.test(el.innerText));
    const pill = card && card.querySelector(".count-pill");
    return pill ? pill.textContent.trim() : "";
  });
  ok(before === "1", "Needs a reply count is 1 before Done (got " + before + ")");
  ok(/Reply to Sam Hill|Sam Hill/.test(t), "Today mentions the waiting thread");

  await tap(p.locator(".app-tab", { hasText: "Inbox" }));
  await p.waitForTimeout(400);
  t = await txt();
  ok(/Sponsorship call/.test(t) && /Needs reply|Needs a reply/.test(t), "Inbox lists the message");
  await tap(p.locator(".email-card button", { hasText: /^Done$/ }).filter({ visible: true }).first());
  await p.waitForTimeout(500);
  t = await txt();
  ok(!/Sponsorship call/.test(t) || /Marked as done/.test(t) && (await p.locator(".email-card").filter({ hasText: "Sponsorship call" }).count()) === 0, "Inbox no longer lists the open message");
  ok(/Marked as done/.test(t) && await p.locator("button", { hasText: "Undo" }).count(), "Undo toast is shown");

  await tap(p.locator(".app-tab", { hasText: "Today" }));
  await p.waitForTimeout(500);
  t = await txt();
  const after = await p.evaluate(() => {
    const card = Array.from(document.querySelectorAll(".overview-card")).find((el) => /Needs a reply/i.test(el.innerText));
    const pill = card && card.querySelector(".count-pill");
    return pill ? pill.textContent.trim() : "";
  });
  ok(after === "0", "Needs a reply count dropped to 0 (got " + after + ")");
  ok(!/Reply to Sam Hill/.test(t) && !(t.match(/Sponsor and partner[\s\S]{0,200}Sponsorship call/)), "Today’s tasks and pipeline no longer list the sponsorship thread");
  ok(!/One message needs a reply/.test(t), "Morning summary no longer says a reply is waiting");
  const sent = await p.evaluate(() => window.__overviewSent && window.__overviewSent.emails);
  ok(!sent || !sent.some((e) => e.id === "i:17"), "later /overview payloads omit the completed id");

  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(1200);
  t = await txt();
  const afterReload = await p.evaluate(() => {
    const card = Array.from(document.querySelectorAll(".overview-card")).find((el) => /Needs a reply/i.test(el.innerText));
    const pill = card && card.querySelector(".count-pill");
    return { pill: pill ? pill.textContent.trim() : "", body: document.body.innerText };
  });
  ok(afterReload.pill === "0" && !/Reply to Sam Hill/.test(afterReload.body), "Still gone after reload (count 0, not in tasks/pipeline)");

  const personalVal = await p.locator("#dash-select option", { hasText: "Personal" }).getAttribute("value");
  await p.selectOption("#dash-select", personalVal);
  await p.waitForTimeout(1500);
  await p.waitForFunction(() => /Personal/.test(document.querySelector("#dash-select option:checked") && document.querySelector("#dash-select option:checked").textContent || ""), null, { timeout: 10000 }).catch(() => {});
  const racingVal = await p.locator("#dash-select option", { hasText: "Archie Owen Racing" }).getAttribute("value");
  await p.selectOption("#dash-select", racingVal);
  await p.waitForFunction(() => /Archie Owen Racing/.test(document.querySelector("#dash-select option:checked") && document.querySelector("#dash-select option:checked").textContent || ""), null, { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(1200);
  t = await txt();
  const afterSwitch = await p.evaluate(() => {
    const card = Array.from(document.querySelectorAll(".overview-card")).find((el) => /Needs a reply/i.test(el.innerText));
    const pill = card && card.querySelector(".count-pill");
    return pill ? pill.textContent.trim() : "";
  });
  ok(afterSwitch === "0" && !/Reply to Sam Hill/.test(t), "Still gone after switching dashboards and back");

  await tap(p.locator(".app-tab", { hasText: "Inbox" }));
  await p.waitForTimeout(400);
  await tap(p.locator(".inbox-filters button", { hasText: /^Done$/ }).filter({ visible: true }).first());
  await p.waitForTimeout(400);
  t = await txt();
  ok(/Sponsorship call/.test(t), "Done filter still lists the completed message");

  await p.screenshot({ path: `/tmp/done-${engineName}-${label}.png` });
  await b.close();
}

(async () => {
  const web = (process.env.ONLY || "chromium,webkit").split(",");
  for (const e of web) {
    const eng = e === "chromium" ? chromium : webkit;
    await run(e, eng, "mobile", e === "chromium" ? { ...devices["iPhone 14"], defaultBrowserType: undefined } : devices["iPhone 14"]);
    await run(e, eng, "desktop", { viewport: { width: 1280, height: 800 } });
  }
  console.log(fails ? `\n${fails} FAILED` : "\nall done-walk checks passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
