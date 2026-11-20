/* Consumer journey preview: sign-up → business → connect wizard → setting up → dashboard.
   Demo only. State lives in localStorage on this device. */
(function () {
  "use strict";
  var E = window.AOEngine, S = window.AOStore, C = window.Connectors;
  if (!E || !S || !C) return;
  var h = S.h;
  var root = document.getElementById("journey");
  var overBtn = document.getElementById("start-over");
  var state = S.load();
  var single = null; // item key when connecting just one service from the dashboard
  var ui = { search: "", provider: null, field: "", error: "", unlisted: false, unlistedText: "", copied: false, pickErr: "" };

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

  overBtn.addEventListener("click", function () {
    S.confirmReset(function () { state = E.newState(); single = null; history.replaceState(null, "", "start.html"); go("account"); overBtn.hidden = true; });
  });

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
      if (pass.value.length < 8) { errs.pass = "Please use at least 8 characters."; bad = true; }
      if (bad) { state.account = { name: name.value.trim(), email: email.value.trim() }; showErrs(); return; }
      state.account = { name: name.value.trim(), email: email.value.trim() };
      go("business"); // the password is deliberately never stored
    } } });
    function showErrs() {
      [["acc-name", errs.name], ["acc-email", errs.email], ["acc-pass", errs.pass]].forEach(function (p) {
        var wrap = document.getElementById(p[0]).parentNode;
        var old = wrap.querySelector(".j-error"); if (old) wrap.removeChild(old);
        wrap.classList.toggle("has-error", !!p[1]);
        if (p[1]) wrap.appendChild(h("p", { class: "j-error", role: "alert" }, p[1]));
      });
      var first = form.querySelector(".has-error input"); if (first) first.focus();
    }
    form.appendChild(field("acc-name", "Your name", name));
    form.appendChild(field("acc-email", "Email", email));
    form.appendChild(field("acc-pass", "Password", pass, "Demo only: we don’t keep or send your password."));
    form.appendChild(h("button", { class: "btn btn-primary j-wide", type: "submit" }, "Create my account"));
    setRoot(card(
      h("p", { class: "j-eyebrow" }, "Step 1 · Create your account"),
      h("h1", null, "Let’s get your agent started"),
      h("p", { class: "j-lead" }, "A few quick details, then we’ll set up your business. It takes about 3 minutes."),
      form,
      h("p", { class: "j-fine" }, "This is a preview: your details stay on this device and no real account is created.")));
  }

  function stepBusiness() {
    var b = state.business || { name: "", industry: "motorsport", size: "solo" };
    var name = h("input", { id: "biz-name", type: "text", autocomplete: "organization", value: b.name, required: true, placeholder: "e.g. Archie Owen Racing" });
    var ind = h("select", { id: "biz-ind" }, E.INDUSTRIES.map(function (i) { return h("option", { value: i.id, selected: i.id === b.industry ? true : null }, i.label); }));
    ind.value = b.industry;
    var size = h("select", { id: "biz-size" }, E.SIZES.map(function (i) { return h("option", { value: i.id }, i.label); }));
    size.value = b.size;
    var form = h("form", { class: "j-form", novalidate: true, on: { submit: function (e) {
      e.preventDefault();
      if (!name.value.trim()) {
        var wrap = name.parentNode; wrap.classList.add("has-error");
        if (!wrap.querySelector(".j-error")) wrap.appendChild(h("p", { class: "j-error", role: "alert" }, "Please tell us what your business is called."));
        name.focus(); return;
      }
      state.business = { name: name.value.trim(), industry: ind.value, size: size.value };
      state.selected = state.selected && state.selected.length ? state.selected : ["bank"];
      go("w-welcome");
    } } },
      field("biz-name", "Business name", name),
      field("biz-ind", "What kind of business?", ind, "We use this to tailor your sample figures and daily overview."),
      field("biz-size", "Roughly how big?", size),
      h("button", { class: "btn btn-primary j-wide", type: "submit" }, "Continue"));
    setRoot(card(
      h("p", { class: "j-eyebrow" }, "Step 2 · Your business"),
      h("h1", null, "Tell us about your business"),
      h("p", { class: "j-lead" }, "Just three quick things — a few seconds."),
      form,
      h("p", { class: "j-back" }, h("button", { class: "link-btn", type: "button", on: { click: function () { go("account"); } } }, "← Back"))));
  }

  function stepWelcome() {
    var who = state.account ? state.account.name.split(/\s+/)[0] : "";
    setRoot(card(
      progress(),
      h("p", { class: "j-eyebrow" }, "Step 3 · Connect your business"),
      h("h1", null, who ? "Nice to meet you, " + who + "." : "Let’s connect your business"),
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
        var items = E.ITEMS.filter(function (i) { return i.group === g; });
        wrap.appendChild(h("h2", { class: "j-group" }, g));
        wrap.appendChild(h("div", { class: "j-tiles" }, items.map(function (it) {
          var on = sel.indexOf(it.key) !== -1;
          return h("button", { class: "j-tile" + (on ? " is-on" : ""), type: "button", "aria-pressed": on ? "true" : "false", on: { click: function () { toggle(it.key); } } },
            h("span", { class: "j-tile-check", "aria-hidden": "true" }, on ? "✓" : ""),
            h("span", { class: "j-tile-title" }, it.title),
            h("span", { class: "j-tile-short" }, it.short));
        })));
      });
      wrap.appendChild(h("div", { class: "j-field" }, h("label", { for: "pick-other" }, "Something else? Tell us"), note,
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
      h("p", { class: "j-lead" }, "Tap anything you’d like to connect. Your bank is ticked to start — untick it if you’d rather not. Nothing here is required."),
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
    if (params.help) { overBtn.hidden = true; stepHelper(params.help, params["for"] || "Someone"); return; }
    overBtn.hidden = state.step === "welcome" && !state.account;
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
