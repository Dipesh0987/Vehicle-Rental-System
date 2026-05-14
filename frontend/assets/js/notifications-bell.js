/**
 * Notifications bell - injects a bell + dropdown into the existing
 * `[data-auth-user]` container of every public page that has the auth chrome.
 *
 * Public API (window.VehicleNotificationsBell):
 *   mount()    - ensure DOM is in place + run an initial refresh
 *   refresh()  - re-fetch the unread count and the recent list
 *   unmount()  - hide and detach the bell (called on sign-out)
 *
 * Designed to be safe to call multiple times. Idempotent on mount.
 */
(function () {
  "use strict";

  var BELL_CONTAINER_ID = "vrsNotificationsBell";
  var DROPDOWN_ID = "vrsNotificationsBellDropdown";
  var POLL_INTERVAL_MS = 60 * 1000;

  var state = {
    mounted: false,
    pollHandle: null,
    unsubscribe: null,
    lastCount: 0,
    lastList: [],
    open: false,
    refreshing: false,
  };

  function ensureBellInside(container) {
    if (!container) return null;
    var existing = container.querySelector("#" + BELL_CONTAINER_ID);
    if (existing) return existing;

    var wrap = document.createElement("div");
    wrap.id = BELL_CONTAINER_ID;
    wrap.className = "vrs-bell-wrap relative inline-flex items-center";
    wrap.innerHTML = [
      '<button type="button" data-bell-trigger',
      '  class="vrs-bell-button relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d3ddd7] bg-white text-[#143236] transition hover:-translate-y-[1px] hover:border-[#c1d3cb] hover:bg-[#f4faf7]"',
      '  aria-label="Notifications" aria-haspopup="true" aria-expanded="false">',
      '  <span class="material-symbols-outlined">notifications</span>',
      '  <span data-bell-badge class="vrs-bell-badge hidden absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">0</span>',
      '</button>',
      '<div id="' + DROPDOWN_ID + '" data-bell-dropdown class="vrs-bell-dropdown hidden">',
      '  <div class="vrs-bell-header">',
      '    <span class="vrs-bell-heading">',
      '      Notifications',
      '      <span data-bell-header-badge class="vrs-bell-badge-inline" style="display:none">0</span>',
      '    </span>',
      '    <button type="button" data-bell-mark-all class="vrs-bell-mark-all" style="display:none" title="Mark all as read" aria-label="Mark all as read">',
      '      <span class="material-symbols-outlined">done_all</span>',
      '    </button>',
      '  </div>',
      '  <div data-bell-list class="vrs-bell-list"></div>',
      '</div>',
    ].join("");

    // Place the bell BEFORE the profile trigger so the order on screen is
    // [bell] [profile chip].
    var profileTrigger = container.querySelector("[data-profile-trigger]");
    if (profileTrigger) {
      container.insertBefore(wrap, profileTrigger);
    } else {
      container.appendChild(wrap);
    }

    wireDropdown(wrap);
    return wrap;
  }

  function wireDropdown(wrap) {
    var trigger = wrap.querySelector("[data-bell-trigger]");
    var dropdown = wrap.querySelector("[data-bell-dropdown]");
    var markAllBtn = wrap.querySelector("[data-bell-mark-all]");

    if (trigger) {
      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleDropdown();
      });
    }
    if (markAllBtn) {
      markAllBtn.addEventListener("click", async function (event) {
        event.stopPropagation();
        try {
          if (window.VehicleNotificationService) {
            await window.VehicleNotificationService.markAllRead();
          }
          await refresh();
        } catch (_e) { /* ignore */ }
      });
    }

    if (dropdown) {
      dropdown.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    }

    document.addEventListener("click", function () {
      if (state.open) closeDropdown();
    });
  }

  function toggleDropdown() {
    if (state.open) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function openDropdown() {
    var wrap = document.getElementById(BELL_CONTAINER_ID);
    if (!wrap) return;
    var dropdown = wrap.querySelector("[data-bell-dropdown]");
    var trigger = wrap.querySelector("[data-bell-trigger]");
    if (!dropdown) return;

    dropdown.classList.remove("hidden");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    state.open = true;
    void refresh();
  }

  function closeDropdown() {
    var wrap = document.getElementById(BELL_CONTAINER_ID);
    if (!wrap) return;
    var dropdown = wrap.querySelector("[data-bell-dropdown]");
    var trigger = wrap.querySelector("[data-bell-trigger]");
    if (!dropdown) return;
    dropdown.classList.add("hidden");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    state.open = false;
  }

  function setBadge(count) {
    var wrap = document.getElementById(BELL_CONTAINER_ID);
    if (!wrap) return;
    var badge = wrap.querySelector("[data-bell-badge]");
    var markAllBtn = wrap.querySelector("[data-bell-mark-all]");

    state.lastCount = Number(count) || 0;
    if (badge) {
      if (state.lastCount > 0) {
        badge.classList.remove("hidden");
        badge.textContent = state.lastCount > 99 ? "99+" : String(state.lastCount);
      } else {
        badge.classList.add("hidden");
      }
    }
    // Also update the in-header badge to match admin style
    var wrap2 = document.getElementById(BELL_CONTAINER_ID);
    var headerBadge = wrap2 ? wrap2.querySelector("[data-bell-header-badge]") : null;
    if (headerBadge) {
      headerBadge.textContent = state.lastCount > 99 ? "99+" : String(state.lastCount);
      headerBadge.style.display = state.lastCount > 0 ? "inline-flex" : "none";
    }
    if (markAllBtn) {
      markAllBtn.style.display = state.lastCount > 0 ? "inline-flex" : "none";
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatRelative(iso) {
    var ms = Date.parse(String(iso || ""));
    if (!Number.isFinite(ms)) return "";
    var diff = Date.now() - ms;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + "d ago";
    try {
      return new Date(ms).toLocaleDateString();
    } catch (_e) { return ""; }
  }

  function formatAbsoluteDateTime(iso) {
    var ms = Date.parse(String(iso || ""));
    if (!Number.isFinite(ms)) return "";
    try {
      return new Date(ms).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (_e) { return ""; }
  }

  function renderSection(label, items) {
    var rows = items.map(renderItem).join("");
    return [
      '<div class="vrs-bell-section pt-3">',
      '  <p class="vrs-bell-section-label px-5 pb-2 pt-1 text-[15px] font-semibold leading-tight text-[#14373b]">' + escapeHtml(label) + '</p>',
      rows,
      '</div>',
    ].join("");
  }

  function renderItem(n) {
    var unread = !n.read_at;
    var iconName = pickIcon(n.type);
    var iconHex  = pickIconHex(n.type);
    var absoluteTime = formatAbsoluteDateTime(n.created_at);
    var relativeTime = formatRelative(n.created_at) || absoluteTime;
    return [
      '<button type="button" data-bell-item="' + escapeHtml(n.id) + '"',
      '  title="' + escapeHtml(absoluteTime) + '"',
      '  class="vrs-bell-item ' + (unread ? "is-unread " : "") + '">',
      '  <span class="material-symbols-outlined vrs-bell-item-icon" style="color:' + escapeHtml(iconHex) + '">' + escapeHtml(iconName) + '</span>',
      '  <span class="vrs-bell-item-content">',
      '    <span class="vrs-bell-item-title">' + escapeHtml(n.title) + '</span>',
      '    <span class="vrs-bell-item-body">' + escapeHtml(n.body) + '</span>',
      '    <span class="vrs-bell-item-time">' + escapeHtml(relativeTime) + '</span>',
      '  </span>',
      '  <span class="material-symbols-outlined vrs-bell-chevron">chevron_right</span>',
      '</button>',
    ].join("");
  }

  function renderList(items) {
    var wrap = document.getElementById(BELL_CONTAINER_ID);
    if (!wrap) return;
    var list = wrap.querySelector("[data-bell-list]");
    if (!list) return;

    state.lastList = Array.isArray(items) ? items.slice() : [];

    if (!state.lastList.length) {
      list.innerHTML =
        '<div class="flex flex-col items-center px-6 py-12 text-center">' +
        '<span class="material-symbols-outlined text-[40px] text-[#aabcb8]">notifications_off</span>' +
        '<p class="mt-3 text-[15px] font-semibold text-[#14373b]">No notifications yet</p>' +
        '<p class="mt-1.5 max-w-[300px] text-[13px] leading-snug text-[#54716f]">We will let you know about payments, receipts and booking updates here.</p>' +
        '</div>';
      return;
    }

    var unread = state.lastList.filter(function (n) { return !n.read_at; });
    var read = state.lastList.filter(function (n) { return Boolean(n.read_at); });

    var sections = "";
    if (unread.length) {
      sections += renderSection("Important", unread);
    }
    if (read.length) {
      sections += renderSection(unread.length ? "Earlier" : "Recent", read);
    }
    list.innerHTML = sections;

    var buttons = list.querySelectorAll("[data-bell-item]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", async function (event) {
        event.stopPropagation();
        var id = btn.getAttribute("data-bell-item");
        var item = state.lastList.find(function (n) { return n.id === id; });
        if (!item) return;

        try {
          if (window.VehicleNotificationService && !item.read_at) {
            await window.VehicleNotificationService.markRead([id]);
            item.read_at = new Date().toISOString();
          }
        } catch (_e) { /* ignore */ }

        // Refresh count immediately so the badge feels snappy.
        setBadge(Math.max(0, state.lastCount - (item.read_at ? 0 : 1)));
        renderList(state.lastList);
        handleNotificationActivation(item);
      });
    });
  }

  function pickIconHex(type) {
    switch (String(type || "")) {
      case "payment_success":
      case "booking_confirmed":
      case "receipt_sent":
      case "verification_approved":
        return "#10b981";
      case "payment_failed":
      case "payment_expired":
      case "verification_rejected":
        return "#ef4444";
      case "payment_due":
      case "payment_initiated":
      case "booking_created":
        return "#f59e0b";
      default:
        return "#64748b";
    }
  }

  function pickIcon(type) {
    switch (String(type || "")) {
      case "payment_success": return "task_alt";
      case "payment_failed": return "error";
      case "payment_expired": return "schedule";
      case "payment_initiated": return "credit_card";
      case "receipt_sent": return "mail";
      case "booking_confirmed": return "event_available";
      case "booking_created": return "directions_car";
      case "booking_status_changed": return "sync";
      case "payment_due": return "warning";
      case "admin_payment_alert": return "shield_person";
      case "verification_approved": return "verified_user";
      case "verification_rejected": return "gpp_bad";
      default: return "notifications";
    }
  }

  function pickTone(type) {
    switch (String(type || "")) {
      case "payment_success":
      case "booking_confirmed":
      case "receipt_sent":
      case "verification_approved":
        return "bg-emerald-50 text-emerald-700";
      case "payment_failed":
      case "payment_expired":
      case "verification_rejected":
        return "bg-rose-50 text-rose-700";
      case "payment_due":
      case "payment_initiated":
      case "booking_created":
        return "bg-amber-50 text-amber-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function handleNotificationActivation(item) {
    var url = String(item && item.link_url ? item.link_url : "").trim();
    var meta = (item && item.metadata) || {};
    var bookingId = meta.bookingId || "";
    var transactionCode = meta.transactionCode || "";
    var type = String(item && item.type ? item.type : "");

    // Verification decisions take the user to the profile-verification
    // page so they can either celebrate or fix and resubmit.
    if (type === "verification_approved" || type === "verification_rejected") {
      window.location.assign("profile-verification.html");
      return;
    }

    // booking_created / payment_failed / payment_expired / payment_due all
    // need the customer to take action - send them to the payment page so
    // they can pay (or retry).
    if (bookingId && (
      type === "booking_created"
      || type === "payment_failed"
      || type === "payment_expired"
      || type === "payment_due"
      || type === "payment_initiated"
    )) {
      window.location.assign("payment.html?booking=" + encodeURIComponent(bookingId));
      return;
    }

    // For every other booking-linked notification (confirmation, status
    // change, payment success, receipt sent) - open the bookings panel
    // directly and pre-select that booking. This is what the user expects:
    // "show booking directly".
    if (bookingId) {
      if (window.VehicleAuthUI && typeof window.VehicleAuthUI.openBookingsPanel === "function") {
        closeDropdown();
        window.VehicleAuthUI.openBookingsPanel({ bookingId: String(bookingId) });
        return;
      }
    }

    // No booking context but we have a transaction - jump to the receipt.
    if (transactionCode && (type === "payment_success" || type === "receipt_sent")) {
      window.location.assign("payment-receipt.html?payment=" + encodeURIComponent(transactionCode));
      return;
    }

    if (url) {
      var normalized = url.replace(/^\/frontend\//, "");
      try { window.location.assign(normalized || url); } catch (_e) { /* ignore */ }
    }
  }

  async function refresh() {
    if (state.refreshing) return;
    state.refreshing = true;

    try {
      if (!window.VehicleNotificationService) return;
      var [count, recent] = await Promise.all([
        window.VehicleNotificationService.countUnread(),
        window.VehicleNotificationService.listRecent(20),
      ]);
      setBadge(count);
      renderList(recent);
    } catch (_e) {
      // ignore - user may not be signed in or RLS may block reads.
    } finally {
      state.refreshing = false;
    }
  }

  function startPolling() {
    stopPolling();
    state.pollHandle = window.setInterval(function () {
      void refresh();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (state.pollHandle) {
      window.clearInterval(state.pollHandle);
      state.pollHandle = null;
    }
  }

  function startRealtime() {
    stopRealtime();
    if (!window.VehicleNotificationService) return;
    state.unsubscribe = window.VehicleNotificationService.subscribeToChanges(function () {
      void refresh();
    });
  }

  function stopRealtime() {
    if (state.unsubscribe) {
      try { state.unsubscribe(); } catch (_e) { /* ignore */ }
      state.unsubscribe = null;
    }
  }

  function mount() {
    if (state.mounted) {
      void refresh();
      return;
    }
    var container = document.querySelector("[data-auth-user]");
    if (!container) return;

    var wrap = ensureBellInside(container);
    if (!wrap) return;

    state.mounted = true;
    void refresh();
    startPolling();
    startRealtime();
  }

  function unmount() {
    var wrap = document.getElementById(BELL_CONTAINER_ID);
    if (wrap && wrap.parentNode) {
      wrap.parentNode.removeChild(wrap);
    }
    stopPolling();
    stopRealtime();
    state.mounted = false;
    state.lastCount = 0;
    state.lastList = [];
    state.open = false;
  }

  window.VehicleNotificationsBell = {
    mount: mount,
    unmount: unmount,
    refresh: refresh,
  };
})();
