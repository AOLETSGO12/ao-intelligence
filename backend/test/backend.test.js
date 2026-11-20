import { test } from "node:test";
import assert from "node:assert/strict";
import { seal, unseal, signState, verifyState, hmacHex } from "../src/seal.js";
import { parseIcs } from "../src/ics.js";
import { ImapClient, listNeedingReply, buildDraft, findDraftsFolder, appendDraft, decodeWords, snippetFromBody, parseHeaders } from "../src/imap.js";
import { createHandler, caps } from "../src/index.js";
import { startFakeImap, nodeSocket } from "./fake-imap.js";

const KEY = "test-seal-key-0123456789abcdef";

test("seal round-trips and rejects tampering and wrong keys", async () => {
  const t = await seal(KEY, { t: "imap", pass: "secret" });
  assert.deepEqual(await unseal(KEY, t), { t: "imap", pass: "secret" });
  assert.ok(!t.includes("secret"));
  await assert.rejects(unseal(KEY, t.slice(0, -3) + "AAA"), /no longer valid/);
  await assert.rejects(unseal("another-key-0123456789abcdef", t), /no longer valid/);
  const st = await signState(KEY, { a: 1, exp: Date.now() + 1000 });
  assert.equal((await verifyState(KEY, st)).a, 1);
  const [b0, s0] = st.split("."); assert.equal(await verifyState(KEY, b0 + "." + (s0[0] === "A" ? "B" : "A") + s0.slice(1)), null);
  assert.equal(await verifyState(KEY, await signState(KEY, { exp: Date.now() - 1 })), null);
});

