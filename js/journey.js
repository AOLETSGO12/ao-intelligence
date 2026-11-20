/* Set up a dashboard: account → name and type → connect what you use → your day.
   State lives in this browser, namespaced per dashboard. */
(function () {
  "use strict";
  var E = window.AOEngine, S = window.AOStore, C = window.Connectors;
  if (!E || !S || !C) return;
  var h = S.h;
  var root = document.getElementById("journey");
  var overBtn = document.getElementById("start-over");
  var state = S.load();
  var REAL = !S.demo;
  var REAL_KEYS = ["mail", "calendar", "bank", "sales:stripe", "sales:shopify"];
  var REAL_DEFAULT = ["mail", "calendar", "bank"];
  var single = null; // item key when connecting just one service from the dashboard
  var ui = { search: "", provider: null, field: "", error: "", unlisted: false, unlistedText: "", copied: false, pickErr: "" };

  if (REAL) {
    // Real app: say plainly what each connection does today.
    Object.assign(E.ITEM_BY_KEY["bank"], { short: "Upload a bank statement (CSV or OFX) to see money in and out. It stays on this device.", sees: ["Money in and out, from the statement you upload", "Totals, a daily chart and categories", "Nothing is sent anywhere — the file is read in your browser"], never: "Nothing is linked to your bank. You choose what to upload, and we never show numbers you didn’t give us." });
    Object.assign(E.ITEM_BY_KEY["sales:stripe"], { short: "Card payments and payouts, with a read-only key." });
    Object.assign(E.ITEM_BY_KEY["mail"], { never: "We only read your inbox and save drafts to your Drafts folder. Nothing is ever sent for you." });
    state.selected = state.selected.filter(function (k) { return REAL_KEYS.indexOf(k) !== -1; });
    // walk through email, calendar, then money (in place: the engine's queue() reads this same array)
    E.ITEM_ORDER.sort(function (a, b) { var A = REAL_KEYS.indexOf(a), B = REAL_KEYS.indexOf(b); return (A === -1 ? 99 : A) - (B === -1 ? 99 : B); });
  } else {
    var badge = document.getElementById("mode-badge"); if (badge) badge.hidden = false;
    var fine = document.getElementById("start-fine"); if (fine) fine.textContent = "Demo mode (?demo=1): sample data only — nothing real is connected. Remove ?demo=1 from the address for the real app.";
  }

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  function save() { S.save(state); }
  function resetUi() { ui = { search: "", provider: null, field: "", error: "", unlisted: false, unlistedText: "", copied: false, pickErr: "" }; }
  function go(step, extra) {
    state.step = step;
    if (extra) Object.keys(extra).forEach(function (k) { state[k] = extra[k]; });
    save(); resetUi(); render(); window.scrollTo(0, 0);
    if (root.focus) root.focus({ preventScroll: true });
  }
  function leaveToApp(tab) { state.step = "app"; save(); window.location.href = "app.html#" + (tab || "today"); }

  if (overBtn) overBtn.hidden = true;

  function cancelAdd() {
    var from = "";
    try { from = sessionStorage.getItem("ao-add-from") || ""; sessionStorage.removeItem("ao-add-from"); } catch (e) {}
    var id = S.currentId();
    if (id && !((state.business && state.step === "app"))) {
      var next = S.deleteDashboard(id);
      if (from) S.switchTo(from);
      else if (next) S.switchTo(next);
    }
    var ready = S.firstReadyId();
    window.location.href = ready ? "app.html#today" : "start.html";
  }

  // ---------- shared bits ----------
  function progress() {
    var p = E.wizardProgress(state);
    var left = E.minutesLeft(state);
    var label = state.step === "w-done" ? "All done" : "Step " + Math.min(p.done + 1, p.total) + " of " + p.total + (left ? " · about " + left + " min left" : "");
    return h("div", { class: "j-progress", role: "group", "aria-label": "Setup progress" },
      h("div", { class: "j-progress-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(p.total), "aria-valuenow": String(p.done), "aria-label": label },
        h("span", { style: "width:" + Math.round((p.done / p.total) * 100) + "%" })),
      h("p", { class: "j-progress-label" }, label));
  }
  function card() {
    var el = h("section", { class: "j-card" });
    for (var i = 0; i < arguments.length; i++) { if (arguments[i]) el.appendChild(arguments[i]); }
    return el;
  }
  function field(id, label, input, hint, err) {
    return h("div", { class: "j-field" + (err ? " has-error" : "") },
      h("label", { for: id }, label), input,
      hint ? h("p", { class: "j-hint", id: id + "-hint" }, hint) : null,
      err ? h("p", { class: "j-error", role: "alert", id: id + "-err" }, err) : null);
  }
  function setRoot(node) { S.clear(root); root.appendChild(node); }

  // ---------- steps ----------
  function stepAccount() {
    var errs = {};
    var name = h("input", { id: "acc-name", type: "text", autocomplete: "name", value: state.account ? state.account.name : "", required: true, placeholder: "e.g. Archie Owen" });
    var email = h("input", { id: "acc-email", type: "email", autocomplete: "email", inputmode: "email", value: state.account ? state.account.email : "", required: true, placeholder: "you@example.com" });
    var pass = h("input", { id: "acc-pass", type: "password", autocomplete: "new-password", required: true, placeholder: "At least 8 characters" });
    var form = h("form", { class: "j-form", novalidate: true, on: { submit: function (e) {
      e.preventDefault();
      var bad = false;
      if (!name.value.trim()) { errs.name = "Please tell us your name."; bad = true; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { errs.email = "That email doesn’t look right."; bad = true; }
      if (!REAL && pass.value.length < 8) { errs.pass = "Please use at least 8 characters."; bad = true; }
      if (bad) { state.account = { name: name.value.trim(), email: email.value.trim() }; showErrs(); return; }
      state.account = { name: name.value.trim(), email: email.value.trim() };
      S.setAccount(state.account);
      if (!S.currentId()) S.beginAdd();
      state = S.load();
      state.account = S.account();
      go("business"); // the password is deliberately never stored
    } } });
    function showErrs() {
      [["acc-name", errs.name], ["acc-email", errs.email], ["acc-pass", errs.pass]].forEach(function (p) {
        if (!document.getElementById(p[0])) return;
        var wrap = document.getElementById(p[0]).parentNode;
        var old = wrap.querySelector(".j-error"); if (old) wrap.removeChild(old);
        wrap.classList.toggle("has-error", !!p[1]);
        if (p[1]) wrap.appendChild(h("p", { class: "j-error", role: "alert" }, p[1]));
      });
      var first = form.querySelector(".has-error input"); if (first) first.focus();
    }
    form.appendChild(field("acc-name", "Your name", name));
    form.appendChild(field("acc-email", "Email", email));
    if (!REAL) form.appendChild(field("acc-pass", "Password", pass, "Demo only: we don’t keep or send your password."));
    form.appendChild(h("button", { class: "btn btn-primary j-wide", type: "submit" }, REAL ? "Continue" : "Create my account"));
    setRoot(card(
      h("p", { class: "j-eyebrow" }, REAL ? "Step 1 · About you" : "Step 1 · Create your account"),
      h("h1", null, "Let’s get your agent started"),
      h("p", { class: "j-lead" }, "A few quick details, then we’ll set up your first dashboard. It takes about 3 minutes."),
      form,
      h("p", { class: "j-fine" }, REAL ? "Your name and email are used to personalise the app and sign your reply drafts. They stay on this device — there’s no account or password to remember." : "This is a preview: your details stay on this device and no real account is created.")));
  }

  function stepBusiness() {
    var b = state.business || { name: "", type: "business", industry: "motorsport", size: "solo" };
    if (!b.type) b.type = "business";
    var typ = b.type === "personal" ? "personal" : "business";
    var name = h("input", { id: "biz-name", type: "text", autocomplete: typ === "personal" ? "off" : "organization", value: b.name, required: true, placeholder: typ === "personal" ? "e.g. Personal" : "e.g. Archie Owen Racing" });
    var ind = h("select", { id: "biz-ind" }, E.INDUSTRIES.map(function (i) { return h("option", { value: i.id, selected: i.id === b.industry ? true : null }, i.label); }));
    ind.value = b.industry || "motorsport";
    var size = h("select", { id: "biz-size" }, E.SIZES.map(function (i) { return h("option", { value: i.id }, i.label); }));
    size.value = b.size || "solo";
    function setType(t) {
      state.business = { name: name.value.trim(), type: t, industry: ind.value, size: size.value };
      save(); render();
    }
    var typeField = h("div", { class: "j-field" },
      h("span", { class: "j-label", id: "dash-type-label" }, "What kind of dashboard is this?"),
      h("div", { class: "j-type-row", role: "group", "aria-labelledby": "dash-type-label" },
        h("button", { class: "j-type" + (typ === "personal" ? " is-on" : ""), type: "button", "aria-pressed": typ === "personal" ? "true" : "false", on: { click: function () { setType("personal"); } } }, "Personal"),
        h("button", { class: "j-type" + (typ === "business" ? " is-on" : ""), type: "button", "aria-pressed": typ === "business" ? "true" : "false", on: { click: function () { setType("business"); } } }, "Business")));
    var form = h("form", { class: "j-form", novalidate: true, on: { submit: function (e) {
      e.preventDefault();
      if (!name.value.trim()) {
        var wrap = name.parentNode; wrap.classList.add("has-error");
        if (!wrap.querySelector(".j-error")) wrap.appendChild(h("p", { class: "j-error", role: "alert" }, typ === "personal" ? "Please give this dashboard a name." : "Please tell us what your business is called."));
        name.focus(); return;
      }
      state.business = { name: name.value.trim(), type: typ, industry: ind.value, size: typ === "personal" ? "solo" : size.value };
      S.updateCurrent({ name: state.business.name, type: typ, industry: state.business.industry, size: state.business.size });
      if (REAL && (!state.selected.length || (state.selected.length === 1 && state.selected[0] === "bank" && !Object.keys(state.connected).length))) state.selected = REAL_DEFAULT.slice();
      else if (!state.selected.length) state.selected = ["bank"];
      go("w-welcome");
    } } },
      typeField,
      field("biz-name", typ === "personal" ? "Dashboard name" : "Business name", name),
      field("biz-ind", typ === "personal" ? "What is this mainly for?" : "What kind of business?", ind, "We use this to word your daily overview."),
      typ === "business" ? field("biz-size", "Roughly how big?", size) : null,
      h("button", { class: "btn btn-primary j-wide", type: "submit" }, "Continue"));
    var extra = S.hasReadyDashboard() || (S.list().length > 1);
    var back = extra
      ? h("p", { class: "j-back" }, h("button", { class: "link-btn", type: "button", on: { click: cancelAdd } }, "Cancel"))
      : h("p", { class: "j-back" }, h("button", { class: "link-btn", type: "button", on: { click: function () { go("account"); } } }, "← Back"));
    setRoot(card(
      h("p", { class: "j-eyebrow" }, extra ? "New dashboard" : "Step 2 · Your dashboard"),
      h("h1", null, typ === "personal" ? "Name this dashboard" : "Tell us about your business"),
      h("p", { class: "j-lead" }, "Just a few quick things — a few seconds."),
      form,
      back));
  }

  function stepWelcome() {
    var who = state.account ? state.account.name.split(/\s+/)[0] : "";
    setRoot(card(
      progress(),
      h("p", { class: "j-eyebrow" }, "Step 3 · Connect what you use"),
      h("h1", null, who ? "Nice to meet you, " + who + "." : "Let’s connect what you use"),
      h("p", { class: "j-lead" }, "Takes about 3 minutes. Everything is optional — connect only what you use, and add the rest whenever you like."),
      h("ul", { class: "j-benefits" },
        h("li", null, h("strong", null, "See your money in one place"), " — what came in, what went out, and what’s still owed."),
        h("li", null, h("strong", null, "Get a short briefing each morning"), " — plain English, no spreadsheets."),
        h("li", null, h("strong", null, "Replies ready to approve"), " — we draft, you decide. We never send anything on our own.")),
      h("p", { class: "j-reassure" }, "🔒 Read-only access. You can disconnect any time."),
      h("button", { class: "btn btn-primary j-wide", type: "button", on: { click: function () { go("w-pick"); } } }, "Let’s go"),
      h("p", { class: "j-back" },
        h("button", { class: "link-btn", type: "button", on: { click: function () { state.selected = []; go("w-done"); } } }, "Skip this — take me to my dashboard"))));
  }

  function stepPick() {
    var sel = state.selected.slice();
    function toggle(key) { var i = sel.indexOf(key); if (i === -1) sel.push(key); else sel.splice(i, 1); state.selected = sel.slice(); save(); draw(); }
    var note = h("textarea", { id: "pick-other", rows: "2", placeholder: "e.g. Sage, Zettle, a booking system…" });
    note.value = state.requests.other || "";
    var wrap = h("div");
    function draw() {
      S.clear(wrap);
      E.GROUPS.forEach(function (g) {
        var items = E.ITEMS.filter(function (i) { return i.group === g && (!REAL || REAL_KEYS.indexOf(i.key) !== -1); });
        if (!items.length) return;
        wrap.appendChild(h("h2", { class: "j-group" }, g));
        wrap.appendChild(h("div", { class: "j-tiles" }, items.map(function (it) {
          var on = sel.indexOf(it.key) !== -1;
          return h("button", { class: "j-tile" + (on ? " is-on" : ""), type: "button", "aria-pressed": on ? "true" : "false", on: { click: function () { toggle(it.key); } } },
            h("span", { class: "j-tile-check", "aria-hidden": "true" }, on ? "✓" : ""),
            h("span", { class: "j-tile-title" }, it.title),
            h("span", { class: "j-tile-short" }, it.short));
        })));
      });
      if (!REAL) wrap.appendChild(h("div", { class: "j-field" }, h("label", { for: "pick-other" }, "Something else? Tell us"), note,
        h("p", { class: "j-hint" }, "We’ll note it down — we’re adding more every month.")));
      cta.textContent = sel.length ? "Continue with " + sel.length + " selected" : "Continue without connecting anything";
    }
    var cta = h("button", { class: "btn btn-primary j-wide", type: "button", on: { click: function () {
      state.requests.other = note.value.trim() || undefined; state.selected = sel.slice(); save();
      if (!sel.length) { go("w-done"); return; }
      go("w-item", { cursor: 0 });
    } } }, "Continue");
    setRoot(card(
      progress(),
      h("h1", null, "What do you use?"),
      h("p", { class: "j-lead" }, REAL ? "Tap anything you’d like to connect. Nothing here is required, and you can add or remove things later." : "Tap anything you’d like to connect. Your bank is ticked to start — untick it if you’d rather not. Nothing here is required."),
      wrap, cta,
      h("button", { class: "btn btn-secondary j-wide j-gap", type: "button", on: { click: function () {
        state.requests.other = note.value.trim() || undefined; state.selected = []; save(); go("w-done");
      } } }, "I don’t use any of these — skip, I’ll add later"),
      h("p", { class: "j-back" }, h("button", { class: "link-btn", type: "button", on: { click: function () { go("w-welcome"); } } }, "← Back"))));
    draw();
  }

  function pk(item) { return item.title.replace(/^Your /, "").toLowerCase(); }
  // ---- connect one item ----
  function nextAfterItem() {
    if (single) { leaveToApp("connections"); return; }
    var q = E.queue(state);
    if (state.cursor + 1 < q.length) go("w-item", { cursor: state.cursor + 1 });
    else go("w-done");
  }
  function prevItem() {
    if (single) { leaveToApp("connections"); return; }
    if (state.cursor > 0) go("w-item", { cursor: state.cursor - 1 }); else go("w-pick");
  }

  function modal(node) {
    var back = h("div", { class: "j-modal-back is-open", role: "presentation" }, node);
    document.body.appendChild(back);
    document.body.classList.add("modal-open");
    var f = node.querySelector("button"); if (f) f.focus();
    return function close() { if (back.parentNode) back.parentNode.removeChild(back); document.body.classList.remove("modal-open"); };
  }

  function runConnect(item, providerId, value, onDone, onError) {
    C.startConnection(item.key, { providerId: providerId, field: value, conns: state.connected }).then(function (session) {
      var values = {};
      var close;
      var body = h("div", { class: "j-modal-body" });
      var dlg = h("div", { class: "j-modal j-provider", role: "dialog", "aria-modal": "true", "aria-label": "Connect " + session.providerName, tabindex: "-1" }, body);
      function consent() {
        S.clear(body);
        body.appendChild(h("div", { class: "j-prov-head" },
          h("span", { class: "j-prov-badge", "aria-hidden": "true" }, session.providerName.charAt(0)),
          h("div", null, h("p", { class: "j-prov-name" }, session.providerName), h("p", { class: "j-prov-sub" }, session.live ? "Live connection — your real account" : "wants to share read-only access with AO Intelligence"))));
        body.appendChild(h("ul", { class: "j-sees" }, item.sees.map(function (t) { return h("li", null, t); })));
        body.appendChild(h("p", { class: "j-fine" }, session.consent));
        var inputs = {};
        (session.fields || []).forEach(function (f) {
          var inp = h("input", { id: "sf-" + f.key, type: f.type || "text", placeholder: f.placeholder || "", value: values[f.key] != null ? values[f.key] : (f.value || ""), autocomplete: f.type === "password" ? "new-password" : "off", autocapitalize: "none", spellcheck: "false" });
          inp.addEventListener("input", function () { values[f.key] = inp.value; });
          if (values[f.key] == null && f.value) values[f.key] = f.value;
          inputs[f.key] = inp;
          body.appendChild(field("sf-" + f.key, f.label, inp, f.hint));
        });
        var missing = h("p", { class: "j-error", role: "alert", hidden: true });
        body.appendChild(missing);
        body.appendChild(h("div", { class: "j-actions" },
          h("button", { class: "btn btn-secondary", type: "button", on: { click: function () { close(); } } }, "Cancel"),
          h("button", { class: "btn btn-primary", type: "button", on: { click: function () {
            for (var i = 0; i < (session.fields || []).length; i++) {
              var f = session.fields[i];
              if (f.required && !String(values[f.key] || "").trim()) { missing.hidden = false; missing.textContent = "Please fill in “" + f.label + "”."; inputs[f.key].focus(); return; }
            }
            approve();
          } } }, session.live ? "Allow access" : "Allow access")));
        if (session.live) body.appendChild(h("p", { class: "j-demo-note" }, "🔒 Read-only. We never send email, and you can disconnect any time from Connections."));
        else body.appendChild(h("p", { class: "j-demo-note" }, (session.liveNote || "Demo screen — no real sign-in. ") + " ",
          h("button", { class: "link-btn", type: "button", on: { click: fail } }, "Simulate a problem")));
      }
      function working(text) {
        S.clear(body);
        body.appendChild(h("div", { class: "j-working", role: "status" }, h("span", { class: "j-spinner", "aria-hidden": "true" }), h("p", null, text),
          session.live ? h("p", { class: "j-hint" }, "A sign-in window should have opened. If you closed it by mistake, cancel and try again.") : null,
          session.live ? h("button", { class: "link-btn", type: "button", on: { click: function () { if (window.AOLive) window.AOLive.cancelPending(); } } }, "Cancel") : null));
      }
      function approve() {
        working("Connecting to " + session.providerName + "…");
        C.completeConnection(session, values).then(function (conn) { close(); onDone(conn); }).catch(function (err) { problem(err.message); });
      }
      function fail() {
        working("Connecting to " + session.providerName + "…");
        C.startConnection(item.key, { providerId: providerId, field: value, simulateFailure: true }).catch(function (err) { problem(err.message); });
      }
      function problem(msg) {
        S.clear(body);
        body.appendChild(h("div", { class: "j-prob" }, h("p", { class: "j-prob-title" }, "That didn’t work"), h("p", null, msg)));
        body.appendChild(h("div", { class: "j-actions" },
          h("button", { class: "btn btn-secondary", type: "button", on: { click: function () { close(); } } }, "Close"),
          h("button", { class: "btn btn-primary", type: "button", on: { click: consent } }, "Try again")));
      }
      close = modal(dlg);
      consent();
    }).catch(function (err) { onError(err.message); });
  }

  function stepItem() {
    if (REAL) return stepItemReal();
    var key = single || E.queue(state)[state.cursor];
    var item = E.ITEM_BY_KEY[key];
    if (!item) { go("w-done"); return; }
    var conn = state.connected[key];
    var title = item.picker ? item.title : item.title;
    var children = [];
    if (!single) children.push(progress());
    var pickedProvider = ui.provider || (conn ? conn.providerId : null);
    var pname = item.picker ? (pickedProvider ? E.providerName(key, pickedProvider) : null) : item.title;

    children.push(h("p", { class: "j-eyebrow" }, single ? "Add a connection" : "Connect " + (E.queue(state).indexOf(key) + 1) + " of " + E.queue(state).length));
    children.push(h("h1", null, conn ? title + " connected" : (item.picker ? "Connect your " + pk(item) : "Connect " + item.title)));
    children.push(h("p", { class: "j-chip" }, "⏱ About " + item.minutes + (item.minutes === 1 ? " minute" : " minutes")));

    if (conn) {
      children.push(h("div", { class: "j-success", role: "status" }, h("span", { class: "j-success-tick", "aria-hidden": "true" }, "✓"),
        h("div", null, h("strong", null, conn.providerName + " is connected"), conn.detail ? h("p", { class: "j-hint" }, conn.detail) : null,
          h("p", { class: "j-hint" }, conn.live ? "Live — showing your real data." : "Showing sample data (this connection isn’t live)."))));
      children.push(h("button", { class: "btn btn-primary j-wide", type: "button", on: { click: nextAfterItem } }, single ? "Back to my dashboard" : "Continue"));
      setRoot(card.apply(null, children));
      return;
    }

    // provider picker
    if (item.picker) {
      var list = E.pickerList(item.picker);
      var search = h("input", { id: "prov-search", type: "search", placeholder: "Search " + (item.picker === "bank" ? "banks" : item.picker === "mail" ? "email providers" : "calendars") + "…", value: ui.search, autocomplete: "off", "aria-label": "Search" });
      var results = h("div", { class: "j-results", role: "listbox", "aria-label": "Choose one" });
      var drawResults = function () {
        S.clear(results);
        var found = E.searchProviders(list, search.value);
        found.slice(0, item.picker === "bank" ? 60 : 20).forEach(function (p) {
          results.appendChild(h("button", { class: "j-result" + (ui.provider === p.id ? " is-on" : ""), type: "button", role: "option", "aria-selected": ui.provider === p.id ? "true" : "false", on: { click: function () { ui.provider = p.id; ui.unlisted = false; ui.error = ""; ui.field = ui.field; render(); } } },
            h("span", null, p.name), p.hint ? h("small", null, p.hint) : null, ui.provider === p.id ? h("span", { class: "j-result-tick", "aria-hidden": "true" }, "✓") : null));
        });
        if (!found.length) results.appendChild(h("p", { class: "j-hint j-pad" }, "No match — try a different spelling" + (item.picker === "bank" ? ", or tell us below." : ".")));
        if (item.picker === "bank") {
          results.appendChild(h("button", { class: "j-result j-result-other" + (ui.unlisted ? " is-on" : ""), type: "button", on: { click: function () { ui.unlisted = !ui.unlisted; ui.provider = null; render(); } } }, h("span", null, "My bank isn’t listed — tell us")));
        }
      };
      search.addEventListener("input", function () { ui.search = search.value; drawResults(); });
      children.push(h("div", { class: "j-field" }, h("label", { for: "prov-search" }, item.picker === "bank" ? "Which bank?" : item.picker === "mail" ? "Which email do you use?" : "Which calendar do you use?"), search));
      children.push(results);
      drawResults();
      if (item.picker === "bank" && ui.unlisted) {
        var tell = h("input", { id: "bank-tell", type: "text", placeholder: "e.g. Cumbria Credit Union", value: ui.unlistedText });
        tell.addEventListener("input", function () { ui.unlistedText = tell.value; });
        children.push(h("div", { class: "j-field" }, h("label", { for: "bank-tell" }, "Tell us your bank"), tell,
          h("p", { class: "j-hint" }, "We’ll let you know when it’s available."),
          h("button", { class: "btn btn-secondary", type: "button", on: { click: function () {
            if (!tell.value.trim()) { ui.error = "Please type your bank’s name."; render(); return; }
            state.requests.bank = tell.value.trim(); save(); nextAfterItem();
          } } }, "Tell us and carry on")));
      }
    }

    // extra field (Shopify store, IMAP address, CalDAV link)
    var f = E.providerField(key, pickedProvider || undefined);
    var fInput = null;
    if (f && (!item.picker || pickedProvider)) {
      fInput = h("input", { id: "item-field", type: "text", placeholder: f.placeholder, value: ui.field, autocomplete: "off", autocapitalize: "none", "aria-describedby": "item-field-hint" });
      fInput.addEventListener("input", function () { ui.field = fInput.value; });
      children.push(field("item-field", f.label, fInput, f.hint));
    }

    children.push(h("div", { class: "j-see" }, h("h2", null, "What we’ll see"),
      h("ul", { class: "j-sees" }, item.sees.map(function (t) { return h("li", null, t); })),
      h("p", { class: "j-fine" }, "🔒 " + item.never)));

    if (ui.error) children.push(h("p", { class: "j-error j-block", role: "alert" }, ui.error));

    var needsPick = item.picker && !pickedProvider;
    var label = needsPick ? "Choose your " + pk(item) + " above" : "Connect " + (pname || item.title);
    var btn = h("button", { class: "btn btn-primary j-wide", type: "button", disabled: needsPick ? true : null, on: { click: function () {
      ui.error = "";
      btn.disabled = true;
      runConnect(item, pickedProvider || undefined, fInput ? fInput.value : "", function (conn2) {
        if (state.selected.indexOf(key) === -1) state.selected.push(key);
        state.connected[key] = conn2; state.skipped = state.skipped.filter(function (k) { return k !== key; });
        save(); render();
      }, function (msg) { ui.error = msg; render(); });
      setTimeout(function () { btn.disabled = false; }, 600);
    } } }, label);
    children.push(btn);

    children.push(h("div", { class: "j-secondary-row" },
      h("button", { class: "btn btn-secondary", type: "button", on: { click: function () {
        if (state.skipped.indexOf(key) === -1) state.skipped.push(key); save(); nextAfterItem();
      } } }, "Skip for now"),
      h("button", { class: "link-btn", type: "button", on: { click: function () {
        var url = E.helpLink(S.baseUrl(), key, state.business ? state.business.name : "my business");
        S.copyText(url).then(function () { ui.copied = true; render(); }).catch(function () { window.prompt("Copy this link:", url); });
      } } }, ui.copied ? "✓ Link copied — send it to someone" : "Need help? Send this step to someone")));
    children.push(h("p", { class: "j-back" }, h("button", { class: "link-btn", type: "button", on: { click: prevItem } }, "← Back")));
    setRoot(card.apply(null, children));
    var s = document.getElementById("prov-search"); if (s && ui.search) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }

  // =====================================================================================================
  // Real app: connect one item (no sample screens). Everything here either talks to the person's real
  // account or reads a file they choose; nothing is simulated.
  // =====================================================================================================
  var R = window.AOReal, L = window.AOLive;
  var rui = { provider: null, vals: {}, busy: false, error: "", preview: null, capsKnown: false, caps: null, reupload: false, bankName: "" };
  function resetReal() { rui = { provider: null, vals: {}, busy: false, error: "", preview: null, capsKnown: false, caps: null, reupload: false, bankName: "" }; }
  var _go = go; // reset the real-form state whenever the step changes
  go = function (step, extra) { resetReal(); _go(step, extra); };

  function guideSteps(g) {
    if (!g || !g.steps) return null;
    return h("ol", { class: "j-steps" }, g.steps.map(function (st) {
      return h("li", null, st.t, st.href ? [" ", h("a", { href: st.href, target: "_blank", rel: "noopener noreferrer", class: "j-extlink" }, (st.link || "Open") + " ↗")] : null);
    }));
  }
  function normEmail(v) { return String(v || "").trim().toLowerCase(); }
  function normPass(v) { return String(v || "").replace(/\s+/g, ""); }
  /** A short, plain-English box: what an app password is, why it's needed, exact steps, and a big deep-link button. */
  function passwordBox(g) {
    var p = g && g.pass;
    if (!p) return guideSteps(g);
    var box = h("div", { class: "j-passbox", role: "region", "aria-label": "How to get a password" });
    if (p.kind === "normal") {
      box.appendChild(h("h3", { class: "j-passbox-title" }, "Use your normal email password"));
      box.appendChild(h("p", null, p.intro || (g.name + " doesn’t use app passwords.")));
    } else if (p.kind === "either") {
      box.appendChild(h("h3", { class: "j-passbox-title" }, "An app password, or your normal password"));
      box.appendChild(h("p", null, "An app password is a separate password just for this app, so your real password stays private. You can delete it any time. Use one if your provider offers it — otherwise your normal email password is fine."));
    } else {
      box.appendChild(h("h3", { class: "j-passbox-title" }, "What is an app password?"));
      box.appendChild(h("p", null, "It’s a separate password, just for this app, so your real password stays private. You can delete it any time. " + (p.why || "Your provider doesn’t let other apps use your main password.")));
    }
    if (p.steps && p.steps.length) box.appendChild(h("ol", { class: "j-steps" }, p.steps.map(function (st) { return h("li", null, st); })));
    if (p.href && p.button) box.appendChild(h("a", { class: "btn btn-primary j-wide j-extbtn", href: (g.id === "zoho-mail" && rui.zohoAccounts) ? rui.zohoAccounts : p.href, target: "_blank", rel: "noopener noreferrer" }, p.button + " ↗"));
    if (p.kind !== "normal") box.appendChild(h("p", { class: "j-passtip" }, "Copy and paste it here, spaces don’t matter."));
    if (p.extra) box.appendChild(h("p", { class: "j-hint" }, p.extra));
    return box;
  }
  function textInput(id, label, key, opts) {
    opts = opts || {};
    var inp = h("input", { id: id, type: opts.type || "text", placeholder: opts.placeholder || "", value: rui.vals[key] != null ? rui.vals[key] : (opts.value || ""), autocomplete: opts.type === "password" ? "new-password" : (opts.autocomplete || "off"), autocapitalize: "none", autocorrect: "off", spellcheck: "false", inputmode: opts.inputmode || null });
    inp.addEventListener("input", function () { rui.vals[key] = inp.value; });
    if (rui.vals[key] == null && opts.value) rui.vals[key] = opts.value;
    return field(id, label, inp, opts.hint);
  }
  function errBox() { return h("p", { class: "j-error j-block", role: "alert", id: "real-err", hidden: rui.error ? null : true }, rui.error); }
  function showError(msg) {
    rui.error = msg; var e = document.getElementById("real-err");
    if (e) { e.textContent = msg; e.hidden = !msg; if (msg && e.scrollIntoView) { try { e.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (x) { e.scrollIntoView(); } } }
  }
  /** One tap-friendly button. Never disabled while idle: pressing it always does something (connects, or tells you what's missing). */
  function actionButton(label, fn, cls) {
    var btn = h("button", { class: "btn " + (cls || "btn-primary") + " j-wide", type: "button" }, label);
    btn.addEventListener("click", function () {
      if (rui.busy) return;
      showError("");
      var p; try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); }
      rui.busy = true; btn.classList.add("is-busy"); btn.textContent = "Connecting…";
      p.then(function (conn) { rui.busy = false; if (conn) finishReal(conn); else { btn.classList.remove("is-busy"); btn.textContent = label; } })
        .catch(function (e) { rui.busy = false; btn.classList.remove("is-busy"); btn.textContent = label; showError((e && e.message) || "That didn’t work. Please try again."); });
    });
    return btn;
  }
  function finishReal(conn) {
    var all = [conn].concat(conn.also || []);
    all.forEach(function (c) {
      var cc = Object.assign({}, c); delete cc.also;
      if (state.selected.indexOf(cc.key) === -1) state.selected.push(cc.key);
      state.connected[cc.key] = cc; state.skipped = state.skipped.filter(function (k) { return k !== cc.key; });
    });
    rui.reupload = false; rui.preview = null; save(); render();
  }
  function needBackend(what) {
    if (!L || !L.configured().backend) return Promise.reject(new Error("This needs the AO connection service, which isn’t switched on for this site yet. " + what));
    return L.backendCaps().then(function (caps) {
      if (!caps) throw new Error("We couldn’t reach the AO connection service just now. Please try again in a moment.");
      return caps;
    });
  }
  function serviceNotice() {
    if (!L) return null;
    if (!L.configured().backend) return h("div", { class: "j-notice", role: "note" }, h("strong", null, "Connection service not switched on yet. "), "Stripe and Shopify go through a small AO service that hasn’t been set up for this site. Bank statements work without it.");
    if (rui.capsKnown && !rui.caps) return h("div", { class: "j-notice is-warn", role: "alert" }, h("strong", null, "Can’t reach the connection service. "), "Check your internet and reload. If it keeps happening the service may be down.");
    return null;
  }
  function checkCaps() {
    if (rui.capsKnown || !L || !L.configured().backend) return;
    rui.capsKnown = true; // set first so we only ask once
    L.backendCaps().then(function (caps) { rui.caps = caps; if (!caps) { var n = serviceNotice(); if (n && document.getElementById("real-notice")) { var slot = document.getElementById("real-notice"); S.clear(slot); slot.appendChild(n); } } });
  }
  function providerList(list, onPick) {
    return h("div", { class: "j-results j-results-open", role: "listbox", "aria-label": "Choose one" }, list.map(function (p) {
      var on = rui.provider === p.id;
      return h("button", { class: "j-result" + (on ? " is-on" : ""), type: "button", role: "option", "aria-selected": on ? "true" : "false", on: { click: function () { var y = window.pageYOffset; rui.provider = p.id; rui.error = ""; rui.notice = ""; rui.hostNote = ""; rui.zohoAccounts = ""; rui.detecting = ""; delete rui.vals.host; delete rui.vals.url; delete rui.vals.password; onPick && onPick(p); render(); window.scrollTo(0, y); var pn = document.getElementById("real-panel"); if (pn && pn.scrollIntoView) { try { pn.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (x) { pn.scrollIntoView(); } } } } },
        h("span", null, p.name), on ? h("span", { class: "j-result-tick", "aria-hidden": "true" }, "✓") : null);
    }));
  }
  function fileInput(accept, onFile, label) {
    var inp = h("input", { type: "file", accept: accept, id: "real-file", class: "j-file" });
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 12 * 1024 * 1024) { showError("That file is bigger than 12 MB. Try a shorter date range."); return; }
      var rd = new FileReader();
      rd.onload = function () { try { onFile(String(rd.result || ""), f); } catch (e) { showError(e.message); } };
      rd.onerror = function () { showError("We couldn’t read that file."); };
      rd.readAsText(f);
    });
    return h("label", { class: "j-filebtn btn btn-secondary j-wide", for: "real-file" }, label || "Choose a file", inp);
  }

  // ---------------------------------------------------------------- mail and calendar
  var SWITCHING_ON = "Sign-in isn’t switched on for this site yet. You can connect with an app password below.";
  var SWITCHING_ON_CAL = "Sign-in isn’t switched on for this site yet. You can connect with a calendar link below.";
  function hostFor(g, addr, typed) {
    typed = String(typed || "").trim();
    if (typed && typed !== g.host) return typed;
    if (g.id === "gmx" || g.id === "zoho-mail" || g.other) { var gh = R.guessHost(addr); if (gh) return gh; }
    return typed || g.host || "";
  }
  /** Sign in with Google or Microsoft: one sign-in covers mail and calendar. */
  function oauthPanel(provider, what, itemKey, children) {
    var panel = h("div", { class: "j-panel", id: "real-panel" });
    panel.appendChild(h("h2", { class: "j-sub" }, provider.name));
    var rt = provider.oauth, who = rt === "google" ? "Google" : "Microsoft";
    var ready = !!(L && L.configured()[rt]);
    if (ready && rt === "google" && L._preload) L._preload().catch(function () {});
    panel.appendChild(h("ol", { class: "j-steps" },
      h("li", null, "Press Connect — " + who + "’s own sign-in page opens."),
      h("li", null, "Sign in and press Allow."),
      h("li", null, "That’s it — " + (rt === "google" ? "Gmail and Google Calendar are both connected in one go." : "Outlook mail and calendar are both connected in one go."))));
    panel.appendChild(h("p", { class: "j-hint" }, "We ask only to " + what + " We can’t send mail, and you can disconnect any time."));
    if (provider.note && itemKey === "mail" && rt === "microsoft") panel.appendChild(h("div", { class: "j-notice", role: "note" }, provider.note));
    var waitMsg = itemKey === "calendar" ? SWITCHING_ON_CAL : SWITCHING_ON;
    if (!ready) panel.appendChild(h("div", { class: "j-notice", role: "note" }, waitMsg));
    panel.appendChild(errBox());
    var label = itemKey === "mail" ? (rt === "google" ? "Connect Gmail" : "Connect Outlook") : (rt === "google" ? "Connect Google Calendar" : "Connect Outlook calendar");
    panel.appendChild(actionButton(label, function () {
      if (!ready) return Promise.reject(new Error(waitMsg));
      return L.connect(itemKey, provider.id, provider.name, rt, {}, state.connected);
    }));
    children.push(panel);
    return ready;
  }

  function lookUpHost(g, addr) {
    addr = normEmail(addr);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return;
    if (!(g.id === "zoho-mail" || g.id === "gmx" || g.other)) return;
    if (!L || !L.detectImap) return;
    if (rui.detecting === addr) return;
    rui.detecting = addr;
    L.detectImap(addr).then(function (r) {
      if (normEmail(rui.vals.address) !== addr) return;
      if (r && r.accounts) rui.zohoAccounts = r.accounts;
      if (r && r.host) {
        var typed = String(rui.vals.host || "").trim();
        var def = g.host || "";
        if (!typed || typed === def) rui.vals.host = r.host;
        else if (typed !== r.host) { /* keep a host the person typed themselves */ }
        if (r.kind === "zoho" && /imappro/.test(r.host || rui.vals.host || "")) rui.hostNote = "Using " + (rui.vals.host || r.host) + " (Zoho organisation server, from your domain’s mail records). We’ll try the others if this one doesn’t accept the sign-in.";
        else if (r.host) rui.hostNote = "Using " + (rui.vals.host || r.host) + ".";
        render();
      }
    }, function () { if (rui.detecting === addr) rui.detecting = ""; });
  }

  /** Address + app password (or password) over IMAP. Mail only — calendars have their own step. */
  function imapPanel(g, children, opts) {
    opts = opts || {};
    var panel = opts.nested ? h("div", { class: "j-panel j-nested", id: "real-fallback" }) : h("div", { class: "j-panel", id: "real-panel" });
    panel.appendChild(h("h2", { class: opts.nested ? "j-sub j-sub-small" : "j-sub" }, opts.nested ? "Or connect with an app password" : g.name));
    var box = passwordBox(g); if (box) panel.appendChild(box);
    if (g.note && !opts.nested) panel.appendChild(h("p", { class: "j-hint" }, g.note));
    var normal = g.pass && g.pass.kind === "normal";
    panel.appendChild(textInput("real-addr", "Your email address", "address", { type: "email", inputmode: "email", autocomplete: "email", placeholder: "you@example.com", value: rui.vals.address || (state.account ? state.account.email : "") }));
    var addrEl = panel.querySelector("#real-addr");
    if (addrEl) {
      var schedule = function () { lookUpHost(g, addrEl.value); };
      addrEl.addEventListener("blur", schedule);
      addrEl.addEventListener("change", schedule);
      if (addrEl.value) setTimeout(schedule, 0);
    }
    panel.appendChild(textInput("real-pass", g.other ? "Password or app password" : (normal ? "Email password" : "App password"), "password", { type: "password", placeholder: g.id === "gmail" ? "16-letter code" : (g.id === "icloud-mail" ? "abcd-efgh-ijkl-mnop" : ""), hint: "Sent over an encrypted connection, sealed, and kept only in this browser." }));
    var hostHint = g.other ? "We can look it up for you, or type it in." : (g.id === "zoho-mail" ? "We’ll try the right Zoho server automatically if this one doesn’t work, including organisation servers and other data centres." : "Already filled in — only change it if your provider says otherwise.");
    var host = textInput("real-host", "Mail server (IMAP)", "host", { value: rui.vals.host != null ? rui.vals.host : g.host, placeholder: "imap.example.com", hint: "Port 993 (SSL). " + hostHint });
    if (g.other) {
      panel.appendChild(host);
      panel.appendChild(h("button", { class: "btn btn-secondary j-wide", type: "button", id: "real-detect", on: { click: function () {
        var a = String(rui.vals.address || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) { showError("Type your email address first."); return; }
        showError("");
        var gh = R.guessHost(a);
        var done = function (hst, kind) {
          if (kind === "microsoft") { showError("That looks like an Outlook, Hotmail or Microsoft 365 mailbox. Microsoft doesn’t allow passwords for this kind of mailbox, so it can’t be connected here. You can still connect an Outlook calendar with a published ICS link."); return; }
          if (kind === "proton") { showError("Proton Mail only allows other apps in through Proton Bridge on your own computer, so it can’t be connected here."); return; }
          if (hst) { rui.vals.host = hst; rui.hostNote = "Found: " + hst; } else rui.hostNote = "We couldn’t find it automatically — please type your provider’s mail server above.";
          render();
        };
        if (!L || !L.detectImap) return done(gh);
        L.detectImap(a).then(function (r) { done(r.host || gh, r.kind); }, function () { done(gh); });
      } } }, "Find my settings"));
      if (rui.hostNote) panel.appendChild(h("p", { class: "j-hint", role: "status" }, rui.hostNote));
    } else panel.appendChild(h("details", { class: "j-details" }, h("summary", null, "Server settings"), host));
    if (rui.hostNote && !g.other) panel.appendChild(h("p", { class: "j-hint", role: "status" }, rui.hostNote));
    panel.appendChild(errBox());
    var label = "Connect " + (g.other ? "my email" : g.name);
    panel.appendChild(actionButton(label, function () {
      var v = rui.vals, addr = normEmail(v.address), pw = normal ? String(v.password || "") : normPass(v.password);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return Promise.reject(new Error("Please enter your email address."));
      if (!String(v.password || "").trim()) return Promise.reject(new Error("Please paste the " + (normal ? "email password." : "app password (see the steps above).")));
      var hostV = hostFor(g, addr, v.host);
      var go = hostV ? Promise.resolve(hostV) : (L && L.detectImap ? L.detectImap(addr).then(function (r) { return r.host || ""; }, function () { return ""; }) : Promise.resolve(""));
      return go.then(function (hh) {
        if (!hh) throw new Error("Please enter your mail server, for example imap.example.com (or press “Find my settings”).");
        return needBackend("Email can’t be read directly from a web page, so it has to go through the AO service.").then(function () {
          var name = g.other ? "Email (" + addr.split("@")[1] + ")" : g.name;
          return L.connect("mail", g.id, name, "imap", { address: addr, password: pw, host: hh }, state.connected);
        });
      });
    }));
    children.push(panel);
  }

  /** A calendar link (.ics / webcal). */
  function icsPanel(g, children, opts) {
    opts = opts || {};
    var panel = opts.nested ? h("div", { class: "j-panel j-nested", id: "real-fallback" }) : h("div", { class: "j-panel", id: "real-panel" });
    panel.appendChild(h("h2", { class: opts.nested ? "j-sub j-sub-small" : "j-sub" }, opts.nested ? (g.id === "google-calendar" ? "Or use a secret iCal link" : "Or use a published calendar link") : g.name));
    panel.appendChild(guideSteps(g));
    if (g.note) panel.appendChild(h("p", { class: "j-hint" }, g.note));
    panel.appendChild(textInput("real-url", "Calendar link", "url", { placeholder: "https://… .ics  or  webcal://…", hint: "Keep it private: anyone with this link can see the calendar." }));
    panel.appendChild(errBox());
    panel.appendChild(actionButton("Connect " + (opts.nested ? "with this link" : g.name), function () {
      var u = String(rui.vals.url || "").trim();
      if (!/^(webcal:|https?:)\/\//i.test(u)) return Promise.reject(new Error("Please paste the calendar link (it starts with https:// or webcal://)."));
      return needBackend("Calendar links are read through the AO service.").then(function () { return L.connect("calendar", g.id, g.name, "caldav", { url: u, icsOnly: true }, state.connected); });
    }));
    children.push(panel);
  }

  /** CalDAV with username + app password. Independent of mail — iCloud, Yahoo, Fastmail, or any server. */
  function caldavPanel(g, children) {
    var panel = h("div", { class: "j-panel", id: "real-panel" });
    panel.appendChild(h("h2", { class: "j-sub" }, g.name));
    var box = passwordBox(g); if (box) panel.appendChild(box);
    var manual = !g.url;
    var isApple = g.id === "icloud-calendar";
    if (manual) panel.appendChild(textInput("real-url", "CalDAV server address", "url", { placeholder: "https://caldav.example.com/" }));
    panel.appendChild(textInput("real-user", isApple ? "Apple Account email" : "Username (usually your email address)", "username", { type: "email", inputmode: "email", autocomplete: "username", placeholder: isApple ? "you@icloud.com" : "", value: rui.vals.username || "" }));
    panel.appendChild(textInput("real-cpass", "App password", "password", { type: "password", placeholder: isApple ? "abcd-efgh-ijkl-mnop" : "", hint: "Sent over an encrypted connection, sealed, and kept only in this browser." }));
    if (!manual) panel.appendChild(h("details", { class: "j-details" }, h("summary", null, "Server settings"), textInput("real-url", "CalDAV server address", "url", { value: rui.vals.url != null ? rui.vals.url : g.url })));
    panel.appendChild(errBox());
    panel.appendChild(actionButton("Connect " + g.name, function () {
      var v = rui.vals, user = normEmail(v.username), pw = normPass(v.password), url = String(v.url != null ? v.url : g.url || "").trim();
      if (!url) return Promise.reject(new Error("Please enter the CalDAV server address."));
      if (!user) return Promise.reject(new Error(isApple ? "Please enter your Apple Account email." : "Please enter your username."));
      if (!String(v.password || "").trim()) return Promise.reject(new Error("Please paste the app password (see the steps above)."));
      return needBackend("Calendars are read through the AO service.").then(function () {
        return L.connect("calendar", g.id, g.name, "caldav", { url: url, username: user, password: pw }, state.connected);
      });
    }));
    children.push(panel);
  }

  function mailList() { return (R.visibleMail || function () { return R.MAIL; })(); }
  function realMail(children) {
    var list = mailList();
    if (rui.provider && !list.some(function (x) { return x.id === rui.provider; })) rui.provider = null;
    var g = list.filter(function (x) { return x.id === rui.provider; })[0];
    children.push(h("div", { class: "j-field" }, h("label", { id: "pick-label" }, "Which email do you use?"), providerList(list)));
    if (!g) { children.push(h("p", { class: "j-hint" }, "Choose your email provider above.")); return; }
    if (g.oauth) {
      var ready = oauthPanel(g, "read your recent mail and save reply drafts.", "mail", children);
      if (g.id === "gmail" && !ready) imapPanel(g, children, { nested: true });
    } else imapPanel(g, children);
  }
  function realCalendar(children) {
    var g = R.CAL.filter(function (x) { return x.id === rui.provider; })[0];
    children.push(h("div", { class: "j-field" }, h("label", { id: "pick-label" }, "Which calendar do you use?"), providerList(R.CAL)));
    if (!g) { children.push(h("p", { class: "j-hint" }, "Choose your calendar above.")); return; }
    var msReady = !!(L && L.configured && L.configured().microsoft);
    // Outlook calendar stays available via a published ICS link. Microsoft sign-in for calendar
    // only appears once microsoft.clientId is set — same as Outlook email.
    if (g.id === "outlook-calendar" && !msReady) { icsPanel(g, children); return; }
    if (g.oauth) {
      var ready = oauthPanel(g, "read your calendar events.", "calendar", children);
      if (!ready) icsPanel(g, children, { nested: true });
    } else if (g.kind === "caldav") caldavPanel(g, children);
    else icsPanel(g, children);
  }

  // ---------------------------------------------------------------- bank statement
  function money(n) { return E.fmtMoney(n, false); }
  function realBank(children) {
    var panel = h("div", { class: "j-panel", id: "real-panel" });
    var banks = E.pickerList("bank");
    var sel = h("select", { id: "real-bank", "aria-label": "Your bank" }, [h("option", { value: "" }, "Choose your bank (optional)…")].concat(banks.map(function (b) { return h("option", { value: b.id }, b.name); })).concat([h("option", { value: "other" }, "Another bank")]));
    sel.value = rui.vals.bankId || "";
    sel.addEventListener("change", function () { rui.vals.bankId = sel.value; rui.bankName = sel.options[sel.selectedIndex].text; render(); });
    panel.appendChild(h("div", { class: "j-field" }, h("label", { for: "real-bank" }, "Which bank?"), sel));
    var tip = R.BANK_TIPS[rui.vals.bankId];
    panel.appendChild(h("ol", { class: "j-steps" },
      h("li", null, tip || "In your banking app or website, find “Statements”, “Export” or “Download transactions”. Menu names change a little between versions."),
      h("li", null, "Choose CSV (or OFX) and the last 1–3 months. Weekly, you can upload a newer one — it fills in the gap without duplicating anything."),
      h("li", null, "Choose the file below. It’s read in your browser and stays on this device — it isn’t uploaded anywhere.")));
    panel.appendChild(errBox());
    panel.appendChild(fileInput(".csv,.ofx,.qfx,.txt,text/csv,application/x-ofx", function (text, f) {
      var parsed = R.parseStatement(text, f.name);
      rui.preview = { parsed: parsed, file: f.name }; showError(""); render();
    }, rui.preview ? "Choose a different file" : "Choose a statement file"));
    if (rui.preview) {
      var p = rui.preview.parsed;
      panel.appendChild(h("div", { class: "j-preview", role: "status" },
        h("strong", null, "Found " + p.rows.length + " transaction" + (p.rows.length === 1 ? "" : "s")),
        h("p", null, E.shortDate(p.from) + " to " + E.shortDate(p.to) + " · " + p.format),
        h("p", null, "Money in " + money(p.inTotal) + " · Money out " + money(p.outTotal)),
        p.warnings.length ? h("p", { class: "j-hint" }, p.warnings.join(" ")) : null,
        h("ul", { class: "j-fine j-sample-rows" }, p.rows.slice(-3).reverse().map(function (r) { return h("li", null, E.shortDate(r.date) + " · " + r.desc + " · " + (r.direction === "in" ? "+" : "−") + money(r.amount)); }))));
      panel.appendChild(actionButton("Use this statement", function () {
        var bankName = rui.bankName && rui.vals.bankId && rui.vals.bankId !== "other" ? rui.bankName : "";
        var r = R.saveBank(rui.preview.parsed, { file: rui.preview.file, bank: bankName });
        var pp = rui.preview.parsed;
        return { key: "bank", providerId: rui.vals.bankId || "statement", providerName: bankName ? bankName + " statement" : "Bank statement", detail: r.count + " transactions · latest " + E.shortDate((R.localBank().rows.slice(-1)[0] || {}).date || pp.to), at: new Date().toISOString(), live: true, route: "local" };
      }));
    }
    children.push(panel);
    children.push(h("p", { class: "j-hint" }, "Only what you upload is shown. We never make up numbers."));
  }

  // ---------------------------------------------------------------- Stripe / Shopify
  function realStripe(children) {
    var panel = h("div", { class: "j-panel", id: "real-panel" });
    panel.appendChild(h("ol", { class: "j-steps" },
      h("li", null, "In Stripe, create a restricted key and give it Read access to Balance, Charges and Payouts — nothing else. ", h("a", { href: "https://dashboard.stripe.com/apikeys", target: "_blank", rel: "noopener noreferrer", class: "j-extlink" }, "Open Stripe API keys ↗")),
      h("li", null, "Copy the key (it starts rk_live_… — or rk_test_… to try with test data) and paste it below.")));
    panel.appendChild(textInput("real-key", "Restricted API key", "key", { type: "password", placeholder: "rk_live_…" }));
    panel.appendChild(errBox());
    panel.appendChild(actionButton("Connect Stripe", function () {
      var k = String(rui.vals.key || "").trim();
      if (!k) return Promise.reject(new Error("Please paste your restricted key."));
      if (/^sk_/.test(k)) return Promise.reject(new Error("That’s a full secret key. For safety please create a restricted read-only key (starts rk_) and use that."));
      if (!/^rk_(live|test)_/.test(k)) return Promise.reject(new Error("That doesn’t look like a restricted key (it should start rk_live_ or rk_test_)."));
      return needBackend("Stripe can’t be read directly from a web page.").then(function () { return L.connect("sales:stripe", "stripe", "Stripe", "stripe", { key: k }, state.connected); });
    }));
    children.push(panel);
  }
  function realShopify(children) {
    var panel = h("div", { class: "j-panel", id: "real-panel" });
    panel.appendChild(h("p", { class: "j-hint" }, "Optional. Create an app in Shopify’s Dev Dashboard with the read_orders scope and install it on your store (Shopify no longer lets you make new “custom apps”). Then paste its Client ID and secret."));
    panel.appendChild(textInput("real-shop", "Your Shopify store", "shop", { placeholder: "yourshop.myshopify.com" }));
    panel.appendChild(textInput("real-cid", "App Client ID", "clientId"));
    panel.appendChild(textInput("real-csec", "App Client secret", "clientSecret", { type: "password" }));
    panel.appendChild(textInput("real-tok", "…or an existing custom app’s access token", "token", { type: "password", placeholder: "shpat_…", hint: "Only if you already have one. Use the Client ID and secret above, or this token — not both." }));
    panel.appendChild(errBox());
    panel.appendChild(actionButton("Connect Shopify", function () {
      var shop = E.cleanShopifyStore(rui.vals.shop || "");
      if (!shop) return Promise.reject(new Error("Please enter your store name, for example yourshop.myshopify.com."));
      var v = rui.vals;
      if (!((v.clientId && v.clientSecret) || v.token)) return Promise.reject(new Error("Please paste the app’s Client ID and secret, or an access token."));
      return needBackend("Shopify can’t be read directly from a web page.").then(function () { return L.connect("sales:shopify", "shopify", "Shopify", "shopify", { shop: shop, token: v.token, clientId: v.clientId, clientSecret: v.clientSecret }, state.connected); });
    }));
    children.push(panel);
  }

  function stepItemReal() {
    var key = single || E.queue(state)[state.cursor];
    var item = E.ITEM_BY_KEY[key];
    if (!item) { go("w-done"); return; }
    var conn = state.connected[key];
    var children = [];
    if (!single) children.push(progress());
    children.push(h("p", { class: "j-eyebrow" }, single ? "Add a connection" : "Connect " + (E.queue(state).indexOf(key) + 1) + " of " + E.queue(state).length));
    children.push(h("h1", null, conn && !rui.reupload ? item.title + " connected" : (key === "mail" ? "Connect your email" : key === "calendar" ? "Connect your calendar" : key === "bank" ? "Add your bank statement" : "Connect " + item.title)));
    if (key.indexOf("sales:") === 0) { children.push(h("div", { id: "real-notice" }, serviceNotice())); checkCaps(); }

    if (conn && !rui.reupload) {
      children.push(h("div", { class: "j-success", role: "status" }, h("span", { class: "j-success-tick", "aria-hidden": "true" }, "✓"),
        h("div", null, h("strong", null, conn.providerName + " is connected"), conn.detail ? h("p", { class: "j-hint" }, conn.detail) : null,
          h("p", { class: "j-hint" }, conn.route === "local" ? "Kept on this device — nothing was uploaded." : "Live — showing your real data."))));
      if (rui.notice) children.push(h("div", { class: "j-notice is-warn", role: "alert" }, rui.notice));
      if (key === "bank" && conn.route === "local") children.push(h("button", { class: "btn btn-secondary j-wide j-gap", type: "button", on: { click: function () { rui.reupload = true; render(); } } }, "Upload a newer statement"));
      children.push(h("button", { class: "btn btn-primary j-wide j-gap", type: "button", on: { click: function () { rui.notice = ""; nextAfterItem(); } } }, single ? "Back to my dashboard" : "Continue"));
      setRoot(card.apply(null, children));
      return;
    }
    children.push(h("div", { class: "j-see" }, h("h2", null, "What we’ll see"), h("ul", { class: "j-sees" }, item.sees.map(function (t) { return h("li", null, t); })), h("p", { class: "j-fine" }, "🔒 " + item.never)));
    if (key === "mail") realMail(children);
    else if (key === "calendar") realCalendar(children);
    else if (key === "bank") realBank(children);
    else if (key === "sales:stripe") realStripe(children);
    else if (key === "sales:shopify") realShopify(children);
    children.push(h("div", { class: "j-secondary-row" },
      h("button", { class: "btn btn-secondary", type: "button", on: { click: function () {
        if (rui.reupload) { rui.reupload = false; render(); return; }
        if (state.skipped.indexOf(key) === -1) state.skipped.push(key); save(); nextAfterItem();
      } } }, rui.reupload ? "Cancel" : "Skip for now")));
    children.push(h("p", { class: "j-back" }, h("button", { class: "link-btn", type: "button", on: { click: prevItem } }, "← Back")));
    var st = window.scrollY;
    setRoot(card.apply(null, children));
    if (rui.keepScroll != null) { window.scrollTo(0, rui.keepScroll); rui.keepScroll = null; }
  }

  function stepDone() {
    var rows = E.ITEMS.filter(function (i) { return state.selected.indexOf(i.key) !== -1 || state.connected[i.key]; });
    var left = E.setupLeft(state);
    var list = h("ul", { class: "j-checklist" }, rows.map(function (i) {
      var c = state.connected[i.key];
      return h("li", { class: c ? "is-done" : "is-skipped" },
        h("span", { class: "j-check", "aria-hidden": "true" }, c ? "✓" : "–"),
        h("div", null, h("strong", null, c ? c.providerName : i.title), h("small", null, c ? "Connected" + (c.detail ? " · " + c.detail : "") : "Skipped — add it later from Connections")));
    }));
    var extra = [];
    if (state.requests.bank) extra.push(h("li", { class: "is-skipped" }, h("span", { class: "j-check" }, "–"), h("div", null, h("strong", null, state.requests.bank), h("small", null, "Noted — we’ll tell you when your bank is available"))));
    if (state.requests.other) extra.push(h("li", { class: "is-skipped" }, h("span", { class: "j-check" }, "–"), h("div", null, h("strong", null, "Requested: " + state.requests.other), h("small", null, "Noted — thank you"))));
    extra.forEach(function (x) { list.appendChild(x); });
    setRoot(card(
      progress(),
      h("h1", null, rows.length ? "You’re all set" : "No problem — you can add things later"),
      h("p", { class: "j-lead" }, rows.length ? (left ? "You’ve connected what you wanted for now. " + left + " still to add whenever you’re ready." : "Everything you picked is connected.") : "Your dashboard will show a few friendly prompts to connect things when you’re ready."),
      rows.length || extra.length ? list : null,
      h("button", { class: "btn btn-primary j-wide", type: "button", on: { click: function () { if (state.setupSeen) leaveToApp("today"); else go("setup"); } } }, "Go to my dashboard")));
  }

  function stepSetup() {
    state.setupSeen = true; save();
    var lines = ["Reading what you’ve connected", "Learning how " + (state.business ? state.business.name : "your business") + " earns and spends", "Writing your first daily briefing", "Getting your day ready"];
    var ul = h("ul", { class: "j-setup-list" }, lines.map(function (t) { return h("li", null, h("span", { class: "j-setup-dot", "aria-hidden": "true" }), t); }));
    setRoot(card(
      h("div", { class: "j-setup" },
        h("span", { class: "j-spinner j-spinner-lg", "aria-hidden": "true" }),
        h("h1", null, "Setting up your agent…"),
        h("p", { class: "j-lead", role: "status" }, "This only takes a moment."),
        ul)));
    var items = ul.children, i = 0;
    var t = setInterval(function () {
      if (i < items.length) { items[i].classList.add("is-done"); i += 1; }
      else { clearInterval(t); leaveToApp("today"); }
    }, 850);
  }

  function stepHelper(key, who) {
    var item = E.ITEM_BY_KEY[key];
    if (!item) { setRoot(card(h("h1", null, "That link doesn’t look right"), h("p", { class: "j-lead" }, "Ask whoever sent it to share it again."))); return; }
    var done = false;
    var body = h("div");
    function draw() {
      S.clear(body);
      if (done) { body.appendChild(h("div", { class: "j-success" }, h("span", { class: "j-success-tick" }, "✓"), h("div", null, h("strong", null, "All done — thank you!"), h("p", { class: "j-hint" }, "You can close this page. " + who + " will see it’s connected.")))); return; }
      body.appendChild(h("div", { class: "j-see" }, h("h2", null, "What this lets us see"), h("ul", { class: "j-sees" }, item.sees.map(function (t) { return h("li", null, t); })), h("p", { class: "j-fine" }, "🔒 " + item.never)));
      var provider = item.picker ? (item.picker === "bank" ? "monzo" : item.picker === "mail" ? "gmail" : "google-calendar") : undefined;
      body.appendChild(h("button", { class: "btn btn-primary j-wide", type: "button", on: { click: function () {
        runConnect(item, provider, item.field ? "demo-shop" : "", function () { done = true; draw(); }, function () { /* ignore */ });
      } } }, "Connect " + (item.picker ? "their " + pk(item) : item.title)));
    }
    draw();
    setRoot(card(h("p", { class: "j-eyebrow" }, "Helping out"), h("h1", null, who + " asked for your help"), h("p", { class: "j-lead" }, "They’re setting up AO Intelligence and need someone to connect " + (item.picker ? "their " + pk(item) : item.title) + ". It takes about " + item.minutes + (item.minutes === 1 ? " minute." : " minutes.")), body,
      h("p", { class: "j-fine" }, "Connections are read-only, and you can disconnect any time.")));
  }

  // ---------- router ----------
  function readHash() {
    var hash = (window.location.hash || "").replace(/^#/, "");
    var params = {};
    hash.split("&").forEach(function (p) { if (!p) return; var kv = p.split("="); params[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : ""; });
    return params;
  }
  function render() {
    var params = readHash();
    if (params.help) { overBtn.hidden = true; if (REAL) { setRoot(card(h("h1", null, "This helper link isn’t available"), h("p", { class: "j-lead" }, "Ask the person to connect it themselves from their own device."))); return; } stepHelper(params.help, params["for"] || "Someone"); return; }
    if (overBtn) overBtn.hidden = true;
    if (state.step === "welcome") state.step = "account";
    if (state.step === "app") { if (!state.business) state.step = "account"; }
    switch (state.step) {
      case "account": return stepAccount();
      case "business": if (!state.account) return stepAccount(); return stepBusiness();
      case "w-welcome": return stepWelcome();
      case "w-pick": return stepPick();
      case "w-item": return stepItem();
      case "w-done": return stepDone();
      case "setup": return stepSetup();
      default: return stepAccount();
    }
  }

  (function boot() {
    var params = readHash();
    if (params.help) { render(); return; }
    var adding = /(?:\?|&)add=1(?:&|$)/.test(window.location.search || "");
    if (adding) {
      try { sessionStorage.setItem("ao-add-from", S.currentId() || ""); } catch (e) {}
      S.beginAdd();
      state = S.load();
      if (S.account()) { state.account = S.account(); state.step = "business"; }
      else state.step = "account";
      save();
      history.replaceState(null, "", "start.html");
      render();
      return;
    }
    // already has a finished dashboard, and this visit isn’t mid-connect
    if (params.connect === undefined) {
      var ready = S.firstReadyId();
      if (ready && (state.step === "app" || !state.business || state.step === "welcome")) {
        if (S.currentId() !== ready) { S.switchTo(ready); state = S.load(); }
        window.location.replace("app.html#today"); return;
      }
    }
    // coming from the dashboard
    if (params.connect !== undefined) {
      if (!state.business) { state.step = "account"; }
      else if (params.connect) { single = params.connect; state.step = "w-item"; if (state.selected.indexOf(single) === -1) state.selected.push(single); }
      else {
        var q = E.queue(state).filter(function (k) { return !state.connected[k]; });
        if (!q.length) { leaveToApp("connections"); return; }
        state.step = "w-item"; state.cursor = E.queue(state).indexOf(q[0]);
      }
      history.replaceState(null, "", "start.html");
    } else if (params.step && ["account", "business", "w-welcome", "w-pick", "w-done", "setup"].indexOf(params.step) !== -1) {
      state.step = params.step;
    } else if (state.step === "app" && state.business) {
      window.location.replace("app.html#today"); return;
    }
    if (!single) save();
    render();
  })();
})();
