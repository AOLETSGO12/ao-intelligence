// Stripe (read-only): balance, charges and payouts. Either a restricted API key the person pastes
// (Stripe → Developers → API keys → Create restricted key, with Read on Balance, Charges and Payouts)
// or Stripe Connect OAuth (read_only scope).
import { HttpError, fetchWithTimeout, wall } from "./util.js";

function authFor(env, creds) {
  if (creds.key) return { authorization: "Bearer " + creds.key };
  return { authorization: "Bearer " + env.STRIPE_SECRET_KEY, "stripe-account": creds.acct };
}
async function sget(env, fetchImpl, creds, path) {
  const r = await fetchWithTimeout(fetchImpl, "https://api.stripe.com/v1" + path, { headers: authFor(env, creds) }, 20000);
  if (r.status === 401 || r.status === 403) {
    const j = await r.json().catch(() => ({}));
    const e = new HttpError(401, r.status === 403 ? "That Stripe key doesn’t have permission to read this. Give it Read access to Balance, Charges and Payouts." : "Stripe didn’t accept that key. Please reconnect.", "reauth");
    e.detail = j.error && j.error.message; throw e;
  }
  if (!r.ok) throw new HttpError(502, "Stripe returned an error (" + r.status + ").");
  return r.json();
}
export async function verifyKey(env, fetchImpl, key) {
  if (!/^(rk|sk)_(live|test)_[A-Za-z0-9]+$/.test(String(key || "").trim())) throw new HttpError(400, "That doesn’t look like a Stripe API key (it should start rk_live_ or rk_test_).");
  const creds = { key: key.trim() };
  await sget(env, fetchImpl, creds, "/balance");
  let name = "";
  try { const a = await sget(env, fetchImpl, creds, "/account"); name = (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || a.business_profile && a.business_profile.name || a.email || ""; } catch (e) { /* restricted keys often can't read /account */ }
  return { creds, account: name || (key.includes("_test_") ? "Stripe (test mode)" : "Stripe") };
}

export function mapCharges(charges, tz) {
  const ok = charges.filter((c) => c.paid && c.status === "succeeded");
  const counts = {};
  ok.forEach((c) => { counts[c.currency] = (counts[c.currency] || 0) + 1; });
  const main = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  return ok.filter((c) => c.currency === main).map((c) => {
    const w = wall(c.created * 1000, tz);
    const pm = c.payment_method_details && c.payment_method_details.type;
    const total = Math.round(((c.amount - (c.amount_refunded || 0)) / 100) * 100) / 100;
    return { id: "st:" + c.id, date: w.date, time: w.time, ref: c.id.slice(-6).toUpperCase(), desc: c.description || (c.billing_details && c.billing_details.name) || "Card payment", total, channel: pm === "card_present" || pm === "interac_present" ? "inperson" : "online", currency: main };
  }).filter((o) => o.total > 0);
}

export async function fetchSales(env, fetchImpl, creds, { days = 30, tz = "Europe/London" } = {}) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const charges = [];
  let starting = "";
  for (let page = 0; page < 5; page++) {
    const j = await sget(env, fetchImpl, creds, `/charges?limit=100&created[gte]=${since}${starting ? "&starting_after=" + starting : ""}`);
    charges.push(...(j.data || []));
    if (!j.has_more || !j.data.length) break;
    starting = j.data[j.data.length - 1].id;
  }
  const orders = mapCharges(charges, tz);
  let summary = null;
  try {
    const b = await sget(env, fetchImpl, creds, "/balance");
    const sum = (arr) => (arr || []).reduce((a, x) => a + x.amount, 0) / 100;
    const payouts = await sget(env, fetchImpl, creds, "/payouts?limit=5").catch(() => ({ data: [] }));
    summary = { available: sum(b.available), pending: sum(b.pending), currency: ((b.available || [])[0] || {}).currency || "gbp", payouts: (payouts.data || []).map((p) => ({ date: wall((p.arrival_date || p.created) * 1000, tz).date, amount: p.amount / 100, status: p.status })) };
  } catch (e) { if (e.code === "reauth") throw e; }
  return { orders, summary };
}

export function connectUrl(env, { state, redirectUri }) {
  return `https://connect.stripe.com/oauth/authorize?${new URLSearchParams({ response_type: "code", client_id: env.STRIPE_CONNECT_CLIENT_ID, scope: "read_only", redirect_uri: redirectUri, state })}`;
}
export async function exchangeConnect(env, fetchImpl, code) {
  const r = await fetchWithTimeout(fetchImpl, "https://connect.stripe.com/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Bearer " + env.STRIPE_SECRET_KEY }, body: new URLSearchParams({ grant_type: "authorization_code", code }).toString() }, 20000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.stripe_user_id) throw new HttpError(502, "Stripe didn’t finish the connection.");
  return { acct: j.stripe_user_id };
}
