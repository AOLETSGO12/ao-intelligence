/* AO Intelligence — live connections.
 *
 * Real sign-in and real data for:
 *   - Google  (Gmail read + drafts, Calendar read)        browser-only, Google Identity Services
 *   - Microsoft (Outlook mail + calendar via Graph)       browser-only, OAuth code flow with PKCE
 *   - Everything that needs a secret or a server          via the backend (Cloudflare Worker, /backend):
 *       other email (IMAP), Open Banking (TrueLayer), Stripe, Shopify, CalDAV, .ics links, Calendly
 *
 * If a provider has no client ID / backend URL configured (js/config.js), route() returns null and the
 * existing simulated flow is used, labelled as sample data. Nothing here ever sends an email.
 *
 * Tokens: kept in this browser's localStorage only, namespaced per dashboard. Backend connections store
 * an opaque, encrypted "sealed" blob — the backend itself stores nothing.
 */
(function (root) {
  "use strict";
  var E = root.AOEngine;
  var LEGACY_TOKEN_KEY = "ao-live-tokens-v1";
  var PENDING_KEY = "ao-oauth-pending-v1";
  var RESULT_KEY = "ao-oauth-result-v1";
  function tokenKey() {
    try {
      var S = root.AOStore;
      if (S && S.currentId && S.currentId() && S.tokenKey) return S.tokenKey();
    } catch (e) { /* ignore */ }
    return LEGACY_TOKEN_KEY;
  }
  function withDashId(obj) {
    try {
      var S = root.AOStore;
      var id = S && S.currentId && S.currentId();
      if (id) obj.dashId = id;
    } catch (e) { /* ignore */ }
    return obj;
  }

  // ------------------------------------------------------------ config
  function readConfig() {
    var base = root.AO_CONFIG || {};
    var over = {};
    try { over = JSON.parse(root.localStorage.getItem("ao-config-override") || "{}"); } catch (e) { over = {}; }
    function pick(a, b) { return Object.assign({}, a || {}, b || {}); }
    var cfg = {
      google: pick(base.google, over.google),
      microsoft: pick({ authority: "https://login.microsoftonline.com/common" }, pick(base.microsoft, over.microsoft)),
      backendUrl: String(over.backendUrl != null ? over.backendUrl : (base.backendUrl || "")).replace(/\/+$/, ""),
      draftEndpoint: over.draftEndpoint != null ? over.draftEndpoint : (base.draftEndpoint || ""),
      redirectUri: over.redirectUri || base.redirectUri || "",
      timezone: over.timezone || base.timezone || ""
    };
    return cfg;
  }
  function cfg() { return readConfig(); }
  function redirectUri() {
    var c = cfg();
    if (c.redirectUri) return c.redirectUri;
    var p = root.location.href.split("#")[0].split("?")[0];
    return p.substring(0, p.lastIndexOf("/") + 1) + "oauth.html";
  }
  function tz() { return cfg().timezone || (root.Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Europe/London"; }

  // ------------------------------------------------------------ small utils
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoLocal(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hhmm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function addDaysDate(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function b64url(bytes) {
    var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function utf8Bytes(str) { return new TextEncoder().encode(str); }
  function randomString(n) {
    var a = new Uint8Array(n); (root.crypto || {}).getRandomValues(a);
    return b64url(a).slice(0, n);
  }
  function sha256(str) { return root.crypto.subtle.digest("SHA-256", utf8Bytes(str)).then(function (b) { return new Uint8Array(b); }); }
  var ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  function decodeEntities(s) {
    return String(s || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (m, g) {
      if (g.charAt(0) === "#") { var c = g.charAt(1).toLowerCase() === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return isNaN(c) ? m : String.fromCodePoint(c); }
      return ENT[g.toLowerCase()] != null ? ENT[g.toLowerCase()] : m;
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function q(params) {
    return Object.keys(params).filter(function (k) { return params[k] != null && params[k] !== ""; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
  }
  function friendly(e, fallback) {
    var m = (e && e.message) || String(e || "");
    return m && m.length < 220 ? m : (fallback || "Something went wrong. Nothing was changed.");
  }

  // ------------------------------------------------------------ token store
  function loadTokens() { try { return JSON.parse(root.localStorage.getItem(tokenKey()) || "{}") || {}; } catch (e) { return {}; } }
  function saveTokens(t) { try { root.localStorage.setItem(tokenKey(), JSON.stringify(t)); } catch (e) { /* ignore */ } }
  function clearTokens() { try { root.localStorage.removeItem(tokenKey()); root.localStorage.removeItem(PENDING_KEY); } catch (e) { /* ignore */ } }
  function setSealed(key, route, sealed) { var t = loadTokens(); t.sealed = t.sealed || {}; t.sealed[key] = { route: route, sealed: sealed }; saveTokens(t); }

  // ------------------------------------------------------------ backend client
  var capsPromise = null;
  function backendCaps(force) {
    var url = cfg().backendUrl;
    if (!url) return Promise.resolve(null);
    if (capsPromise && !force) return capsPromise;
    capsPromise = fetchTimeout(url + "/health", { method: "GET" }, 6000).then(function (r) {
      if (!r.ok) throw new Error("bad status");
      return r.json();
    }).then(function (j) { return j && j.ok ? j : null; }).catch(function () { return null; });
    return capsPromise;
  }
  function fetchTimeout(url, opts, ms) {
    if (typeof AbortController === "undefined") return fetch(url, opts);
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms || 15000);
    return fetch(url, Object.assign({}, opts, { signal: ctl.signal })).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function api(path, body, ms) {
    var url = cfg().backendUrl;
    if (!url) return Promise.reject(new Error("The AO Intelligence backend isn’t set up yet."));
    return fetchTimeout(url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) }, ms || 25000).then(function (r) {
      return r.text().then(function (txt) {
        var j; try { j = JSON.parse(txt); } catch (e) { j = null; }
        if (!r.ok) { var err = new Error((j && j.error) || "The backend said no (" + r.status + ")."); err.status = r.status; err.code = j && j.code; throw err; }
        return j || {};
      });
    }, function (e) { throw new Error("We couldn’t reach the AO Intelligence backend. Please try again in a moment."); });
  }

  // ------------------------------------------------------------ routing
  var MAIL_IMAP_HOST = { "gmail": "imap.gmail.com", "icloud-mail": "imap.mail.me.com", "yahoo": "imap.mail.yahoo.com", "aol": "imap.aol.com", "zoho-mail": "imap.zoho.com", "outlook": "outlook.office365.com", "proton": "127.0.0.1" };
  var CAL_DAV = { "icloud-calendar": "https://caldav.icloud.com/", "zoho-calendar": "https://calendar.zoho.com/caldav/" };

  /** Decide how (and whether) a connection can be live. Resolves {route} or {route:null, reason}. */
  function route(itemKey, providerId) {
    var c = cfg();
    return backendCaps().then(function (caps) {
      var be = function (cap) { return caps && caps.ok && (!cap || caps.caps[cap]); };
      if (itemKey === "mail") {
        if (providerId === "gmail" && c.google.clientId) return { route: "google" };
        if (providerId === "outlook" && c.microsoft.clientId) return { route: "microsoft" };
        if (providerId === "proton") return { route: null, reason: "Proton Mail only supports third-party access through Proton Bridge, which runs on your own computer — so it can’t be connected from here." };
        if (be("imap")) return { route: "imap" };
        return { route: null };
      }
      if (itemKey === "calendar") {
        if (providerId === "google-calendar" && c.google.clientId) return { route: "google" };
        if (providerId === "outlook-calendar" && c.microsoft.clientId) return { route: "microsoft" };
        if (providerId === "calendly" && be("calendly")) return { route: "calendly" };
        if ((providerId === "icloud-calendar" || providerId === "zoho-calendar" || providerId === "caldav") && (be("caldav") || be("ics"))) return { route: "caldav" };
        return { route: null };
      }
      if (itemKey === "bank") return be("truelayer") ? { route: "truelayer" } : { route: null };
      if (itemKey === "sales:stripe") return be("stripe") ? { route: "stripe" } : { route: null };
      if (itemKey === "sales:shopify") return be("shopify") ? { route: "shopify" } : { route: null };
      return { route: null };
    });
  }
  function configured() {
    var c = cfg();
    return { google: !!c.google.clientId, microsoft: !!c.microsoft.clientId, backend: !!c.backendUrl };
  }

  // ------------------------------------------------------------ extra fields the person types in the sheet
  function fieldsFor(rt, itemKey, providerId, caps, typed) {
    var f = [];
    if (rt === "imap") {
      f.push({ key: "password", label: "App password", type: "password", hint: "Use an app-specific password from your email provider’s security page, not your normal password. It’s sent over an encrypted connection, sealed, and kept only in this browser.", required: true });
      f.push({ key: "host", label: "Mail server (IMAP)", type: "text", value: MAIL_IMAP_HOST[providerId] || "", placeholder: "imap.example.com", hint: "Usually shown in your provider’s help pages. Port 993 (SSL).", required: true });
      if (providerId !== "imap") f.unshift({ key: "address", label: "Your email address", type: "text", placeholder: "you@example.com", required: true });
    } else if (rt === "caldav") {
      var isIcs = /^(webcal:|https?:\/\/[^\s]*\.ics(\?|$))/i.test(typed || "");
      if (providerId !== "caldav") {
        f.push({ key: "url", label: "Calendar server address", type: "text", value: CAL_DAV[providerId] || "", required: true });
      }
      if (providerId === "caldav" && !isIcs) {
        f.push({ key: "username", label: "Username", type: "text", required: true });
        f.push({ key: "password", label: "App password", type: "password", required: true });
      } else if (providerId !== "caldav") {
        f.push({ key: "username", label: "Username / Apple ID", type: "text", required: true });
        f.push({ key: "password", label: "App-specific password", type: "password", hint: "Create one in your account’s security settings. It’s sealed and kept only in this browser.", required: true });
      }
    } else if (rt === "calendly") {
      f.push({ key: "token", label: "Calendly personal access token", type: "password", hint: "Calendly → Integrations → API & Webhooks → Personal access tokens.", required: true });
    } else if (rt === "stripe" && !(caps && caps.caps && caps.caps.stripe_oauth)) {
      f.push({ key: "key", label: "Restricted API key (read-only)", type: "password", placeholder: "rk_live_…", hint: "Stripe → Developers → API keys → Create restricted key. Give it Read on Charges, Balance and Payouts only.", required: true });
    } else if (rt === "shopify" && !(caps && caps.caps && caps.caps.shopify_oauth)) {
      f.push({ key: "clientId", label: "App Client ID", type: "text", hint: "Easiest for your own store: in Shopify’s Dev Dashboard create an app with the read_orders scope, install it on your store, then copy its Client ID and Client secret from Settings.", required: false });
      f.push({ key: "clientSecret", label: "App Client secret", type: "password", required: false });
      f.push({ key: "token", label: "…or an existing custom app’s Admin API access token", type: "password", placeholder: "shpat_…", hint: "Only if you already have a custom app (Shopify stopped allowing new ones on 1 January 2026). Fill in the Client ID and secret above, or this token — not both.", required: false });
    }
    return f;
  }

  // ------------------------------------------------------------ popup + callback plumbing
  var inflight = null; // {state, resolve, reject, popup, timer}
  function openPopup() {
    var w = 520, h = 700;
    var left = Math.max(0, (root.screenX || 0) + ((root.outerWidth || 1000) - w) / 2);
    var top = Math.max(0, (root.screenY || 0) + ((root.outerHeight || 800) - h) / 2);
    var p = null;
    try { p = root.open("about:blank", "ao-oauth", "popup=yes,width=" + w + ",height=" + h + ",left=" + left + ",top=" + top); } catch (e) { p = null; }
    if (p && p.document) { try { p.document.title = "Connecting…"; p.document.body.innerHTML = "<p style=\"font-family:system-ui;padding:24px;color:#333\">Opening the sign-in page…</p>"; } catch (e) { /* cross-origin */ } }
    return p;
  }
  /** Wait for oauth.html to report back. Works whether or not the browser keeps window.opener
   *  (some sign-in pages cut it), by listening on postMessage, BroadcastChannel and localStorage. */
  function waitForCallback(state, popup) {
    return new Promise(function (resolve, reject) {
      var done = false, bc = null, timer;
      function finish(fn, v) {
        if (done) return; done = true; clearTimeout(timer);
        root.removeEventListener("message", onMsg); root.removeEventListener("storage", onStore);
        try { if (bc) bc.close(); } catch (e) { /* ignore */ }
        inflight = null;
        try { root.localStorage.removeItem(RESULT_KEY); } catch (e) { /* ignore */ }
        try { if (popup && !popup.closed) popup.close(); } catch (e) { /* ignore */ }
        fn(v);
      }
      function accept(d) {
        if (!d || d.type !== "ao-oauth") return;
        if (d.params && d.params.state && d.params.state !== state) return;
        finish(resolve, d.params || {});
      }
      function onMsg(ev) { if (ev.origin === root.location.origin) accept(ev.data); }
      function onStore(ev) { if (ev.key === RESULT_KEY && ev.newValue) { try { accept(JSON.parse(ev.newValue)); } catch (e) { /* ignore */ } } }
      root.addEventListener("message", onMsg); root.addEventListener("storage", onStore);
      try { if (root.BroadcastChannel) { bc = new BroadcastChannel("ao-oauth"); bc.onmessage = function (ev) { accept(ev.data); }; } } catch (e) { bc = null; }
      timer = setTimeout(function () { finish(reject, new Error("The sign-in took too long, so nothing was connected. Please try again.")); }, 5 * 60 * 1000);
      inflight = { state: state, cancel: function () { finish(reject, new Error("Cancelled — nothing was connected.")); } };
    });
  }
  function cancelPending() { if (inflight && inflight.cancel) inflight.cancel(); }
  function savePending(p) { try { root.localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } }
  function readPending() { try { return JSON.parse(root.localStorage.getItem(PENDING_KEY) || "null"); } catch (e) { return null; } }

  // ------------------------------------------------------------ Google (Gmail + Calendar) via Google Identity Services
  var GSCOPE = {
    mail: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"],
    calendar: ["https://www.googleapis.com/auth/calendar.readonly"]
  };
  var GSCOPE_ALL = GSCOPE.mail.concat(GSCOPE.calendar);
  var gisPromise = null;
  function loadGis() {
    if (root.google && root.google.accounts && root.google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { gisPromise = null; reject(new Error("We couldn’t load Google’s sign-in. Check your connection (or an ad-blocker) and try again.")); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }
  /** Must be called straight from a click so the browser allows Google's sign-in window. */
  function googleToken(scopes, opts) {
    opts = opts || {};
    return loadGis().then(function () {
      return new Promise(function (resolve, reject) {
        var client = root.google.accounts.oauth2.initTokenClient({
          client_id: cfg().google.clientId,
          scope: scopes.join(" "),
          include_granted_scopes: true,
          callback: function (resp) {
            if (resp.error) { reject(new Error(resp.error === "access_denied" ? "Access wasn’t granted, so nothing was connected." : "Google said: " + (resp.error_description || resp.error))); return; }
            var t = loadTokens();
            var prev = t.google || {};
            var granted = String(resp.scope || "").split(/\s+/).filter(Boolean);
            t.google = { token: resp.access_token, exp: Date.now() + (resp.expires_in || 3600) * 1000 - 60000, scope: granted.join(" "), login: opts.login || prev.login };
            saveTokens(t);
            resolve(t.google);
          },
          error_callback: function (err) {
            reject(new Error(err && err.type === "popup_failed_to_open" ? "Your browser blocked Google’s sign-in window. Please allow pop-ups for this site and try again." : err && err.type === "popup_closed" ? "The Google sign-in window was closed before it finished. Nothing was connected." : "Google sign-in didn’t complete. Please try again."));
          }
        });
        client.requestAccessToken({ prompt: opts.prompt != null ? opts.prompt : "consent" });
      });
    });
  }
  function googleAccess() {
    var t = loadTokens().google;
    if (!t || !t.token) { var e = new Error("Please reconnect Google — your sign-in has ended."); e.reauth = "google"; return Promise.reject(e); }
    if (t.exp < Date.now()) { var e2 = new Error("Your Google sign-in has expired (Google keeps browser sign-ins for an hour). Tap Reconnect to refresh it."); e2.reauth = "google"; return Promise.reject(e2); }
    return Promise.resolve(t.token);
  }
  function gfetch(url, opts) {
    return googleAccess().then(function (tok) {
      opts = opts || {};
      opts.headers = Object.assign({ authorization: "Bearer " + tok }, opts.headers || {});
      return fetch(url, opts).then(function (r) {
        if (r.status === 401) { var e = new Error("Your Google sign-in has expired. Tap Reconnect to refresh it."); e.reauth = "google"; throw e; }
        if (r.status === 403) { return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error((j.error && j.error.message) || "Google refused access (is the Gmail / Calendar API enabled for your project?)."); e.status = 403; throw e; }); }
        if (!r.ok) throw new Error("Google returned an error (" + r.status + ").");
        return r.json();
      });
    });
  }

  // ---- Gmail
  function headerMap(msg) {
    var m = {}; ((msg.payload && msg.payload.headers) || []).forEach(function (h) { m[h.name.toLowerCase()] = h.value; });
    return m;
  }
  function parseAddress(raw) {
    raw = String(raw || "");
    var m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    var name = m ? m[1].trim() : "", addr = (m ? m[2] : raw).trim();
    if (!m && /^[^\s@]+@[^\s@]+$/.test(raw.trim())) { addr = raw.trim(); name = ""; }
    var domain = addr.indexOf("@") > 0 ? addr.split("@")[1] : "";
    return { name: name || addr.split("@")[0] || "Someone", address: addr, domain: domain };
  }
  var AUTO_SENDER = /(^|[^a-z])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|notifications?|newsletter|updates?|alerts?|billing|receipts?|support-noreply|bounce)([^a-z]|$)/i;
  function orgFromDomain(domain) {
    if (!domain) return "";
    var parts = domain.split(".");
    var core = parts.length > 2 && /^(co|org|ac|gov|com)$/i.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[Math.max(0, parts.length - 2)];
    return (core || domain).replace(/[-_]/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function whenFor(date) {
    var today = isoLocal(new Date());
    return E.whenLabel(isoLocal(date), today) + " " + hhmm(date);
  }
  function gmailPlain(msg, max) {
    max = max || 1200;
    function walk(part) {
      if (!part) return "";
      var mime = String((part.mimeType || "")).toLowerCase();
      var data = part.body && part.body.data ? part.body.data : "";
      if (data && (mime === "text/plain" || (!mime && !part.parts))) {
        try { return decodeURIComponent(escape(atob(String(data).replace(/-/g, "+").replace(/_/g, "/")))); } catch (e) { return ""; }
      }
      var kids = part.parts || [];
      var plain = "", html = "";
      for (var i = 0; i < kids.length; i++) {
        var t = walk(kids[i]);
        if ((kids[i].mimeType || "").toLowerCase() === "text/html" && !html) html = t;
        else if (t && !plain) plain = t;
      }
      return plain || html;
    }
    var text = walk(msg.payload).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) text = decodeEntities(msg.snippet || "");
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }
  function mapGmail(msg, owner, business) {
    var h = headerMap(msg), a = parseAddress(h.from);
    var replyTo = h["reply-to"] ? parseAddress(h["reply-to"]) : a;
    var d = new Date(Number(msg.internalDate) || Date.parse(h.date) || Date.now());
    var snippet = decodeEntities(msg.snippet || "");
    var subject = (h.subject || "(no subject)").trim();
    var drafts = E.templateDrafts({ from: a.name, subject: subject, snippet: snippet, address: replyTo.address, headers: h }, owner, business);
    return {
      id: "g:" + msg.id, from: a.name, org: orgFromDomain(a.domain) || a.domain, subject: subject, snippet: snippet.length > 220 ? snippet.slice(0, 217) + "…" : snippet,
      body: snippet, when: whenFor(d), drafts: drafts, live: true,
      headers: { "list-unsubscribe": h["list-unsubscribe"] || "", "auto-submitted": h["auto-submitted"] || "", precedence: h.precedence || "" },
      meta: { provider: "google", messageId: msg.id, threadId: msg.threadId, address: replyTo.address, subject: subject, rfcId: h["message-id"], refs: h.references },
      _auto: !!h["list-unsubscribe"] || AUTO_SENDER.test(a.address) || AUTO_SENDER.test(a.name), _t: d.getTime()
    };
  }
  function fetchGmail(ctx) {
    var base = "https://gmail.googleapis.com/gmail/v1/users/me/";
    var query = "in:inbox newer_than:14d -from:me -category:promotions -category:social -category:forums";
    return gfetch(base + "messages?" + q({ maxResults: 30, q: query })).then(function (list) {
      var ids = (list.messages || []).slice(0, 30);
      return Promise.all(ids.map(function (m) {
        return gfetch(base + "messages/" + m.id + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Reply-To&metadataHeaders=List-Unsubscribe");
      }));
    }).then(function (msgs) {
      var mapped = msgs.map(function (m) { return mapGmail(m, ctx.owner, ctx.business); });
      var byThread = {}; mapped.forEach(function (m) { if (!byThread[m.meta.threadId] || byThread[m.meta.threadId]._t < m._t) byThread[m.meta.threadId] = m; });
      var cands = Object.keys(byThread).map(function (k) { return byThread[k]; }).filter(function (m) { return !m._auto; }).sort(function (a, b) { return b._t - a._t; }).slice(0, 14);
      var filed = Object.keys(byThread).map(function (k) { return byThread[k]; }).filter(function (m) { return m._auto; }).sort(function (a, b) { return b._t - a._t; }).slice(0, 15);
      filed.forEach(function (m) { m.noReply = true; m.noReplyReason = "No reply needed"; m.drafts = []; delete m._auto; delete m._t; });
      return Promise.all(cands.map(function (m) {
        return gfetch(base + "threads/" + m.meta.threadId + "?format=full").then(function (t) {
          var msgs = t.messages || [];
          var last = msgs.slice(-1)[0];
          m._replied = !!(last && (last.labelIds || []).indexOf("SENT") !== -1);
          m.thread = msgs.slice(-4).map(function (x) {
            var hh = headerMap(x);
            var a = parseAddress(hh.from);
            return { from: a.name || a.address, date: hh.date || "", text: gmailPlain(x, 1200) };
          });
          if (m.thread.length) m.body = m.thread[m.thread.length - 1].text || m.snippet;
          return m;
        }).catch(function () { return m; });
      })).then(function (cs) {
        var need = cs.filter(function (m) { return !m._replied; }).slice(0, 10);
        need.forEach(function (m) { delete m._auto; delete m._t; delete m._replied; });
        return { emails: need, filed: filed, other: Math.max(0, mapped.length - need.length) };
      });
    });
  }
  function gmailProfile() { return gfetch("https://gmail.googleapis.com/gmail/v1/users/me/profile").then(function (p) { return p.emailAddress; }); }

  // ---- Google Calendar
  function mapGoogleEvents(items, from, to) {
    var out = [];
    (items || []).forEach(function (ev) {
      if (ev.status === "cancelled") return;
      var title = ev.summary || "(no title)";
      var attendees = (ev.attendees || []).filter(function (a) { return !a.self && !a.resource; }).length;
      var online = !!(ev.conferenceData || ev.hangoutLink);
      var kind = attendees > 0 || online ? "meeting" : "business";
      var place = ev.location || (online ? "Video call" : "");
      if (ev.start && ev.start.date) {
        // all-day: may span several days (end.date is exclusive)
        var s = new Date(ev.start.date + "T12:00:00"), e = new Date((ev.end && ev.end.date || ev.start.date) + "T12:00:00");
        for (var d = s, n = 0; d < e && n < 14; d = addDaysDate(d, 1), n++) {
          var iso = isoLocal(d); if (iso < from || iso > to) continue;
          out.push({ id: "gc:" + ev.id + ":" + iso, date: iso, start: "00:00", end: "23:59", title: title, kind: "business", place: place, allDay: true });
        }
        return;
      }
      var st = new Date(ev.start && ev.start.dateTime), en = new Date(ev.end && ev.end.dateTime || ev.start && ev.start.dateTime);
      if (isNaN(st.getTime())) return;
      out.push({ id: "gc:" + ev.id, date: isoLocal(st), start: hhmm(st), end: hhmm(en), title: title, kind: kind, place: place });
    });
    return out;
  }
  function fetchGoogleCalendar() {
    var now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), now.getDate()), to = addDaysDate(from, 14);
    var url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + q({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: 100 });
    return gfetch(url).then(function (r) { return mapGoogleEvents(r.items, isoLocal(from), isoLocal(to)); });
  }
  function googleCalendarId() { return gfetch("https://www.googleapis.com/calendar/v3/calendars/primary").then(function (c) { return c.id; }); }

  function saveGmailDraft(em, body) {
    var m = em.meta, subj = /^re:/i.test(m.subject) ? m.subject : "Re: " + m.subject;
    var lines = ["To: " + m.address, "Subject: " + encHeader(subj)];
    if (m.rfcId) { lines.push("In-Reply-To: " + m.rfcId); lines.push("References: " + ((m.refs ? m.refs + " " : "") + m.rfcId).trim()); }
    lines.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=\"UTF-8\"", "Content-Transfer-Encoding: base64", "", chunk(btoa(unescape(encodeURIComponent(body))), 76));
    var raw = b64url(utf8Bytes(lines.join("\r\n")));
    return gfetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: { raw: raw, threadId: m.threadId } }) })
      .then(function (d) { return { where: "Gmail", url: "https://mail.google.com/mail/u/0/#drafts" }; });
  }
  function encHeader(s) { return /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + btoa(unescape(encodeURIComponent(s))) + "?="; }
  function chunk(s, n) { var o = []; for (var i = 0; i < s.length; i += n) o.push(s.slice(i, i + n)); return o.join("\r\n"); }

  // ------------------------------------------------------------ Microsoft (Graph) via OAuth code flow + PKCE
  var MSCOPE = { mail: ["Mail.ReadWrite"], calendar: ["Calendars.Read"] };
  function msEndpoint(p) { return cfg().microsoft.authority.replace(/\/+$/, "") + "/oauth2/v2.0/" + p; }
  // One Microsoft sign-in covers mail and calendar together.
  function msScopesFor() {
    var set = { "User.Read": 1, "offline_access": 1 };
    ["mail", "calendar"].forEach(function (k) { MSCOPE[k].forEach(function (s) { set[s] = 1; }); });
    return Object.keys(set);
  }
  function msBuildAuthUrl(scopes, state, challenge) {
    return msEndpoint("authorize") + "?" + q({
      client_id: cfg().microsoft.clientId, response_type: "code", redirect_uri: redirectUri(), response_mode: "query",
      scope: scopes.join(" "), state: state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account"
    });
  }
  function msStart(scopes, popup, meta) {
    var verifier = randomString(64), state = "ms." + randomString(16);
    return sha256(verifier).then(function (h) {
      var url = msBuildAuthUrl(scopes, state, b64url(h));
      savePending(withDashId(Object.assign({ route: "microsoft", verifier: verifier, state: state, scopes: scopes, at: Date.now() }, meta || {})));
      if (popup) { popup.location.href = url; return waitForCallback(state, popup); }
      root.location.href = url; // popup blocked: full-page redirect, finished by oauth.html
      return new Promise(function () { /* page is navigating away */ });
    }).then(function (params) { return msExchange(params, { verifier: verifier, scopes: scopes }); });
  }
  function msExchange(params, p) {
    if (params.error) throw new Error(params.error === "access_denied" || /declined|denied|consent/i.test(params.error_description || "") ? "Access wasn’t granted, so nothing was connected." : "Microsoft said: " + (params.error_description || params.error).split("\n")[0]);
    var body = q({ client_id: cfg().microsoft.clientId, scope: p.scopes.join(" "), code: params.code, redirect_uri: redirectUri(), grant_type: "authorization_code", code_verifier: p.verifier });
    return fetch(msEndpoint("token"), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.access_token) throw new Error("Microsoft didn’t finish signing you in" + (j.error_description ? ": " + String(j.error_description).split("\r")[0] : "") + ".");
      var t = loadTokens();
      t.microsoft = { token: j.access_token, refresh: j.refresh_token || (t.microsoft && t.microsoft.refresh), exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, scope: j.scope || p.scopes.join(" ") };
      saveTokens(t); return t.microsoft;
    });
  }
  function msAccess() {
    var t = loadTokens().microsoft;
    if (!t) { var e = new Error("Please reconnect Microsoft — your sign-in has ended."); e.reauth = "microsoft"; return Promise.reject(e); }
    if (t.exp > Date.now()) return Promise.resolve(t.token);
    if (!t.refresh) { var e2 = new Error("Your Microsoft sign-in has expired. Tap Reconnect."); e2.reauth = "microsoft"; return Promise.reject(e2); }
    return fetch(msEndpoint("token"), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: q({ client_id: cfg().microsoft.clientId, grant_type: "refresh_token", refresh_token: t.refresh, scope: t.scope || "" }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j.access_token) { var e = new Error("Your Microsoft sign-in has expired. Tap Reconnect."); e.reauth = "microsoft"; throw e; }
        var all = loadTokens();
        all.microsoft = { token: j.access_token, refresh: j.refresh_token || t.refresh, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, scope: j.scope || t.scope };
        saveTokens(all); return all.microsoft.token;
      });
  }
  function gr(path, opts) {
    return msAccess().then(function (tok) {
      opts = opts || {};
      opts.headers = Object.assign({ authorization: "Bearer " + tok }, opts.headers || {});
      var url = path.indexOf("http") === 0 ? path : "https://graph.microsoft.com/v1.0" + path;
      return fetch(url, opts).then(function (r) {
        if (r.status === 401) { var e = new Error("Your Microsoft sign-in has expired. Tap Reconnect."); e.reauth = "microsoft"; throw e; }
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error((j.error && j.error.message) || "Microsoft returned an error (" + r.status + ")."); });
        return r.status === 204 ? {} : r.json();
      });
    });
  }
  function mapGraphMail(m, owner, business) {
    var a = { name: (m.from && m.from.emailAddress && m.from.emailAddress.name) || "", address: (m.from && m.from.emailAddress && m.from.emailAddress.address) || "" };
    var domain = a.address.indexOf("@") > 0 ? a.address.split("@")[1] : "";
    var d = new Date(m.receivedDateTime);
    var name = a.name && a.name !== a.address ? a.name : (a.address.split("@")[0] || "Someone");
    var subject = (m.subject || "(no subject)").trim();
    var snippet = String(m.bodyPreview || "").replace(/\s+/g, " ").trim();
    var rt = m.replyTo && m.replyTo[0] && m.replyTo[0].emailAddress && m.replyTo[0].emailAddress.address;
    return {
      id: "m:" + m.id, from: name, org: orgFromDomain(domain) || domain, subject: subject, snippet: snippet.length > 220 ? snippet.slice(0, 217) + "…" : snippet,
      when: whenFor(d), body: snippet, drafts: E.templateDrafts({ from: name, subject: subject, snippet: snippet, address: rt || a.address }, owner, business), live: true,
      meta: { provider: "microsoft", messageId: m.id, threadId: m.conversationId, address: rt || a.address, subject: subject },
      _auto: AUTO_SENDER.test(a.address) || AUTO_SENDER.test(a.name), _other: m.inferenceClassification === "other", _t: d.getTime(), _conv: m.conversationId
    };
  }
  function fetchOutlook(ctx) {
    var since = addDaysDate(new Date(), -14).toISOString();
    var sel = "id,conversationId,subject,from,replyTo,receivedDateTime,bodyPreview,isRead,inferenceClassification";
    return Promise.all([
      gr("/me/mailFolders/inbox/messages?" + q({ "$top": 40, "$select": sel, "$orderby": "receivedDateTime desc", "$filter": "receivedDateTime ge " + since })),
      gr("/me/mailFolders/sentitems/messages?" + q({ "$top": 40, "$select": "conversationId,sentDateTime", "$orderby": "sentDateTime desc" })).catch(function () { return { value: [] }; })
    ]).then(function (res) {
      var sent = {}; (res[1].value || []).forEach(function (s) { var t = Date.parse(s.sentDateTime); if (!sent[s.conversationId] || sent[s.conversationId] < t) sent[s.conversationId] = t; });
      var mapped = (res[0].value || []).map(function (m) { return mapGraphMail(m, ctx.owner, ctx.business); });
      var filed = mapped.filter(function (m) { return m._auto || m._other; }).slice(0, 15);
      filed.forEach(function (m) { m.noReply = true; m.noReplyReason = "No reply needed"; m.drafts = m.drafts || []; delete m._auto; delete m._other; delete m._t; delete m._conv; });
      var seen = {};
      var need = mapped.filter(function (m) {
        if (m._auto || m._other) return false;
        if (sent[m._conv] && sent[m._conv] > m._t) return false;
        if (seen[m._conv]) return false; seen[m._conv] = 1; return true;
      }).slice(0, 10);
      need.forEach(function (m) { delete m._auto; delete m._other; delete m._t; delete m._conv; });
      return Promise.all(need.map(function (m) {
        if (!m.meta.threadId) return m;
        var filter = "conversationId eq '" + String(m.meta.threadId).replace(/'/g, "''") + "'";
        return gr("/me/messages?" + q({ "$top": 4, "$select": "id,from,receivedDateTime,bodyPreview,body", "$orderby": "receivedDateTime asc", "$filter": filter }), { headers: { Prefer: 'outlook.body-content-type="text"' } })
          .then(function (r) {
            m.thread = (r.value || []).slice(-4).map(function (x) {
              var nm = (x.from && x.from.emailAddress && (x.from.emailAddress.name || x.from.emailAddress.address)) || "";
              var text = "";
              if (x.body && x.body.content) text = String(x.body.content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              if (!text) text = String(x.bodyPreview || "").trim();
              return { from: nm, date: x.receivedDateTime || "", text: text.slice(0, 1200) };
            });
            if (m.thread.length) m.body = m.thread[m.thread.length - 1].text || m.snippet;
            return m;
          }).catch(function () { return m; });
      })).then(function (emails) { return { emails: emails, filed: filed, other: Math.max(0, mapped.length - need.length) }; });
    });
  }
  function mapGraphEvents(items, from, to) {
    var out = [];
    (items || []).forEach(function (ev) {
      if (ev.isCancelled) return;
      var title = ev.subject || "(no title)";
      var att = (ev.attendees || []).length, online = !!ev.isOnlineMeeting;
      var place = (ev.location && ev.location.displayName) || (online ? "Video call" : "");
      var kind = att > 1 || online ? "meeting" : "business";
      var sd = String(ev.start.dateTime || "").slice(0, 10), st = String(ev.start.dateTime || "").slice(11, 16);
      var ed = String(ev.end.dateTime || "").slice(0, 10), et = String(ev.end.dateTime || "").slice(11, 16);
      if (ev.isAllDay) {
        var s = new Date(sd + "T12:00:00"), e = new Date(ed + "T12:00:00");
        for (var d = s, n = 0; d < e && n < 14; d = addDaysDate(d, 1), n++) {
          var iso = isoLocal(d); if (iso < from || iso > to) continue;
          out.push({ id: "mc:" + ev.id + ":" + iso, date: iso, start: "00:00", end: "23:59", title: title, kind: "business", place: place, allDay: true });
        }
        return;
      }
      out.push({ id: "mc:" + ev.id, date: sd, start: st, end: ed === sd ? et : "23:59", title: title, kind: kind, place: place });
    });
    return out;
  }
  function fetchOutlookCalendar() {
    var now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), now.getDate()), to = addDaysDate(from, 14);
    var url = "/me/calendarView?" + q({ startDateTime: from.toISOString(), endDateTime: to.toISOString(), "$top": 100, "$orderby": "start/dateTime", "$select": "id,subject,start,end,isAllDay,location,attendees,isOnlineMeeting,isCancelled" });
    return gr(url, { headers: { Prefer: 'outlook.timezone="' + tz() + '"' } }).then(function (r) { return mapGraphEvents(r.value, isoLocal(from), isoLocal(to)); });
  }
  function saveOutlookDraft(em, body) {
    return gr("/me/messages/" + encodeURIComponent(em.meta.messageId) + "/createReply", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then(function (d) {
      return gr("/me/messages/" + encodeURIComponent(d.id), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: { contentType: "Text", content: body } }) }).then(function () {
        return { where: "Outlook", url: "https://outlook.office.com/mail/drafts" };
      });
    });
  }

  // ------------------------------------------------------------ AI / template drafts
  function sealedMail() {
    var t = loadTokens();
    return t.sealed && t.sealed.mail && t.sealed.mail.sealed ? t.sealed.mail.sealed : "";
  }
  function draftPayload(m, ctx, extra) {
    extra = extra || {};
    return {
      from: m.from || "",
      address: (m.meta && m.meta.address) || m.address || "",
      subject: m.subject || "",
      snippet: m.snippet || "",
      body: m.body || m.snippet || "",
      thread: m.thread || [],
      headers: m.headers || {},
      owner: ctx.owner || "",
      business: ctx.business || "",
      type: ctx.type || "",
      industry: ctx.industry || "",
      tone: extra.tone || "friendly",
      rewrite: !!extra.rewrite,
      previous: extra.previous || "",
      sealed: sealedMail() || undefined,
      tz: tz()
    };
  }
  function applyDraftResult(m, j) {
    if (j && j.skip) { m.noReply = true; m.noReplyReason = j.reason || "No reply needed"; m.drafts = []; return; }
    if (j && j.drafts && j.drafts.length) {
      m.drafts = j.drafts.slice(0, 3).map(function (d) { return { label: String(d.label || "Draft").slice(0, 24), body: String(d.body || "") }; });
      m.noReply = false;
    }
  }
  function markLocalSkip(m) {
    if (E.classifyNoReply && E.classifyNoReply({ from: m.from, address: m.meta && m.meta.address, subject: m.subject, snippet: m.snippet, body: m.body, headers: m.headers, thread: m.thread })) {
      m.noReply = true; m.noReplyReason = "No reply needed"; m.drafts = [];
      return true;
    }
    return false;
  }
  function maybeAiDrafts(emails, ctx, caps) {
    var c = cfg();
    var endpoint = c.backendUrl ? c.backendUrl + "/draft" : "";
    emails.forEach(function (m) { markLocalSkip(m); });
    var work = emails.filter(function (m) { return !m.noReply; }).slice(0, 8);
    if (!endpoint || !work.length) return Promise.resolve(emails);
    var i = 0;
    function one(m) {
      return fetchTimeout(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draftPayload(m, ctx)) }, 30000)
        .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) applyDraftResult(m, j); }).catch(function () { /* keep the content-aware template */ });
    }
    function nextBatch() {
      if (i >= work.length) return Promise.resolve();
      var batch = work.slice(i, i + 3);
      i += 3;
      return Promise.all(batch.map(one)).then(nextBatch);
    }
    return nextBatch().then(function () { return emails; });
  }
  function rewriteDraft(email, ctx, opts) {
    opts = opts || {};
    var c = cfg();
    var endpoint = c.backendUrl ? c.backendUrl + "/draft" : "";
    if (!endpoint) {
      var fb = E.templateDrafts(email, ctx.owner, ctx.business, opts.tone);
      return Promise.resolve({ skip: false, drafts: fb });
    }
    return fetchTimeout(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draftPayload(email, ctx, { tone: opts.tone, rewrite: true, previous: opts.previous })) }, 30000)
      .then(function (r) { if (!r.ok) throw new Error("The draft couldn’t be rewritten just now."); return r.json(); });
  }

  // ------------------------------------------------------------ backend data (normalised by the Worker into the same shapes)
  function sealedFor(key) { var t = loadTokens(); return t.sealed && t.sealed[key] ? t.sealed[key] : null; }
  function backendData(key, path, extra) {
    var s = sealedFor(key);
    if (!s) { var e = new Error("This connection needs to be set up again."); e.reauth = key; return Promise.reject(e); }
    return api(path, Object.assign({ sealed: s.sealed, tz: tz() }, extra || {})).then(function (j) {
      if (j.sealed) setSealed(key, s.route, j.sealed);
      return j;
    }).catch(function (e) { if (e.status === 401 || e.code === "reauth") e.reauth = key; throw e; });
  }

  // ------------------------------------------------------------ the public pieces used by the journey
  var KIND_LABEL = { google: "Google", microsoft: "Microsoft", truelayer: "your bank", stripe: "Stripe", shopify: "Shopify", imap: "your mail server", caldav: "your calendar", calendly: "Calendly" };

  /** Which IMAP server does this address use? Resolves {host, kind}; host may be empty. */
  function detectImap(address) { return api("/imap/detect", { address: address }, 12000); }
  /** Called by startConnection when the route is live. Returns the session fields the journey shows. */
  function liveSession(itemKey, providerId, name, rt, typed, caps) {
    var fields = fieldsFor(rt, itemKey, providerId, caps, typed);
    var consent;
    if (rt === "google") consent = "You’ll sign in with Google in a small window. We ask only to " + (itemKey === "mail" ? "read your recent mail and save reply drafts (we can’t send)." : "read your calendar events.");
    else if (rt === "microsoft") consent = "You’ll sign in with Microsoft in a small window. We ask only to " + (itemKey === "mail" ? "read your mail and save reply drafts (we can’t send)." : "read your calendar.");
    else if (rt === "truelayer") consent = "You’ll be taken to your bank (through TrueLayer, a regulated Open Banking provider) to approve read-only access. We never see your banking password.";
    else if (rt === "stripe") consent = fields.length ? "Paste a read-only key. We can see balance, charges and payouts — we can’t move money." : "You’ll be taken to Stripe to approve read-only access.";
    else if (rt === "shopify") consent = "We’ll read your orders and sales. We can’t change anything in your shop.";
    else consent = "We’ll check the details you give and read your " + (itemKey === "mail" ? "recent mail (and save drafts, never send)." : "calendar events.") + " Credentials are sealed and kept only in this browser.";
    return { live: true, route: rt, fields: fields, consent: consent, oauth: !!((rt === "stripe" && caps && caps.caps && caps.caps.stripe_oauth) || (rt === "shopify" && caps && caps.caps && caps.caps.shopify_oauth)) };
  }

  /** Complete the connection. MUST be called synchronously from the "Allow access" click. */
  function complete(session, values) {
    values = values || {};
    var rt = session.route, key = session.itemKey, popup;
    var done = function (detail) { return { key: key, providerId: session.providerId, providerName: session.providerName, detail: detail || session.detail, at: new Date().toISOString(), live: true, route: rt }; };
    try {
      if (rt === "google") {
        // One sign-in, one consent screen, for Gmail and Google Calendar together.
        return googleToken(GSCOPE_ALL.slice()).then(function (g) {
          var granted = String(g.scope || "");
          var hasMail = granted.indexOf(GSCOPE.mail[0]) !== -1, hasCal = granted.indexOf(GSCOPE.calendar[0]) !== -1;
          if (key === "mail" ? !hasMail : !hasCal) throw new Error("Google didn’t get permission to read your " + (key === "mail" ? "Gmail" : "calendar") + ". Please try again and leave every box ticked.");
          return Promise.all([hasMail ? gmailProfile() : null, hasCal ? googleCalendarId() : null]).then(function (r) {
            var login = r[0] || r[1] || "";
            var mine = done(key === "mail" ? r[0] : r[1]);
            mine.also = [];
            var other = key === "mail" ? "calendar" : "mail";
            if (key === "mail" ? hasCal : hasMail) mine.also.push({ key: other, providerId: other === "mail" ? "gmail" : "google-calendar", providerName: other === "mail" ? "Gmail" : "Google Calendar", detail: login, at: mine.at, live: true, route: "google" });
            return mine;
          });
        });
      }
      if (rt === "microsoft") {
        popup = openPopup();
        return msStart(msScopesFor(), popup, { key: key, providerId: session.providerId, providerName: session.providerName }).then(function () {
          return gr("/me?$select=mail,userPrincipalName,displayName").then(function (me) { var who = me.mail || me.userPrincipalName; var mine = done(who); mine.also = [msSibling(key, who, mine.at)]; return mine; });
        });
      }
      if (rt === "truelayer" || ((rt === "stripe") && session.oauth) || ((rt === "shopify") && session.oauth)) {
        popup = openPopup();
        var state = rt + "." + randomString(16);
        var url = cfg().backendUrl + "/" + rt + "/start?" + q({ state: state, return_to: redirectUri(), shop: session.detail });
        savePending(withDashId({ route: rt, key: key, providerId: session.providerId, providerName: session.providerName, state: state, at: Date.now(), detail: session.detail }));
        if (popup) popup.location.href = url; else { root.location.href = url; return new Promise(function () {}); }
        return waitForCallback(state, popup).then(function (p) { return finishBackendCallback(p, session); });
      }
    } catch (e) { return Promise.reject(e); }
    // sealed backend connects with typed credentials
    var body;
    if (rt === "stripe") body = api("/stripe/connect", { key: values.key });
    else if (rt === "shopify") body = (values.clientId || values.clientSecret || values.token) ? api("/shopify/connect", { shop: session.detail, token: values.token, clientId: values.clientId, clientSecret: values.clientSecret }) : Promise.reject(new Error("Please paste the app’s Client ID and Client secret, or an Admin API access token."));
    else if (rt === "imap") body = api("/imap/connect", { address: values.address || session.detail, password: values.password, host: values.host }, 60000);
    else if (rt === "calendly") body = api("/calendly/connect", { token: values.token });
    else if (rt === "caldav") {
      var u = values.url || (session.providerId === "caldav" ? session.detail : "");
      var looksIcs = /^(webcal:|https?:\/\/[^\s]*\.ics(\?|$))/i.test(u || "") || /calendar\/ical\/|\/ical\/|[?&]format=ics|private-[0-9a-f]+/i.test(u || "");
      body = (session.icsOnly || (looksIcs && !values.username)) ? api("/ics/connect", { url: u }) : api("/caldav/connect", { url: u, username: values.username, password: values.password });
    } else return Promise.reject(new Error("That connection isn’t available live yet."));
    return body.then(function (r) { setSealed(key, rt, r.sealed); return done(r.account || session.detail); });
  }
  function msSibling(key, who, at) {
    var other = key === "mail" ? "calendar" : "mail";
    return { key: other, providerId: other === "mail" ? "outlook" : "outlook-calendar", providerName: other === "mail" ? "Outlook" : "Outlook calendar", detail: who, at: at, live: true, route: "microsoft" };
  }
  /** Real-app connect (no consent sheet): build the session and run the same completion. Must be called from a click. */
  function connect(itemKey, providerId, providerName, rt, values, conns) {
    var session = { itemKey: itemKey, providerId: providerId, providerName: providerName, route: rt, allConns: conns || {}, detail: (values && (values.address || values.url || values.shop)) || "", icsOnly: !!(values && values.icsOnly) };
    if (rt === "shopify") session.detail = (values && values.shop) || "";
    return complete(session, values || {});
  }
  function finishBackendCallback(p, session) {
    if (p.error) throw new Error(p.error === "access_denied" ? "Access wasn’t granted, so nothing was connected." : String(p.error_description || p.error).slice(0, 200));
    if (!p.sealed) throw new Error("The connection didn’t finish. Please try again.");
    setSealed(session.itemKey, session.route, p.sealed);
    return { key: session.itemKey, providerId: session.providerId, providerName: session.providerName, detail: p.account || session.detail, at: new Date().toISOString(), live: true, route: session.route };
  }

  /** Full-page-redirect fallback (popup blocked): oauth.html calls this. Resolves {key, conn} or throws. */
  function finishRedirect(params) {
    var pend = readPending();
    if (!pend) return Promise.reject(new Error("That sign-in session wasn’t found. Please start again from the dashboard."));
    if (pend.dashId && root.AOStore && root.AOStore.switchTo) root.AOStore.switchTo(pend.dashId);
    root.localStorage.removeItem(PENDING_KEY);
    if (pend.state && params.state && params.state !== pend.state) return Promise.reject(new Error("That sign-in didn’t match the one we started. Please try again."));
    var sess = { itemKey: pend.key, providerId: pend.providerId, providerName: pend.providerName, route: pend.route, detail: pend.detail };
    var p;
    if (pend.route === "microsoft") {
      p = msExchange(params, { verifier: pend.verifier, scopes: pend.scopes }).then(function () {
        return gr("/me?$select=mail,userPrincipalName").then(function (me) { var who = me.mail || me.userPrincipalName, at = new Date().toISOString(); return { key: pend.key, providerId: pend.providerId, providerName: pend.providerName, detail: who, at: at, live: true, route: "microsoft", also: [msSibling(pend.key, who, at)] }; });
      });
    } else p = Promise.resolve(finishBackendCallback(params, sess));
    return p.then(function (conn) { return { key: pend.key, conn: conn }; });
  }

  /** Re-run the sign-in for a route whose token ended. Must come from a click. */
  function reconnect(rt, conns) {
    if (rt === "google") {
      return googleToken(GSCOPE_ALL.slice());
    }
    if (rt === "microsoft") { var popup = openPopup(); return msStart(msScopesFor(), popup, {}); }
    return Promise.reject(new Error("Please remove and add this connection again."));
  }

  /** Forget one connection. `others` = the remaining connections; Google access is revoked once none still use it. */
  function disconnect(key, conn, others) {
    var t = loadTokens();
    if (conn && conn.route === "local" && root.AOReal) { if (key === "bank") root.AOReal.clearBank(); if (key === "calendar") root.AOReal.clearCalendar(); }
    if (t.sealed) delete t.sealed[key];
    if (conn && conn.route === "google") {
      var still = !!others && Object.keys(others).some(function (k) { return k !== key && others[k].live && others[k].route === "google"; });
      if (!still && t.google && t.google.token) {
        // Google's documented revoke endpoint works without loading the sign-in script.
        try { fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "token=" + encodeURIComponent(t.google.token), keepalive: true }).catch(function () {}); } catch (e) { /* ignore */ }
      }
      if (!still) delete t.google;
    }
    if (conn && conn.route === "microsoft") {
      var stillMs = !!others && Object.keys(others).some(function (k) { return k !== key && others[k].live && others[k].route === "microsoft"; });
      if (!stillMs) delete t.microsoft;
    }
    saveTokens(t);
  }

  // ------------------------------------------------------------ loading everything for the dashboard
  function load(state) {
    var conns = state.connected || {};
    var ctx = { owner: state.account ? state.account.name : "", business: state.business ? state.business.name : "", type: state.business && state.business.type ? state.business.type : "", industry: state.business && state.business.industry ? state.business.industry : "" };
    var out = { errors: {}, accounts: {}, extras: {} };
    var jobs = [];
    function job(key, fn) { jobs.push(fn().catch(function (e) { out.errors[key] = friendly(e, "We couldn’t load this just now."); if (e && e.reauth) { out.reauth = out.reauth || {}; out.reauth[key] = conns[key].route; } })); }
    var live = Object.keys(conns).filter(function (k) { return conns[k].live; });
    if (!live.length) return Promise.resolve(out);
    return backendCaps().then(function (caps) {
      live.forEach(function (key) {
        var c = conns[key]; out.accounts[key] = c.detail || "";
        if (key === "mail") job(key, function () {
          var p = c.route === "google" ? fetchGmail(ctx) : c.route === "microsoft" ? fetchOutlook(ctx) : backendData("mail", "/data/mail", { owner: ctx.owner, business: ctx.business });
          return p.then(function (r) {
            var emails = r.emails || [];
            if (c.route === "imap") emails.forEach(function (m) { if (m.when_iso) m.when = whenFor(new Date(m.when_iso)); m.drafts = m.drafts && m.drafts.length ? m.drafts : E.templateDrafts({ from: m.from, subject: m.subject, snippet: m.snippet, body: m.body, thread: m.thread, headers: m.headers, address: m.meta && m.meta.address }, ctx.owner, ctx.business); m.live = true; });
            return maybeAiDrafts(emails, ctx, caps).then(function (em) { out.mail = em; out.filed = r.filed || []; out.otherMessages = r.other || 0; });
          });
        });
        else if (key === "calendar" && c.route !== "local") job(key, function () {
          var p = c.route === "google" ? fetchGoogleCalendar() : c.route === "microsoft" ? fetchOutlookCalendar() : backendData("calendar", "/data/calendar", { days: 14 }).then(function (r) { return r.events || []; });
          return p.then(function (ev) { out.calendar = ev; });
        });
        else if (key === "bank" && c.route === "local") job(key, function () {
          var b = root.AOReal && root.AOReal.localBank();
          if (!b || !b.rows || !b.rows.length) return Promise.reject(new Error("The statement on this device is empty. Upload one from Connections."));
          out.bank = b.rows.slice(); out.extras.bankLocal = { updated: b.updated, file: b.file, count: b.rows.length };
          return Promise.resolve();
        });
        else if (key === "calendar" && c.route === "local") job(key, function () {
          var cal = root.AOReal && root.AOReal.localCalendar();
          if (!cal) return Promise.reject(new Error("The calendar file on this device is gone. Upload it again from Connections."));
          out.calendar = cal.events || []; out.extras.calendarLocal = { updated: cal.updated, file: cal.file };
          return Promise.resolve();
        });
        else if (key === "bank") job(key, function () {
          return backendData("bank", "/data/bank", { days: 30 }).then(function (r) { out.bank = r.bank || []; if (r.summary) out.extras.bank = r.summary; if (r.account) out.accounts.bank = r.account; });
        });
        else if (key === "sales:stripe") job(key, function () {
          return backendData(key, "/data/sales", { days: 30 }).then(function (r) { out.orders = (out.orders || []).concat((r.orders || []).map(function (o) { o.source = "Stripe"; return o; })); if (r.summary) out.extras.stripe = r.summary; });
        });
        else if (key === "sales:shopify") job(key, function () {
          return backendData(key, "/data/sales", { days: 30 }).then(function (r) { out.orders = (out.orders || []).concat((r.orders || []).map(function (o) { o.source = "Shopify"; return o; })); });
        });
      });
      return Promise.all(jobs).then(function () { return out; });
    });
  }


  function fetchOverview(payload) {
    var c = cfg();
    if (!c.backendUrl) return Promise.resolve(null);
    var body = Object.assign({ tz: tz(), sealed: sealedMail() || undefined }, payload || {});
    return fetchTimeout(c.backendUrl + "/overview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 60000)
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  function saveDraft(email, body, conns) {
    var p = email.meta && email.meta.provider;
    if (p === "google") return saveGmailDraft(email, body);
    if (p === "microsoft") return saveOutlookDraft(email, body);
    if (p === "imap") return backendData("mail", "/mail/draft", { to: email.meta.address, subject: email.meta.subject, body: body, rfcId: email.meta.rfcId, refs: email.meta.refs }).then(function () { return { where: "your mailbox’s Drafts folder", url: null }; });
    return Promise.reject(new Error("Drafts can’t be saved for this email."));
  }

  root.AOLive = {
    config: cfg, configured: configured, redirectUri: redirectUri, route: route, backendCaps: backendCaps,
    liveSession: liveSession, complete: complete, connect: connect, detectImap: detectImap, finishRedirect: finishRedirect, reconnect: reconnect, disconnect: disconnect,
    _preload: loadGis, cancelPending: cancelPending, RESULT_KEY: RESULT_KEY, load: load, saveDraft: saveDraft, rewriteDraft: rewriteDraft, fetchOverview: fetchOverview, clearTokens: clearTokens, KIND_LABEL: KIND_LABEL,
    // exposed for tests
    _t: { mapGmail: mapGmail, mapGoogleEvents: mapGoogleEvents, mapGraphMail: mapGraphMail, mapGraphEvents: mapGraphEvents, parseAddress: parseAddress, decodeEntities: decodeEntities, msBuildAuthUrl: msBuildAuthUrl, fieldsFor: fieldsFor, orgFromDomain: orgFromDomain, AUTO_SENDER: AUTO_SENDER }
  };
})(typeof window !== "undefined" ? window : globalThis);
