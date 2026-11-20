/* Your day: Today / Inbox / Money / Calendar / Connections / Settings — personalised per dashboard.
   Real data from your connections; state is local to this device and namespaced per dashboard. */
(function () {
  "use strict";
  var E = window.AOEngine, S = window.AOStore;
  if (!E || !S) return;
  var h = S.h;
  var state = S.load();
  if (!state.business || state.step !== "app") {
    var ready = S.firstReadyId && S.firstReadyId();
    if (ready && ready !== S.currentId()) { S.switchTo(ready); state = S.load(); }
    if (!state.business) { window.location.replace("start.html"); return; }
  }
  var panel = document.getElementById("app-panel");
  var tabsEl = document.getElementById("app-tabs");
  var TABS = [
    { id: "today", label: "Today", icon: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" },
    { id: "inbox", label: "Inbox", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
    { id: "money", label: "Money", icon: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6 10v4M18 10v4" },
    { id: "calendar", label: "Calendar", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
    { id: "connections", label: "Connections", icon: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" }
  ];
  var REAL_KEYS = ["mail", "calendar", "bank", "sales:stripe", "sales:shopify"];
  var active = "today";
  var view, universe;
  var live = null;          // real data fetched from live connections (null until loaded)
  var loading = false;
  var L = window.AOLive;
  var ui = { day: null, draft: {}, copied: null, saved: {}, saveErr: {}, editTask: null, editTarget: null, addingTarget: false, editGoal: false, addingPlace: false, editPlace: null };
  var REAL = !S.demo;
  if (REAL) E.ITEM_ORDER.sort(function (a, b) { var o = ["mail", "calendar", "bank", "sales:stripe", "sales:shopify"], A = o.indexOf(a), B = o.indexOf(b); return (A === -1 ? 99 : A) - (B === -1 ? 99 : B); });
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function placeById(id) {
    if (!id || !state.places) return null;
    for (var i = 0; i < state.places.length; i++) if (state.places[i].id === id) return state.places[i];
    return null;
  }
  function placeSelect(current, attrs) {
    var sel = h("select", Object.assign({ "aria-label": "Place", class: "task-place-select" }, attrs || {}),
      [h("option", { value: "" }, "No place")].concat((state.places || []).map(function (pl) {
        return h("option", { value: pl.id }, pl.name + (pl.address ? " — " + pl.address : ""));
      })));
    sel.value = current || "";
    return sel;
  }
  function fillSwitcher() {
    var sel = document.getElementById("dash-select");
    if (!sel) return;
    var cur = S.currentId();
    var keep = sel.value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    (S.list() || []).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.name || (d.type === "personal" ? "Personal" : "New dashboard");
      if (d.id === cur) opt.selected = true;
      sel.appendChild(opt);
    });
    var add = document.createElement("option");
    add.value = "__add__";
    add.textContent = "+ Add a dashboard";
    sel.appendChild(add);
    if (!sel._bound) {
      sel._bound = true;
      sel.addEventListener("change", function () {
        if (sel.value === "__add__") { window.location.href = "start.html?add=1"; return; }
        if (sel.value && sel.value !== S.currentId()) { S.switchTo(sel.value); window.location.reload(); }
      });
    }
  }
  fillSwitcher();
  var settingsBtn = document.getElementById("app-settings");
  if (settingsBtn) settingsBtn.addEventListener("click", function () { go("settings"); });

  function save() { S.save(state); }
  function compute() {
    universe = E.universeOf(state, undefined, live || undefined);
    var d = new Date();
    view = E.buildView(universe, state, String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"), live || undefined);
    if (!ui.day) ui.day = view.today;
  }
  function icon(path) {
    var s = h("span", { class: "tab-icon", "aria-hidden": "true" });
    s.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
    return s;
  }
  function badgeFor(id) {
    if (id === "inbox" && view.flags.mail && view.emails.length) return String(view.emails.length);
    if (id === "connections" && view.setupLeft) return String(view.setupLeft);
    return null;
  }
  function drawTabs() {
    S.clear(tabsEl);
    TABS.forEach(function (t) {
      var b = badgeFor(t.id);
      tabsEl.appendChild(h("button", { class: "app-tab" + (active === t.id ? " is-active" : ""), type: "button", role: "tab", "aria-selected": active === t.id ? "true" : "false", on: { click: function () { setTab(t.id); } } },
        icon(t.icon), h("span", null, t.label), b ? h("span", { class: "tab-badge" }, b) : null));
    });
  }
  function setTab(id) {
    active = id;
    if (window.location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    draw(); window.scrollTo(0, 0);
  }
  function draw() {
    compute(); drawTabs(); drawBadge();
    S.clear(panel);
    if (loading && hasLive()) { panel.appendChild(h("div", { class: "app-loading", role: "status" }, h("span", { class: "j-spinner", "aria-hidden": "true" }), h("p", null, "Fetching your live data…"))); return; }
    var pages = { today: pToday, inbox: pInbox, money: pMoney, calendar: pCalendar, connections: pConnections, settings: pSettings };
    var root = (pages[active] || pToday)();
    var notices = liveNotices();
    if (notices) root.insertBefore(notices, root.firstChild && root.firstChild.nextSibling);
    panel.appendChild(root);
  }
  function hasLive() { return Object.keys(state.connected).some(function (k) { return state.connected[k].live; }); }
  function connectedCount() { return Object.keys(state.connected).length; }
  function drawBadge() {
    var b = document.getElementById("data-badge"); if (!b) return;
    if (REAL) { b.hidden = true; return; }
    var n = connectedCount(), nl = Object.keys(state.connected).filter(function (k) { return state.connected[k].live; }).length;
    b.hidden = false;
    b.textContent = nl && nl === n ? "Live data" : nl ? "Live + sample data" : "Sample data"; b.className = "demo-badge" + (nl ? " is-live" : "");
  }
  function loadLive(force) {
    if (!L || !hasLive()) { live = null; loading = false; return Promise.resolve(); }
    loading = !live || force === "block";
    if (loading) draw();
    return L.load(state).then(function (d) { live = d; loading = false; draw(); }).catch(function () { loading = false; draw(); });
  }
  function pill(isLive) { if (REAL) return document.createTextNode(""); return h("span", { class: "src-pill " + (isLive ? "is-live" : "is-sample") }, isLive ? "Live" : "Sample"); }
  function liveNotices() {
    if (!view.liveErrors || !view.liveErrors.length) return null;
    var wrap = h("div", { class: "live-notices" });
    view.liveErrors.forEach(function (e) {
      var rt = view.reauth[e.key];
      var item = E.ITEM_BY_KEY[e.key];
      wrap.appendChild(h("div", { class: "live-notice", role: "alert" },
        h("p", null, h("strong", null, (item ? item.title : e.key) + ": "), e.message),
        rt ? h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: function (ev) {
          var b = ev.currentTarget; b.disabled = true; b.textContent = "Opening sign-in…";
          L.reconnect(rt, state.connected).then(function () { return loadLive("block"); }).catch(function (err) { b.disabled = false; b.textContent = "Reconnect"; e.message = err.message; draw(); });
        } } }, "Reconnect") : h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { loadLive("block"); } } }, "Try again")));
    });
    return wrap;
  }
  function go(tab) { setTab(tab); }

  // ---------- helpers ----------
  function card(title, right) {
    var el = h("section", { class: "dash-card app-card" });
    if (title) el.appendChild(h("div", { class: "panel-head" }, h("h2", { class: "panel-title" }, title), right ? h("span", { class: "muted" }, right) : null));
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }
  function empty(text, ctaLabel, tab) {
    return h("div", { class: "app-empty" }, h("p", null, text), ctaLabel ? h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { go(tab || "connections"); } } }, ctaLabel) : null);
  }
  function pageHead(title, sub) { return h("div", { class: "app-head" }, h("h1", null, title), sub ? h("p", { class: "muted" }, sub) : null); }
  function bar(pct) { return h("div", { class: "bar", role: "presentation" }, h("span", { style: "width:" + Math.round(Math.max(0, Math.min(1, pct)) * 100) + "%" })); }

  // ---------- Today ----------
  function pToday() {
    var hr = new Date().getHours();
    var greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    var first = (state.account && state.account.name || "").split(/\s+/)[0];
    var root = h("div");
    root.appendChild(pageHead(greet + (first ? ", " + first : ""), view.todayLabel + " · " + view.name));
    if (view.setupLeft) {
      root.appendChild(h("button", { class: "app-nudge", type: "button", on: { click: function () { window.location.href = "start.html#connect"; } } },
        h("strong", null, "Finish setup (" + view.setupLeft + " left)"), h("span", null, "Connect the rest in about " + E.minutesLeft({ step: "w-pick", cursor: 0, selected: state.selected, connected: state.connected }) + " min →")));
    }
    var brief = card("Your briefing", "Today");
    brief.appendChild(h("p", { class: "overview-body" }, view.overview.body));
    if (view.overview.suggestions.length) {
      brief.appendChild(h("details", { class: "app-ideas" }, h("summary", null, "Ideas for today (" + view.overview.suggestions.length + ")"),
        h("ol", { class: "suggestion-list" }, view.overview.suggestions.map(function (t) { return h("li", null, t); }))));
    }
    root.appendChild(brief);

    root.appendChild(h("div", { class: "teasers" }, view.teasers.map(function (t) {
      return h("button", { class: "teaser" + (t.muted ? " is-muted" : ""), type: "button", on: { click: function () { go(t.tab); } } }, h("span", null, t.text), h("span", { "aria-hidden": "true" }, "→"));
    })));

    var sched = card("Today’s schedule", view.flags.calendar ? view.calendarName : null);
    if (view.flags.calendar) sched.querySelector(".panel-head").appendChild(pill(view.live.calendar));
    if (!view.flags.calendar) sched.appendChild(empty("Connect your calendar to see today’s meetings and events.", "Connect calendar", "connections"));
    else if (!view.todayEvents.length) sched.appendChild(h("p", { class: "muted" }, "Nothing in your calendar today."));
    else sched.appendChild(eventList(view.todayEvents, false));
    root.appendChild(sched);

    root.appendChild(REAL ? tasksCardReal() : tasksCardDemo());
    root.appendChild(REAL ? targetsCardReal() : targetsCardDemo());
    return root;
  }


  // ---------- tasks and targets ----------
  function toggleDone(t, checked) {
    if (t.user) {
      var id = t.id.slice(2);
      state.userTasks.forEach(function (u) { if (u.id === id) u.done = checked; });
    } else {
      var i = state.doneTasks.indexOf(t.id);
      if (checked && i === -1) state.doneTasks.push(t.id); else if (!checked && i !== -1) state.doneTasks.splice(i, 1);
    }
    save(); draw();
  }
  function tasksCardDemo() {
    var tasks = card("Today’s tasks");
    tasks.appendChild(h("ul", { class: "task-list" }, view.tasks.map(function (t) {
      var cb = h("input", { type: "checkbox", id: "task-" + t.id, checked: t.done ? true : null, "aria-label": t.title });
      cb.addEventListener("change", function () { toggleDone(t, cb.checked); });
      return h("li", { class: "task" + (t.done ? " is-done" : "") }, cb, h("label", { for: "task-" + t.id }, t.title),
        t.tab ? h("button", { class: "link-btn", type: "button", on: { click: function () { go(t.tab); } } }, "Open") : null);
    })));
    return tasks;
  }
  function tasksCardReal() {
    var tasks = card("Tasks", view.tasks.length ? (view.tasks.filter(function (t) { return t.done; }).length + " of " + view.tasks.length + " done") : null);
    if (!view.tasks.length) tasks.appendChild(h("p", { class: "muted" }, "Nothing here yet. Add your first task below — tasks suggested from your real emails and calendar will appear here too."));
    tasks.appendChild(h("ul", { class: "task-list" }, view.tasks.map(function (t) {
      var cb = h("input", { type: "checkbox", id: "task-" + t.id, checked: t.done ? true : null, "aria-label": t.title });
      cb.addEventListener("change", function () { toggleDone(t, cb.checked); });
      if (t.user && ui.editTask === t.id) {
        var inp = h("input", { type: "text", class: "task-edit", value: t.title, "aria-label": "Edit task", maxlength: "200" });
        var curPlace = (state.userTasks.filter(function (u) { return u.id === t.id.slice(2); })[0] || {}).placeId || "";
        var psel = (state.places && state.places.length) ? placeSelect(curPlace) : null;
        var saveEdit = function () { var v = inp.value.trim(); if (v) state.userTasks.forEach(function (u) { if (u.id === t.id.slice(2)) { u.title = v; if (psel) u.placeId = psel.value || undefined; } }); ui.editTask = null; save(); draw(); };
        inp.addEventListener("keydown", function (e) { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") { ui.editTask = null; draw(); } });
        setTimeout(function () { inp.focus(); }, 0);
        return h("li", { class: "task is-editing" }, inp, psel, h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: saveEdit } }, "Save"), h("button", { class: "link-btn", type: "button", on: { click: function () { ui.editTask = null; draw(); } } }, "Cancel"));
      }
      var tPlace = t.user ? placeById((state.userTasks.filter(function (u) { return u.id === t.id.slice(2); })[0] || {}).placeId) : null;
      return h("li", { class: "task" + (t.done ? " is-done" : "") }, cb, h("label", { for: "task-" + t.id }, t.title, tPlace ? h("small", { class: "task-place" }, tPlace.name) : null, !t.user ? h("small", { class: "task-sugg" }, " suggested") : null),
        t.tab ? h("button", { class: "link-btn", type: "button", on: { click: function () { go(t.tab); } } }, "Open") : null,
        t.user ? h("button", { class: "link-btn", type: "button", "aria-label": "Edit " + t.title, on: { click: function () { ui.editTask = t.id; draw(); } } }, "Edit") : null,
        t.user ? h("button", { class: "link-btn is-danger", type: "button", "aria-label": "Remove " + t.title, on: { click: function () { state.userTasks = state.userTasks.filter(function (u) { return u.id !== t.id.slice(2); }); save(); draw(); } } }, "Remove") : null);
    })));
    var add = h("input", { type: "text", id: "new-task", placeholder: "Add a task, e.g. Send the sponsor deck", maxlength: "200", "aria-label": "New task", autocomplete: "off" });
    var addPlace = (state.places && state.places.length) ? placeSelect("", { id: "new-task-place" }) : null;
    var addIt = function () {
      var v = add.value.trim(); if (!v) { add.focus(); return; }
      var task = { id: uid(), title: v, done: false, created: new Date().toISOString() };
      if (addPlace && addPlace.value) task.placeId = addPlace.value;
      state.userTasks.push(task); save(); draw();
      var n = document.getElementById("new-task"); if (n) n.focus();
    };
    add.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addIt(); } });
    tasks.appendChild(h("div", { class: "add-row" }, add, addPlace, h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: addIt } }, "Add")));
    var done = state.userTasks.filter(function (u) { return u.done; }).length;
    if (done) tasks.appendChild(h("button", { class: "link-btn", type: "button", on: { click: function () { state.userTasks = state.userTasks.filter(function (u) { return !u.done; }); save(); draw(); } } }, "Clear " + done + " completed"));
    return tasks;
  }
  function targetsCardDemo() {
    var targets = card("Targets");
    targets.appendChild(h("ul", { class: "target-list" }, view.targets.map(function (t) {
      return h("li", null, h("div", { class: "target-top" }, h("span", null, t.label), h("strong", null, t.text)), bar(t.pct));
    })));
    return targets;
  }
  function numField(id, label, val, step) { return h("div", { class: "j-field num-field" }, h("label", { for: id }, label), h("input", { id: id, type: "number", inputmode: "decimal", step: step || "any", value: val == null ? "" : String(val) })); }
  function targetForm(t) {
    var wrap = h("div", { class: "target-form" });
    var label = h("input", { type: "text", id: "tg-label", placeholder: "e.g. Sponsor meetings booked", value: t ? t.label : "", maxlength: "80", "aria-label": "Target name" });
    var unit = h("input", { type: "text", id: "tg-unit", placeholder: "£ or a word, optional", value: t ? t.unit : "", maxlength: "12", "aria-label": "Unit" });
    var cur = numField("tg-cur", "So far", t ? t.current : 0), goal = numField("tg-goal", "Goal", t ? t.goal : "");
    var err = h("p", { class: "j-error", role: "alert", hidden: true });
    var saveIt = function () {
      var l = label.value.trim(), c = parseFloat(cur.querySelector("input").value), g = parseFloat(goal.querySelector("input").value);
      var bad = !l ? "Please name the target." : isNaN(g) || g <= 0 ? "Please enter a goal above zero." : isNaN(c) ? "Please enter how far you’ve got (0 is fine)." : "";
      if (bad) { err.textContent = bad; err.hidden = false; return; }
      if (t) state.userTargets.forEach(function (x) { if (x.id === t.id) { x.label = l; x.current = c; x.goal = g; x.unit = unit.value.trim(); } });
      else state.userTargets.push({ id: uid(), label: l, current: c, goal: g, unit: unit.value.trim() });
      ui.editTarget = null; ui.addingTarget = false; save(); draw();
    };
    wrap.appendChild(h("div", { class: "j-field" }, h("label", { for: "tg-label" }, "Target"), label));
    wrap.appendChild(h("div", { class: "num-row" }, cur, goal, h("div", { class: "j-field" }, h("label", { for: "tg-unit" }, "Unit"), unit)));
    wrap.appendChild(err);
    wrap.appendChild(h("div", { class: "j-actions" }, h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { ui.editTarget = null; ui.addingTarget = false; draw(); } } }, "Cancel"), h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: saveIt } }, t ? "Save" : "Add target")));
    return wrap;
  }
  function targetsCardReal() {
    var card0 = card("Targets");
    var list = h("ul", { class: "target-list" });
    view.targets.forEach(function (t) {
      if (t.user && ui.editTarget === t.id) { list.appendChild(h("li", null, targetForm({ id: t.id, label: t.label, current: t.current, goal: t.goal, unit: t.unit }))); return; }
      var actions = [];
      if (t.user) {
        actions.push(h("button", { class: "link-btn", type: "button", on: { click: function () { ui.editTarget = t.id; ui.addingTarget = false; draw(); } } }, "Update"));
        actions.push(h("button", { class: "link-btn is-danger", type: "button", on: { click: function () { state.userTargets = state.userTargets.filter(function (x) { return x.id !== t.id; }); save(); draw(); } } }, "Remove"));
      } else if (t.moneyGoal) {
        actions.push(h("button", { class: "link-btn", type: "button", on: { click: function () { ui.editGoal = true; draw(); } } }, "Change goal"));
      }
      list.appendChild(h("li", null, h("div", { class: "target-top" }, h("span", null, t.label), h("strong", null, t.text)), bar(t.pct), actions.length ? h("div", { class: "target-actions" }, actions) : null));
    });
    if (!view.targets.length) card0.appendChild(h("p", { class: "muted" }, "No targets yet. Add one below, for example “Sponsor meetings booked: 0 of 5”."));
    card0.appendChild(list);
    // money goal
    if (view.revenueSource !== "none" && (!state.moneyGoal || ui.editGoal)) {
      var gi = h("input", { type: "number", inputmode: "decimal", id: "money-goal", placeholder: "e.g. 5000", value: state.moneyGoal ? String(state.moneyGoal) : "", "aria-label": "Monthly goal in pounds" });
      var setIt = function () { var v = parseFloat(gi.value); state.moneyGoal = v > 0 ? v : 0; ui.editGoal = false; save(); draw(); };
      gi.addEventListener("keydown", function (e) { if (e.key === "Enter") setIt(); });
      card0.appendChild(h("div", { class: "add-row" }, h("label", { for: "money-goal", class: "add-label" }, view.revenueSource === "bank" ? "Monthly money-in goal (£)" : "Monthly sales goal (£)"), gi, h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: setIt } }, "Set goal")));
    }
    if (ui.addingTarget) card0.appendChild(targetForm(null));
    else card0.appendChild(h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { ui.addingTarget = true; ui.editTarget = null; draw(); setTimeout(function () { var l = document.getElementById("tg-label"); if (l) l.focus(); }, 0); } } }, "Add a target"));
    return card0;
  }

  function eventList(events, showDate) {
    return h("ul", { class: "event-list" }, events.map(function (e) {
      var tagged = placeById(state.eventPlaces && e.id ? state.eventPlaces[e.id] : null);
      var where = tagged ? tagged.name : (e.place || (e.kind === "deadline" ? "Deadline" : ""));
      var tagger = null;
      if (state.places && state.places.length && e.id) {
        var sel = placeSelect(state.eventPlaces && state.eventPlaces[e.id] || "", { "aria-label": "Tag a place for " + e.title });
        sel.addEventListener("change", function () {
          state.eventPlaces = state.eventPlaces || {};
          if (sel.value) state.eventPlaces[e.id] = sel.value; else delete state.eventPlaces[e.id];
          save(); draw();
        });
        tagger = h("div", { class: "event-place" }, h("span", { class: "muted" }, "Place"), sel);
      }
      return h("li", { class: "event kind-" + e.kind },
        h("div", { class: "event-time" }, e.allDay ? "All day" : e.kind === "deadline" ? "Due" : E.time12(e.start), !e.allDay && e.kind !== "deadline" && e.end !== e.start ? h("small", null, "to " + E.time12(e.end)) : null),
        h("div", null, h("strong", null, e.title), h("small", null, (showDate ? E.whenLabel(e.date, view.today) + " · " : "") + where), tagger));
    }));
  }

  // ---------- Inbox ----------
  function pInbox() {
    var root = h("div");
    root.appendChild(pageHead("Inbox", view.flags.mail ? view.mailName + (view.liveAccounts.mail ? " (" + view.liveAccounts.mail + ")" : "") + " · replies waiting for you" : "Emails that need a reply, with drafts ready"));
    if (view.flags.mail) root.querySelector(".app-head").appendChild(pill(view.live.mail));
    if (!view.flags.mail) { root.appendChild(card(null, null, empty("Connect your email to see which messages need a reply — we’ll have a draft ready for each one. Nothing is ever sent without your approval.", "Connect email", "connections"))); return root; }
    root.appendChild(h("p", { class: "overview-intro" }, "We looked through " + (view.otherMessages + view.emailTotal) + " recent " + (view.live.mail ? "real " : "") + "messages. " + (view.emails.length ? view.emails.length + " need a reply from you; the rest are handled or don’t need you." : "None need a reply — you’re all caught up.")));
    if (!view.emails.length) { root.appendChild(card(null, null, empty("All caught up. New emails that need a reply will appear here."))); return root; }
    view.emails.forEach(function (m) { root.appendChild(emailCard(m)); });
    return root;
  }
  function emailCard(m) {
    var di = ui.draft[m.id] || 0;
    var body = m.draftBody(di);
    var ta = h("textarea", { class: "draft-text", rows: "8", "aria-label": "Draft reply to " + m.from });
    ta.value = body;
    ta.addEventListener("input", function () { state.edits[m.id + ":" + di] = ta.value; save(); });
    var el = h("article", { class: "dash-card app-card email-card" },
      h("header", null, h("div", null, h("strong", null, m.from), h("small", null, m.org + " · " + m.when)), h("span", { class: "count-pill" }, "Needs reply")),
      h("h3", { class: "email-subject" }, m.subject),
      h("p", { class: "muted" }, m.snippet),
      h("div", { class: "draft-tabs", role: "tablist", "aria-label": "Draft replies" }, m.drafts.map(function (d, i) {
        return h("button", { class: "draft-tab" + (i === di ? " is-on" : ""), type: "button", role: "tab", "aria-selected": i === di ? "true" : "false", on: { click: function () { ui.draft[m.id] = i; draw(); } } }, d.label);
      })),
      ta,
      h("div", { class: "draft-actions" },
        h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: function () {
          var url = "mailto:?subject=" + encodeURIComponent("Re: " + m.subject) + "&body=" + encodeURIComponent(ta.value);
          window.location.href = url;
        } } }, "Open in email"),
        m.live && m.meta ? h("button", { class: "btn btn-secondary btn-small", type: "button", disabled: ui.saved[m.id] ? true : null, on: { click: function (ev) {
          var b = ev.currentTarget; b.disabled = true; b.textContent = "Saving…"; ui.saveErr[m.id] = "";
          L.saveDraft(m, ta.value, state.connected).then(function (r) { ui.saved[m.id] = r; draw(); }).catch(function (err) { ui.saveErr[m.id] = err.message; if (err.reauth) { /* shown by banner on next refresh */ } draw(); });
        } } }, ui.saved[m.id] ? "Saved ✓" : "Save as draft in " + ({ google: "Gmail", microsoft: "Outlook", imap: "your mailbox" }[m.meta.provider])) : null,
        h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function (ev) {
          var b = ev.currentTarget;
          S.copyText(ta.value).then(function () { b.textContent = "Copied ✓"; setTimeout(function () { b.textContent = "Copy"; }, 1500); });
        } } }, "Copy"),
        h("button", { class: "btn btn-ghost btn-small", type: "button", on: { click: function () {
          state.replied.push(m.id); if (state.doneTasks.indexOf("reply:" + m.id) === -1) state.doneTasks.push("reply:" + m.id); save(); draw();
        } } }, "Mark as replied")),
      ui.saveErr[m.id] ? h("p", { class: "j-error j-block", role: "alert" }, ui.saveErr[m.id]) : null,
      ui.saved[m.id] ? h("p", { class: "j-fine", role: "status" }, "Saved to " + ui.saved[m.id].where + ". Nothing has been sent — open it there to review and send." + (ui.saved[m.id].url ? " " : ""), ui.saved[m.id].url ? h("a", { href: ui.saved[m.id].url, target: "_blank", rel: "noopener" }, "Open drafts ↗") : null) : null,
      h("p", { class: "j-fine" }, "You can edit the draft above. Nothing is sent from here — " + (m.live ? "drafts are saved to your mailbox for you to review, and " : "") + "“Open in email” hands it to your own mail app."));
    return el;
  }

  // ---------- Money ----------
  function pMoney() {
    var v = view, root = h("div");
    root.appendChild(pageHead("Money", v.revenueSource === "none" ? "Money in, money out and what’s owed" : (v.revenueSource === "sales" ? "Sales" + (v.flags.bank ? " and money in" : "") : "Money in and out") + " · last 30 days · " + (REAL ? "your own data" : v.revenueSource === "sales" ? (v.live.sales ? "live data" : "sample data") : v.revenueSource === "bank" ? (v.live.bank ? "live data" : "sample data") : "sample data")));
    if (REAL && v.flags.bank) {
      var bl = v.extras.bankLocal;
      root.appendChild(h("div", { class: "j-notice" + (v.bankStale ? " is-warn" : ""), role: "note" },
        h("strong", null, "Bank statement kept on this device. "),
        v.bankLatest ? "Latest transaction: " + E.shortDate(v.bankLatest) + (v.bankStale ? " — that’s a few days ago, so “today” figures will look quiet until you upload a newer statement. " : ". ") : "",
        h("a", { href: "start.html#connect=bank", class: "j-extlink" }, "Upload a newer statement →")));
    }
    if (v.revenueSource === "none") {
      root.appendChild(card("Today at a glance", null, empty(v.kpiEmpty, "Connect your bank", "connections")));
    } else {
      root.appendChild(h("div", { class: "kpi-grid" }, v.kpis.map(function (k) {
        return h("article", { class: "kpi-card dash-card" + (k.empty ? " is-empty" : "") }, h("p", { class: "kpi-label" }, k.label), h("p", { class: "kpi-value" }, k.value),
          k.change ? h("p", { class: "kpi-change is-" + k.change.kind }, k.change.text) : null, k.note ? h("p", { class: "muted kpi-note" }, k.note) : null);
      })));
      if (v.revenueSource === "sales" && !v.flags.bank) root.appendChild(h("p", { class: "overview-intro" }, "Add your bank to see money in and out alongside your sales."));
      if (v.revenueSource === "bank") root.appendChild(h("p", { class: "overview-intro" }, "No sales tool is connected, so “revenue” here is the money arriving in your bank. Add a sales or payments tool to see orders too."));
    }
    if (v.live.sales && v.extras.stripe) {
      var st = v.extras.stripe;
      root.appendChild(card("Stripe balance", "Live", h("div", { class: "bd-totals" },
        h("div", null, h("small", null, "Available"), h("strong", { class: "is-in" }, E.fmtMoney(st.available))),
        h("div", null, h("small", null, "Pending"), h("strong", null, E.fmtMoney(st.pending))),
        h("div", null, h("small", null, "Next payout"), h("strong", null, st.payouts && st.payouts[0] ? E.fmtMoney(st.payouts[0].amount) + " · " + E.shortDate(st.payouts[0].date) : "—"))),
        st.payouts && st.payouts.length ? h("ul", { class: "act-list" }, st.payouts.slice(0, 4).map(function (p) { return h("li", null, h("div", null, h("strong", null, "Payout"), h("small", null, E.shortDate(p.date) + " · " + p.status)), h("strong", { class: "is-in" }, E.fmtMoney(p.amount))); })) : null));
    }
    if (v.live.bank && v.extras.bank) {
      root.appendChild(card("Bank balance", "Live", h("p", { class: "overview-intro" }, E.fmtMoney(v.extras.bank.balance) + " across " + v.extras.bank.accounts + (v.extras.bank.accounts === 1 ? " account" : " accounts") + (v.liveAccounts.bank ? " · " + v.liveAccounts.bank : ""))));
    }
    // chart
    var chart = card("Daily " + (v.revenueSource === "bank" ? "money in" : "revenue"), "Last 30 days");
    if (v.revenueSource === "none") chart.appendChild(empty(v.chartEmpty, "Add your bank", "connections"));
    else {
      var max = 1; v.series.forEach(function (p) { max = Math.max(max, p.primary, p.secondary); });
      chart.appendChild(h("ul", { class: "chart-legend" }, h("li", null, h("span", { class: "swatch swatch-sales" }), v.legend.primary), v.legend.secondary ? h("li", null, h("span", { class: "swatch swatch-bank" }), v.legend.secondary) : null));
      chart.appendChild(h("div", { class: "bars", role: "img", "aria-label": "Daily bar chart for the last 30 days" }, v.series.map(function (p) {
        return h("div", { class: "bars-day", title: E.shortDate(p.date) + ": " + E.fmtMoney(p.primary) }, h("span", { class: "b1", style: "height:" + Math.max(1, Math.round((p.primary / max) * 100)) + "%" }), v.legend.secondary ? h("span", { class: "b2", style: "height:" + Math.max(1, Math.round((p.secondary / max) * 100)) + "%" }) : null);
      })));
      chart.appendChild(h("div", { class: "bars-axis" }, h("span", null, E.shortDate(v.series[0].date)), h("span", null, "Max " + E.fmtMoney(max, true)), h("span", null, "Today")));
    }
    root.appendChild(chart);
    // breakdown
    var bd = card("Where the money comes from and goes", "Last 30 days");
    if (!v.breakdown) bd.appendChild(empty("Add your bank to see money in and out by category.", "Add your bank", "connections"));
    else {
      var b = v.breakdown;
      bd.appendChild(h("div", { class: "bd-totals" }, h("div", null, h("small", null, "In"), h("strong", { class: "is-in" }, E.fmtMoney(b.totalIn, true))), h("div", null, h("small", null, "Out"), h("strong", { class: "is-out" }, E.fmtMoney(b.totalOut, true))), h("div", null, h("small", null, "Net"), h("strong", { class: b.net < 0 ? "is-out" : "is-in" }, E.fmtMoney(b.net, true)))));
      var col = function (title, rows, total, cls) {
        return h("div", null, h("h3", { class: "bd-title" }, title), h("ul", { class: "bd-list" }, rows.map(function (r) {
          return h("li", null, h("div", { class: "target-top" }, h("span", null, r.cat), h("strong", null, E.fmtMoney(r.amount, true))), h("div", { class: "bar " + cls }, h("span", { style: "width:" + Math.round((r.amount / Math.max(1, total)) * 100) + "%" })));
        })));
      };
      bd.appendChild(h("div", { class: "bd-cols" }, col("Money in", b.ins, b.totalIn, "bar-in"), col("Money out", b.outs, b.totalOut, "bar-out")));
    }
    root.appendChild(bd);
    // invoices (needs an accounts tool, which isn't available yet — don't show an empty promise in the real app)
    if (!REAL) {
    var inv = card(universe.flavor.invoiceWord.replace(/^./, function (c) { return c.toUpperCase(); }) + "s", v.flags.books ? v.booksNames.join(", ") : null);
    if (!v.invoices) inv.appendChild(empty("Connect Xero, QuickBooks or FreeAgent to see who owes you and for how long.", "Connect accounts", "connections"));
    else {
      inv.appendChild(h("p", { class: "overview-intro" }, v.invoices.overdueCount + " overdue (" + E.fmtMoney(v.invoices.overdueTotal) + ") · " + E.fmtMoney(v.invoices.dueTotal) + " due soon"));
      inv.appendChild(h("ul", { class: "inv-list" }, v.invoices.rows.map(function (i) {
        return h("li", null, h("div", null, h("strong", null, i.client), h("small", null, i.number + " · " + i.desc)), h("div", { class: "inv-right" }, h("strong", null, E.fmtMoney(i.amount)), h("span", { class: "inv-status is-" + i.status }, i.statusLabel)));
      })));
    }
    root.appendChild(inv);
    }
    // activity
    var act = card("Recent activity");
    if (!v.activity.length) act.appendChild(empty(v.activityEmpty, "Connect something", "connections"));
    else act.appendChild(h("ul", { class: "act-list" }, v.activity.map(function (a) {
      return h("li", null, h("div", null, h("strong", null, a.title), h("small", null, a.desc + " · " + a.source + " · " + a.when + (a.time ? ", " + E.time12(a.time) : ""))), h("strong", { class: a.direction === "out" ? "is-out" : "is-in" }, (a.direction === "out" ? "−" : "+") + E.fmtMoney(a.amount)));
    })));
    root.appendChild(act);
    return root;
  }

  // ---------- Calendar ----------
  function pCalendar() {
    var root = h("div");
    root.appendChild(pageHead("Calendar", view.flags.calendar ? view.calendarName + (view.liveAccounts.calendar ? " (" + view.liveAccounts.calendar + ")" : "") + " · the next two weeks" : "Meetings, deadlines and business events"));
    if (view.flags.calendar) root.querySelector(".app-head").appendChild(pill(view.live.calendar));
    if (!view.flags.calendar) { root.appendChild(card(null, null, empty("Connect your calendar to see today’s schedule and what’s coming up. Read-only — we never add or change events.", "Connect calendar", "connections"))); return root; }
    var days = []; for (var i = 0; i < 14; i++) days.push(shift(view.today, i));
    root.appendChild(h("div", { class: "day-strip", role: "tablist", "aria-label": "Choose a day" }, days.map(function (d) {
      var c = E.dayChip(d), n = view.events.filter(function (e) { return e.date === d; }).length;
      return h("button", { class: "day-chip" + (ui.day === d ? " is-on" : ""), type: "button", role: "tab", "aria-selected": ui.day === d ? "true" : "false", on: { click: function () { ui.day = d; draw(); } } },
        h("small", null, c.dow), h("strong", null, c.day), h("span", { class: "dots", "aria-label": n + " events" }, n ? new Array(Math.min(n, 3) + 1).join("•") : ""));
    })));
    var list = view.events.filter(function (e) { return e.date === ui.day; });
    var c1 = card(E.longDate(ui.day).replace(/ \d{4}$/, ""), list.length + (list.length === 1 ? " item" : " items"));
    c1.appendChild(list.length ? eventList(list, false) : h("p", { class: "muted" }, "Nothing scheduled — a clear day."));
    root.appendChild(c1);
    var up = view.events.filter(function (e) { return e.date > ui.day; }).slice(0, 5);
    var c2 = card("Coming up");
    c2.appendChild(up.length ? eventList(up, true) : h("p", { class: "muted" }, "Nothing else in the next two weeks."));
    root.appendChild(c2);
    return root;
  }
  function shift(iso, n) { return E.addDays(iso, n); }

  // ---------- Connections ----------
  function pConnections() {
    var root = h("div");
    root.appendChild(pageHead("Connections", "Everything is optional. Connect what you use; add the rest any time."));
    if (view.setupLeft) {
      root.appendChild(h("button", { class: "app-nudge", type: "button", on: { click: function () { window.location.href = "start.html#connect"; } } }, h("strong", null, "Finish setup (" + view.setupLeft + " left)"), h("span", null, "Continue where you left off →")));
    }
    E.GROUPS.forEach(function (g) {
      var rows = E.connectionRows(state).filter(function (r) { return r.item.group === g && (!REAL || REAL_KEYS.indexOf(r.item.key) !== -1); });
      if (!rows.length) return;
      var c = card(g);
      c.appendChild(h("div", { class: "conn-list" }, rows.map(function (r) {
        var it = r.item;
        var name = r.conn ? r.conn.providerName : it.title;
        var action;
        if (r.conn) action = h("button", { class: "btn btn-ghost btn-small", type: "button", on: { click: function () { if (L && r.conn.live) L.disconnect(it.key, r.conn, state.connected); delete state.connected[it.key]; save(); loadLive(); draw(); } } }, "Disconnect");
        else action = h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { window.location.href = "start.html#connect=" + encodeURIComponent(it.key); } } }, it.picker ? "Choose & connect" : "Connect " + it.title);
        return h("div", { class: "conn-row" + (r.conn ? " is-on" : "") },
          h("span", { class: "conn-badge", "aria-hidden": "true" }, name.charAt(0)),
          h("div", { class: "conn-main" }, h("strong", null, name), h("small", null, r.conn ? (REAL ? (r.conn.route === "local" ? "Kept on this device" : "Connected") : r.conn.live ? "Connected live" : "Connected (sample data)") + (r.conn.detail ? " · " + r.conn.detail : "") : it.short)),
          r.conn ? pill(!!r.conn.live) : null,
          r.status === "pending" ? h("span", { class: "status-pill is-pending" }, "To do") : null, action);
      })));
      root.appendChild(c);
    });
    var note = h("textarea", { rows: "2", id: "other-req", placeholder: "e.g. Sage, Zettle, a booking system…", "aria-label": "Something else? Tell us" });
    note.value = state.requests.other || "";
    var saved = h("span", { class: "muted", role: "status" });
    var other = card("Something else? Tell us", null, note,
      h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { state.requests.other = note.value.trim() || undefined; save(); saved.textContent = "Noted — thank you."; } } }, "Send"), saved);
    root.appendChild(other);
    root.appendChild(card("Your data", null,
      h("p", { class: "muted" }, "Everything this dashboard keeps — tasks, targets, places, bank statements and sign-in details — lives only in this browser on this device. Open Settings to delete this dashboard or sign out of this device.")));
    return root;
  }

  function pSettings() {
    var info = S.currentInfo && S.currentInfo() || { name: state.business && state.business.name };
    var root = h("div");
    root.appendChild(pageHead("Settings", info && info.name ? info.name : "This dashboard"));

    var placesCard = card("Places", (state.places || []).length ? String((state.places || []).length) : null);
    placesCard.appendChild(h("p", { class: "muted" }, "Locations this dashboard uses — a workshop, an office, a track. You can tag tasks and calendar events to one."));
    if (!(state.places || []).length && !ui.addingPlace) placesCard.appendChild(h("p", { class: "muted" }, "No places yet."));
    if ((state.places || []).length) {
      placesCard.appendChild(h("ul", { class: "place-list" }, state.places.map(function (pl) {
        if (ui.editPlace === pl.id) {
          var n = h("input", { type: "text", value: pl.name, maxlength: "80", "aria-label": "Place name" });
          var a = h("input", { type: "text", value: pl.address || "", maxlength: "200", "aria-label": "Address" });
          var saveP = function () {
            var name = n.value.trim(); if (!name) { n.focus(); return; }
            state.places.forEach(function (x) { if (x.id === pl.id) { x.name = name; x.address = a.value.trim(); } });
            ui.editPlace = null; save(); draw();
          };
          return h("li", { class: "place-row" }, n, a, h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: saveP } }, "Save"), h("button", { class: "link-btn", type: "button", on: { click: function () { ui.editPlace = null; draw(); } } }, "Cancel"));
        }
        return h("li", { class: "place-row" },
          h("div", { class: "place-meta" }, h("strong", null, pl.name), pl.address ? h("small", null, pl.address) : null),
          h("div", null,
            h("button", { class: "link-btn", type: "button", on: { click: function () { ui.editPlace = pl.id; ui.addingPlace = false; draw(); } } }, "Edit"),
            h("button", { class: "link-btn is-danger", type: "button", on: { click: function () {
              state.places = state.places.filter(function (x) { return x.id !== pl.id; });
              state.userTasks.forEach(function (t) { if (t.placeId === pl.id) delete t.placeId; });
              if (state.eventPlaces) Object.keys(state.eventPlaces).forEach(function (k) { if (state.eventPlaces[k] === pl.id) delete state.eventPlaces[k]; });
              save(); draw();
            } } }, "Remove")));
      })));
    }
    if (ui.addingPlace) {
      var pn = h("input", { type: "text", id: "place-name", placeholder: "e.g. Workshop", maxlength: "80", "aria-label": "Place name" });
      var pa = h("input", { type: "text", id: "place-addr", placeholder: "Address (optional)", maxlength: "200", "aria-label": "Address" });
      var addP = function () {
        var name = pn.value.trim(); if (!name) { pn.focus(); return; }
        state.places = state.places || [];
        state.places.push({ id: uid(), name: name, address: pa.value.trim() });
        ui.addingPlace = false; save(); draw();
      };
      placesCard.appendChild(h("div", { class: "place-form" }, pn, pa,
        h("div", { class: "add-row" },
          h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: addP } }, "Save place"),
          h("button", { class: "link-btn", type: "button", on: { click: function () { ui.addingPlace = false; draw(); } } }, "Cancel"))));
      setTimeout(function () { var el = document.getElementById("place-name"); if (el) el.focus(); }, 0);
    } else {
      placesCard.appendChild(h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { ui.addingPlace = true; ui.editPlace = null; draw(); } } }, "Add a place"));
    }
    root.appendChild(placesCard);

    root.appendChild(card("This dashboard", null,
      h("p", { class: "muted" }, "Removing it deletes its connections, tasks, targets, places and uploads from this device. Your other dashboards stay as they are."),
      h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () {
        S.confirmDeleteDashboard(info, function () {
          var next = S.deleteDashboard(S.currentId());
          window.location.href = next ? "app.html#today" : "start.html";
        });
      } } }, "Delete this dashboard")));

    root.appendChild(card("This device", null,
      h("p", { class: "muted" }, "Sign out removes every dashboard and connection kept in this browser. Your email, calendars and bank themselves are not changed."),
      h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () {
        S.confirmSignOut(function () { S.signOut(); window.location.href = "index.html"; });
      } } }, "Sign out of this device")));
    return root;
  }

  var hash = (window.location.hash || "").replace("#", "");
  if (hash === "settings" || TABS.some(function (t) { return t.id === hash; })) active = hash;
  window.addEventListener("hashchange", function () {
    var x = (window.location.hash || "").replace("#", "");
    if ((x === "settings" || TABS.some(function (t) { return t.id === x; })) && x !== active) { active = x; draw(); }
  });
  state.step = "app"; save();
  draw();
  var rb = document.getElementById("refresh-live");
  if (rb) rb.addEventListener("click", function () { rb.disabled = true; loadLive("block").then(function () { rb.disabled = false; }); });
  if (rb) rb.hidden = !hasLive();
  loadLive("block");
})();
