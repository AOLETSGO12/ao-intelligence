/**
 * Progressive Web App helpers: service worker registration, install prompt,
 * an iOS “Add to Home Screen” sheet, and a standalone tab bar.
 */
(function () {
  "use strict";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" }).catch(function () {
        /* Registration can fail on file:// pages; ignore in the prototype. */
      });
    });
  }

  function isIos() {
    var ua = window.navigator.userAgent || "";
    var isIpadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || isIpadOs;
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  var deferredPrompt = null;
  var buttons = [];

  function showButtons() {
    buttons.forEach(function (btn) {
      btn.hidden = false;
      btn.removeAttribute("hidden");
    });
  }

  function hideButtons() {
    buttons.forEach(function (btn) {
      btn.hidden = true;
    });
  }

  function ensureSheet() {
    var existing = document.getElementById("install-sheet");
    if (existing) return existing;

    var backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.id = "install-sheet";
    backdrop.setAttribute("role", "presentation");
    backdrop.innerHTML =
      '<div class="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-sheet-title" tabindex="-1">' +
        "<h2 id=\"install-sheet-title\">Install AO Intelligence</h2>" +
        "<p>On iPhone and iPad, add this preview to your Home Screen from Safari.</p>" +
        '<ol class="install-steps">' +
          "<li><span class=\"step-num\" aria-hidden=\"true\">1</span><span>Tap the <strong>Share</strong> button — the square with an arrow pointing up — at the bottom of Safari.</span></li>" +
          "<li><span class=\"step-num\" aria-hidden=\"true\">2</span><span>Scroll the list and tap <strong>Add to Home Screen</strong>.</span></li>" +
          "<li><span class=\"step-num\" aria-hidden=\"true\">3</span><span>Tap <strong>Add</strong> in the top right. The app icon will appear on your Home Screen.</span></li>" +
        "</ol>" +
        '<div class="modal-actions">' +
          '<button class="btn btn-primary" type="button" data-sheet-close>Got it</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(backdrop);

    function closeSheet() {
      backdrop.classList.remove("is-open");
      document.body.classList.remove("modal-open");
      var opener = backdrop._opener;
      if (opener && typeof opener.focus === "function") opener.focus();
    }

    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) closeSheet();
    });
    backdrop.querySelector("[data-sheet-close]").addEventListener("click", closeSheet);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && backdrop.classList.contains("is-open")) {
        event.preventDefault();
        closeSheet();
      }
    });
    return backdrop;
  }

  function openSheet(opener) {
    var backdrop = ensureSheet();
    backdrop._opener = opener || document.activeElement;
    backdrop.classList.add("is-open");
    document.body.classList.add("modal-open");
    var dialog = backdrop.querySelector(".install-sheet");
    if (dialog) dialog.focus();
  }

  function onInstallClick(event) {
    var opener = event.currentTarget;
    var nav = document.querySelector("[data-nav]");
    var toggle = document.querySelector("[data-nav-toggle]");
    if (nav) {
      nav.classList.remove("is-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
    if (deferredPrompt) {
      var promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      promptEvent.userChoice.finally(function () {
        hideButtons();
      });
      return;
    }
    if (isIos() && !isStandalone()) {
      openSheet(opener);
    }
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone()) showButtons();
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideButtons();
  });

  document.querySelectorAll("[data-install-app]").forEach(function (btn) {
    buttons.push(btn);
    btn.addEventListener("click", onInstallClick);
  });

  if (isIos() && !isStandalone() && buttons.length) {
    showButtons();
  }

  /* Standalone mobile tab bar */
  if (isStandalone()) {
    document.documentElement.classList.add("is-standalone");
    document.body.classList.add("is-standalone");

    if (!document.querySelector(".app-tabbar")) {
      var nav = document.createElement("nav");
      nav.className = "app-tabbar";
      nav.setAttribute("aria-label", "App");
      var path = (window.location.pathname || "").split("/").pop() || "index.html";
      var hash = window.location.hash || "";
      function item(href, label, key, icon) {
        var current = false;
        if (key === "overview") current = path === "dashboard.html" && hash !== "#settings";
        if (key === "business") current = path === "business.html";
        if (key === "settings") current = path === "dashboard.html" && hash === "#settings";
        return (
          '<a href="' + href + '"' + (current ? ' aria-current="page"' : "") + ">" +
            icon + "<span>" + label + "</span>" +
          "</a>"
        );
      }
      var overviewIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>';
      var businessIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9l8-5 8 5v10"/><path d="M9 19v-6h6v6"/></svg>';
      var settingsIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 5V3M12 21v-2M5 12H3M21 12h-2M6.6 6.6 5.2 5.2M18.8 18.8l-1.4-1.4M6.6 17.4 5.2 18.8M18.8 5.2l-1.4 1.4"/></svg>';
      nav.innerHTML =
        item("dashboard.html", "Overview", "overview", overviewIcon) +
        item("business.html", "Business", "business", businessIcon) +
        item("dashboard.html#settings", "Settings", "settings", settingsIcon);
      document.body.appendChild(nav);
    }
  }
})();
