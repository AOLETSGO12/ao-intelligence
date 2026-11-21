// Reply drafts: Workers AI when the binding is present, otherwise a content-aware fallback.
// Email text is used only to write the draft. It is never stored or logged.
import { HttpError } from "./util.js";

export const PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const FALLBACK_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const NO_REPLY_ADDR = /(^|[^a-z])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|newsletter|notifications?|alerts?|bounce|postmaster)([^a-z]|$)/i;
const SORTING = /\b(we('ll| will)? (try (and|to) )?get that sorted|get (this|that|it) sorted|looking into (it|this)|we('re| are) looking into|i('ve| have) (passed|forwarded) this|we('ll| will) (look into|investigate|check (this|it) out)|leave (it|this) with (us|me)|we're on (it|this))\b/i;
const MEETING = /\b(call|meet|meeting|catch[- ]up|zoom|teams|availability|are you free|pencil(led)? in|book a (call|slot)|can we speak|15 minutes|20 minutes|half an hour)\b/i;
const INVOICE = /\b(invoice|vat|payment due|overdue|please pay|bank details|purchase order|\bpo number)\b/i;
const DELAY = /\b(delay(ed)?|running late|postponed|pushed back|behind schedule)\b/i;
const QUESTION = /\?|\b(can you|could you|would you|please (confirm|advise|let me know|send|share)|let me know|how (much|many|soon|long)|what('s| is) the|when (can|will|are)|is it possible)\b/i;

function clip(s, n) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n); }
function titleCase(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : ""; }
function firstName(s, fallback) {
  const parts = String(s || "").replace(/<.*$/, "").replace(/["']/g, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback || "";
  if (/^(mr|mrs|ms|miss|dr|prof|sir|dame)$/i.test(parts[0]) && parts[1]) return titleCase(parts[0]) + " " + titleCase(parts[1]);
  const n = parts[0];
  if (/^(hi|hello|there|team|info|mail|support|accounts|admin|noreply|no-reply|british|entries|orders|news|newsletter|championship|hello@)$/i.test(n)) return fallback || "";
  return titleCase(n);
}
function textOf(input) {
  const parts = [];
  if (input.body) parts.push(input.body);
  if (input.snippet) parts.push(input.snippet);
  (input.thread || []).forEach((t) => { if (t && (t.text || t.body)) parts.push(t.text || t.body); });
  return (input.subject || "") + "\n" + parts.join("\n");
}

/** Returns a short reason when no reply should be drafted, otherwise null. */
export function classifyNoReply(input) {
  const from = String(input.from || "") + " " + String(input.address || "");
  const subj = String(input.subject || "");
  const body = String(input.body || input.snippet || "");
  const text = (subj + "\n" + body).toLowerCase();
  const h = input.headers || {};
  const needsHuman = SORTING.test(subj + "\n" + body) || MEETING.test(subj + "\n" + body) || QUESTION.test(subj + "\n" + body) || INVOICE.test(subj + "\n" + body);
  if (h["list-unsubscribe"] && !needsHuman) return "newsletter";
  if (h["auto-submitted"] && !/^no$/i.test(String(h["auto-submitted"])) && !needsHuman) return "notification";
  if (/^(bulk|list|junk)$/i.test(String(h.precedence || "").trim()) && !needsHuman) return "marketing";
  if (NO_REPLY_ADDR.test(from) || NO_REPLY_ADDR.test(subj)) return "no-reply";
  if (/\b(newsletter|weekly round-?up|this week in)\b/i.test(subj) && !needsHuman) return "newsletter";
  if (/\bunsubscribe\b/i.test(body) && /\b(view in (your )?browser|manage (your )?preferences|you('re| are) receiving this)\b/i.test(body) && !needsHuman) return "newsletter";
  if (/\b(receipt|payment (received|confirmation)|your (payment|order) (was|has been|is)|order (confirmation|confirmed|received|has been (placed|received|dispatched|shipped))|despatch confirmation|shipping confirmation|thanks for (your )?order)\b/i.test(subj)
      && !needsHuman) return "receipt";
  if (/\b(do not reply|this (mailbox|inbox) is not monitored|automatically generated)\b/i.test(text) && !needsHuman) return "notification";
  return null;
}

function signOff(owner, tone) {
  const me = firstName(owner, "");
  const close = tone === "formal" ? "Kind regards" : "Thanks";
  return me ? close + ",\n" + me : close;
}
function greeting(from, tone) {
  const n = firstName(from, "");
  if (tone === "formal") return n ? "Dear " + n + "," : "Hello,";
  return n ? "Hi " + n + "," : "Hi,";
}
function wrap(from, owner, tone, sentences) {
  return greeting(from, tone) + "\n\n" + sentences.join(" ") + "\n\n" + signOff(owner, tone);
}

/** Content-aware rule-based drafts. Never a generic “I’ll get back to you shortly.” */
export function fallbackDrafts(input) {
  const tone = (input.tone || "friendly").toLowerCase();
  const from = input.from || "";
  const owner = input.owner || "";
  const subject = String(input.subject || "").replace(/^(re|fwd?):\s*/i, "").trim();
  const blob = textOf(input);
  const skip = classifyNoReply(input);
  if (skip) return { skip: true, reason: "No reply needed", drafts: [] };

  let sentences;
  if (SORTING.test(blob)) {
    sentences = tone === "short"
      ? ["Thanks for your help — please let me know when you’ve found a solution."]
      : ["Thanks for your help with this.", "Please let me know when you’ve found a solution, or if you need anything else from me in the meantime."];
  } else if (MEETING.test(blob) && !INVOICE.test(blob)) {
    sentences = tone === "short"
      ? ["Yes, I’m happy to speak — [[suggest a time that works for you]]."]
      : ["Thanks for getting in touch, and yes, I’m happy to speak.", "[[Suggest a couple of times that work for you, or ask them to propose one.]]"];
  } else if (INVOICE.test(blob) && /\b(please (find|see)|attached|here is|our invoice|invoice is due|outstanding)\b/i.test(blob)) {
    sentences = tone === "short"
      ? ["Thanks, I’ve got the invoice and will look it over."]
      : ["Thanks, I’ve received the invoice and will look it over.", "I’ll follow up only if something doesn’t match."];
  } else if (INVOICE.test(blob) && /\b(please (send|raise|issue)|can you (send|invoice)|outstanding from us|bank details)\b/i.test(blob)) {
    sentences = ["Thanks for the reminder.", "[[Add the invoice details, amount, or bank information, or say when you’ll send it.]]"];
  } else if (QUESTION.test(blob)) {
    sentences = tone === "short"
      ? ["Thanks for the question — [[answer, or say what you need in order to answer]]."]
      : ["Thanks for your email" + (subject ? " about “" + clip(subject, 80) + "”" : "") + ".", "[[Answer their question, or write a short note about what you need in order to answer it.]]"];
  } else if (DELAY.test(blob) && !QUESTION.test(blob)) {
    sentences = tone === "short"
      ? ["Thanks for the update — noted."]
      : ["Thanks for the update, that’s noted.", "Please send tracking or a further update when you have it."];
  } else if (/\b(thank(s| you)|cheers|much appreciated)\b/i.test(blob) && blob.length < 400) {
    sentences = ["You’re welcome — glad that was useful.", "Do shout if you need anything else."];
  } else {
    const about = subject ? " about “" + clip(subject, 80) + "”" : "";
    sentences = tone === "short"
      ? ["Thanks for your email" + about + " — [[reply to the point they raised]]."]
      : ["Thanks for your email" + about + ".", "[[Reply to what they actually asked or told you. Don’t promise to get back later unless you genuinely need to check something.]]"];
  }
  if (tone === "formal" && sentences[0] && /^Thanks/.test(sentences[0])) {
    sentences[0] = sentences[0].replace(/^Thanks/, "Thank you");
  }
  const body = wrap(from, owner, tone, sentences);
  const label = tone === "short" ? "Short" : tone === "formal" ? "Formal" : "Draft";
  return { skip: false, drafts: [{ label, body }] };
}

export function buildMessages(input) {
  const tone = (input.tone || "friendly").toLowerCase();
  const toneLine = tone === "formal" ? "Tone: formal and reserved, still warm."
    : tone === "short" ? "Tone: brief — two or three sentences if you can, still polite."
    : "Tone: friendly and natural, still professional.";
  const type = input.type === "personal" ? "Personal dashboard" : "Business dashboard";
  const sys = [
    "You write a short email reply draft in the user's name, in British English. They will review it before it is sent.",
    "Read the thread carefully. Work out what the sender actually said or asked, and who owes the next action.",
    "If the sender is helping, looking into something, or says they will get it sorted, thank them and ask them to let the user know when there is a solution or update. Do not promise that the user will get back to them.",
    "If they asked a question you can answer from the thread, answer it. If you need information only the user can provide, ask a brief neutral question or leave a clearly marked gap like [[add the date]].",
    "If they propose a meeting or call, agree in principle and leave a gap for a time, or ask them to suggest one. If they have sent an invoice, thank them and say you will look it over — never say you will pay, arrange payment, or have already paid, unless the user already said that in the thread. Do not claim you are already reviewing, checking or arranging something unless the thread shows that.",
    "Never invent facts, figures, dates, prices or commitments. Do not agree to pay, attend, confirm an entry, or make any other commitment unless the user already made that commitment in the thread. If only the user can decide, leave a clearly marked gap. Never use placeholders such as [Name] or [Your Name] when the name is known.",
    "Never write that the user will 'get back to you', 'come back to you shortly', or similar, unless the thread genuinely means the user must go away and find something that is not in the messages.",
    "Match the sender's formality. Keep the body to 2–5 sentences. Start with a natural greeting using the sender's first name if you have it. Sign off with the user's first name only.",
    "Output ONLY the email body. No subject line, no preamble, no quotation marks around the whole draft.",
    toneLine,
  ].join(" ");

  const lines = [
    type + (input.business ? " — " + clip(input.business, 80) : "") + (input.industry ? " (" + clip(input.industry, 40) + ")" : ""),
    "User's name: " + clip(input.owner, 80),
    "Sender: " + clip(input.from, 80) + (input.address ? " <" + clip(input.address, 80) + ">" : ""),
    "Subject: " + clip(input.subject, 200),
  ];
  const thread = Array.isArray(input.thread) && input.thread.length
    ? input.thread.slice(-4)
    : [{ from: input.from, text: input.body || input.snippet || "" }];
  lines.push("Thread, oldest first (latest is the message to answer):");
  thread.forEach((t, i) => {
    const who = clip((t && (t.from || t.name)) || (i === thread.length - 1 ? input.from : "Earlier message"), 80);
    const when = t && t.date ? " (" + clip(t.date, 40) + ")" : "";
    lines.push("--- " + who + when + " ---\n" + clip((t && (t.text || t.body)) || "", 1200));
  });
  if (input.rewrite && input.previous) {
    lines.push("The user already has this draft and wants it rewritten, following the rules above and the requested tone:\n" + clip(input.previous, 1500));
  }
  return [
    { role: "system", content: sys },
    { role: "user", content: lines.join("\n") },
  ];
}

function cleanDraft(text, input) {
  let s = String(text || "").trim();
  s = s.replace(/^```(?:\w+)?\s*/i, "").replace(/```$/i, "").trim();
  s = s.replace(/^("|“)([\s\S]*)("|”)$/, "$2").trim();
  s = s.replace(/^Subject:.*\n+/i, "");
  const me = firstName(input.owner, "");
  if (me) {
    s = s.replace(/\[(?:your )?name\]/ig, me);
    s = s.replace(/\{(?:first|name|owner)\}/ig, me);
  }
  const them = firstName(input.from, "");
  if (them) s = s.replace(/\[(?:their |sender'?s )?name\]/ig, them);
  if (s.length > 2000) s = s.slice(0, 1997) + "…";
  return s;
}

async function runModel(ai, model, messages) {
  const result = await ai.run(model, { messages, max_tokens: 500, temperature: 0.35 });
  if (typeof result === "string") return result;
  if (result && typeof result.response === "string") return result.response;
  if (result && result.result && typeof result.result.response === "string") return result.result.response;
  if (result && result.choices && result.choices[0] && result.choices[0].message) return result.choices[0].message.content || "";
  return "";
}

async function fromWorkersAI(env, input) {
  if (!env || !env.AI || typeof env.AI.run !== "function") return null;
  const messages = buildMessages(input);
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let last;
  for (const model of models) {
    try {
      const text = cleanDraft(await runModel(env.AI, model, messages), input);
      if (text && text.length > 20) return text;
    } catch (e) { last = e; }
  }
  if (last) throw last;
  return null;
}

/** Main entry: { skip, reason?, drafts, source } source is "ai" or "fallback". Never logs the email. */
export async function makeDrafts(env, input) {
  const skip = classifyNoReply(input || {});
  if (skip) return { skip: true, reason: "No reply needed", drafts: [], source: "skip" };
  try {
    const body = await fromWorkersAI(env, input);
    if (body) {
      const label = (input.tone || "friendly") === "short" ? "Short" : (input.tone || "") === "formal" ? "Formal" : (input.rewrite ? "Rewrite" : "Draft");
      return { skip: false, drafts: [{ label, body }], source: "ai" };
    }
  } catch (e) {
    try { console.log(JSON.stringify({ ev: "draft-ai-fail", status: e && e.status })); } catch (x) { /* ignore */ }
  }
  const fb = fallbackDrafts(input);
  return { ...fb, source: "fallback" };
}

const buckets = new Map();
export function rateLimitDraft(key, limit = 40, windowMs = 15 * 60 * 1000, message) {
  const now = Date.now();
  let b = buckets.get(key) || [];
  b = b.filter((t) => now - t < windowMs);
  if (b.length >= limit) throw new HttpError(429, message || "Please wait a few minutes before asking for more drafts.");
  b.push(now);
  buckets.set(key, b);
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) { if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k); }
  }
}

export async function rateKey(sealed, ip, owner) {
  const base = sealed ? "s:" + sealed.slice(0, 80) : "i:" + String(ip || "") + "|" + String(owner || "");
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
  } catch (e) {
    return clip(base, 48);
  }
}
