// Daily overview: classify a small inbox and write a one-line summary.
// Email text is used only for this and is never stored or logged.
import { classifyNoReply, PRIMARY_MODEL, FALLBACK_MODEL } from "./drafts.js";
import { HttpError } from "./util.js";

const INVOICE = /\b(invoice|vat|payment due|overdue|please pay|bank details|purchase order|receipt|payout|statement)\b/i;
const BOOKING = /\b(appointment|booking|booked|reservation|site visit|school visit|are you free|availability|catch[- ]up|meeting request|can we (meet|speak|call)|test day|arrival time)\b/i;

function clip(s, n) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n); }

export function categoryOf(input) {
  const skip = classifyNoReply(input || {});
  if (skip === "receipt") return "invoice";
  if (skip === "newsletter" || skip === "marketing" || skip === "no-reply" || skip === "notification") return "newsletter";
  const blob = ((input && (input.subject || "")) + "\n" + ((input && (input.body || input.snippet)) || ""));
  if (INVOICE.test(blob)) return "invoice";
  if (BOOKING.test(blob)) return "booking";
  return "reply";
}

export function classifyEmails(emails) {
  const cats = { reply: [], invoice: [], booking: [], newsletter: [] };
  (emails || []).forEach((e) => {
    const cat = e.noReply && !INVOICE.test((e.subject || "") + " " + (e.snippet || "")) ? (categoryOf(e) === "invoice" ? "invoice" : "newsletter") : categoryOf(e);
    if (cats[cat]) cats[cat].push(e.id);
    if (cat !== "reply" && !e.noReply && !classifyNoReply(e) && cats.reply.indexOf(e.id) === -1) cats.reply.push(e.id);
  });
  return cats;
}

export function fallbackSummary(input) {
  const emails = input.emails || [];
  const events = input.events || [];
  const cats = classifyEmails(emails);
  const reply = cats.reply.length;
  const inv = cats.invoice.length;
  const book = cats.booking.length;
  const news = cats.newsletter.length;
  const todayEvents = events.filter((e) => e.today || e.when === "today").length || events.length;
  const bits = [];
  if (reply) bits.push(reply === 1 ? "one message needs a reply" : reply + " messages need a reply");
  if (inv) bits.push(inv === 1 ? "one invoice or payment item" : inv + " invoice or payment items");
  if (book) bits.push(book === 1 ? "one booking to look at" : book + " bookings to look at");
  if (todayEvents) bits.push(todayEvents === 1 ? "one thing in the diary today" : todayEvents + " things in the diary today");
  if (news && !bits.length) bits.push("only newsletters and notifications — nothing urgent");
  let summary;
  if (!bits.length) summary = "A quiet day so far — nothing waiting that needs you.";
  else if (bits.length === 1) summary = "A straightforward day: " + bits[0] + ".";
  else summary = "Today: " + bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] + ".";
  const blurb = (ids, empty) => ids.length ? ids.length + (ids.length === 1 ? " item" : " items") : empty;
  return {
    summary,
    categories: {
      reply: { count: reply, ids: cats.reply, blurb: reply ? (reply === 1 ? "A message is waiting for a reply." : reply + " messages are waiting for a reply.") : "Nothing needs a reply." },
      invoices: { count: inv, ids: cats.invoice, blurb: inv ? blurb(cats.invoice, "") : "No invoices or payments in the recent mail." },
      bookings: { count: book, ids: cats.booking, blurb: book ? blurb(cats.booking, "") : "No booking or appointment messages." },
      newsletters: { count: news, ids: cats.newsletter, blurb: news ? (news === 1 ? "One newsletter or notification was filed." : news + " newsletters or notifications were filed.") : "No newsletters filed." },
    },
    actions: fallbackActions(input, cats),
    source: "fallback",
  };
}

function fallbackActions(input, cats) {
  const out = [];
  const emails = input.emails || [];
  const byId = Object.fromEntries(emails.map((e) => [e.id, e]));
  (cats.reply || []).slice(0, 3).forEach((id) => {
    const e = byId[id];
    if (e) out.push({ id: "reply:" + id, title: "Reply to " + clip(e.from, 40), detail: clip(e.subject, 80), tab: "inbox" });
  });
  (input.events || []).filter((e) => e.upcoming || e.today).slice(0, 2).forEach((e) => {
    out.push({ id: "prep:" + (e.id || e.title), title: "Get ready for “" + clip(e.title, 60) + "”", detail: [e.start, e.place].filter(Boolean).join(" · "), tab: "calendar" });
  });
  return out.slice(0, 5);
}

