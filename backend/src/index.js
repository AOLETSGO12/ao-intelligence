// AO Intelligence backend — Cloudflare Worker.
//
// Everything here needs a secret or a server, so it can't live in the website:
//   /imap/*       other email (any IMAP provider): read recent mail, save reply drafts (never sends)
//   /truelayer/*  Open Banking via TrueLayer (sandbox first)
//   /stripe/*     Stripe balance, charges and payouts (restricted key, or Connect OAuth)
//   /shopify/*    Shopify orders and sales (custom-app token, or OAuth)
//   /ics, /caldav, /calendly   calendar links, CalDAV servers and Calendly
//   /ai/draft     optional smarter reply drafts
//
// It stores nothing. Credentials are encrypted ("sealed") with SEAL_KEY and given to the browser,
// which sends them back for each request. Revoking = deleting the browser's copy (and the provider's grant).
import { seal, unseal, signState, verifyState } from "./seal.js";
import { HttpError, wall, addDaysIso, assertPublicHost } from "./util.js";
import { ImapClient, connectTls, listNeedingReply, buildDraft, findDraftsFolder, appendDraft } from "./imap.js";
import { fetchIcs, parseIcs, windowFor } from "./ics.js";
import { discoverCalendars, fetchCaldavEvents, calendlyUser, calendlyEvents, normalizeUser, normalizePass } from "./caldav.js";
import * as TL from "./truelayer.js";
import * as ST from "./stripe.js";
import * as SH from "./shopify.js";
import { aiDrafts } from "./ai.js";
import { detectImap } from "./detect.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function allowedOrigin(env, origin) {
  if (!origin) return null;
  if (origin === env.ALLOWED_ORIGIN) return origin;
  if (env.ALLOW_LOCALHOST === "1" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}
function allowedReturn(env, url) {
  try {
    const u = new URL(url);
    if (env.FRONTEND_URL && url.startsWith(env.FRONTEND_URL.replace(/\/+$/, "") + "/")) return true;
    return env.ALLOW_LOCALHOST === "1" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
  } catch (e) { return false; }
}
function json(env, request, body, status = 200) {
  const h = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", vary: "Origin" };
  const o = allowedOrigin(env, request.headers.get("origin"));
  if (o) { h["access-control-allow-origin"] = o; }
  return new Response(JSON.stringify(body), { status, headers: h });
}
function redirect(url) { return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } }); }
function back(ret, params) { return redirect(`${ret}#${new URLSearchParams(params).toString()}`); }

async function readBody(request) {
  const text = await request.text();
  if (text.length > 60000) throw new HttpError(413, "That request is too big.");
  try { return text ? JSON.parse(text) : {}; } catch (e) { throw new HttpError(400, "That request wasn’t valid."); }
}
const need = (env, ...names) => { for (const n of names) if (!env[n]) throw new HttpError(503, "This connection isn’t switched on yet (the backend is missing " + n + ")."); };

export function caps(env) {
  const sealed = !!env.SEAL_KEY && String(env.SEAL_KEY).length >= 16;
  return {
    sealed,
    imap: sealed, ics: sealed, caldav: sealed, calendly: sealed,
    stripe: sealed, stripe_oauth: sealed && !!(env.STRIPE_CONNECT_CLIENT_ID && env.STRIPE_SECRET_KEY),
    shopify: sealed, shopify_oauth: sealed && !!(env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET),
    truelayer: sealed && !!(env.TRUELAYER_CLIENT_ID && env.TRUELAYER_CLIENT_SECRET),
    ai: !!(env.AI_API_URL && env.AI_API_KEY),
  };
}

