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
  var ui = { day: null, draft: {}, tone: {}, rewriting: {}, copied: null, saved: {}, saveErr: {}, editTask: null, editTarget: null, addingTarget: false, editGoal: false, addingPlace: false, editPlace: null, inboxFilter: "reply" };
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
    return L.load(state).then(function (d) {
      live = d; loading = false;
      afterLive(d);
      draw();
      return maybeOverview().then(function () { draw(); });
    }).catch(function () { loading = false; draw(); });
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

  function afterLive(d) {
    var today = E.todayIso();
    var drafted = ((d && d.mail) || []).filter(function (m) { return !m.noReply && m.drafts && m.drafts.length; });
    if (drafted.length) {
      var names = drafted.slice(0, 3).map(function (m) { return m.from; });
      E.logActivity(state, today, "drafts", drafted.length === 1 ? "Drafted a reply to " + names[0] : "Drafted " + drafted.length + " replies", drafted.length === 1 ? (drafted[0].subject || "") : "Including " + names.join(", "));
    }
    var filed = (d && d.filed) || [];
    if (filed.length) E.logActivity(state, today, "filed", filed.length === 1 ? "Filed a newsletter" : "Filed " + filed.length + " newsletters", "Newsletters and notifications were set aside so they wouldn’t sit with messages that need you.");
    var invoices = ((d && d.mail) || []).concat(filed).filter(function (m) { return E.classifyEmail(m) === "invoice"; });
    if (invoices.length) E.logActivity(state, today, "invoice", invoices.length === 1 ? "Noted an invoice from " + invoices[0].from : "Noted " + invoices.length + " invoice or payment messages", invoices[0] ? invoices[0].subject : "");
    save();
  }
  function mailSig(d) {
    return ((d && d.mail) || []).concat((d && d.filed) || []).map(function (m) { return m.id; }).sort().join(",");
  }
  function maybeOverview() {
    if (!L || !L.fetchOverview || !live) return Promise.resolve();
    var today = E.todayIso();
    var sig = mailSig(live);
    if (state.dailyOverview && state.dailyOverview.date === today && state.dailyOverview.sig === sig) return Promise.resolve();
    var events = (live.calendar || []).filter(function (e) { return e.date >= today; }).slice(0, 12).map(function (e) {
      return { id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, place: e.place, today: e.date === today, upcoming: e.date >= today };
    });
    var money = {};
    if (view && view.extras && view.extras.bank && typeof view.extras.bank.balance === "number") money.balance = view.extras.bank.balance;
    if (view && view.invoices) { money.overdueCount = view.invoices.overdueCount; money.overdueTotal = view.invoices.overdueTotal; money.dueTotal = view.invoices.dueTotal; }
    return L.fetchOverview({
      owner: state.account && state.account.name || "",
      business: state.business && state.business.name || "",
      type: state.business && state.business.type || "",
      industry: state.business && state.business.industry || "",
      emails: ((live.mail || []).concat(live.filed || [])).slice(0, 20).map(function (m) { return { id: m.id, from: m.from, subject: m.subject, snippet: m.snippet, noReply: !!m.noReply }; }),
      events: events,
      money: money
    }).then(function (j) {
      if (!j || !j.summary) return;
      state.dailyOverview = { date: today, sig: sig, summary: j.summary, categories: j.categories, actions: j.actions || [], at: new Date().toISOString() };
      E.logActivity(state, today, "overview", "Prepared today’s overview", "Looked through your recent mail and diary.");
      save();
    }).catch(function () { /* keep the on-device briefing */ });
  }
  function activityWhen(a) {
    if (!a || !a.at) return a && a.date ? E.whenLabel(a.date, view.today) : "";
    var d = new Date(a.at);
    if (isNaN(d.getTime())) return "";
    var day = d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    var time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase().replace(" ", "");
    return day === view.today ? time : E.whenLabel(day, view.today) + ", " + time;
  }
  function openInbox(filter) { ui.inboxFilter = filter || "reply"; go("inbox"); }
  function categoryModel() {
    var ov = view.dailyOverview && view.dailyOverview.categories;
    if (ov && (ov.reply || ov.invoices || ov.newsletters)) return ov;
    var ids = { reply: [], invoices: [], bookings: [], newsletters: [] };
    (view.emails || []).filter(function (e) { return !e.noReply; }).forEach(function (e) { ids.reply.push(e.id); });
    (view.emails || []).concat(view.filed || []).forEach(function (e) {
      var c = E.classifyEmail(e);
      if (c === "invoice") ids.invoices.push(e.id);
      else if (c === "booking") ids.bookings.push(e.id);
      else if (c === "newsletter") ids.newsletters.push(e.id);
    });
    return {
      reply: { count: ids.reply.length, ids: ids.reply, blurb: ids.reply.length ? ids.reply.length + " waiting for a reply." : "Nothing needs a reply." },
      invoices: { count: ids.invoices.length, ids: ids.invoices, blurb: ids.invoices.length ? "Invoice or payment messages in your recent mail." : "No invoices or payments in the recent mail." },
      bookings: { count: ids.bookings.length, ids: ids.bookings, blurb: ids.bookings.length ? "Booking or appointment messages." : "No booking or appointment messages." },
      newsletters: { count: ids.newsletters.length, ids: ids.newsletters, blurb: ids.newsletters.length ? ids.newsletters.length + " filed." : "No newsletters filed." }
    };
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
        h("strong", null, "Finish setup (" + view.setupLeft + " left)"), h("span", null, "Connect the rest in about " + E.minutesLeft({ step: "w-pick", cursor: 0, selected: state.selected, connected: state.connected }) + " min")));
    }

    root.appendChild(agendaCard());
    root.appendChild(dailyOverviewCard());
    if (view.forward) root.appendChild(forwardCard());
    root.appendChild(agentActivityCard());

    root.appendChild(REAL ? tasksCardReal() : tasksCardDemo());
    if (!view.forward) root.appendChild(REAL ? targetsCardReal() : targetsCardDemo());
    return root;
  }

  function agendaCard() {
    var sched = card("Today’s agenda", view.flags.calendar ? view.calendarName : null);
    if (view.flags.calendar) sched.querySelector(".panel-head").appendChild(pill(view.live.calendar));
    if (!view.flags.calendar) {
      sched.appendChild(empty("Connect your calendar to see today’s meetings and events, with times, places and travel hints.", "Connect calendar", "connections"));
      return sched;
    }
    if (!view.todayEvents.length) {
      sched.appendChild(h("p", { class: "muted" }, "Nothing in your calendar today."));
      return sched;
    }
    var rows = (view.agenda && view.agenda.rows) || [];
    sched.appendChild(h("ul", { class: "agenda-list" }, rows.map(function (row) {
      if (row.type === "gap" || row.type === "travel") return h("li", { class: "agenda-note is-" + row.type }, row.label);
      var e = row.event, pl = row.place || {};
      var tagged = placeById(state.eventPlaces && e.id ? state.eventPlaces[e.id] : null);
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
      var where = pl.name || (e.kind === "deadline" ? "Deadline" : "");
      var loc = where ? h("small", { class: "agenda-place" }, where, pl.maps ? h("a", { href: pl.maps, target: "_blank", rel: "noopener", class: "maps-link" }, " Map ↗") : null) : null;
      return h("li", { class: "event kind-" + e.kind + (row.isNext ? " is-next" : "") },
        h("div", { class: "event-time" }, e.allDay ? "All day" : e.kind === "deadline" ? "Due" : E.time12(e.start), !e.allDay && e.kind !== "deadline" && e.end !== e.start ? h("small", null, "to " + E.time12(e.end)) : null, row.highlight ? h("span", { class: "next-up" }, row.highlight) : null),
        h("div", null, h("strong", null, e.title), loc, tagger));
    })));
    return sched;
  }

  function dailyOverviewCard() {
    var prefs = view.overviewPrefs || {};
    var cats = categoryModel();
    var brief = card("Daily overview", "Today");
    var line = (view.dailyOverview && view.dailyOverview.summary) || (view.overview && view.overview.body) || "";
    brief.appendChild(h("p", { class: "overview-body" }, line));
    var cards = [];
    if (prefs.showReply !== false) cards.push({ key: "reply", label: "Needs a reply", tone: "attention", data: cats.reply });
    if (prefs.showInvoices !== false) cards.push({ key: "invoices", label: "Invoices and payments", tone: "money", data: cats.invoices });
    if (prefs.showBookings !== false) cards.push({ key: "bookings", label: "Bookings / appointments", tone: "calendar", data: cats.bookings });
    if (prefs.showNewsletters !== false) cards.push({ key: "newsletters", label: "Newsletters filed", tone: "quiet", data: cats.newsletters });
    if (cards.length) {
      brief.appendChild(h("div", { class: "overview-grid" }, cards.map(function (c) {
        var n = (c.data && c.data.count) || 0;
        return h("button", { class: "overview-card dash-card tone-" + c.tone, type: "button", on: { click: function () { openInbox(c.key); } } },
          h("header", null, h("h3", null, c.label), h("span", { class: "count-pill" }, String(n))),
          h("p", null, (c.data && c.data.blurb) || ""));
      })));
    }
    return brief;
  }

  function forwardCard() {
    var f = view.forward;
    var wrap = card("Move the business forward");
    if (!f.pipeline.length && !f.upcoming.length && !f.content.length && !f.actions.length && !(view.targets && view.targets.length) && !(state.userTargets && state.userTargets.length) && !(f.money && (f.money.balance != null || (f.money.invoiceEmails && f.money.invoiceEmails.length) || f.money.invoices))) {
      wrap.appendChild(h("p", { class: "muted" }, "Nothing to push forward just now. Add a goal so you’ve got something to work towards."));
      wrap.appendChild(h("button", { class: "btn btn-primary btn-small", type: "button", on: { click: function () { ui.addingTarget = true; draw(); var el = document.getElementById("new-target"); if (el) el.focus(); } } }, "Add a goal"));
      wrap.appendChild(targetsCardReal());
      return wrap;
    }
    if (f.actions && f.actions.length) {
      wrap.appendChild(h("h3", { class: "forward-sub" }, "Suggested next"));
      wrap.appendChild(h("ul", { class: "forward-actions" }, f.actions.map(function (a) {
        var title = h("input", { type: "text", value: a.title, "aria-label": "Edit action", class: "action-edit" });
        title.addEventListener("change", function () { state.actionEdits = state.actionEdits || {}; state.actionEdits[a.id] = title.value.trim() || a.title; save(); });
        return h("li", null, title, a.detail ? h("small", null, a.detail) : null,
          h("div", { class: "add-row" },
            a.tab ? h("button", { class: "link-btn", type: "button", on: { click: function () { go(a.tab); } } }, "Open") : null,
            h("button", { class: "link-btn", type: "button", on: { click: function () { state.dismissedActions = (state.dismissedActions || []).concat([a.id]); save(); draw(); } } }, "Dismiss")));
      })));
    }
    wrap.appendChild(h("h3", { class: "forward-sub" }, f.labels.pipeline));
    if (!f.pipeline.length) wrap.appendChild(h("p", { class: "muted" }, f.motor ? "No sponsor or partner threads waiting just now." : "No one is waiting on a reply just now."));
    else wrap.appendChild(h("ul", { class: "forward-list" }, f.pipeline.map(function (p) {
      return h("li", { class: "forward-row" },
        h("div", null, h("strong", null, p.from + (p.org ? " (" + p.org + ")" : "")), h("small", null, p.subject + (p.quiet ? " · gone quiet for " + p.days + " days" : " · awaiting a reply"))),
        h("button", { class: "btn btn-secondary btn-small", type: "button", on: { click: function () { openInbox("reply"); } } }, "View"));
    })));
    wrap.appendChild(h("h3", { class: "forward-sub" }, f.labels.events));
    if (!f.upcoming.length) wrap.appendChild(h("p", { class: "muted" }, f.motor ? "No tests, races or travel in the diary for the next two weeks." : "Nothing coming up in the diary."));
    else wrap.appendChild(h("ul", { class: "forward-list" }, f.upcoming.map(function (e) {
      var items = f.motor
        ? ["Confirm travel and arrival", "Pack kit and paperwork", "Check tyres and run plan", "Plan a short post for after the event"]
        : ["Confirm the time and place", "Gather what you need", "Add a reminder if you want one"];
      return h("li", { class: "forward-row" },
        h("div", null, h("strong", null, e.title), h("small", null, E.whenLabel(e.date, view.today) + (e.start && !e.allDay ? " · " + E.time12(e.start) + (e.end && e.end !== e.start ? "–" + E.time12(e.end) : "") : "") + (e.place ? " · " + e.place : "")),
          h("ul", { class: "prep-list" }, items.map(function (t) { return h("li", null, t); }))));
    })));
    wrap.appendChild(h("h3", { class: "forward-sub" }, f.labels.money));
    var moneyBits = [];
    if (f.money && f.money.balance != null) moneyBits.push("Statement balance: " + E.fmtMoney(f.money.balance) + ".");
    if (f.money && f.money.trend) moneyBits.push(f.money.trend);
    if (f.money && f.money.invoices && f.money.invoices.overdueCount) moneyBits.push(f.money.invoices.overdueCount + " overdue (" + E.fmtMoney(f.money.invoices.overdueTotal) + ").");
    if (f.money && f.money.invoiceEmails && f.money.invoiceEmails.length) moneyBits.push(f.money.invoiceEmails.length + " invoice or payment " + (f.money.invoiceEmails.length === 1 ? "message" : "messages") + " in your mail.");
    wrap.appendChild(h("p", { class: "muted" }, moneyBits.length ? moneyBits.join(" ") : "Connect your bank or keep invoice emails in view — amounts are only shown when they come from your own data."));
    wrap.appendChild(h("h3", { class: "forward-sub" }, f.labels.content));
    if (!f.content.length) wrap.appendChild(h("p", { class: "muted" }, f.motor ? "When a test or race has just happened, a recap for sponsors and socials will show up here." : "Follow-up ideas will show up here after events in your diary."));
    else wrap.appendChild(h("ul", { class: "forward-list" }, f.content.map(function (c) {
      return h("li", { class: "forward-row" }, h("div", null, h("strong", null, c.title), h("small", null, c.detail)));
    })));
    wrap.appendChild(h("h3", { class: "forward-sub" }, f.labels.goals));
    wrap.appendChild(REAL ? targetsCardReal() : targetsCardDemo());
    return wrap;
  }

  function agentActivityCard() {
    var act = card("Recent activity");
    var rows = view.agentActivity || [];
    if (!rows.length) {
      act.appendChild(h("p", { class: "muted" }, "When a draft is written, a newsletter is filed or today’s overview is prepared, it will show up here."));
      return act;
    }
    act.appendChild(h("ol", { class: "activity-list agent-activity" }, rows.map(function (a) {
      return h("li", null, h("time", null, activityWhen(a)), h("div", null, h("strong", null, a.title), a.detail ? h("small", null, a.detail) : null));
    })));
    return act;
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
    var filter = ui.inboxFilter || "reply";
    root.appendChild(pageHead("Inbox", view.flags.mail ? view.mailName + (view.liveAccounts.mail ? " (" + view.liveAccounts.mail + ")" : "") + " · replies waiting for you" : "Emails that need a reply, with drafts ready"));
    if (view.flags.mail) root.querySelector(".app-head").appendChild(pill(view.live.mail));
    if (!view.flags.mail) { root.appendChild(card(null, null, empty("Connect your email to see which messages need a reply — we’ll have a draft ready for each one. Nothing is ever sent without your approval.", "Connect email", "connections"))); return root; }
    var scanned = (view.otherMessages + view.emailTotal + (view.filed ? view.filed.length : 0));
    root.appendChild(h("p", { class: "overview-intro" }, "We looked through " + scanned + " recent " + (view.live.mail ? "real " : "") + "messages. " + ((view.emails || []).filter(function (e) { return !e.noReply; }).length ? (view.emails.filter(function (e) { return !e.noReply; }).length + " need a reply from you.") : "None need a reply — you’re all caught up.")));
    root.appendChild(h("p", { class: "j-fine privacy-line" }, "Email text is used only to write a draft, and is never stored."));
    var filters = [
      { id: "reply", label: "Needs a reply" },
      { id: "invoices", label: "Invoices and payments" },
      { id: "bookings", label: "Bookings" },
      { id: "newsletters", label: "Newsletters" },
      { id: "all", label: "All" }
    ];
    root.appendChild(h("div", { class: "inbox-filters", role: "tablist", "aria-label": "Inbox filter" }, filters.map(function (f) {
      return h("button", { class: "draft-tab" + (filter === f.id ? " is-on" : ""), type: "button", role: "tab", "aria-selected": filter === f.id ? "true" : "false", on: { click: function () { ui.inboxFilter = f.id; draw(); } } }, f.label);
    })));
    var list = inboxList(filter);
    if (!list.length) {
      var emptyMsg = filter === "newsletters" ? "No newsletters have been filed from the recent mail." : filter === "invoices" ? "No invoice or payment messages in the recent mail." : filter === "bookings" ? "No booking or appointment messages." : filter === "all" ? "Nothing in the recent mail to show." : "All caught up. New emails that need a reply will appear here.";
      root.appendChild(card(null, null, empty(emptyMsg)));
      return root;
    }
    list.forEach(function (m) { root.appendChild(emailCard(m)); });
    return root;
  }
  function inboxList(filter) {
    var need = (view.emails || []).filter(function (e) { return !e.noReply; });
    var filed = view.filed || [];
    var all = need.concat(filed, (view.emails || []).filter(function (e) { return e.noReply; }));
    var seen = {};
    all = all.filter(function (m) { if (seen[m.id]) return false; seen[m.id] = 1; return true; });
    if (filter === "all") return all;
    if (filter === "reply") return need;
    if (filter === "newsletters") return all.filter(function (m) { return E.classifyEmail(m) === "newsletter" || m.noReply && E.classifyEmail(m) !== "invoice"; });
    if (filter === "invoices") return all.filter(function (m) { return E.classifyEmail(m) === "invoice"; });
    if (filter === "bookings") return all.filter(function (m) { return E.classifyEmail(m) === "booking"; });
    return need;
  }
  function draftCtx() {
    return { owner: state.account && state.account.name || "", business: state.business && state.business.name || "", type: state.business && state.business.type || "", industry: state.business && state.business.industry || "" };
  }
  function emailCard(m) {
    var di = ui.draft[m.id] || 0;
    if (!m.noReply && !(m.drafts && m.drafts.length)) m.drafts = E.templateDrafts(m, draftCtx().owner, draftCtx().business, ui.tone[m.id] || "friendly");
    var noReply = !!m.noReply;
    var body = m.draftBody ? m.draftBody(di) : (m.drafts && m.drafts[di] && m.drafts[di].body) || "";
    var el = h("article", { class: "dash-card app-card email-card" },
      h("header", null, h("div", null, h("strong", null, m.from), h("small", null, (m.org ? m.org + " · " : "") + m.when)), h("span", { class: "count-pill" }, noReply ? "No reply needed" : "Needs reply")),
      h("h3", { class: "email-subject" }, m.subject),
      h("p", { class: "muted" }, m.snippet));
    if (noReply) {
      el.appendChild(h("p", { class: "j-fine" }, m.noReplyReason || "This looks like a newsletter, receipt or notification, so no draft was written."));
      el.appendChild(h("div", { class: "draft-actions" },
        h("button", { class: "btn btn-ghost btn-small", type: "button", on: { click: function () { state.replied.push(m.id); save(); draw(); } } }, "Clear")));
      return el;
    }
    var ta = h("textarea", { class: "draft-text", rows: "8", "aria-label": "Draft reply to " + m.from });
    ta.value = body;
    ta.addEventListener("input", function () { state.edits[m.id + ":" + di] = ta.value; save(); });
    if (m.drafts && m.drafts.length > 1) {
      el.appendChild(h("div", { class: "draft-tabs", role: "tablist", "aria-label": "Draft replies" }, m.drafts.map(function (d, i) {
        return h("button", { class: "draft-tab" + (i === di ? " is-on" : ""), type: "button", role: "tab", "aria-selected": i === di ? "true" : "false", on: { click: function () { ui.draft[m.id] = i; draw(); } } }, d.label);
      })));
    }
    var tone = ui.tone[m.id] || "friendly";
    var toneSel = h("select", { class: "tone-select", "aria-label": "Draft tone" },
      ["friendly", "formal", "short"].map(function (t) {
        return h("option", { value: t, selected: tone === t ? "selected" : null }, t.charAt(0).toUpperCase() + t.slice(1));
      })
    );
    toneSel.value = tone;
    toneSel.addEventListener("change", function () { ui.tone[m.id] = toneSel.value; });
    el.appendChild(h("div", { class: "draft-tools" },
      h("label", { class: "tone-label" }, "Tone ", toneSel),
      h("button", { class: "btn btn-secondary btn-small", type: "button", disabled: ui.rewriting[m.id] ? true : null, on: { click: function (ev) {
        var b = ev.currentTarget;
        ui.rewriting[m.id] = true; b.disabled = true; b.textContent = "Rewriting…";
        var prev = ta.value;
        (L && L.rewriteDraft ? L.rewriteDraft(m, draftCtx(), { tone: ui.tone[m.id] || toneSel.value, previous: prev }) : Promise.resolve({ drafts: E.templateDrafts(m, draftCtx().owner, draftCtx().business, ui.tone[m.id] || toneSel.value) }))
          .then(function (j) {
            var next = j && j.drafts && j.drafts[0] && j.drafts[0].body;
            if (next) { state.edits[m.id + ":" + di] = next; if (m.drafts && m.drafts[di]) m.drafts[di].body = next; }
            ui.rewriting[m.id] = false; save(); draw();
          }).catch(function () { ui.rewriting[m.id] = false; draw(); });
      } } }, ui.rewriting[m.id] ? "Rewriting…" : "Rewrite")));
    el.appendChild(ta);
    el.appendChild(h("div", { class: "draft-actions" },
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
      } } }, "Mark as replied")));
    if (ui.saveErr[m.id]) el.appendChild(h("p", { class: "j-error j-block", role: "alert" }, ui.saveErr[m.id]));
    if (ui.saved[m.id]) el.appendChild(h("p", { class: "j-fine", role: "status" }, "Saved to " + ui.saved[m.id].where + ". Nothing has been sent — open it there to review and send." + (ui.saved[m.id].url ? " " : ""), ui.saved[m.id].url ? h("a", { href: ui.saved[m.id].url, target: "_blank", rel: "noopener" }, "Open drafts ↗") : null));
    el.appendChild(h("p", { class: "j-fine" }, "You can edit the draft above. Nothing is sent from here — " + (m.live ? "drafts are saved to your mailbox for you to review, and " : "") + "“Open in email” hands it to your own mail app."));
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
    var linked = Object.keys(state.connected || {});
    if (linked.length) {
      var acc = card("Connected accounts", String(linked.length));
      acc.appendChild(h("ul", { class: "email-list connected-accounts" }, linked.map(function (key) {
        var conn = state.connected[key];
        var item = E.ITEM_BY_KEY[key] || { title: key };
        var who = (view.liveAccounts && view.liveAccounts[key]) || conn.detail || "";
        var status = conn.route === "local" ? "Kept on this device" : (conn.live ? "Connected" : "Connected");
        return h("li", { class: "conn-row is-on" },
          h("span", { class: "conn-badge", "aria-hidden": "true" }, (conn.providerName || item.title).charAt(0)),
          h("div", { class: "conn-main" }, h("strong", null, conn.providerName || item.title), h("small", null, (who ? who + " · " : "") + status)));
      })));
      root.appendChild(acc);
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

    var prefs = state.overviewPrefs || { time: "07:00", showReply: true, showInvoices: true, showBookings: true, showNewsletters: true };
    state.overviewPrefs = prefs;
    var timeIn = h("input", { type: "time", id: "overview-time", value: prefs.time || "07:00", "aria-label": "Daily overview time" });
    timeIn.addEventListener("change", function () { prefs.time = timeIn.value || "07:00"; save(); });
    function alertRow(key, label) {
      var box = h("input", { type: "checkbox", id: "alert-" + key });
      box.checked = prefs[key] !== false;
      box.addEventListener("change", function () { prefs[key] = box.checked; save(); draw(); });
      return h("div", { class: "checkbox-row" }, box, h("label", { for: "alert-" + key }, label));
    }
    var ov = card("Daily overview");
    ov.appendChild(h("p", { class: "muted" }, "The overview is prepared when you open Today. Choose a time that suits your morning — we’ll aim to have it ready if you open the app around then."));
    ov.appendChild(h("div", { class: "settings-grid" },
      h("label", { for: "overview-time" }, "Daily overview time"), timeIn,
      alertRow("showReply", "Show alerts for messages that need a reply"),
      alertRow("showInvoices", "Show alerts for invoices and payments"),
      alertRow("showBookings", "Show alerts for bookings and appointments"),
      alertRow("showNewsletters", "Show alerts for filed newsletters")));
    root.appendChild(ov);

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
