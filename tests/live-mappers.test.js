// Run: node --test tests/   (no credentials needed — checks how real Gmail / Calendar / Graph answers become dashboard data)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ctx = { console, setTimeout, clearTimeout, TextEncoder, TextDecoder, btoa, atob, URL, URLSearchParams, Intl };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8") + "\nglobalThis.AOEngine = AOEngine;", ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/live.js"), "utf8"), ctx);
const T = ctx.AOLive._t;
const E = ctx.AOEngine;
const plain = (x) => JSON.parse(JSON.stringify(x)); // values come from another vm realm

const gmail = { id: "m1", threadId: "t1", internalDate: String(Date.now() - 3600e3), snippet: "Hi Archie, can we chat about 2027 &amp; the Brands Hatch round? Thanks, Sam&#39;s team",
  payload: { headers: [{ name: "From", value: "Sam Hill <sam@apexlube.co.uk>" }, { name: "Subject", value: "Sponsor renewal for 2027?" }, { name: "Message-ID", value: "<abc@mail.x>" }, { name: "Reply-To", value: "Sam Direct <sam.direct@apexlube.co.uk>" }] } };

test("gmail message becomes an email card with drafts and reply metadata", () => {
  const m = T.mapGmail(gmail, "Archie Owen", "Archie Owen Racing");
  assert.equal(m.from, "Sam Hill"); assert.equal(m.org, "Apexlube"); assert.equal(m.subject, "Sponsor renewal for 2027?");
  assert.match(m.snippet, /2027 & the Brands Hatch round\? Thanks, Sam's team/);
  assert.equal(m.id, "g:m1"); assert.equal(m.live, true);
  assert.equal(m.meta.address, "sam.direct@apexlube.co.uk"); assert.equal(m.meta.threadId, "t1"); assert.equal(m.meta.rfcId, "<abc@mail.x>");
  assert.ok(m.drafts.length >= 1); assert.match(m.drafts[0].body, /^Hi Sam,/); assert.match(m.drafts[0].body, /Archie$/);
  assert.doesNotMatch(m.drafts[0].body, /get back to you shortly/i);
  assert.equal(m._auto, false);
  const news = T.mapGmail({ ...gmail, payload: { headers: [{ name: "From", value: "Shop <noreply@shop.com>" }, { name: "Subject", value: "x" }, { name: "List-Unsubscribe", value: "<mailto:u@x>" }] } }, "A", "B");
  assert.equal(news._auto, true);
});

test("google calendar events: timed, all-day multi-day, cancelled", () => {
  const from = "2026-11-20", to = "2026-12-04";
  const ev = T.mapGoogleEvents([
    { id: "e1", summary: "Sponsor call", start: { dateTime: "2026-11-20T14:00:00+00:00" }, end: { dateTime: "2026-11-20T15:00:00+00:00" }, attendees: [{ email: "a@x.com" }, { self: true }], hangoutLink: "https://meet.google.com/x" },
    { id: "e2", summary: "Race weekend", start: { date: "2026-11-21" }, end: { date: "2026-11-23" }, location: "Brands Hatch" },
    { id: "e3", summary: "Dentist", status: "cancelled", start: { dateTime: "2026-11-22T09:00:00Z" }, end: { dateTime: "2026-11-22T10:00:00Z" } },
  ], from, to);
  assert.equal(ev.length, 3);
  assert.equal(ev[0].title, "Sponsor call"); assert.equal(ev[0].kind, "meeting"); assert.equal(ev[0].place, "Video call"); assert.match(ev[0].start, /^\d\d:\d\d$/);
  assert.deepEqual(plain(ev.slice(1).map((e) => [e.date, e.allDay, e.place])), [["2026-11-21", true, "Brands Hatch"], ["2026-11-22", true, "Brands Hatch"]]);
});

test("microsoft graph mail + events", () => {
  const m = T.mapGraphMail({ id: "AAA=", conversationId: "C1", subject: "Tyre order", from: { emailAddress: { name: "Pat", address: "pat@team.com" } }, receivedDateTime: new Date().toISOString(), bodyPreview: "Need  numbers\r\nplease", inferenceClassification: "focused" }, "Archie", "ARR");
  assert.equal(m.from, "Pat"); assert.equal(m.snippet, "Need numbers please"); assert.equal(m.meta.provider, "microsoft"); assert.equal(m.meta.threadId, "C1");
  const ev = T.mapGraphEvents([
    { id: "x1", subject: "Team debrief", start: { dateTime: "2026-11-20T18:00:00.0000000" }, end: { dateTime: "2026-11-20T19:00:00.0000000" }, attendees: [{}, {}], isOnlineMeeting: true, location: { displayName: "" } },
    { id: "x2", subject: "Holiday", isAllDay: true, start: { dateTime: "2026-11-25T00:00:00.0000000" }, end: { dateTime: "2026-11-27T00:00:00.0000000" } },
  ], "2026-11-20", "2026-12-04");
  assert.deepEqual(plain(ev.map((e) => [e.date, e.start, e.end, e.kind, !!e.allDay])), [["2026-11-20", "18:00", "19:00", "meeting", false], ["2026-11-25", "00:00", "23:59", "business", true], ["2026-11-26", "00:00", "23:59", "business", true]]);
});

test("microsoft authorize URL uses PKCE and the registered redirect", () => {
  ctx.AO_CONFIG = { microsoft: { clientId: "00000000-aaaa-bbbb-cccc-111111111111" } };
  ctx.location = { href: "https://aoletsgo12.github.io/ao-intelligence/start.html" };
  ctx.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const url = new URL(T.msBuildAuthUrl(["Mail.ReadWrite", "offline_access", "User.Read"], "ms.state", "CHALLENGE"));
  assert.equal(url.origin + url.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  assert.equal(url.searchParams.get("client_id"), "00000000-aaaa-bbbb-cccc-111111111111");
  assert.equal(url.searchParams.get("redirect_uri"), "https://aoletsgo12.github.io/ao-intelligence/oauth.html");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256"); assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "Mail.ReadWrite offline_access User.Read");
});

test("engine: live data replaces sample data only for live connections, and revenue falls back to the bank", () => {
  let s = E.newState(); s.business = { name: "Archie Owen Racing", industry: "motorsport", size: "solo" }; s.account = { name: "Archie Owen", email: "a@b.c" };
  const today = "2026-11-20";
  s.connected = { mail: { key: "mail", providerId: "gmail", providerName: "Gmail", at: "", live: true, route: "google" }, bank: { key: "bank", providerId: "monzo", providerName: "Monzo", at: "" } };
  const live = { mail: [{ id: "g:1", from: "Sam", org: "Apex", subject: "S", snippet: "x", when: "Today", drafts: [{ label: "Q", body: "b" }], live: true }], otherMessages: 4 };
  const u = E.universeOf(s, today, live);
  assert.equal(u.emails.length, 1); assert.equal(u.otherMessages, 4); assert.equal(u.live.mail, true); assert.equal(u.live.bank, false);
  assert.ok(u.bank.length > 0); // simulated bank keeps sample data
  const v = E.buildView(u, s, "09:00", live);
  assert.equal(v.emails.length, 1); assert.equal(v.anyLive, true); assert.equal(v.live.mail, true);
  // bank live with no sales tool: revenue = real money in; target derives from real figures
  s.connected.bank = { key: "bank", providerId: "monzo", providerName: "Monzo", at: "", live: true, route: "truelayer" };
  const bank = [{ id: "b1", date: today, time: "10:00", desc: "Sponsor", amount: 1500, direction: "in", category: "Income" }, { id: "b2", date: today, time: "11:00", desc: "Entry", amount: 400, direction: "out", category: "Racing" }];
  const u2 = E.universeOf(s, today, { ...live, bank });
  const v2 = E.buildView(u2, s, "09:00", { ...live, bank });
  assert.equal(v2.revenueSource, "bank"); assert.equal(v2.breakdown.totalIn, 1500); assert.equal(u2.monthTarget, 1700);
  assert.match(v2.kpis[0].value, /1,500/);
  // live but empty / failed fetch -> real empty state, never sample data
  const u3 = E.universeOf(s, today, { errors: { mail: "x" } });
  assert.equal(u3.emails.length, 0); assert.equal(u3.bank.length, 0);
});

test("template drafts are polite, content-aware and never invent facts", () => {
  const d = E.templateDrafts({ from: "Jo Bloggs", subject: "Re: Quote please?", snippet: "How much for a day?" }, "Archie Owen", "AOR");
  assert.match(d[0].body, /Hi Jo,/);
  assert.match(d[0].body, /Archie/);
  assert.match(d[0].body, /\[\[/);
  assert.doesNotMatch(d[0].body, /get back to you shortly|come back to you with a proper answer shortly/i);
  assert.doesNotMatch(d[0].body, /£|\d{2}:\d{2}/);
  const s = E.templateDrafts({ from: "Hannah Cole", subject: "Re: leak", snippet: "We're going to try and get that sorted for you." }, "Archie Owen", "AOR");
  assert.match(s[0].body, /let me know/i);
  assert.doesNotMatch(s[0].body, /get back to you shortly/i);
  assert.ok(E.classifyNoReply({ from: "News", address: "newsletter@x.com", subject: "This week in British F4", snippet: "Unsubscribe. You are receiving this because you subscribed. View in your browser." }));
});

test("agenda marks the next event, gaps and travel hints without inventing places", () => {
  const ev = [
    { id: "a", title: "Workshop brief", start: "09:00", end: "10:00", date: "2026-11-20", place: "Workshop", kind: "business" },
    { id: "b", title: "Silverstone test", start: "13:00", end: "16:00", date: "2026-11-20", place: "Silverstone Circuit", kind: "business" },
  ];
  const places = [{ id: "w", name: "Workshop", address: "Unit 4, CF10 1AA" }, { id: "s", name: "Silverstone", address: "Silverstone Circuit, NN12 8TN" }];
  const ag = E.buildAgenda(ev, "08:30", places, { a: "w", b: "s" });
  assert.equal(ag.nextId, "a");
  assert.ok(ag.rows.some((r) => r.type === "event" && r.highlight && /Next up/.test(r.highlight)));
  assert.ok(ag.rows.some((r) => r.type === "gap" && /Free gap/.test(r.label)));
  assert.ok(ag.rows.some((r) => r.type === "travel" && /Travel from/.test(r.label)));
  assert.ok(ag.rows.filter((r) => r.type === "event")[1].place.maps.indexOf("maps") !== -1);
});

test("business forward is empty-safe and motorsport-aware", () => {
  const s = E.parseState(null);
  s.business = { name: "Archie Owen Racing", type: "business", industry: "motorsport" };
  s.replied = [];
  const u = { emails: [{ id: "1", from: "Sam Hill", org: "Apex Lube", subject: "Sponsorship call", snippet: "Can we talk about next season?", when: "8 days ago" }], events: [{ id: "e", title: "Silverstone test day", date: "2026-11-22", start: "09:00", place: "Silverstone" }], bank: [] };
  const f = E.buildForward(u, s, "2026-11-20", { mail: true, calendar: true }, {}, {});
  assert.equal(f.motor, true);
  assert.equal(f.pipeline[0].quiet, true);
  assert.equal(f.upcoming[0].title, "Silverstone test day");
  const personal = E.parseState(null);
  personal.business = { name: "Home", type: "personal", industry: "other" };
  assert.equal(E.buildForward(u, personal, "2026-11-20", {}, {}, {}), null);
});

test("marking an email done uses stable keys and drops it from every view", () => {
  const s = E.parseState(null);
  s.real = true;
  s.business = { name: "Archie Owen Racing", type: "business", industry: "motorsport" };
  s.account = { name: "Archie Owen", email: "archie@archieowenracing.com" };
  s.connected = { mail: { providerName: "Zoho", live: true, route: "imap", detail: "archie@archieowenracing.com" } };
  const mail = {
    id: "i:17", from: "Sam Hill", org: "Apex", subject: "Sponsorship call", snippet: "Can we talk about next season?",
    when: "Today", when_iso: "2026-11-20T09:00:00.000Z",
    drafts: [{ label: "Draft", body: "Hi Sam" }], live: true,
    meta: { provider: "imap", messageId: 17, address: "sam@apexlube.co.uk", subject: "Sponsorship call", rfcId: "<abc@mail.x>" }
  };
  const live = { mail: [mail], filed: [], otherMessages: 2, accounts: { mail: "archie@archieowenracing.com" } };
  const u = E.universeOf(s, "2026-11-20", live);
  let v = E.buildView(u, s, "09:00", live);
  assert.equal(v.emails.length, 1);
  s.dailyOverview = { date: v.today, summary: "One message needs a reply.", categories: { reply: { count: 1, ids: ["i:17"], blurb: "1 waiting" }, invoices: { count: 0, ids: [] }, bookings: { count: 0, ids: [] }, newsletters: { count: 0, ids: [] } }, actions: [{ id: "reply:i:17", title: "Reply to Sam", tab: "inbox" }] };
  v = E.buildView(u, s, "09:00", live);
  assert.equal(v.dailyOverview.categories.reply.count, 1);

  E.markCompleted(s, mail, "archie@archieowenracing.com");
  const keys = E.completionKeys(mail, "archie@archieowenracing.com");
  assert.ok(keys.indexOf("i:17") !== -1);
  assert.ok(keys.some((k) => k.indexOf("mid:") === 0));
  assert.ok(keys.some((k) => k.indexOf("h:") === 0));
  assert.ok(E.isCompleted(mail, s, "archie@archieowenracing.com"));
  // same message, different mutable id, same Message-ID — still done
  const again = Object.assign({}, mail, { id: "i:99", meta: Object.assign({}, mail.meta, { messageId: 99 }) });
  assert.ok(E.isCompleted(again, s, "archie@archieowenracing.com"));

  v = E.buildView(u, s, "09:00", live);
  assert.equal(v.emails.length, 0);
  assert.equal(v.completed.length, 1);
  assert.equal(v.dailyOverview.categories.reply.count, 0);
  assert.ok(!/one message needs a reply/i.test(v.dailyOverview.summary));
  assert.equal((v.dailyOverview.actions || []).length, 0);
  assert.equal(v.forward.pipeline.length, 0);
  assert.ok(!v.tasks.some((t) => t.id === "reply:i:17"));

  E.unmarkCompleted(s, mail, "archie@archieowenracing.com");
  v = E.buildView(u, s, "09:00", live);
  assert.equal(v.emails.length, 1);
});