test("ics: timed (UTC + zoned), all-day, weekly recurrence with EXDATE and an edited instance", () => {
  const ics = [
    "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:a1", "DTSTART:20261120T140000Z", "DTEND:20261120T150000Z", "SUMMARY:Sponsor call\\, Apex", "LOCATION:https://meet.google.com/abc", "END:VEVENT",
    "BEGIN:VEVENT", "UID:a2", "DTSTART;TZID=Europe/London:20261121T090000", "DTEND;TZID=Europe/London:20261121T100000", "SUMMARY:Sim session", "ATTENDEE:mailto:x@y.com", "END:VEVENT",
    "BEGIN:VEVENT", "UID:a3", "DTSTART;VALUE=DATE:20261122", "DTEND;VALUE=DATE:20261124", "SUMMARY:Race weekend", "END:VEVENT",
    "BEGIN:VEVENT", "UID:w1", "DTSTART;TZID=Europe/London:20261116T180000", "DTEND;TZID=Europe/London:20261116T190000", "RRULE:FREQ=WEEKLY;BYDAY=MO", "EXDATE;TZID=Europe/London:20261130T180000", "SUMMARY:Team debrief", "END:VEVENT",
    "BEGIN:VEVENT", "UID:w1", "RECURRENCE-ID;TZID=Europe/London:20261123T180000", "DTSTART;TZID=Europe/London:20261123T200000", "DTEND;TZID=Europe/London:20261123T210000", "SUMMARY:Team debrief (moved)", "END:VEVENT",
    "BEGIN:VEVENT", "UID:c1", "DTSTART:20261125T100000Z", "STATUS:CANCELLED", "SUMMARY:Cancelled thing", "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const ev = parseIcs(ics, { from: "2026-11-20", to: "2026-12-04", tz: "Europe/London" });
  const by = (t) => ev.filter((e) => e.title === t);
  assert.equal(by("Sponsor call, Apex")[0].start, "14:00");
  assert.equal(by("Sponsor call, Apex")[0].kind, "meeting");
  assert.equal(by("Sim session")[0].start, "09:00");
  assert.deepEqual(by("Race weekend").map((e) => e.date), ["2026-11-22", "2026-11-23"]);
  assert.ok(by("Race weekend").every((e) => e.allDay));
  assert.deepEqual(by("Team debrief").map((e) => e.date), []); // 16 Nov is before the window, 23 Nov replaced, 30 Nov excluded, 7 Dec after the window
  assert.deepEqual(by("Team debrief (moved)").map((e) => e.start), ["20:00"]);
  assert.equal(by("Cancelled thing").length, 0);
});

test("ics: UTC converts into the person's time zone (BST/GMT aware)", () => {
  const ev = parseIcs("BEGIN:VEVENT\r\nUID:z\r\nDTSTART:20260715T130000Z\r\nDTEND:20260715T140000Z\r\nSUMMARY:Summer\r\nEND:VEVENT", { from: "2026-07-01", to: "2026-07-31", tz: "Europe/London" });
  assert.equal(ev[0].start, "14:00"); // BST
});

test("imap helpers decode headers and bodies", () => {
  assert.equal(decodeWords("=?UTF-8?B?Q2Fmw6k=?= menu"), "Café menu");
  assert.equal(decodeWords("=?iso-8859-1?Q?Andr=E9?="), "André");
  const h = parseHeaders("Subject: Hello\r\n there\r\nFrom: A <a@b.com>");
  assert.equal(h.subject, "Hello there");
  const mp = snippetFromBody({ "content-type": 'multipart/alternative; boundary="B"' }, new TextEncoder().encode('--B\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nCan you do 14th at Brands?=0AThanks=21\r\n--B\r\nContent-Type: text/html\r\n\r\n<p>x</p>\r\n--B--'));
  assert.match(mp, /^Can you do 14th at Brands\? Thanks!/);
});

test("imap: read-only listing filters automated mail, saves drafts into the Drafts folder", async () => {
  const mk = (uid, from, subject, body, extra = "", flags = "") => ({ uid, flags, date: "20-Nov-2026 09:00:00 +0000", headers: `From: ${from}\r\nSubject: ${subject}\r\n${extra}\r\n`, body });
  const fake = await startFakeImap({
    messages: [
      mk(1, "Sam Hill <sam@apexlube.co.uk>", "Sponsor renewal for 2027?", "Hi, can we talk about next season? Thanks, Sam"),
      mk(2, "Shop Alerts <noreply@shop.com>", "Your order shipped", "Tracking"),
      mk(3, "Jo <jo@club.org>", "Entry list", "Are you in?", "", "\\Answered"),
      mk(4, "Me <me@example.com>", "Note to self", "x"),
      mk(5, "Pat <pat@team.com>", "=?UTF-8?B?Q2Fmw6k=?= tyre order", "Need numbers please", "Reply-To: Pat Orders <orders@team.com>\r\n"),
    ],
  });
  const c = new ImapClient(await nodeSocket(fake.port));
  await c.greeting(); await c.login("me@example.com", "app-pass");
  const r = await listNeedingReply(c, { selfAddress: "me@example.com", tz: "Europe/London" });
  assert.deepEqual(r.emails.map((e) => e.from).sort(), ["Pat", "Sam Hill"]);
  assert.equal(r.emails.find((e) => e.from === "Pat").subject, "Café tyre order");
  assert.equal(r.emails.find((e) => e.from === "Pat").meta.address, "orders@team.com");
  assert.equal(r.other, 3);
  const folder = await findDraftsFolder(c);
  assert.equal(folder, "Entwürfe");
  await appendDraft(c, folder, buildDraft({ from: "me@example.com", to: "sam@apexlube.co.uk", subject: "Sponsor renewal for 2027?", body: "Hi Sam — yes, let’s talk.", inReplyTo: "<abc@x>" }));
  assert.equal(fake.state.appended.length, 1);
  assert.equal(fake.state.appended[0].folder, "Entwürfe");
  assert.match(fake.state.appended[0].message, /Subject: Re: Sponsor renewal/);
  assert.match(fake.state.appended[0].message, /In-Reply-To: <abc@x>/);
  await c.logout(); fake.close();
});

test("imap: wrong password gives a friendly error; LOGIN fallback works", async () => {
  const fake = await startFakeImap({ messages: [], supportsPlain: false });
  const c1 = new ImapClient(await nodeSocket(fake.port)); await c1.greeting();
  await c1.login("me@example.com", "app-pass"); assert.equal(fake.state.logins, 1); await c1.logout();
  const c2 = new ImapClient(await nodeSocket(fake.port)); await c2.greeting();
  await assert.rejects(c2.login("me@example.com", "nope"), /didn’t accept those details/); await c2.logout();
  fake.close();
});

// ------------------------------------------------------------- the Worker's HTTP surface
const ENV = { SEAL_KEY: KEY, ALLOWED_ORIGIN: "https://aoletsgo12.github.io", FRONTEND_URL: "https://aoletsgo12.github.io/ao-intelligence", TRUELAYER_ENV: "sandbox", TRUELAYER_CLIENT_ID: "sandbox-id", TRUELAYER_CLIENT_SECRET: "sec", SHOPIFY_API_KEY: "k", SHOPIFY_API_SECRET: "shopsecret", STRIPE_CONNECT_CLIENT_ID: "ca_x", STRIPE_SECRET_KEY: "sk_test_platform" };
const ORIGIN = "https://aoletsgo12.github.io";
const call = (h, env, path, { method = "GET", body, origin = ORIGIN } = {}) => h(new Request("https://api.example.workers.dev" + path, { method, headers: { origin, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), env);

test("health reports what is switched on, with CORS only for the site", async () => {
  const h = createHandler({ fetchImpl: async () => { throw new Error("no network"); } });
  const r = await call(h, ENV, "/health");
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.caps.truelayer, true); assert.equal(j.caps.stripe_oauth, true); assert.equal(j.caps.ai, false);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal((await call(h, ENV, "/health", { origin: "https://evil.example" })).headers.get("access-control-allow-origin"), null);
  const bare = await (await call(h, {}, "/health")).json();
  assert.equal(bare.ok, false);
  const pre = await call(h, ENV, "/data/mail", { method: "OPTIONS" });
  assert.equal(pre.status, 204);
});

test("POST routes refuse other origins and bad return addresses", async () => {
  const h = createHandler({ fetchImpl: async () => { throw new Error("no network"); } });
  assert.equal((await call(h, ENV, "/stripe/connect", { method: "POST", body: {}, origin: "https://evil.example" })).status, 403);
  assert.equal((await call(h, ENV, "/truelayer/start?return_to=https://evil.example/x")).status, 400);
});

test("truelayer: start redirect, callback exchange, then bank data (with token refresh)", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push(url);
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
    if (url.endsWith("/connect/token")) {
      const p = new URLSearchParams(init.body);
      if (p.get("grant_type") === "authorization_code") return J({ access_token: "A1", refresh_token: "R1", expires_in: 3600 });
      return J({ access_token: "A2", refresh_token: "R2", expires_in: 3600 });
    }
    if (url.endsWith("/data/v1/accounts")) return J({ results: [{ account_id: "acc1", display_name: "Business Current" }] });
    if (url.includes("/balance")) return J({ results: [{ current: 1234.5, currency: "GBP" }] });
    if (url.includes("/transactions")) return J({ results: [
      { transaction_id: "t1", timestamp: "2026-11-19T10:30:00Z", description: "APEX LUBRICANTS SPONSOR", amount: 1500, transaction_type: "CREDIT", transaction_classification: ["Income"] },
      { transaction_id: "t2", timestamp: "2026-11-18T08:00:00Z", description: "BRANDS HATCH ENTRY", merchant_name: "Brands Hatch", amount: -420.25, transaction_type: "DEBIT", transaction_classification: ["Entertainment", "Sport"] },
      { transaction_id: "t3", timestamp: "2026-11-17T08:00:00Z", description: "DD INSURANCE", amount: -55, transaction_type: "DIRECT_DEBIT", transaction_classification: [] },
    ] });
    throw new Error("unexpected " + url);
  };
  const h = createHandler({ fetchImpl });
  const ret = ENV.FRONTEND_URL + "/oauth.html";
  const start = await call(h, ENV, "/truelayer/start?state=client123&return_to=" + encodeURIComponent(ret));
  assert.equal(start.status, 302);
  const loc = new URL(start.headers.get("location"));
  assert.equal(loc.host, "auth.truelayer-sandbox.com");
  assert.equal(loc.searchParams.get("client_id"), "sandbox-id");
  assert.match(loc.searchParams.get("scope"), /transactions/);
  assert.equal(loc.searchParams.get("redirect_uri"), "https://api.example.workers.dev/truelayer/callback");
  const cb = await call(h, ENV, "/truelayer/callback?code=abc&state=" + encodeURIComponent(loc.searchParams.get("state")));
  assert.equal(cb.status, 302);
  const back = new URL(cb.headers.get("location"));
  assert.equal(back.origin + back.pathname, ret);
  const frag = new URLSearchParams(back.hash.slice(1));
  assert.equal(frag.get("state"), "client123");
  const sealed = frag.get("sealed");
  assert.ok(sealed && !sealed.includes("A1"));
  const data = await (await call(h, ENV, "/data/bank", { method: "POST", body: { sealed, days: 30, tz: "Europe/London" } })).json();
  assert.equal(data.bank.length, 3);
  assert.deepEqual(data.bank.map((t) => t.direction), ["in", "out", "out"]);
  assert.equal(data.bank[1].amount, 420.25); assert.equal(data.bank[1].category, "Entertainment"); assert.equal(data.bank[2].category, "Direct debits");
  assert.equal(data.summary.balance, 1234.5);
  // expired token -> refresh, new sealed returned
  const expired = await seal(KEY, { t: "tl", access: "old", refresh: "R1", exp: 1 });
  const d2 = await (await call(h, ENV, "/data/bank", { method: "POST", body: { sealed: expired } })).json();
  assert.ok(d2.sealed);
  assert.deepEqual(await unseal(KEY, d2.sealed), { t: "tl", access: "A2", refresh: "R2", exp: (await unseal(KEY, d2.sealed)).exp });
  // denied at the bank
  const st2 = new URL((await call(h, ENV, "/truelayer/start?state=c2&return_to=" + encodeURIComponent(ret))).headers.get("location")).searchParams.get("state");
  const denied = await call(h, ENV, "/truelayer/callback?error=access_denied&state=" + encodeURIComponent(st2));
  assert.match(denied.headers.get("location"), /error=access_denied/);
  // tampered state
  assert.equal((await call(h, ENV, "/truelayer/callback?code=x&state=bogus")).status, 400);
});