export function createHandler({ fetchImpl = fetch, openImap = (host) => connectTls(host, 993) } = {}) {
  async function withImap(creds, fn) {
    assertPublicHost(creds.host);
    const sock = await openImap(creds.host);
    const c = new ImapClient(sock);
    try { await c.greeting(); await c.login(creds.user, creds.pass); return await fn(c); }
    finally { await c.logout(); }
  }

  async function route(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const origin = url.origin;

    if (request.method === "OPTIONS") {
      const o = allowedOrigin(env, request.headers.get("origin"));
      return new Response(null, { status: 204, headers: o ? { "access-control-allow-origin": o, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600", vary: "Origin" } : {} });
    }
    if (path === "/health" || path === "/") {
      const c = caps(env);
      return json(env, request, { ok: c.sealed, service: "ao-intelligence-api", caps: c, truelayer_env: env.TRUELAYER_ENV === "live" ? "live" : "sandbox" });
    }

    // ---------------------------------------------------------------- OAuth-style redirects (browser navigations)
    if (request.method === "GET") {
      if (path === "/truelayer/start") {
        need(env, "SEAL_KEY", "TRUELAYER_CLIENT_ID", "TRUELAYER_CLIENT_SECRET");
        const ret = url.searchParams.get("return_to") || "";
        if (!allowedReturn(env, ret)) throw new HttpError(400, "That return address isn’t allowed.");
        const state = await signState(env.SEAL_KEY, { p: "truelayer", ret, cs: url.searchParams.get("state") || "", exp: Date.now() + 15 * 60000 });
        return redirect(TL.authUrl(env, { state, redirectUri: origin + "/truelayer/callback" }));
      }
      if (path === "/truelayer/callback") {
        const st = await verifyState(env.SEAL_KEY || "", url.searchParams.get("state") || "");
        if (!st || st.p !== "truelayer") throw new HttpError(400, "That sign-in link has expired. Please start again.");
        if (url.searchParams.get("error")) return back(st.ret, { provider: "truelayer", state: st.cs, error: url.searchParams.get("error"), error_description: url.searchParams.get("error_description") || "" });
        try {
          const tok = await TL.exchangeCode(env, fetchImpl, url.searchParams.get("code"), origin + "/truelayer/callback");
          const sealed = await seal(env.SEAL_KEY, { t: "tl", ...tok });
          return back(st.ret, { provider: "truelayer", state: st.cs, sealed });
        } catch (e) { return back(st.ret, { provider: "truelayer", state: st.cs, error: "failed", error_description: e.message }); }
      }
      if (path === "/stripe/start") {
        need(env, "SEAL_KEY", "STRIPE_CONNECT_CLIENT_ID", "STRIPE_SECRET_KEY");
        const ret = url.searchParams.get("return_to") || "";
        if (!allowedReturn(env, ret)) throw new HttpError(400, "That return address isn’t allowed.");
        const state = await signState(env.SEAL_KEY, { p: "stripe", ret, cs: url.searchParams.get("state") || "", exp: Date.now() + 15 * 60000 });
        return redirect(ST.connectUrl(env, { state, redirectUri: origin + "/stripe/callback" }));
      }
      if (path === "/stripe/callback") {
        const st = await verifyState(env.SEAL_KEY || "", url.searchParams.get("state") || "");
        if (!st || st.p !== "stripe") throw new HttpError(400, "That sign-in link has expired. Please start again.");
        if (url.searchParams.get("error")) return back(st.ret, { provider: "stripe", state: st.cs, error: url.searchParams.get("error"), error_description: url.searchParams.get("error_description") || "" });
        try {
          const creds = await ST.exchangeConnect(env, fetchImpl, url.searchParams.get("code"));
          const sealed = await seal(env.SEAL_KEY, { t: "stripe", ...creds });
          return back(st.ret, { provider: "stripe", state: st.cs, sealed, account: "Stripe" });
        } catch (e) { return back(st.ret, { provider: "stripe", state: st.cs, error: "failed", error_description: e.message }); }
      }
      if (path === "/shopify/start") {
        need(env, "SEAL_KEY", "SHOPIFY_API_KEY", "SHOPIFY_API_SECRET");
        const ret = url.searchParams.get("return_to") || "";
        if (!allowedReturn(env, ret)) throw new HttpError(400, "That return address isn’t allowed.");
        const shop = SH.cleanShop(url.searchParams.get("shop"));
        const state = await signState(env.SEAL_KEY, { p: "shopify", ret, cs: url.searchParams.get("state") || "", shop, exp: Date.now() + 15 * 60000 });
        return redirect(SH.installUrl(env, { shop, state, redirectUri: origin + "/shopify/callback" }));
      }
      if (path === "/shopify/callback") {
        need(env, "SEAL_KEY", "SHOPIFY_API_SECRET");
        const st = await verifyState(env.SEAL_KEY, url.searchParams.get("state") || "");
        if (!st || st.p !== "shopify") throw new HttpError(400, "That sign-in link has expired. Please start again.");
        if (!(await SH.verifyCallbackHmac(env, url.searchParams))) throw new HttpError(400, "That Shopify callback couldn’t be verified.");
        if (SH.cleanShop(url.searchParams.get("shop")) !== st.shop) throw new HttpError(400, "That Shopify store didn’t match.");
        try {
          const creds = await SH.exchange(env, fetchImpl, st.shop, url.searchParams.get("code"));
          const sealed = await seal(env.SEAL_KEY, { t: "shopify", ...creds });
          return back(st.ret, { provider: "shopify", state: st.cs, sealed, account: st.shop });
        } catch (e) { return back(st.ret, { provider: "shopify", state: st.cs, error: "failed", error_description: e.message }); }
      }
      throw new HttpError(404, "Not found.");
    }

    if (request.method !== "POST") throw new HttpError(405, "Method not allowed.");
    if (!allowedOrigin(env, request.headers.get("origin")) && env.REQUIRE_ORIGIN !== "0") throw new HttpError(403, "This service only answers the AO Intelligence website.");
    need(env, "SEAL_KEY");
    const body = await readBody(request);
    const tz = typeof body.tz === "string" && body.tz.length < 60 ? body.tz : "Europe/London";

    // ---------------------------------------------------------------- connect (validate + seal)
    if (path === "/imap/detect") {
      const address = String(body.address || "").trim();
      if (!EMAIL.test(address)) throw new HttpError(400, "That email address doesn’t look right.");
      return json(env, request, await detectImap(fetchImpl, address));
    }
    if (path === "/imap/connect") {
      const address = String(body.address || "").trim();
      if (!EMAIL.test(address)) throw new HttpError(400, "That email address doesn’t look right.");
      if (!body.password) throw new HttpError(400, "Please enter the app password.");
      const host = String(body.host || "").trim().toLowerCase();
      if (!host) throw new HttpError(400, "Please enter your mail server (for example imap.example.com).");
      const creds = { host, user: address, pass: String(body.password) };
      await withImap(creds, async () => {});
      return json(env, request, { sealed: await seal(env.SEAL_KEY, { t: "imap", ...creds }), account: address });
    }
    if (path === "/ics/connect") {
      const text = await fetchIcs(body.url, fetchImpl);
      const w = windowFor(14, tz);
      const n = parseIcs(text, { ...w, tz }).length;
      const host = new URL(String(body.url).replace(/^webcal:/i, "https:")).hostname;
      return json(env, request, { sealed: await seal(env.SEAL_KEY, { t: "ics", url: String(body.url).replace(/^webcal:/i, "https:") }), account: host + (n ? "" : " (no events in the next 2 weeks)") });
    }
    if (path === "/caldav/connect") {
      const user = normalizeUser(body.username);
      const pass = normalizePass(body.password);
      if (!user || !pass) throw new HttpError(400, "Please enter the username and app password.");
      const log = (ev, data) => { try { console.log(JSON.stringify({ ev, ...data })); } catch (e) { /* ignore */ } };
      const cals = await discoverCalendars(fetchImpl, String(body.url || ""), user, pass, { log });
      return json(env, request, { sealed: await seal(env.SEAL_KEY, { t: "caldav", cals, user, pass }), account: `${user} (${cals.length} ${cals.length === 1 ? "calendar" : "calendars"})` });
    }
    if (path === "/calendly/connect") {
      const u = await calendlyUser(fetchImpl, String(body.token || ""));
      return json(env, request, { sealed: await seal(env.SEAL_KEY, { t: "calendly", token: String(body.token), uri: u.uri }), account: u.email || u.name });
    }
    if (path === "/stripe/connect") {
      const v = await ST.verifyKey(env, fetchImpl, body.key);
      return json(env, request, { sealed: await seal(env.SEAL_KEY, { t: "stripe", ...v.creds }), account: v.account });
    }
    if (path === "/shopify/connect") {
      const v = await SH.verify(fetchImpl, body.shop, { token: body.token, clientId: body.clientId, clientSecret: body.clientSecret });
      return json(env, request, { sealed: await seal(env.SEAL_KEY, { t: "shopify", ...v.creds }), account: v.account });
    }

    // ---------------------------------------------------------------- data
    if (path.startsWith("/data/") || path === "/mail/draft") {
      const s = await unseal(env.SEAL_KEY, String(body.sealed || ""));
      const days = Math.min(60, Math.max(1, parseInt(body.days || "14", 10) || 14));
      if (path === "/data/mail") {
        if (s.t !== "imap") throw new HttpError(400, "That isn’t a mail connection.");
        const r = await withImap(s, (c) => listNeedingReply(c, { selfAddress: s.user, days: 14, tz }));
        return json(env, request, r);
      }
      if (path === "/mail/draft") {
        if (s.t !== "imap") throw new HttpError(400, "That isn’t a mail connection.");
        if (!EMAIL.test(String(body.to || ""))) throw new HttpError(400, "That reply address doesn’t look right.");
        const msg = buildDraft({ from: s.user, to: body.to, subject: String(body.subject || "").slice(0, 250), body: String(body.body || "").slice(0, 20000), inReplyTo: body.rfcId, references: body.refs });
        await withImap(s, async (c) => { const folder = await findDraftsFolder(c); await appendDraft(c, folder, msg); });
        return json(env, request, { ok: true });
      }
      if (path === "/data/calendar") {
        const w = windowFor(days, tz);
        let events;
        if (s.t === "ics") events = parseIcs(await fetchIcs(s.url, fetchImpl), { ...w, tz });
        else if (s.t === "caldav") events = await fetchCaldavEvents(fetchImpl, s.cals, s.user, s.pass, { ...w, tz }, { log: (ev, data) => { try { console.log(JSON.stringify({ ev, ...data })); } catch (e) {} } });
        else if (s.t === "calendly") events = await calendlyEvents(fetchImpl, s.token, s.uri, { ...w, tz });
        else throw new HttpError(400, "That isn’t a calendar connection.");
        return json(env, request, { events });
      }
      if (path === "/data/bank") {
        if (s.t !== "tl") throw new HttpError(400, "That isn’t a bank connection.");
        need(env, "TRUELAYER_CLIENT_ID", "TRUELAYER_CLIENT_SECRET");
        const r = await TL.fetchBank(env, fetchImpl, s, { days, tz });
        const out = { bank: r.bank, summary: r.summary, account: r.account };
        if (r.tokens) out.sealed = await seal(env.SEAL_KEY, { t: "tl", ...r.tokens });
        return json(env, request, out);
      }
      if (path === "/data/sales") {
        if (s.t === "stripe") return json(env, request, await ST.fetchSales(env, fetchImpl, s, { days, tz }));
        if (s.t === "shopify") return json(env, request, { orders: await SH.fetchOrders(fetchImpl, s, { days, tz }) });
        throw new HttpError(400, "That isn’t a sales connection.");
      }
    }
    if (path === "/ai/draft") {
      need(env, "AI_API_URL", "AI_API_KEY");
      return json(env, request, await aiDrafts(env, fetchImpl, body));
    }
    throw new HttpError(404, "Not found.");
  }

  return async function handle(request, env) {
    try { return await route(request, env); }
    catch (e) {
      if (e instanceof HttpError) return json(env, request, { error: e.message, code: e.code }, e.status);
      try { console.error("unhandled", e && e.stack || e); } catch (x) { /* ignore */ }
      return json(env, request, { error: "Something went wrong on our side. Nothing was changed." }, 500);
    }
  };
}

const handler = createHandler();
export default { fetch: (request, env) => handler(request, env) };