function buildMessages(input, local) {
  const type = input.type === "personal" ? "Personal dashboard" : "Business dashboard";
  const motorsport = /motor|racing|f4|athlete/i.test(String(input.industry || "") + " " + String(input.business || ""));
  const sys = [
    "You write a single-sentence daily overview in British English for a dashboard the user will read this morning.",
    "Use only the facts given. Never invent counts, money, dates, results or commitments. If a figure is not in the facts, do not mention one. Do not suggest paying a bill or confirming an entry unless the facts already show the user has decided to. Prefer a one-line feel for the day over restating every count.",
    "Also classify each email id as one of: reply, invoice, booking, newsletter. Newsletters, receipts, no-reply and marketing are not 'reply'.",
    "Suggest up to 5 short next actions, only from those real emails and events. Actions must be things the user can do, not promises you will do later.",
    motorsport ? "This is a motorsport driver business: tailor actions toward sponsors and partners, tests, races, travel, money that is actually listed, and content after events — but only where the facts support it." : "Keep actions relevant to the business or personal context given.",
    "Return ONLY JSON: {\"summary\":\"...\",\"categories\":{\"reply\":{\"ids\":[]},\"invoice\":{\"ids\":[]},\"booking\":{\"ids\":[]},\"newsletter\":{\"ids\":[]}},\"actions\":[{\"id\":\"...\",\"title\":\"...\",\"detail\":\"...\",\"tab\":\"inbox|calendar|money\"}]}",
  ].join(" ");
  const lines = [
    type + (input.business ? " — " + clip(input.business, 80) : "") + (input.industry ? " (" + clip(input.industry, 40) + ")" : ""),
    "User: " + clip(input.owner, 80),
    "Local counts (do not contradict these): replies " + local.categories.reply.count + ", invoices " + local.categories.invoices.count + ", bookings " + local.categories.bookings.count + ", newsletters " + local.categories.newsletters.count,
    "Emails:",
  ];
  (input.emails || []).slice(0, 20).forEach((e) => {
    lines.push("- " + (e.id || "") + " | " + clip(e.from, 40) + " | " + clip(e.subject, 80) + " | " + clip(e.snippet, 160) + (e.noReply ? " | no-reply" : ""));
  });
  lines.push("Today's and upcoming events:");
  (input.events || []).slice(0, 12).forEach((e) => {
    lines.push("- " + clip(e.title, 80) + " | " + clip(e.date, 12) + " " + clip(e.start, 8) + (e.end ? "–" + clip(e.end, 8) : "") + (e.place ? " | " + clip(e.place, 40) : ""));
  });
  if (input.money && (input.money.balance != null || input.money.overdueCount)) {
    lines.push("Money facts: " + JSON.stringify(input.money));
  }
  return [
    { role: "system", content: sys },
    { role: "user", content: lines.join("\n") },
  ];
}

function parseAi(text, local) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch (e) { return null; }
  const summary = clip(j.summary, 280);
  if (!summary) return null;
  const actions = Array.isArray(j.actions) ? j.actions.filter((a) => a && a.title).slice(0, 5).map((a, i) => ({
    id: clip(a.id || ("act-" + i), 60),
    title: clip(a.title, 100),
    detail: clip(a.detail, 160),
    tab: /^(inbox|calendar|money)$/.test(a.tab) ? a.tab : "today",
  })) : local.actions;
  return {
    summary,
    categories: local.categories,
    actions: actions.length ? actions : local.actions,
    source: "ai",
  };
}

async function runModel(ai, model, messages) {
  const result = await ai.run(model, { messages, max_tokens: 500, temperature: 0.2 });
  if (typeof result === "string") return result;
  if (result && typeof result.response === "string") return result.response;
  if (result && result.result && typeof result.result.response === "string") return result.result.response;
  return "";
}

export async function makeOverview(env, input) {
  const local = fallbackSummary(input || {});
  if (!env || !env.AI || typeof env.AI.run !== "function") return local;
  const messages = buildMessages(input || {}, local);
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const parsed = parseAi(await runModel(env.AI, model, messages), local);
      if (parsed && parsed.summary) return parsed;
    } catch (e) {
      try { console.log(JSON.stringify({ ev: "overview-ai-fail", status: e && e.status })); } catch (x) { /* ignore */ }
    }
  }
  return local;
}
