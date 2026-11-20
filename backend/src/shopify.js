// Shopify (read-only orders). Either a custom-app Admin API access token the person pastes
// (Settings → Apps → Develop apps → scope read_orders), or the OAuth install flow.
import { HttpError, fetchWithTimeout, wall, assertPublicHost } from "./util.js";
import { hmacHex } from "./seal.js";

export const API_VERSION = "2025-01";
export function cleanShop(input) {
  const t = String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const base = t.replace(/\.myshopify\.com$/, "");
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(base)) throw new HttpError(400, "That doesn’t look like a Shopify store name. It usually looks like yourshop.myshopify.com.");
  return base + ".myshopify.com";
}
async function sget(fetchImpl, shop, token, pathOrUrl) {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `https://${shop}/admin/api/${API_VERSION}${pathOrUrl}`;
  assertPublicHost(new URL(url).hostname);
  const r = await fetchWithTimeout(fetchImpl, url, { headers: { "x-shopify-access-token": token, accept: "application/json" } }, 20000);
  if (r.status === 401 || r.status === 403) throw new HttpError(401, r.status === 403 ? "That token can’t read orders. Give the app the read_orders permission." : "Shopify didn’t accept that token.", "reauth");
  if (r.status === 404) throw new HttpError(404, "We couldn’t find that Shopify store.");
  if (!r.ok) throw new HttpError(502, "Shopify returned an error (" + r.status + ").");
  return { json: await r.json(), link: r.headers.get("link") || "" };
}
export async function verify(fetchImpl, shopInput, token) {
  const shop = cleanShop(shopInput);
  if (!token || String(token).length < 10) throw new HttpError(400, "Please paste the Admin API access token (it starts shpat_).");
  const { json } = await sget(fetchImpl, shop, token.trim(), "/shop.json");
  return { creds: { shop, token: token.trim() }, account: (json.shop && json.shop.name) || shop };
}
export function mapOrders(orders, tz) {
  return orders.filter((o) => !o.cancelled_at && !o.test && ["paid", "partially_paid", "partially_refunded", "authorized"].includes(o.financial_status)).map((o) => {
    const w = wall(Date.parse(o.created_at), tz);
    const items = (o.line_items || []).map((l) => l.title).filter(Boolean);
    const desc = items.length ? items.slice(0, 2).join(", ") + (items.length > 2 ? " +" + (items.length - 2) + " more" : "") : "Online order";
    return { id: "sh:" + o.id, date: w.date, time: w.time, ref: String(o.name || "#" + o.id), desc, total: Math.round(Number(o.total_price) * 100) / 100, channel: o.source_name === "pos" ? "inperson" : "online", currency: o.currency };
  });
}
export async function fetchOrders(fetchImpl, creds, { days = 30, tz = "Europe/London" } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  let next = `/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(since)}&fields=id,name,created_at,total_price,currency,financial_status,cancelled_at,line_items,source_name,test`;
  const all = [];
  for (let page = 0; page < 6 && next; page++) {
    const { json, link } = await sget(fetchImpl, creds.shop, creds.token, next);
    all.push(...(json.orders || []));
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    next = m ? m[1] : null;
  }
  return mapOrders(all, tz);
}
export function installUrl(env, { shop, state, redirectUri }) {
  return `https://${cleanShop(shop)}/admin/oauth/authorize?${new URLSearchParams({ client_id: env.SHOPIFY_API_KEY, scope: "read_orders", redirect_uri: redirectUri, state })}`;
}
/** Shopify signs its callback query string: verify before trusting it. */
export async function verifyCallbackHmac(env, searchParams) {
  const given = searchParams.get("hmac") || "";
  const pairs = [];
  for (const [k, v] of searchParams.entries()) if (k !== "hmac") pairs.push(`${k}=${v}`);
  pairs.sort();
  const calc = await hmacHex(env.SHOPIFY_API_SECRET, pairs.join("&"));
  if (calc.length !== given.length) return false;
  let diff = 0; for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
export async function exchange(env, fetchImpl, shop, code) {
  const r = await fetchWithTimeout(fetchImpl, `https://${shop}/admin/oauth/access_token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: env.SHOPIFY_API_KEY, client_secret: env.SHOPIFY_API_SECRET, code }) }, 20000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(502, "Shopify didn’t finish the connection.");
  return { shop, token: j.access_token };
}
