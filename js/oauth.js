/* Landing page for sign-in redirects (Microsoft, bank, Stripe, Shopify). Opened in a small window
   it simply hands the result back to the page that opened it. If the browser blocked the window and
   this is a full-page redirect, it finishes the connection itself and returns you to where you were. */
(function () {
  "use strict";
  var params = {};
  function parse(str) {
    String(str || "").replace(/^[?#]/, "").split("&").forEach(function (p) {
      if (!p) return; var kv = p.split("="); try { params[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || "").replace(/\+/g, " ")); } catch (e) { /* ignore */ }
    });
  }
  parse(window.location.search); parse(window.location.hash);
  var msg = document.getElementById("oauth-msg");
  function say(t) { if (msg) msg.textContent = t; }
  // never leave codes or sealed tokens sitting in the address bar
  try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* ignore */ }

  var hasResult = params.code || params.error || params.sealed;
  if (!hasResult) { say("Nothing to finish here. You can close this window."); return; }

  var payload = { type: "ao-oauth", params: params };
  var delivered = false;
  try { if (window.opener && window.opener !== window) { window.opener.postMessage(payload, window.location.origin); delivered = true; } } catch (e) { /* ignore */ }
  try { if (window.BroadcastChannel) { var bc = new BroadcastChannel("ao-oauth"); bc.postMessage(payload); bc.close(); } } catch (e) { /* ignore */ }
  try { window.localStorage.setItem("ao-oauth-result-v1", JSON.stringify(payload)); } catch (e) { /* ignore */ }

  if (window.opener && window.opener !== window || window.name === "ao-oauth") {
    say("Done — you can close this window.");
    setTimeout(function () { try { window.close(); } catch (e) { /* ignore */ } }, 400);
    return;
  }
  // Full-page redirect fallback.
  try { window.localStorage.removeItem("ao-oauth-result-v1"); } catch (e) { /* ignore */ }
  var L = window.AOLive, S = window.AOStore;
  if (!L || !S) { say("Something didn’t load. Please go back and try again."); return; }
  say("Finishing your connection…");
  L.finishRedirect(params).then(function (r) {
    var st = S.load();
    if (st.selected.indexOf(r.key) === -1) st.selected.push(r.key);
    [r.conn].concat((r.conn && r.conn.also) || []).forEach(function (c) {
      if (!c) return;
      if (st.selected.indexOf(c.key) === -1) st.selected.push(c.key);
      var cc = Object.assign({}, c); delete cc.also; st.connected[c.key] = cc; st.skipped = st.skipped.filter(function (k) { return k !== c.key; });
    });
    S.save(st);
    window.location.replace(st.step === "app" ? "app.html#connections" : "start.html");
  }).catch(function (e) {
    say(e.message || "That didn’t work. Please go back and try again.");
    var a = document.getElementById("oauth-back"); if (a) a.hidden = false;
  });
})();
