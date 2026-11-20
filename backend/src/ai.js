// Optional smarter reply drafts. Works with any chat-completions-style HTTP endpoint you configure
// (AI_API_URL, AI_API_KEY, AI_MODEL). Nothing is stored or logged; if it isn't configured the website uses templates.
import { HttpError, fetchWithTimeout } from "./util.js";

export async function aiDrafts(env, fetchImpl, { from, subject, snippet, business, owner }) {
  const clip = (s, n) => String(s || "").slice(0, n);
  const sys = "You write short, warm, professional email reply drafts in British English for a small-business owner. Never invent facts, prices, dates or promises; where something is unknown, say you will confirm. Keep each draft under 110 words and sign off with the owner's first name. Reply ONLY with JSON: {\"drafts\":[{\"label\":\"Short label\",\"body\":\"...\"},{\"label\":\"...\",\"body\":\"...\"}]} with exactly two different drafts (for example a quick acknowledgement, and a fuller answer asking for any missing detail).";
  const user = `Business: ${clip(business, 80)}\nOwner: ${clip(owner, 60)}\nFrom: ${clip(from, 80)}\nSubject: ${clip(subject, 160)}\nMessage preview: ${clip(snippet, 600)}`;
  const r = await fetchWithTimeout(fetchImpl, env.AI_API_URL, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + env.AI_API_KEY }, body: JSON.stringify({ model: env.AI_MODEL || "default", temperature: 0.4, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) }, 25000);
  if (!r.ok) throw new HttpError(502, "The drafting service didn’t answer.");
  const j = await r.json();
  const text = (((j.choices || [])[0] || {}).message || {}).content || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new HttpError(502, "The drafting service gave an unexpected answer.");
  const parsed = JSON.parse(m[0]);
  const drafts = (parsed.drafts || []).filter((d) => d && d.body).slice(0, 3).map((d) => ({ label: clip(d.label || "Draft", 24), body: clip(d.body, 1500) }));
  if (!drafts.length) throw new HttpError(502, "No drafts came back.");
  return { drafts };
}