test("stripe: restricted key connect + balance, charges and payouts", async () => {
  const now = Math.floor(Date.now() / 1000);
  const fetchImpl = async (url, init = {}) => {
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
    assert.match(init.headers.authorization, /^Bearer rk_test_/);
    if (url.endsWith("/v1/balance")) return J({ available: [{ amount: 12345, currency: "gbp" }], pending: [{ amount: 2000, currency: "gbp" }] });
    if (url.endsWith("/v1/account")) return J({ error: { message: "no" } }, 403);
    if (url.includes("/v1/charges")) return J({ has_more: false, data: [
      { id: "ch_aaaa11", paid: true, status: "succeeded", amount: 4500, amount_refunded: 500, currency: "gbp", created: now - 3600, description: "Team cap x3", payment_method_details: { type: "card" } },
      { id: "ch_bbbb22", paid: true, status: "succeeded", amount: 2000, amount_refunded: 0, currency: "gbp", created: now - 7200, billing_details: { name: "A Fan" }, payment_method_details: { type: "card_present" } },
      { id: "ch_cccc33", paid: false, status: "failed", amount: 999, currency: "gbp", created: now - 100 },
      { id: "ch_dddd44", paid: true, status: "succeeded", amount: 999, currency: "usd", created: now - 100 },
    ] });
    if (url.includes("/v1/payouts")) return J({ data: [{ arrival_date: now + 86400, amount: 10000, status: "in_transit" }] });
    throw new Error("unexpected " + url);
  };
  const h = createHandler({ fetchImpl });
  assert.equal((await call(h, ENV, "/stripe/connect", { method: "POST", body: { key: "not-a-key" } })).status, 400);
  const c = await (await call(h, ENV, "/stripe/connect", { method: "POST", body: { key: "rk_test_abc123" } })).json();
  assert.equal(c.account, "Stripe (test mode)");
  const d = await (await call(h, ENV, "/data/sales", { method: "POST", body: { sealed: c.sealed, days: 30 } })).json();
  assert.equal(d.orders.length, 2);
  assert.equal(d.orders[0].total, 40); assert.equal(d.orders[0].desc, "Team cap x3"); assert.equal(d.orders[1].channel, "inperson");
  assert.equal(d.summary.available, 123.45); assert.equal(d.summary.pending, 20); assert.equal(d.summary.payouts[0].amount, 100);
});

