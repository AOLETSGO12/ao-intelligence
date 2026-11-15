(function () {
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

  var data = window.DEMO_DATA;
  if (!data || !data.businesses || !data.businesses.length) {
    return;
  }

  var select = document.getElementById("business-select");
  var demoBadge = document.getElementById("demo-badge");
  var agentName = document.getElementById("agent-name");
  var agentStatus = document.getElementById("agent-status");
  var agentManaged = document.getElementById("agent-managed");
  var agentSince = document.getElementById("agent-since");
  var businessType = document.getElementById("business-type");
  var overviewIntro = document.getElementById("overview-intro");
  var overviewDate = document.getElementById("overview-date");
  var overviewGrid = document.getElementById("overview-grid");
  var emailList = document.getElementById("email-list");
  var activityList = document.getElementById("activity-list");
  var digestTime = document.getElementById("digest-time");
  var digestAddress = document.getElementById("digest-address");
  var notifyReplies = document.getElementById("notify-replies");
  var notifyInvoices = document.getElementById("notify-invoices");
  var notifyBookings = document.getElementById("notify-bookings");
  var settingsForm = document.getElementById("settings-form");
  var settingsSuccess = document.getElementById("settings-success");

  var modal = document.getElementById("link-modal");
  var modalTitle = document.getElementById("link-modal-title");
  var modalBody = document.getElementById("link-modal-body");
  var modalConfirm = document.getElementById("link-modal-confirm");
  var modalDialog = modal ? modal.querySelector(".modal") : null;
  var lastFocus = null;
  var pendingProvider = "Gmail";

  var STORAGE_KEY = "ao-intelligence-demo-business";
  var currentId = null;

  if (demoBadge && data.demoLabel) {
    demoBadge.textContent = data.demoLabel;
  }
  if (overviewDate && data.overviewDateLabel) {
    overviewDate.textContent = data.overviewDateLabel;
  }

  data.businesses.forEach(function (business) {
    var option = document.createElement("option");
    option.value = business.id;
    option.textContent = business.name;
    select.appendChild(option);
  });

  try {
    var saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && data.businesses.some(function (b) { return b.id === saved; })) {
      select.value = saved;
    }
  } catch (err) {
    /* localStorage may be unavailable; ignore */
  }

  function findBusiness(id) {
    return data.businesses.find(function (b) { return b.id === id; }) || data.businesses[0];
  }

  function escapeText(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function render(id) {
    var business = findBusiness(id);
    currentId = business.id;
    select.value = business.id;

    try {
      window.localStorage.setItem(STORAGE_KEY, business.id);
    } catch (err) {
      /* ignore */
    }

    agentName.textContent = business.agent.name;
    agentStatus.textContent = business.agent.status;
    agentManaged.textContent = business.agent.managedBy;
    agentSince.textContent = business.agent.since ? "With you since " + business.agent.since : "";
    businessType.textContent = business.type || business.name;
    overviewIntro.textContent = business.overview.intro;

    overviewGrid.innerHTML = business.overview.categories.map(function (category) {
      return (
        '<article class="overview-card dash-card tone-' + escapeText(category.tone) + '">' +
          "<header>" +
            "<h3>" + escapeText(category.label) + "</h3>" +
            '<span class="count-pill">' + escapeText(category.count) + "</span>" +
          "</header>" +
          "<p>" + escapeText(category.summary) + "</p>" +
        "</article>"
      );
    }).join("");

    emailList.innerHTML = business.emails.map(function (account) {
      return (
        '<li class="email-item">' +
          "<div>" +
            "<strong>" + escapeText(account.address) + "</strong>" +
            "<span>" + escapeText(account.provider) + " · " + escapeText(account.status) +
            (account.linkedOn ? " · Linked " + escapeText(account.linkedOn) : "") + "</span>" +
          "</div>" +
        "</li>"
      );
    }).join("");

    activityList.innerHTML = business.activity.map(function (item) {
      return (
        '<li class="activity-item">' +
          "<time>" + escapeText(item.time) + "</time>" +
          "<h3>" + escapeText(item.title) + "</h3>" +
          "<p>" + escapeText(item.detail) + "</p>" +
        "</li>"
      );
    }).join("");

    digestTime.value = business.settings.digestTime || "";
    digestAddress.value = business.settings.digestAddress || "";
    notifyReplies.checked = !!business.settings.notifyReplies;
    notifyInvoices.checked = !!business.settings.notifyInvoices;
    notifyBookings.checked = !!business.settings.notifyBookings;

    if (settingsSuccess) {
      settingsSuccess.classList.remove("is-visible");
    }
  }

  select.addEventListener("change", function () {
    render(select.value);
  });

  if (settingsForm) {
    settingsForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var business = findBusiness(currentId);
      business.settings.digestTime = digestTime.value;
      business.settings.digestAddress = digestAddress.value;
      business.settings.notifyReplies = notifyReplies.checked;
      business.settings.notifyInvoices = notifyInvoices.checked;
      business.settings.notifyBookings = notifyBookings.checked;
      if (settingsSuccess) {
        settingsSuccess.classList.add("is-visible");
        settingsSuccess.focus();
      }
    });
  }

  function getFocusable(root) {
    return Array.prototype.slice.call(
      root.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.hasAttribute("disabled") && el.offsetParent !== null;
    });
  }

  function openModal(provider) {
    pendingProvider = provider;
    lastFocus = document.activeElement;
    modalTitle.textContent = "Link " + provider;
    modalBody.textContent =
      "This is a preview, so no real " + provider +
      " account is connected. In the finished service you would be asked to confirm access, then the inbox would appear in the list below.";
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    if (modalDialog) modalDialog.focus();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.classList.remove("modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  document.querySelectorAll("[data-link-provider]").forEach(function (button) {
    button.addEventListener("click", function () {
      openModal(button.getAttribute("data-link-provider") || "email");
    });
  });

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
      var business = findBusiness(currentId);
      var next = business.emails.length + 1;
      var domain = business.id.replace(/-/g, "") + ".example";
      business.emails.push({
        id: business.id + "-new-" + next,
        address: "new-" + next + "@" + domain,
        provider: pendingProvider,
        status: "Connected (preview)",
        linkedOn: "just now"
      });
      render(currentId);
      closeModal();
    });
  }

  render(select.value || data.businesses[0].id);
})();
