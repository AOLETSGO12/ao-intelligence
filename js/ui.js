/* DOM helpers and dashboard (workspace) storage for start.html and app.html.
   Everything lives in this browser. Multiple dashboards are namespaced so each
   has its own connections, tasks, money uploads and drafts. */
(function (root) {
  "use strict";
  var E = root.AOEngine;
  var META_KEY = "ao-meta-v1";
  var LEGACY_STATE = "ao-app-v1";
  var LEGACY_TOKENS = "ao-live-tokens-v1";
  var LEGACY_BANK = "ao-local-bank-v1";
  var LEGACY_CAL = "ao-local-calendar-v1";

  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "on") Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
      else if (k === "value") el.value = v;
      else if (k === "checked" || k === "disabled" || k === "hidden") { if (v) el.setAttribute(k, ""); }
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function get(key) { try { return root.localStorage.getItem(key); } catch (e) { return null; } }
  function set(key, val) { try { root.localStorage.setItem(key, val); return true; } catch (e) { return false; } }
  function del(key) { try { root.localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function stateKey(id) { return "ao-dash-" + id + "-state"; }
  function tokenKey(id) { return "ao-dash-" + id + "-tokens"; }
  function bankKey(id) { return "ao-dash-" + id + "-bank"; }
  function calKey(id) { return "ao-dash-" + id + "-cal"; }

  function readMeta() {
    try { var m = JSON.parse(get(META_KEY) || "null"); if (m && m.v === 1 && Array.isArray(m.dashboards)) return m; } catch (e) { /* ignore */ }
    return { v: 1, account: null, current: null, dashboards: [] };
  }
  function writeMeta(m) { set(META_KEY, JSON.stringify(m)); }

  function migrate() {
    if (get(META_KEY)) return;
    var old = get(LEGACY_STATE), tokens = get(LEGACY_TOKENS), bank = get(LEGACY_BANK), cal = get(LEGACY_CAL);
    if (!old && !tokens && !bank && !cal) return;
    var st = E.parseState(old);
    if (st.places == null) st.places = [];
    if (st.eventPlaces == null) st.eventPlaces = {};
    var name = (st.business && st.business.name) || "Personal";
    var type = (st.business && st.business.type) || (/^personal$/i.test(name) ? "personal" : "business");
    var id = uid();
    var meta = {
      v: 1,
      account: st.account || null,
      current: id,
      dashboards: [{ id: id, name: name, type: type, industry: st.business && st.business.industry, size: st.business && st.business.size, created: new Date().toISOString() }]
    };
    set(stateKey(id), JSON.stringify(st));
    if (tokens) set(tokenKey(id), tokens);
    if (bank) set(bankKey(id), bank);
    if (cal) set(calKey(id), cal);
    writeMeta(meta);
    del(LEGACY_STATE); del(LEGACY_TOKENS); del(LEGACY_BANK); del(LEGACY_CAL); del("ao-mode");
  }
  migrate();

  function currentId() { return readMeta().current || null; }
  function list() { return readMeta().dashboards.slice(); }
  function account() { return readMeta().account || null; }
  function currentInfo() {
    var m = readMeta();
    for (var i = 0; i < m.dashboards.length; i++) if (m.dashboards[i].id === m.current) return m.dashboards[i];
    return m.dashboards[0] || null;
  }
  function hasDashboards() { return list().length > 0; }
  function isReady(st) { return !!(st && st.business && st.step === "app"); }
  function firstReadyId() {
    var m = readMeta();
    var ids = m.dashboards.map(function (d) { return d.id; });
    if (m.current) ids = [m.current].concat(ids.filter(function (id) { return id !== m.current; }));
    for (var i = 0; i < ids.length; i++) {
      if (isReady(E.parseState(get(stateKey(ids[i]))))) return ids[i];
    }
    return null;
  }
  function hasReadyDashboard() { return !!firstReadyId(); }

  function loadState(id) {
    var st = E.parseState(get(stateKey(id)));
    st.real = true;
    if (!st.places) st.places = [];
    if (!st.eventPlaces) st.eventPlaces = {};
    return st;
  }
  function saveState(id, s) { set(stateKey(id), JSON.stringify(s)); }

  function load() { var id = currentId(); return id ? loadState(id) : E.parseState(null); }
  function save(s) { var id = currentId(); if (id) saveState(id, s); }

  function setAccount(acc) { var m = readMeta(); m.account = acc; writeMeta(m); }
  function updateCurrent(patch) {
    var m = readMeta();
    m.dashboards.forEach(function (d) {
      if (d.id === m.current) Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
    });
    writeMeta(m);
  }

  function beginAdd(opts) {
    opts = opts || {};
    var m = readMeta();
    var id = uid();
    var dash = { id: id, name: opts.name || "", type: opts.type || "business", industry: opts.industry || "motorsport", size: opts.size || "solo", created: new Date().toISOString() };
    m.dashboards.push(dash);
    m.current = id;
    writeMeta(m);
    var st = E.parseState(null);
    st.real = true;
    st.step = m.account ? "business" : "account";
    st.account = m.account || null;
    st.places = [];
    st.eventPlaces = {};
    st.selected = [];
    saveState(id, st);
    return dash;
  }

  function switchTo(id) {
    var m = readMeta();
    if (!m.dashboards.some(function (d) { return d.id === id; })) return false;
    m.current = id;
    writeMeta(m);
    return true;
  }

  function clearDashKeys(id) {
    del(stateKey(id)); del(tokenKey(id)); del(bankKey(id)); del(calKey(id));
  }

  function disconnectDash(id) {
    try {
      var st = loadState(id);
      if (root.AOLive) {
        var cur = currentId();
        // temporarily point token reads at this dashboard
        var m = readMeta(); m.current = id; writeMeta(m);
        Object.keys(st.connected || {}).forEach(function (k) { if (st.connected[k].live) root.AOLive.disconnect(k, st.connected[k]); });
        root.AOLive.clearTokens();
        m.current = cur; writeMeta(m);
      }
    } catch (e) { /* ignore */ }
    clearDashKeys(id);
  }

  function deleteDashboard(id) {
    var m = readMeta();
    disconnectDash(id);
    m.dashboards = m.dashboards.filter(function (d) { return d.id !== id; });
    if (m.current === id) m.current = m.dashboards[0] ? m.dashboards[0].id : null;
    writeMeta(m);
    return m.current;
  }

  function signOut() {
    var m = readMeta();
    m.dashboards.slice().forEach(function (d) { disconnectDash(d.id); });
    del(META_KEY); del(LEGACY_STATE); del(LEGACY_TOKENS); del(LEGACY_BANK); del(LEGACY_CAL); del("ao-mode");
    del("ao-oauth-pending-v1"); del("ao-oauth-result-v1");
  }

  function isAdding() {
    try { return /[?&]add=1(&|$)/.test(root.location.search || ""); } catch (e) { return false; }
  }

  function confirmModal(opts) {
    var back = h("div", { class: "j-modal-back is-open", role: "presentation" });
    var dlg = h("div", { class: "j-modal", role: "dialog", "aria-modal": "true", "aria-label": opts.title, tabindex: "-1" },
      h("h2", null, opts.title),
      h("p", null, opts.body),
      h("div", { class: "j-actions" },
        h("button", { class: "btn btn-secondary", type: "button", on: { click: function () { document.body.removeChild(back); } } }, opts.cancel || "Cancel"),
        h("button", { class: "btn btn-primary", type: "button", on: { click: function () { document.body.removeChild(back); opts.onYes(); } } }, opts.ok)));
    back.appendChild(dlg);
    document.body.appendChild(back);
    dlg.focus();
  }

  function confirmDeleteDashboard(info, onYes) {
    var name = (info && info.name) || "this dashboard";
    confirmModal({
      title: "Delete \u201c" + name + "\u201d?",
      body: "This removes “" + name + "” and its connections, tasks, targets, places and uploads from this device. Your other dashboards are not touched. Your email, calendars and bank themselves are not changed.",
      ok: "Delete dashboard",
      onYes: onYes
    });
  }
  function confirmSignOut(onYes) {
    confirmModal({
      title: "Sign out of this device?",
      body: "This signs you out of AO Intelligence on this device. Dashboards, connections and files kept here will be removed from this browser. Your email, calendars and bank themselves are not changed. You can also revoke access in your provider’s security settings.",
      ok: "Sign out",
      onYes: onYes
    });
  }

  function baseUrl() {
    var p = root.location.href.split("#")[0].split("?")[0];
    return p.substring(0, p.lastIndexOf("/") + 1);
  }
  function copyText(text) {
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = h("textarea", { style: "position:fixed;opacity:0" });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy") ? resolve() : reject(new Error("copy failed")); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }


  function exportAll() {
    var meta = readMeta();
    var dashes = {};
    (meta.dashboards || []).forEach(function (d) {
      dashes[d.id] = {
        state: get(stateKey(d.id)),
        tokens: get(tokenKey(d.id)),
        bank: get(bankKey(d.id)),
        cal: get(calKey(d.id))
      };
    });
    return { v: 1, meta: meta, dashes: dashes };
  }
  function importAll(payload) {
    if (!payload || payload.v !== 1 || !payload.meta || !Array.isArray(payload.meta.dashboards) || !payload.dashes) {
      throw new Error("That code didn’t contain a complete copy.");
    }
    var old = readMeta();
    (old.dashboards || []).forEach(function (d) { clearDashKeys(d.id); });
    writeMeta({
      v: 1,
      account: payload.meta.account || null,
      current: payload.meta.current || (payload.meta.dashboards[0] && payload.meta.dashboards[0].id) || null,
      dashboards: payload.meta.dashboards
    });
    Object.keys(payload.dashes).forEach(function (id) {
      var x = payload.dashes[id] || {};
      function put(fn, val) {
        if (val == null || val === "") return;
        set(fn(id), typeof val === "string" ? val : JSON.stringify(val));
      }
      put(stateKey, x.state);
      put(tokenKey, x.tokens);
      put(bankKey, x.bank);
      put(calKey, x.cal);
    });
  }

  root.AOStore = {
    demo: false,
    h: h, clear: clear, load: load, save: save,
    currentId: currentId, list: list, account: account, setAccount: setAccount,
    currentInfo: currentInfo, updateCurrent: updateCurrent, hasDashboards: hasDashboards,
    hasReadyDashboard: hasReadyDashboard, firstReadyId: firstReadyId, isAdding: isAdding, beginAdd: beginAdd,
    switchTo: switchTo, deleteDashboard: deleteDashboard, signOut: signOut,
    tokenKey: function (id) { return tokenKey(id || currentId()); },
    bankKey: function (id) { return bankKey(id || currentId()); },
    calKey: function (id) { return calKey(id || currentId()); },
    confirmDeleteDashboard: confirmDeleteDashboard, confirmSignOut: confirmSignOut,
    exportAll: exportAll, importAll: importAll,
    baseUrl: baseUrl, copyText: copyText, KEY: META_KEY
  };
})(window);
