// TrueLayer Open Banking (Data API): read-only accounts, balances and transactions.
// Start in the sandbox (TRUELAYER_ENV=sandbox) with their mock bank; production needs a licence or an FCA-regulated partner.
import { HttpError, fetchWithTimeout, wall, addDaysIso } from "./util.js";

export const hosts = (env) => env.TRUELAYER_ENV === "live"
  ? { auth: "https://auth.truelayer.com", api: "https://api.truelayer.com", providers: "uk-ob-all uk-oauth-all" }
  : { auth: "https://auth.truelayer-sandbox.com", api: "https://api.truelayer-sandbox.com", providers: "uk-cs-mock uk-ob-all uk-oauth-all" };

export function authUrl(env, { state, redirectUri }) {
  const h = hosts(env);
  const p = new URLSearchParams({
    response_type: "code", client_id: env.TRUELAYER_CLIENT_ID, scope: "info accounts balance transactions offline_access",
    redirect_uri: redirectUri, providers: h.providers, state,
  });
  return `${h.auth}/?${p.toString()}`;
}

async function tokenCall(env, fetchImpl, params) {
  const r = await fetchWithTimeout(fetchImpl, `${hosts(env).auth}/connect/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.TRUELAYER_CLIENT_ID, client_secret: env.TRUELAYER_CLIENT_SECRET, ...params }).toString(),
  }, 20000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(r.status === 400 ? 401 : 502, "Your bank connection needs to be set up again.", "reauth");
  return { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000 };
}
export const exchangeCode = (env, fetchImpl, code, redirectUri) => tokenCall(env, fetchImpl, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
export const refreshToken = (env, fetchImpl, refresh) => tokenCall(env, fetchImpl, { grant_type: "refresh_token", refresh_token: refresh });

async function get(env, fetchImpl, token, path) {
  const r = await fetchWithTimeout(fetchImpl, `${hosts(env).api}${path}`, { headers: { authorization: "Bearer " + token } }, 20000);
  if (r.status === 401 || r.status === 403) { const e = new HttpError(401, "Your bank connection has expired. Please reconnect it.", "reauth"); throw e; }
  if (!r.ok) throw new HttpError(502, "The bank connection returned an error (" + r.status + ").");
  return r.json();
}

const GENERIC = new Set(["purchase", "credit", "debit", "unknown", "other", "unclassified"]);
const TYPE_LABEL = { DIRECT_DEBIT: "Direct debits", STANDING_ORDER: "Standing orders", TRANSFER: "Transfers", CASH: "Cash", INTEREST: "Interest", FEE_CHARGE: "Bank fees", ATM: "Cash", PURCHASE: "Card spending" };
export function categoryFor(t) {
  const cls = (t.transaction_classification || []).filter((c) => c && !GENERIC.has(String(c).toLowerCase()));
  if (cls.length) return String(cls[0]).replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (TYPE_LABEL[t.transaction_type]) return TYPE_LABEL[t.transaction_type];
  return t.amount < 0 ? "Other spending" : "Other income";
}
export function mapTransaction(t, tz) {
  const w = wall(Date.parse(t.timestamp), tz);
  const amount = Math.round(Math.abs(Number(t.amount)) * 100) / 100;
  return { id: "tl:" + t.transaction_id, date: w.date, time: w.time, desc: t.merchant_name || t.description || "Transaction", amount, direction: Number(t.amount) < 0 ? "out" : "in", category: categoryFor(t) };
}

/** tokens: { access, refresh, exp } -> { bank, summary, tokens (if refreshed) } */
export async function fetchBank(env, fetchImpl, tokens, { days = 30, tz = "Europe/London" } = {}) {
  let t = tokens, refreshed = null;
  if (!t.access || t.exp < Date.now()) {
    if (!t.refresh) throw new HttpError(401, "Your bank connection has expired. Please reconnect it.", "reauth");
    t = await refreshToken(env, fetchImpl, t.refresh);
    if (!t.refresh) t.refresh = tokens.refresh;
    refreshed = t;
  }
  const accounts = (await get(env, fetchImpl, t.access, "/data/v1/accounts")).results || [];
  const today = wall(Date.now(), tz).date;
  const from = addDaysIso(today, -days);
  let balance = 0, cur = "GBP";
  const bank = [];
  for (const a of accounts.slice(0, 4)) {
    try {
      const b = (await get(env, fetchImpl, t.access, `/data/v1/accounts/${a.account_id}/balance`)).results || [];
      if (b[0]) { balance += Number(b[0].current || 0); cur = b[0].currency || cur; }
    } catch (e) { if (e.code === "reauth") throw e; }
    try {
      const tx = (await get(env, fetchImpl, t.access, `/data/v1/accounts/${a.account_id}/transactions?from=${from}&to=${addDaysIso(today, 1)}`)).results || [];
      tx.forEach((x) => bank.push(mapTransaction(x, tz)));
    } catch (e) { if (e.code === "reauth") throw e; }
  }
  const names = accounts.slice(0, 3).map((a) => a.display_name).filter(Boolean).join(", ");
  return { bank, summary: { balance: Math.round(balance * 100) / 100, currency: cur, accounts: accounts.length }, account: names, tokens: refreshed };
}