test("shopify: custom-app token connect + orders (pagination, filters) and OAuth callback verification", async () => {
  const fetchImpl = async (url, init = {}) => {
    const J = (o, h = {}) => new Response(JSON.stringify(o), { status: 200, headers: h });
    assert.equal(init.headers["x-shopify-access-token"], "shpat_abcdef123456");
    if (url.includes("/shop.json")) return J({ shop: { name: "Owen Racing Merch" } });
    if (url.includes("orders.json") && !url.includes("page_info")) return J({ orders: [
      { id: 1, name: "#1001", created_at: "2026-11-19T10:00:00Z", total_price: "35.00", currency: "GBP", financial_status: "paid", line_items: [{ title: "Team tee" }, { title: "Cap" }, { title: "Sticker" }], source_name: "web" },
      { id: 2, name: "#1002", created_at: "2026-11-19T11:00:00Z", total_price: "20.00", currency: "GBP", financial_status: "pending" },
    ] }, { link: '<https://owen.myshopify.com/admin/api/2025-01/orders.json?page_info=zzz&limit=250>; rel="next"' });
    if (url.includes("page_info")) return J({ orders: [{ id: 3, name: "#1003", created_at: "2026-11-18T09:00:00Z", total_price: "12.50", currency: "GBP", financial_status: "paid", line_items: [{ title: "Mug" }], source_name: "pos" }, { id: 4, name: "#1004", created_at: "2026-11-18T09:30:00Z", total_price: "9.00", currency: "GBP", financial_status: "paid", cancelled_at: "2026-11-18T10:00:00Z" }] });
    throw new Error("unexpected " + url);
  };
  const h = createHandler({ fetchImpl });
  assert.equal((await call(h, ENV, "/shopify/connect", { method: "POST", body: { shop: "not a shop!", token: "shpat_abcdef123456" } })).status, 400);
  const c = await (await call(h, ENV, "/shopify/connect", { method: "POST", body: { shop: "https://owen.myshopify.com/admin", token: "shpat_abcdef123456" } })).json();
  assert.equal(c.account, "Owen Racing Merch");
  const d = await (await call(h, ENV, "/data/sales", { method: "POST", body: { sealed: c.sealed } })).json();
  assert.deepEqual(d.orders.map((o) => o.ref), ["#1001", "#1003"]);
  assert.equal(d.orders[0].desc, "Team tee, Cap +1 more"); assert.equal(d.orders[1].channel, "inperson");
  // OAuth callback: HMAC must verify
  const ret = ENV.FRONTEND_URL + "/oauth.html";
  const start = await call(h, ENV, "/shopify/start?shop=owen&state=cs&return_to=" + encodeURIComponent(ret));
  const sl = new URL(start.headers.get("location"));
  assert.equal(sl.host, "owen.myshopify.com"); assert.equal(sl.searchParams.get("scope"), "read_orders");
  const state = sl.searchParams.get("state");
  const q = `code=c1&shop=owen.myshopify.com&state=${encodeURIComponent(state)}&timestamp=1`;
  const sp = new URLSearchParams(q);
  const msg = [...sp.entries()].map(([k, v]) => `${k}=${v}`).sort().join("&");
  const good = await hmacHex(ENV.SHOPIFY_API_SECRET, msg);
  assert.equal((await call(h, ENV, "/shopify/callback?" + q + "&hmac=" + "0".repeat(64))).status, 400);
  const h2 = createHandler({ fetchImpl: async (url) => new Response(JSON.stringify({ access_token: "shpat_new" }), { status: 200 }) });
  const ok = await call(h2, ENV, "/shopify/callback?" + q + "&hmac=" + good);
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get("location"), /^https:\/\/aoletsgo12\.github\.io\/ao-intelligence\/oauth\.html#provider=shopify&state=cs&sealed=/);
});

