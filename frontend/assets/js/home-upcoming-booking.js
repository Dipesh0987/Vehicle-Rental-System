/**
 * Home page "Upcoming Booking" toast.
 * When a logged-in user visits the home page and has an upcoming (confirmed/pending)
 * booking whose start_date >= today, a sleek toast slides in at the bottom-right
 * for ~10 seconds then auto-dismisses. Clicking it opens the bookings panel.
 */
(function () {
  "use strict";

  var TOAST_ID = "homeUpcomingBookingToast";
  var DISPLAY_DURATION_MS = 10000;
  var ANIMATION_MS = 400;
  var DISMISSED_KEY = "vrs:upcoming-toast-dismissed:v1";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(isoDate) {
    var text = String(isoDate || "").trim();
    if (!text) return "-";
    var d = new Date(text.length === 10 ? text + "T00:00:00" : text);
    if (Number.isNaN(d.getTime())) return text;
    try {
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (_e) {
      return text;
    }
  }

  function daysUntil(isoDate) {
    var text = String(isoDate || "").trim();
    if (!text) return null;
    var target = new Date(text.length === 10 ? text + "T00:00:00" : text);
    if (Number.isNaN(target.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function wasDismissedRecently(bookingId) {
    try {
      var raw = sessionStorage.getItem(DISMISSED_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      return data.id === bookingId && Date.now() - data.ts < 300000;
    } catch (_e) {
      return false;
    }
  }

  function markDismissed(bookingId) {
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify({ id: bookingId, ts: Date.now() }));
    } catch (_e) { /* ignore */ }
  }

  function removeToast() {
    var el = document.getElementById(TOAST_ID);
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, ANIMATION_MS);
  }

  function buildToast(booking) {
    var days = daysUntil(booking.startDate);
    var daysLabel = "";
    if (days === 0) daysLabel = "Today";
    else if (days === 1) daysLabel = "Tomorrow";
    else if (days !== null && days > 0) daysLabel = "In " + days + " days";
    else daysLabel = formatDate(booking.startDate);

    var toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.className = "vrs-upcoming-toast";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";

    toast.innerHTML = [
      '<div class="vrs-upcoming-toast-inner">',
      '  <div class="vrs-upcoming-toast-icon">',
      '    <span class="material-symbols-outlined">directions_car</span>',
      '  </div>',
      '  <div class="vrs-upcoming-toast-body">',
      '    <p class="vrs-upcoming-toast-title">Upcoming Booking</p>',
      '    <p class="vrs-upcoming-toast-detail">',
      '      <strong>' + escapeHtml(booking.vehicleName || "Vehicle") + '</strong>',
      '      <span class="vrs-upcoming-toast-sep">&middot;</span>',
      '      <span>' + escapeHtml(daysLabel) + '</span>',
      '      <span class="vrs-upcoming-toast-sep">&middot;</span>',
      '      <span>' + escapeHtml(formatDate(booking.startDate)) + ' \u2192 ' + escapeHtml(formatDate(booking.endDate)) + '</span>',
      '    </p>',
      '    <p class="vrs-upcoming-toast-code">' + escapeHtml(booking.bookingCode) + '</p>',
      '  </div>',
      '  <button type="button" class="vrs-upcoming-toast-close" aria-label="Dismiss" title="Dismiss">&times;</button>',
      '</div>',
    ].join("\n");

    return toast;
  }

  function showToast(booking) {
    if (document.getElementById(TOAST_ID)) return;

    var toast = buildToast(booking);
    document.body.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
      });
    });

    // Close button
    var closeBtn = toast.querySelector(".vrs-upcoming-toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        markDismissed(booking.id);
        removeToast();
      });
    }

    // Click to open bookings panel
    toast.addEventListener("click", function () {
      if (window.VehicleAuthUI && typeof window.VehicleAuthUI.openBookingsPanel === "function") {
        window.VehicleAuthUI.openBookingsPanel({ bookingId: booking.id });
      }
      removeToast();
    });

    // Auto-dismiss
    setTimeout(removeToast, DISPLAY_DURATION_MS);
  }

  async function init() {
    // Wait a moment for auth to settle
    await new Promise(function (r) { setTimeout(r, 300); });

    var authService = window.VehicleAuthService;
    var bookingService = window.VehicleBookingService;

    if (!authService || !bookingService) return;
    if (typeof authService.getSession !== "function") return;
    if (typeof bookingService.listBookings !== "function") return;

    var session;
    try {
      session = await authService.getSession();
    } catch (_e) {
      return;
    }
    if (!session || !session.user) return;

    var bookings;
    try {
      bookings = await bookingService.listBookings({
        rangeStart: new Date().toISOString().slice(0, 10),
      });
    } catch (_e) {
      return;
    }

    if (!Array.isArray(bookings) || !bookings.length) return;

    // Find the nearest upcoming (pending/confirmed) booking
    var today = new Date().toISOString().slice(0, 10);
    var upcoming = bookings
      .filter(function (b) {
        return (b.status === "confirmed" || b.status === "pending") && b.startDate >= today;
      })
      .sort(function (a, b) {
        return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0;
      });

    if (!upcoming.length) return;

    var nearest = upcoming[0];
    if (wasDismissedRecently(nearest.id)) return;

    showToast(nearest);
  }

  window.HomeUpcomingBooking = {
    init: init,
  };
})();
