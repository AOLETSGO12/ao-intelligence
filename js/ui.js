/* Tiny DOM + storage helpers shared by start.html and app.html (demo only). */
(function (root) {
  "use strict";
  var E = root.AOEngine;
  var KEY = "ao-intelligence-journey-v2";

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

  function load() {
    var raw = null;
    try { raw = root.localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    return E.parseState(raw);
  }
  function save(s) {
    try { root.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  function reset() {
    try { root.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
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
  function confirmReset(onYes) {
    var back = h("div", { class: "j-modal-back is-open", role: "presentation" });
    var dlg = h("div", { class: "j-modal", role: "dialog", "aria-modal": "true", "aria-label": "Reset demo", tabindex: "-1" },
      h("h2", null, "Start over?"),
      h("p", null, "This clears the demo account, your business, and every connection on this device, and takes you back to the beginning. Nothing was ever sent anywhere."),
      h("div", { class: "j-actions" },
        h("button", { class: "btn btn-secondary", type: "button", on: { click: function () { document.body.removeChild(back); } } }, "Keep going"),
        h("button", { class: "btn btn-primary", type: "button", on: { click: function () { reset(); onYes(); } } }, "Reset demo")));
    back.appendChild(dlg);
    document.body.appendChild(back);
    dlg.focus();
  }
  root.AOStore = { h: h, clear: clear, load: load, save: save, reset: reset, baseUrl: baseUrl, copyText: copyText, confirmReset: confirmReset, KEY: KEY };
})(window);