test("imap routes: connect + data + draft through the Worker", async () => {
  const fake = await startFakeImap({ messages: [{ uid: 7, flags: "", date: "20-Nov-2026 08:00:00 +0000", headers: "From: Dee <dee@club.org>\r\nSubject: Practice day\r\n\r\n", body: "Are you free on the 3rd?" }] });
  const h = createHandler({ openImap: async () => nodeSocket(fake.port), fetchImpl: async () => { throw new Error("no"); } });
  assert.equal((await call(h, ENV, "/imap/connect", { method: "POST", body: { address: "me@example.com", password: "wrong", host: "imap.example.com" } })).status, 401);
  assert.equal((await call(h, ENV, "/imap/connect", { method: "POST", body: { address: "me@example.com", password: "app-pass", host: "127.0.0.1" } })).status, 400);
  const c = await (await call(h, ENV, "/imap/connect", { method: "POST", body: { address: "me@example.com", password: "app-pass", host: "imap.example.com" } })).json();
  assert.ok(c.sealed && !c.sealed.includes("app-pass"));
  const d = await (await call(h, ENV, "/data/mail", { method: "POST", body: { sealed: c.sealed } })).json();
  assert.equal(d.emails[0].from, "Dee"); assert.match(d.emails[0].snippet, /free on the 3rd/);
  const dr = await call(h, ENV, "/mail/draft", { method: "POST", body: { sealed: c.sealed, to: "dee@club.org", subject: "Practice day", body: "Yes!" } });
  assert.equal(dr.status, 200); assert.equal(fake.state.appended.length, 1);
  fake.close();
});

