/**
 * Progressive Web App helpers: service worker registration, install prompt,
 * and an iOS “Add to Home Screen” sheet. The Home Screen app is the same
 * product as Safari — no separate layout, tab bar or demo pages.
 */
(function () {
  "use strict";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" }).catch(function () {
        /* Registration can fail on file:// pages; ignore. */
      });
    });
  }

  function isIos() {
    var ua = window.navigator.userAgent || "";
    var isIpadOs = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || isIpadOs;
  }

  function isStandalone() {
    return (window.AOHandoff && window.AOHandoff.isStandalone && window.AOHandoff.isStandalone()) ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  var deferredPrompt = null;
  var buttons = [];

  function showButtons() {
    if (isStandalone()) return;
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

  function hasDashboards() {
    try { return !!(window.AOStore && window.AOStore.hasDashboards && window.AOStore.hasDashboards()); }
    catch (e) { return false; }
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
        "<h2 id=\"install-sheet-title\">Use on your Home Screen</h2>" +
        "<p>The Home Screen app is the same as this one in Safari. On iPhone, Safari keeps its data separately, so you’ll use a short code to bring your dashboards across.</p>" +
        '<div id="install-code-wrap" class="handoff-block"></div>' +
        '<ol class="install-steps">' +
          "<li><span class=\"step-num\" aria-hidden=\"true\">1</span><span>Create a code above, if you already use AO Intelligence in Safari.</span></li>" +
          "<li><span class=\"step-num\" aria-hidden=\"true\">2</span><span>Tap the <strong>Share</strong> button — the square with an arrow pointing up — at the bottom of Safari.</span></li>" +
          "<li><span class=\"step-num\" aria-hidden=\"true\">3</span><span>Scroll the list and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</span></li>" +
          "<li><span class=\"step-num\" aria-hidden=\"true\">4</span><span>Open the new icon and choose <strong>Already set up in Safari?</strong> to type your code.</span></li>" +
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

  function fillCodeWrap() {
    var wrap = document.getElementById("install-code-wrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (isStandalone() || !window.AOHandoff) return;
    if (!hasDashboards()) {
      wrap.innerHTML = "<p class=\"handoff-note\">If you haven’t set up a dashboard yet, add the app first, then open it and follow Get started.</p>";
      return;
    }
    var status = document.createElement("p");
    status.className = "handoff-note";
    status.id = "install-code-status";
    var btn = document.createElement("button");
    btn.className = "btn btn-secondary";
    btn.type = "button";
    btn.textContent = "Create a code";
    var codeEl = document.createElement("p");
    codeEl.className = "handoff-code";
    codeEl.hidden = true;
    var copyBtn = document.createElement("button");
    copyBtn.className = "btn btn-ghost btn-small";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy code";
    copyBtn.hidden = true;
    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = "Creating a code…";
      status.textContent = "";
      window.AOHandoff.createCode().then(function (r) {
        codeEl.hidden = false;
        codeEl.textContent = r.code;
        copyBtn.hidden = false;
        copyBtn._code = r.code;
        status.textContent = "This code works for 10 minutes and can be used once. Add the app to your Home Screen, open it, and type the code there.";
        btn.textContent = "Create a new code";
        btn.disabled = false;
      }).catch(function (e) {
        status.textContent = (e && e.message) || "That didn’t work. Please try again.";
        btn.disabled = false;
        btn.textContent = "Create a code";
      });
    });
    copyBtn.addEventListener("click", function () {
      var c = copyBtn._code;
      if (!c || !window.AOStore || !window.AOStore.copyText) return;
      window.AOStore.copyText(c).then(function () { copyBtn.textContent = "Copied"; }, function () { copyBtn.textContent = "Copy code"; });
    });
    wrap.appendChild(btn);
    wrap.appendChild(codeEl);
    wrap.appendChild(copyBtn);
    wrap.appendChild(status);
  }

  function openSheet(opener) {
    var backdrop = ensureSheet();
    backdrop._opener = opener || document.activeElement;
    fillCodeWrap();
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

  if (isStandalone()) {
    hideButtons();
    document.documentElement.classList.add("is-standalone");
    if (document.body) document.body.classList.add("is-standalone");
  } else if (isIos() && buttons.length) {
    showButtons();
  }

  window.AOInstall = { openSheet: openSheet, isStandalone: isStandalone, isIos: isIos };
})();
