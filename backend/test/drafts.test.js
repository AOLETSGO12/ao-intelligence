import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyNoReply, fallbackDrafts, makeDrafts, buildMessages, rateLimitDraft } from "../src/drafts.js";
import { classifyEmails, fallbackSummary, makeOverview } from "../src/overview.js";
import { SAMPLES, OWNER, BUSINESS } from "./sample-threads.js";
import { HttpError } from "../src/util.js";
import { createHandler, caps } from "../src/index.js";

const ENV = { SEAL_KEY: "a".repeat(32), ALLOWED_ORIGIN: "https://aoletsgo12.github.io", FRONTEND_URL: "https://aoletsgo12.github.io/ao-intelligence" };

async function call(h, env, path, { method = "POST", body, origin } = {}) {
  const req = new Request("https://ao-intelligence-api.ao-446557ec.workers.dev" + path, {
    method,
    headers: { "content-type": "application/json", origin: origin || ENV.ALLOWED_ORIGIN },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  return h(req, env);
}

for (const sample of SAMPLES) {
  test("fallback drafts: " + sample.title, () => {
    const r = fallbackDrafts(sample.input);
    if (sample.expectSkip) {
      assert.equal(r.skip, true);
      assert.equal(r.reason, "No reply needed");
      assert.equal(r.drafts.length, 0);
      return;
    }
    assert.equal(r.skip, false);
    assert.ok(r.drafts[0] && r.drafts[0].body);
    const body = r.drafts[0].body;
    for (const re of sample.must || []) assert.match(body, re);
    for (const re of sample.mustNot || []) assert.doesNotMatch(body, re);
    assert.doesNotMatch(body, /I('ll| will) get back to you shortly/i);
  });
}

test("classifyNoReply leaves real support tickets alone", () => {
  assert.equal(classifyNoReply({
    from: "Hannah Cole", address: "support@apexlube.co.uk",
    subject: "Re: Oil cooler leak", body: "We’re going to try and get that sorted for you.",
  }), null);
  assert.ok(classifyNoReply({
    from: "Motorsport Week", address: "newsletter@x.com", subject: "This week in British F4",
    body: "Unsubscribe. You are receiving this because you subscribed. View in your browser.",
    headers: { "list-unsubscribe": "<mailto:unsub@x.com>" },
  }));
});

test("makeDrafts uses Workers AI when bound, otherwise fallback", async () => {
  const input = SAMPLES[0].input;
  const fb = await makeDrafts({}, input);
  assert.equal(fb.source, "fallback");
  assert.match(fb.drafts[0].body, /let me know/i);
  const ai = await makeDrafts({
    AI: { run: async () => ({ response: "Hi Hannah,\n\nThanks for your help, let me know when you’ve found a solution.\n\nThanks,\nArchie" }) },
  }, input);
  assert.equal(ai.source, "ai");
  assert.match(ai.drafts[0].body, /found a solution/);
  assert.ok(buildMessages(input).length === 2);
});

test("rate-limit eventually returns 429", () => {
  const key = "test-bucket-" + Math.random();
  for (let i = 0; i < 40; i++) rateLimitDraft(key, 40, 60_000);
  assert.throws(() => rateLimitDraft(key, 40, 60_000), (e) => e instanceof HttpError && e.status === 429);
});

test("POST /draft returns a content-aware fallback without AI", async () => {
  const h = createHandler({ fetchImpl: async () => { throw new Error("no"); } });
  const r = await call(h, ENV, "/draft", { body: SAMPLES[0].input });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.skip, false);
  assert.match(j.drafts[0].body, /let me know/i);
  assert.doesNotMatch(j.drafts[0].body, /get back to you shortly/i);
  const news = await (await call(h, ENV, "/draft", { body: SAMPLES.find((s) => s.id === "newsletter").input })).json();
  assert.equal(news.skip, true);
  assert.equal(news.reason, "No reply needed");
});

test("caps.ai is true when the AI binding is present", async () => {
  const h = createHandler({ fetchImpl: async () => { throw new Error("no"); } });
  const off = await (await call(h, ENV, "/health", { method: "GET" })).json();
  assert.equal(off.caps.ai, false);
  const on = caps({ ...ENV, AI: { run: async () => ({}) } });
  assert.equal(on.ai, true);
});

test("overview fallback classifies motorsport threads and never invents money", () => {
  const emails = SAMPLES.map((s) => ({ id: s.id, ...s.input, snippet: s.input.body, noReply: !!s.expectSkip }));
  const cats = classifyEmails(emails);
  assert.ok(cats.reply.includes("support-sorted"));
  assert.ok(cats.invoice.includes("invoice") || cats.invoice.includes("parts-order"));
  assert.ok(cats.newsletter.includes("newsletter"));
  const r = fallbackSummary({ emails, events: [{ id: "e1", title: "Silverstone test", date: "2026-11-21", start: "09:00", place: "Silverstone", today: true }], owner: OWNER, business: BUSINESS });
  assert.match(r.summary, /reply|diary|Today/i);
  assert.doesNotMatch(r.summary, /£186/);
  assert.ok(r.categories.reply.count >= 1);
});

test("POST /overview works without AI", async () => {
  const h = createHandler({ fetchImpl: async () => { throw new Error("no"); } });
  const r = await call(h, ENV, "/overview", { body: { owner: OWNER, business: BUSINESS, industry: "motorsport", emails: [{ id: "1", from: "Sam", subject: "Call?", snippet: "Are you free for a call?" }] } });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.summary);
  assert.ok(j.categories.reply.count >= 1);
});

test("makeOverview prefers AI JSON when valid", async () => {
  const r = await makeOverview({
    AI: { run: async () => ({ response: JSON.stringify({ summary: "A short, busy morning with one reply waiting.", categories: { reply: { ids: ["1"] }, invoice: { ids: [] }, booking: { ids: [] }, newsletter: { ids: [] } }, actions: [{ id: "reply:1", title: "Reply to Sam", detail: "Call request", tab: "inbox" }] }) }) },
  }, { emails: [{ id: "1", from: "Sam", subject: "Call?", snippet: "Are you free for a call?" }] });
  assert.equal(r.source, "ai");
  assert.match(r.summary, /one reply waiting/);
});