test("ics + caldav + calendly through the Worker", async () => {
  const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:q\r\nDTSTART:" + new Date(Date.now() + 86400000).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z\r\nSUMMARY:Test day\r\nEND:VEVENT\r\nEND:VCALENDAR";
  const dav = (xml) => new Response(xml, { status: 207 });
  const fetchImpl = async (url, init = {}) => {
    if (url.startsWith("https://cal.example.com/feed.ics")) return new Response(ics, { status: 200 });
    if (url.startsWith("https://api.calendly.com/users/me")) return new Response(JSON.stringify({ resource: { uri: "https://api.calendly.com/users/U1", name: "Archie", email: "a@x.com" } }));
    if (url.startsWith("https://api.calendly.com/scheduled_events")) return new Response(JSON.stringify({ collection: [{ uri: "https://api.calendly.com/scheduled_events/E1", name: "Intro call", start_time: new Date(Date.now() + 86400000).toISOString(), end_time: new Date(Date.now() + 90000000).toISOString(), location: { join_url: "https://zoom.us/x" } }] }));
    if (init.method === "PROPFIND" && url === "https://dav.example.com/") return dav('<d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype><d:current-user-principal><d:href>/principals/me/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>');
    if (init.method === "PROPFIND" && url === "https://dav.example.com/principals/me/") return dav('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:propstat><d:prop><c:calendar-home-set><d:href>/cals/me/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>');
    if (init.method === "PROPFIND" && url === "https://dav.example.com/cals/me/") return dav('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/cals/me/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response><d:response><d:href>/cals/me/work/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop></d:propstat></d:response><d:response><d:href>/cals/me/tasks/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set></d:prop></d:propstat></d:response></d:multistatus>');
    if (init.method === "REPORT" && url === "https://dav.example.com/cals/me/work/") { assert.match(init.headers.authorization, /^Basic /); return dav(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:propstat><d:prop><c:calendar-data><![CDATA[${ics.replace("Test day", "Dav day")}]]></c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>`); }
    if (init.method === "PROPFIND") return new Response("", { status: 401 });
    throw new Error("unexpected " + init.method + " " + url);
  };
  const h = createHandler({ fetchImpl });
  const i = await (await call(h, ENV, "/ics/connect", { method: "POST", body: { url: "webcal://cal.example.com/feed.ics" } })).json();
  const ie = await (await call(h, ENV, "/data/calendar", { method: "POST", body: { sealed: i.sealed, days: 7 } })).json();
  assert.equal(ie.events[0].title, "Test day");
  assert.equal((await call(h, ENV, "/ics/connect", { method: "POST", body: { url: "http://cal.example.com/feed.ics" } })).status, 400);
  assert.equal((await call(h, ENV, "/ics/connect", { method: "POST", body: { url: "https://localhost/feed.ics" } })).status, 400);
  const d = await (await call(h, ENV, "/caldav/connect", { method: "POST", body: { url: "https://dav.example.com/", username: "me", password: "pw" } })).json();
  assert.match(d.account, /1 calendar/);
  const de = await (await call(h, ENV, "/data/calendar", { method: "POST", body: { sealed: d.sealed, days: 7 } })).json();
  assert.equal(de.events[0].title, "Dav day");
  const c = await (await call(h, ENV, "/calendly/connect", { method: "POST", body: { token: "pat" } })).json();
  const ce = await (await call(h, ENV, "/data/calendar", { method: "POST", body: { sealed: c.sealed, days: 7 } })).json();
  assert.equal(ce.events[0].title, "Intro call"); assert.equal(ce.events[0].place, "Video call");
});

test("ai drafts only when configured, and parse the provider answer", async () => {
  const h = createHandler({ fetchImpl: async (url, init) => new Response(JSON.stringify({ choices: [{ message: { content: 'Sure: {"drafts":[{"label":"Quick","body":"Hi Sam, thanks."},{"label":"Fuller","body":"Hi Sam, details please."}]}' } }] })) });
  assert.equal((await call(h, ENV, "/ai/draft", { method: "POST", body: { from: "Sam", subject: "x", snippet: "y" } })).status, 503);
  const j = await (await call(h, { ...ENV, AI_API_URL: "https://ai.example/v1/chat", AI_API_KEY: "k" }, "/ai/draft", { method: "POST", body: { from: "Sam", subject: "x", snippet: "y", business: "B", owner: "O" } })).json();
  assert.equal(j.drafts.length, 2);
});
