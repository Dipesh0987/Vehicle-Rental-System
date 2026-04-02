(function () {
  "use strict";

  var STORAGE_KEY = "vrs:theme:mode";
  var ROOT_SWITCHING_CLASS = "vrs-theme-switching";

  function safeReadStorage() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  function safeWriteStorage(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function prefersDarkMode() {
    try {
      return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch (_error) {
      return false;
    }
  }

  function resolveTheme() {
    var stored = safeReadStorage();
    if (stored === "light" || stored === "dark") {
      return stored;
    }

    return prefersDarkMode() ? "dark" : "light";
  }

  function applyTheme(theme, options) {
    var opts = options || {};
    var normalized = theme === "dark" ? "dark" : "light";
    var root = document.documentElement;

    root.setAttribute("data-theme", normalized);
    root.classList.toggle("dark", normalized === "dark");

    if (opts.persist) {
      safeWriteStorage(normalized);
    }

    if (opts.animate) {
      root.classList.add(ROOT_SWITCHING_CLASS);
      window.setTimeout(function () {
        root.classList.remove(ROOT_SWITCHING_CLASS);
      }, 320);
    }

    syncThemeButtons();
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function toggleTheme() {
    var current = getCurrentTheme();
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next, { persist: true, animate: true });

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.classList.remove("is-switching");
      // Force reflow so quick successive toggles still animate.
      void button.offsetWidth;
      button.classList.add("is-switching");
      window.setTimeout(function () {
        button.classList.remove("is-switching");
      }, 320);
    });
  }

  function buildFloatingToggle() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "vrs-theme-toggle";
    button.setAttribute("data-theme-toggle", "true");
    button.innerHTML =
      '<span class="vrs-theme-toggle__track" aria-hidden="true"><span class="vrs-theme-toggle__thumb"></span></span>' +
      '<span class="vrs-theme-toggle__label">Theme</span>';
    return button;
  }

  function syncThemeButtons() {
    var current = getCurrentTheme();
    var nextLabel = current === "dark" ? "Switch to light mode" : "Switch to dark mode";
    var compactLabel = current === "dark" ? "Dark" : "Light";

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.setAttribute("aria-label", nextLabel);
      button.setAttribute("title", nextLabel);
      button.setAttribute("aria-pressed", current === "dark" ? "true" : "false");

      var label = button.querySelector(".vrs-theme-toggle__label");
      if (label) {
        label.textContent = compactLabel;
      }
    });
  }

  function bindThemeButtons() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      if (button.dataset.listenerBound === "true") {
        return;
      }

      button.dataset.listenerBound = "true";
      button.addEventListener("click", function () {
        toggleTheme();
      });
    });
  }

  function ensureFloatingToggle() {
    if (document.querySelector("[data-theme-toggle]")) {
      return;
    }

    if (!document.body) {
      return;
    }

    document.body.appendChild(buildFloatingToggle());
  }

  function watchSystemPreference() {
    if (!window.matchMedia) {
      return;
    }

    var media = window.matchMedia("(prefers-color-scheme: dark)");
    var handler = function (event) {
      var stored = safeReadStorage();
      if (stored === "light" || stored === "dark") {
        return;
      }

      applyTheme(event.matches ? "dark" : "light", { persist: false, animate: true });
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler);
      return;
    }

    if (typeof media.addListener === "function") {
      media.addListener(handler);
    }
  }

  function init() {
    applyTheme(resolveTheme(), { persist: false, animate: false });
    ensureFloatingToggle();
    bindThemeButtons();
    syncThemeButtons();
    watchSystemPreference();
  }

  // Apply as early as possible to reduce theme flash.
  applyTheme(resolveTheme(), { persist: false, animate: false });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.VRSTheme = {
    init: init,
    applyTheme: function (theme) {
      applyTheme(theme, { persist: true, animate: true });
    },
    toggleTheme: toggleTheme,
    getTheme: getCurrentTheme,
  };
})();
