(function () {
  "use strict";

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var connectors = window.Connectors;
  if (!connectors) return;

  var STORAGE_KEY = "ao-intelligence-demo-business";

  var select = document.getElementById("business-select");
  var demoBadge = document.getElementById("demo-badge");
  var agentName = document.getElementById("agent-name");
  var agentStatus = document.getElementById("agent-status");
  var agentManaged = document.getElementById("agent-managed");
  var agentSince = document.getElementById("agent-since");
  var businessType = document.getElementById("business-type");
  var kpiGrid = document.getElementById("kpi-grid");
  var servicesGrid = document.getElementById("services-grid");
  var overviewBody = document.getElementById("overview-body");
  var overviewSuggestions = document.getElementById("overview-suggestions");
  var overviewDate = document.getElementById("overview-date");
  var chartRoot = document.getElementById("revenue-chart");
  var chartCaption = document.getElementById("chart-caption");
  var tableBody = document.getElementById("activity-table-body");
  var tableNote = document.getElementById("activity-table-note");

  var modal = document.getElementById("connect-modal");
  var modalTitle = document.getElementById("connect-modal-title");
  var modalBody = document.getElementById("connect-modal-body");
  var modalConfirm = document.getElementById("connect-modal-confirm");
  var modalDialog = modal ? modal.querySelector(".modal") : null;
  var lastFocus = null;
  var pendingService = null;
  var catalogue = null;
  var currentId = null;
  var renderToken = 0;

  var gbp = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  });
  var gbpWhole = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  });

  function escapeText(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function formatMoney(value) {
    return gbp.format(Number(value) || 0);
  }

  function formatAxis(value) {
    var n = Number(value) || 0;
    if (n === 0) return "£0";
    return gbpWhole.format(n);
  }

  function parseDate(iso) {
    var parts = String(iso).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatShortDate(iso) {
    var d = parseDate(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function formatTableDate(iso, todayIso) {
    if (iso === todayIso) return "Today";
    var y = parseDate(todayIso);
    y.setDate(y.getDate() - 1);
    var yIso = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    if (iso === yIso) return "Yesterday";
    return formatShortDate(iso);
  }

  function formatTime(hhmm) {
    if (!hhmm) return "";
    var bits = hhmm.split(":");
    var h = Number(bits[0]);
    var m = bits[1] || "00";
    var suffix = h >= 12 ? "pm" : "am";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + suffix;
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  function pctChange(today, yesterday) {
    if (!yesterday) {
      return { kind: today > 0 ? "up" : "flat", percent: null, amount: today };
    }
    var amount = today - yesterday;
    var percent = (amount / Math.abs(yesterday)) * 100;
    var kind = "flat";
    if (percent > 0.5) kind = "up";
    else if (percent < -0.5) kind = "down";
    return { kind: kind, percent: percent, amount: amount };
  }

  function changeLabel(change, isCount) {
    var amountText = isCount
      ? (change.amount > 0 ? "+" : "") + String(Math.round(change.amount * 10) / 10)
      : (change.amount > 0 ? "+" : "") + formatMoney(change.amount);
    if (change.kind === "flat") {
      return { text: "Similar to yesterday", detail: amountText + " vs yesterday" };
    }
    var pct = change.percent === null ? "" : " (" + (change.percent > 0 ? "+" : "") + Math.round(change.percent) + "%)";
    var direction = change.kind === "up" ? "Up" : "Down";
    return { text: direction + " vs yesterday" + pct, detail: amountText + " vs yesterday" };
  }

  /**
   * Build a plain-English daily overview from the current demo numbers.
   * This is a template function: it re-runs whenever the data or business changes.
   */
  function buildDailyOverview(ctx) {
    var name = ctx.businessName;
    var unit = ctx.unit;
    var units = ctx.unitPlural;
    var salesNoun = ctx.salesNoun || "sales";
    var rev = ctx.revenueToday;
    var revY = ctx.revenueYesterday;
    var moneyIn = ctx.moneyInToday;
    var moneyY = ctx.moneyInYesterday;
    var orders = ctx.ordersToday;
    var ordersY = ctx.ordersYesterday;
    var aov = ctx.aovToday;
    var aovY = ctx.aovYesterday;
    var lag = rev - moneyIn;
    var revChange = pctChange(rev, revY);
    var orderChange = pctChange(orders, ordersY);
    var aovChange = pctChange(aov, aovY);

    var pace;
    if (revChange.kind === "up" && revChange.percent >= 8) {
      pace = "a stronger day than yesterday";
    } else if (revChange.kind === "down" && Math.abs(revChange.percent) >= 8) {
      pace = "a quieter day than yesterday";
    } else {
      pace = "a similar day to yesterday";
    }

    var sentence1 =
      "Today " + name + " took " + formatMoney(rev) + " across " +
      orders + " " + plural(orders, unit, units) + ", " + pace + ".";

    var sentence2 =
      "The average " + unit + " was " + formatMoney(aov) +
      (aovChange.kind === "flat"
        ? ", in line with yesterday."
        : aovChange.kind === "up"
          ? ", a little higher than yesterday’s " + formatMoney(aovY) + "."
          : ", a little lower than yesterday’s " + formatMoney(aovY) + ".");

    var sentence3;
    if (Math.abs(lag) >= 25) {
      sentence3 =
        "The bank shows " + formatMoney(moneyIn) + " coming in, which is " +
        formatMoney(Math.abs(lag)) + (lag > 0 ? " less than" : " more than") +
        " today’s " + salesNoun +
        " — often because card payouts or invoice payments land on a different day.";
    } else {
      sentence3 =
        "The bank shows " + formatMoney(moneyIn) + " coming in, close to today’s " +
        salesNoun + ".";
    }

    var suggestions = [];

    if (Math.abs(lag) >= 25) {
      suggestions.push(
        ctx.lagHint
          ? ctx.lagHint + " Treat today’s " + salesNoun + " and today’s money in as two different pictures, so the bank figure does not catch you by surprise."
          : "Treat today’s " + salesNoun + " and today’s money in as two different pictures — payments often arrive a day or two after the work."
      );
    } else if (moneyIn > 0 && moneyIn > moneyY * 1.2) {
      suggestions.push(
        "A larger payment landed today (" + formatMoney(moneyIn) + "). It is worth noting it against any open invoices so the week’s cash is easy to follow."
      );
    } else {
      suggestions.push(
        "Money in today is " + formatMoney(moneyIn) + ". A quick look at anything still unpaid would keep the bank line and the work in step."
      );
    }

    if (aovChange.kind === "down" && orderChange.kind === "up") {
      suggestions.push(
        "There were more " + units + " today, but the average was lower. A simple add-on at the till or a clearly priced extra could lift the average without needing more custom."
      );
    } else if (aovChange.kind === "up" && orders < ordersY) {
      suggestions.push(
        "Fewer " + units + " than yesterday, but a higher average. If that pattern holds, a short reminder to regulars midweek could fill the quieter gaps."
      );
    } else if (orders <= 1 && ctx.type === "Plumbing") {
      suggestions.push(
        "Today rests on a small number of jobs. Following up on outstanding quotes is a reliable way to fill a thinner day later in the week."
      );
    } else {
      suggestions.push(
        "Today’s average " + unit + " was " + formatMoney(aov) + ". Keeping a favourite add-on or a clear next-booking offer in view can steadily lift that figure."
      );
    }

    if (ctx.busyHint) {
      suggestions.push(ctx.busyHint + " A short check of stock, staff, or the diary before the rush will protect the rest of the day.");
    } else if (revChange.kind === "up") {
      suggestions.push(
        "Takings are ahead of yesterday. Making a note of what sold well this morning will help you repeat it next " +
        (ctx.weekday === "Saturday" ? "Saturday" : "week") + "."
      );
    } else {
      suggestions.push(
        "If the afternoon stays quiet, it is a good moment to tidy open invoices or send a friendly reminder to anyone who usually books ahead."
      );
    }

    return {
      body: sentence1 + " " + sentence2 + " " + sentence3,
      suggestions: suggestions.slice(0, 3)
    };
  }

  function niceMax(value) {
    if (value <= 0) return 100;
    var stepGuess = value / 4;
    var magnitude = Math.pow(10, Math.floor(Math.log10(stepGuess)));
    var residual = stepGuess / magnitude;
    var step = 1;
    if (residual > 5) step = 10;
    else if (residual > 2.5) step = 5;
    else if (residual > 2) step = 2.5;
    else if (residual > 1) step = 2;
    step = step * magnitude;
    var max = step * 4;
    if (max < value) max += step;
    return max;
  }

  function renderChart(series, todayIso) {
    if (!chartRoot) return;
    if (!series.length) {
      chartRoot.innerHTML = "<p class='muted'>No demo figures to chart for this business.</p>";
      return;
    }

    var w = 800;
    var h = 280;
    var pad = { l: 58, r: 18, t: 20, b: 42 };
    var iw = w - pad.l - pad.r;
    var ih = h - pad.t - pad.b;
    var maxVal = niceMax(Math.max.apply(null, series.map(function (s) {
      return Math.max(s.shopify, s.bank);
    })));
    var last = series.length - 1;

    function x(i) {
      return pad.l + (last === 0 ? iw / 2 : (i / last) * iw);
    }
    function y(v) {
      return pad.t + ih - (v / maxVal) * ih;
    }

    function linePath(key) {
      return series.map(function (s, i) {
        return (i === 0 ? "M" : "L") + x(i).toFixed(1) + "," + y(s[key]).toFixed(1);
      }).join(" ");
    }

    function areaPath(key) {
      return linePath(key) +
        " L" + x(last).toFixed(1) + "," + y(0).toFixed(1) +
        " L" + x(0).toFixed(1) + "," + y(0).toFixed(1) + " Z";
    }

    var ticks = 4;
    var grid = [];
    var yLabels = [];
    for (var t = 0; t <= ticks; t += 1) {
      var val = (maxVal / ticks) * t;
      var gy = y(val);
      grid.push('<line x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" class="chart-grid" />');
      yLabels.push(
        '<text x="' + (pad.l - 8) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" class="chart-axis">' +
          escapeText(formatAxis(val)) + "</text>"
      );
    }

    var xLabels = [];
    var xTicks = [];
    series.forEach(function (s, i) {
      if (i === 0 || i === last || i % 7 === 0) xTicks.push(i);
    });
    xTicks = xTicks.filter(function (i) {
      return i === last || Math.abs(last - i) > 2;
    });
    xTicks.forEach(function (i) {
      xLabels.push(
        '<text x="' + x(i).toFixed(1) + '" y="' + (h - 14) + '" text-anchor="middle" class="chart-axis">' +
          escapeText(formatShortDate(series[i].date)) + "</text>"
      );
    });

    var salesToday = series[last] ? series[last].shopify : 0;
    var bankToday = series[last] ? series[last].bank : 0;
    var title = "Daily revenue for the last 30 days, Shopify sales against bank money in.";
    var desc =
      "Demo figures ending " + formatShortDate(todayIso) +
      ". Today’s shop sales " + formatMoney(salesToday) +
      ", today’s money in " + formatMoney(bankToday) + ".";

    var svg =
      '<svg class="revenue-svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-labelledby="chart-title chart-desc" focusable="false">' +
        '<title id="chart-title">' + escapeText(title) + "</title>" +
        '<desc id="chart-desc">' + escapeText(desc) + "</desc>" +
        '<rect x="0" y="0" width="' + w + '" height="' + h + '" class="chart-bg" />' +
        grid.join("") +
        '<path d="' + areaPath("shopify") + '" class="chart-area chart-area-sales" />' +
        '<path d="' + areaPath("bank") + '" class="chart-area chart-area-bank" />' +
        '<path d="' + linePath("shopify") + '" class="chart-line chart-line-sales" />' +
        '<path d="' + linePath("bank") + '" class="chart-line chart-line-bank" />' +
        yLabels.join("") +
        xLabels.join("") +
      "</svg>";

    chartRoot.innerHTML = svg;
    if (chartCaption) {
      chartCaption.textContent =
        "Demo figures for the last 30 days, ending " + formatShortDate(todayIso) +
        ". The teal line is shop sales; the blue line is money in at the bank.";
    }
  }

  function serviceIcon(id) {
    var icons = {
      shopify:
        '<svg viewBox="0 0 32 32" class="service-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h16l-1.2 12.5a2 2 0 0 1-2 1.8H11.2a2 2 0 0 1-2-1.8L8 12Z"/><path d="M12 12V9.5a4 4 0 0 1 8 0V12"/></svg>',
      natwest:
        '<svg viewBox="0 0 32 32" class="service-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13 16 6l11 7"/><path d="M7 13v11h18V13"/><path d="M13 24v-6h6v6"/></svg>',
      stripe:
        '<svg viewBox="0 0 32 32" class="service-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="8" width="22" height="16" rx="2.5"/><path d="M5 13h22M10 18h6"/></svg>',
      square:
        '<svg viewBox="0 0 32 32" class="service-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="20" height="20" rx="3"/><rect x="12" y="12" width="8" height="8" rx="1.2"/></svg>',
      xero:
        '<svg viewBox="0 0 32 32" class="service-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="6" width="18" height="20" rx="2"/><path d="M11 12h10M11 16h10M11 20h6"/></svg>'
    };
    return icons[id] || icons.shopify;
  }

  function renderServices(services) {
    servicesGrid.innerHTML = services.map(function (service) {
      var action = service.connected
        ? '<span class="status-pill">' + escapeText(service.status) + "</span>"
        : '<button class="btn btn-secondary btn-small" type="button" data-connect="' + escapeText(service.id) + '">' +
            escapeText(service.connectLabel) + "</button>";
      return (
        '<article class="service-card dash-card' + (service.connected ? " is-connected" : "") + '">' +
          '<div class="service-card-top">' +
            serviceIcon(service.id) +
            "<div>" +
              "<h3>" + escapeText(service.name) + "</h3>" +
              '<p class="muted">' + escapeText(service.blurb) + "</p>" +
            "</div>" +
          "</div>" +
          '<div class="service-card-actions">' +
            action +
            (service.connected
              ? '<p class="service-note">Demo figures only. No live account is linked.</p>'
              : '<p class="service-note">Preview only — nothing is connected for real.</p>') +
          "</div>" +
        "</article>"
      );
    }).join("");

    servicesGrid.querySelectorAll("[data-connect]").forEach(function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-connect");
        var service = services.find(function (s) { return s.id === id; });
        openModal(service || { id: id, name: id });
      });
    });
  }

  function renderKpis(kpis) {
    kpiGrid.innerHTML = kpis.map(function (kpi) {
      var change = changeLabel(kpi.change, kpi.isCount);
      return (
        '<article class="kpi-card dash-card">' +
          '<p class="kpi-label">' + escapeText(kpi.label) + "</p>" +
          '<p class="kpi-value">' + escapeText(kpi.value) + "</p>" +
          '<p class="kpi-change is-' + escapeText(kpi.change.kind) + '">' +
            '<span class="kpi-change-label">' + escapeText(change.text) + "</span>" +
            '<span class="visually-hidden">. ' + escapeText(change.detail) + "</span>" +
          "</p>" +
        "</article>"
      );
    }).join("");
  }

  function dailyMap(rows, valueKey) {
    var map = Object.create(null);
    (rows || []).forEach(function (row) {
      map[row.date] = row[valueKey];
    });
    return map;
  }

  function previousDate(iso) {
    var d = parseDate(iso);
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function mergeActivity(orders, transactions, todayIso) {
    var rows = [];
    (orders || []).forEach(function (order) {
      rows.push({
        date: order.date,
        time: order.time || "",
        source: "Shopify",
        title: order.reference || "Order",
        description: order.description,
        amount: order.total,
        direction: "in"
      });
    });
    (transactions || []).forEach(function (tx) {
      rows.push({
        date: tx.date,
        time: tx.time || "",
        source: "NatWest",
        title: tx.direction === "out" ? "Money out" : "Money in",
        description: tx.description,
        amount: tx.amount,
        direction: tx.direction
      });
    });
    rows.sort(function (a, b) {
      if (a.date === b.date) return String(b.time).localeCompare(String(a.time));
      return a.date < b.date ? 1 : -1;
    });
    return rows.slice(0, 10).map(function (row) {
      return Object.assign({ when: formatTableDate(row.date, todayIso) }, row);
    });
  }

  function renderTable(rows) {
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="4">No demo transactions to show.</td></tr>';
      return;
    }
    tableBody.innerHTML = rows.map(function (row) {
      var amountClass = row.direction === "out" || row.amount < 0 ? "is-out" : "is-in";
      var amount = formatMoney(row.amount);
      return (
        "<tr>" +
          "<td>" +
            '<span class="table-when">' + escapeText(row.when) + (row.time ? ", " + escapeText(formatTime(row.time)) : "") + "</span>" +
          "</td>" +
          "<td>" +
            "<strong>" + escapeText(row.title) + "</strong>" +
            '<span class="table-desc">' + escapeText(row.description) + "</span>" +
          "</td>" +
          "<td>" + escapeText(row.source) + "</td>" +
          '<td class="table-amount ' + amountClass + '">' + escapeText(amount) + "</td>" +
        "</tr>"
      );
    }).join("");
    if (tableNote) {
      tableNote.textContent = "A sample of the latest demo orders and bank lines — not a complete statement.";
    }
  }

  function findMeta(id) {
    return (catalogue.businesses || []).find(function (b) { return b.id === id; }) || catalogue.businesses[0];
  }

  function render(businessId) {
    var meta = findMeta(businessId);
    currentId = meta.id;
    select.value = meta.id;
    try {
      window.localStorage.setItem(STORAGE_KEY, meta.id);
    } catch (err) {
      /* ignore */
    }

    agentName.textContent = meta.agent && meta.agent.name ? meta.agent.name : meta.name;
    agentStatus.textContent = (meta.agent && meta.agent.status) || "Active";
    agentManaged.textContent = (meta.agent && meta.agent.managedBy) || "Managed by your AI agent";
    agentSince.textContent = meta.agent && meta.agent.since ? "With you since " + meta.agent.since : "";
    businessType.textContent = meta.type || meta.name;
    if (overviewDate) overviewDate.textContent = catalogue.todayLabel || "Today";

    var token = (renderToken += 1);

    Promise.all([
      connectors.listServices(meta.id),
      connectors.getShopifySales(meta.id),
      connectors.getBankTransactions(meta.id),
      connectors.getStripePayments(meta.id),
      connectors.getSquareSales(meta.id),
      connectors.getXeroInvoices(meta.id)
    ]).then(function (results) {
      if (token !== renderToken) return;
      var services = results[0].services;
      var shopify = results[1];
      var bank = results[2];
      renderServices(services);

      var todayIso = catalogue.today;
      var yesterdayIso = previousDate(todayIso);
      var salesByDay = dailyMap(shopify.daily, "total");
      var ordersByDay = dailyMap(shopify.daily, "orderCount");
      var bankByDay = dailyMap(bank.dailyIn, "total");

      var revenueToday = Number(salesByDay[todayIso]) || 0;
      var revenueYesterday = Number(salesByDay[yesterdayIso]) || 0;
      var ordersToday = Number(ordersByDay[todayIso]) || 0;
      var ordersYesterday = Number(ordersByDay[yesterdayIso]) || 0;
      var moneyInToday = Number(bankByDay[todayIso]) || 0;
      var moneyInYesterday = Number(bankByDay[yesterdayIso]) || 0;
      var aovToday = ordersToday ? revenueToday / ordersToday : 0;
      var aovYesterday = ordersYesterday ? revenueYesterday / ordersYesterday : 0;

      var flavor = meta.flavor || {};
      var unit = flavor.unit || "order";
      var units = flavor.unitPlural || "orders";

      renderKpis([
        {
          label: "Revenue today",
          value: formatMoney(revenueToday),
          change: pctChange(revenueToday, revenueYesterday)
        },
        {
          label: "Money in today",
          value: formatMoney(moneyInToday),
          change: pctChange(moneyInToday, moneyInYesterday)
        },
        {
          label: plural(ordersToday, unit, units).replace(/^./, function (c) { return c.toUpperCase(); }) + " today",
          value: String(ordersToday),
          isCount: true,
          change: pctChange(ordersToday, ordersYesterday)
        },
        {
          label: "Average " + unit,
          value: formatMoney(aovToday),
          change: pctChange(aovToday, aovYesterday)
        }
      ]);

      var overview = buildDailyOverview({
        businessName: meta.shortName || meta.name,
        type: meta.type,
        unit: unit,
        unitPlural: units,
        salesNoun: flavor.salesNoun,
        busyHint: flavor.busyHint,
        lagHint: flavor.lagHint,
        weekday: "Saturday",
        revenueToday: revenueToday,
        revenueYesterday: revenueYesterday,
        moneyInToday: moneyInToday,
        moneyInYesterday: moneyInYesterday,
        ordersToday: ordersToday,
        ordersYesterday: ordersYesterday,
        aovToday: aovToday,
        aovYesterday: aovYesterday
      });
      overviewBody.textContent = overview.body;
      overviewSuggestions.innerHTML = overview.suggestions.map(function (item) {
        return "<li>" + escapeText(item) + "</li>";
      }).join("");

      var dates = {};
      (shopify.daily || []).forEach(function (row) { dates[row.date] = true; });
      (bank.dailyIn || []).forEach(function (row) { dates[row.date] = true; });
      var series = Object.keys(dates).sort().map(function (date) {
        return {
          date: date,
          shopify: Number(salesByDay[date]) || 0,
          bank: Number(bankByDay[date]) || 0
        };
      });
      renderChart(series, todayIso);
      renderTable(mergeActivity(shopify.orders, bank.transactions, todayIso));
    }).catch(function (err) {
      if (token !== renderToken) return;
      overviewBody.textContent = "The demo figures could not be loaded for this preview.";
      overviewSuggestions.innerHTML = "";
      if (typeof console !== "undefined" && console.error) console.error(err);
    });
  }

  function getFocusable(root) {
    return Array.prototype.slice.call(
      root.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.hasAttribute("disabled") && el.offsetParent !== null;
    });
  }

  function openModal(service) {
    pendingService = service;
    lastFocus = document.activeElement;
    modalTitle.textContent = "Connect " + service.name;
    modalBody.textContent =
      "This is a preview, so no real " + service.name +
      " account is connected and no sign-in takes place. In the finished service you would be asked to confirm access, then demo status would be replaced by a live connection.";
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    if (modalDialog) modalDialog.focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  document.querySelectorAll("[data-modal-close]").forEach(function (button) {
    button.addEventListener("click", closeModal);
  });

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (!modal || !modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab" || !modalDialog) return;
    var nodes = getFocusable(modalDialog);
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (modalConfirm) {
    modalConfirm.addEventListener("click", function () {
      if (!pendingService || !currentId) {
        closeModal();
        return;
      }
      connectors.connectService(currentId, pendingService.id).then(function () {
        render(currentId);
        closeModal();
      });
    });
  }

  connectors.listBusinesses().then(function (list) {
    catalogue = list;
    if (demoBadge && list.demoLabel) demoBadge.textContent = list.demoLabel;

    list.businesses.forEach(function (business) {
      var option = document.createElement("option");
      option.value = business.id;
      option.textContent = business.name;
      select.appendChild(option);
    });

    var startId = list.businesses[0].id;
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && list.businesses.some(function (b) { return b.id === saved; })) {
        startId = saved;
      }
    } catch (err) {
      /* ignore */
    }

    select.addEventListener("change", function () {
      render(select.value);
    });

    render(startId);
  });
})();
