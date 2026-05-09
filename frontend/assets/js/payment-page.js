/**
 * Payment selection page.
 * Reads ?booking=<uuid> from the URL, fetches the booking, lets the user
 * choose 60% advance or 100% upfront, shows a countdown to the 15-minute
 * payment_deadline, then redirects to Khalti.
 */
(function () {
  "use strict";

  var DEFAULT_PARTIAL_PERCENT = 0.60;

  var state = {
    bookingId: "",
    booking: null,
    selectedPaymentType: "partial",
    countdownTimer: null,
    submitting: false,
  };

  function $(id) { return document.getElementById(id); }
  function setText(id, text) { var el = $(id); if (el) el.textContent = text == null ? "" : String(text); }
  function show(id) { var el = $(id); if (el) el.classList.remove("hidden"); }
  function hide(id) { var el = $(id); if (el) el.classList.add("hidden"); }

  function formatMoney(amount) {
    var n = Number(amount);
    if (!Number.isFinite(n)) n = 0;
    return "NPR " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(value) {
    var s = String(value || "").trim();
    if (!s) return "-";
    var d = new Date(s.length === 10 ? s + "T00:00:00" : s);
    if (Number.isNaN(d.getTime())) return s;
    try {
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (_e) { return s; }
  }

  function readBookingIdFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      return String(params.get("booking") || "").trim();
    } catch (_e) { return ""; }
  }

  function readSessionPrefill() {
    if (!window.sessionStorage) return null;
    try {
      var raw = window.sessionStorage.getItem("vrs.recentBooking");
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }

  function setStatus(message, tone) {
    var banner = $("paymentStatusBanner");
    if (!banner) return;
    if (!message) {
      banner.classList.add("hidden");
      banner.textContent = "";
      return;
    }
    banner.classList.remove("hidden", "border-rose-200", "bg-rose-50", "text-rose-700",
      "border-amber-200", "bg-amber-50", "text-amber-700",
      "border-emerald-200", "bg-emerald-50", "text-emerald-700",
      "border-slate-200", "bg-slate-50", "text-slate-700");

    var classes;
    if (tone === "error") {
      classes = ["border-rose-200", "bg-rose-50", "text-rose-700"];
    } else if (tone === "warn") {
      classes = ["border-amber-200", "bg-amber-50", "text-amber-700"];
    } else if (tone === "success") {
      classes = ["border-emerald-200", "bg-emerald-50", "text-emerald-700"];
    } else {
      classes = ["border-slate-200", "bg-slate-50", "text-slate-700"];
    }
    classes.forEach(function (c) { banner.classList.add(c); });
    banner.textContent = message;
  }

  function applyPaymentTypeSelection(type) {
    state.selectedPaymentType = type === "full" ? "full" : "partial";
    var partialBtn = $("paymentOptionPartial");
    var fullBtn = $("paymentOptionFull");
    [partialBtn, fullBtn].forEach(function (btn) {
      if (!btn) return;
      btn.classList.remove("payment-option--active");
      btn.setAttribute("aria-pressed", "false");
    });
    var active = state.selectedPaymentType === "full" ? fullBtn : partialBtn;
    if (active) {
      active.classList.add("payment-option--active");
      active.setAttribute("aria-pressed", "true");
    }
    refreshPayNow();
  }

  function refreshPayNow() {
    if (!state.booking) return;
    var total = Number(state.booking.quote && state.booking.quote.totalAmount || 0);
    var paid = Number(state.booking.paidAmount || 0);
    var remaining = Number(state.booking.remainingAmount || Math.max(0, total - paid));
    var partialAmount = Math.round(total * DEFAULT_PARTIAL_PERCENT * 100) / 100;
    var amountNow = state.selectedPaymentType === "full" ? remaining : partialAmount;

    setText("paymentPayNowAmount", formatMoney(amountNow));
    setText("paymentPayNowSub",
      state.selectedPaymentType === "full"
        ? "Pay the full balance and confirm the booking instantly."
        : "Pay 60% advance to confirm. The remaining " + formatMoney(remaining - partialAmount) + " is collected at pickup.");
    setText("paymentSummaryAmount", formatMoney(amountNow));
  }

  function startCountdown(deadlineIso) {
    if (state.countdownTimer) {
      window.clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
    var label = $("paymentCountdownLabel");
    var hint = $("paymentCountdownHint");
    var bar = $("paymentCountdownBar");
    var card = $("paymentCountdownCard");
    if (!label || !deadlineIso) return;

    var deadlineMs = Date.parse(String(deadlineIso));
    if (!Number.isFinite(deadlineMs)) return;

    var totalWindowMs = 15 * 60 * 1000;
    var startMs = deadlineMs - totalWindowMs;

    function tick() {
      var remainingMs = deadlineMs - Date.now();
      if (remainingMs <= 0) {
        label.textContent = "00:00";
        if (hint) hint.textContent = "Payment window expired. Please book again.";
        if (card) card.classList.add("payment-countdown--expired");
        if (bar) bar.style.width = "0%";
        lockUiForExpiry();
        if (state.countdownTimer) {
          window.clearInterval(state.countdownTimer);
          state.countdownTimer = null;
        }
        return;
      }
      var totalSeconds = Math.floor(remainingMs / 1000);
      var minutes = Math.floor(totalSeconds / 60);
      var seconds = totalSeconds % 60;
      var pad = function (n) { return n < 10 ? "0" + n : String(n); };
      label.textContent = pad(minutes) + ":" + pad(seconds);
      if (hint) {
        hint.textContent = "Complete payment before the timer runs out to confirm your booking.";
      }
      if (card) {
        card.classList.toggle("payment-countdown--urgent", remainingMs < 3 * 60 * 1000);
        card.classList.remove("payment-countdown--expired");
      }
      if (bar) {
        var elapsed = Math.max(0, Date.now() - startMs);
        var pct = Math.max(0, Math.min(100, ((totalWindowMs - elapsed) / totalWindowMs) * 100));
        bar.style.width = pct.toFixed(1) + "%";
      }
    }

    tick();
    state.countdownTimer = window.setInterval(tick, 1000);
  }

  function lockUiForExpiry() {
    var payBtn = $("paymentSubmitBtn");
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.classList.add("payment-button--disabled");
      payBtn.textContent = "Payment window closed";
    }
    setStatus("Payment window has expired. Please make a new booking to try again.", "error");
  }

  function renderBooking(booking) {
    state.booking = booking;
    var total = Number(booking.quote && booking.quote.totalAmount || 0);
    var paid = Number(booking.paidAmount || 0);
    var remaining = Number(booking.remainingAmount || Math.max(0, total - paid));

    setText("paymentVehicleName", booking.vehicleName || "Vehicle");
    setText("paymentBookingCode", booking.bookingCode || "-");
    setText("paymentBookingDates", formatDate(booking.startDate) + " \u2192 " + formatDate(booking.endDate));
    setText("paymentDriverOption", booking.driverOptionLabel || "Self Drive");
    setText("paymentBookingTotal", formatMoney(total));
    setText("paymentBookingPaid", formatMoney(paid));
    setText("paymentBookingRemaining", formatMoney(remaining));
    setText("paymentCustomerName", booking.customerName || "Customer");
    setText("paymentCustomerEmail", booking.customerEmail || "-");

    var partialBtn = $("paymentOptionPartial");
    var partialAmount = Math.round(total * DEFAULT_PARTIAL_PERCENT * 100) / 100;
    if (partialBtn) {
      var partialAmountEl = partialBtn.querySelector("[data-partial-amount]");
      if (partialAmountEl) partialAmountEl.textContent = formatMoney(partialAmount);
      // Disable partial if some has been paid already.
      if (paid > 0) {
        partialBtn.disabled = true;
        partialBtn.classList.add("payment-option--disabled");
        partialBtn.setAttribute("aria-disabled", "true");
        var partialNote = partialBtn.querySelector("[data-partial-note]");
        if (partialNote) partialNote.textContent = "Already partially paid - balance only";
        applyPaymentTypeSelection("full");
      } else {
        partialBtn.disabled = false;
        partialBtn.classList.remove("payment-option--disabled");
        partialBtn.removeAttribute("aria-disabled");
      }
    }

    var fullBtn = $("paymentOptionFull");
    if (fullBtn) {
      var fullAmountEl = fullBtn.querySelector("[data-full-amount]");
      if (fullAmountEl) fullAmountEl.textContent = formatMoney(remaining);
      var fullNote = fullBtn.querySelector("[data-full-note]");
      if (fullNote) {
        fullNote.textContent = paid > 0
          ? "Pay the remaining balance now."
          : "Pay everything upfront and skip a second payment later.";
      }
    }

    if (booking.payment_status === "paid" || remaining <= 0) {
      hide("paymentChooserSection");
      show("paymentAlreadyPaidPanel");
      return;
    }

    if (booking.paymentDeadline) {
      startCountdown(booking.paymentDeadline);
    } else {
      hide("paymentCountdownCard");
    }

    refreshPayNow();
  }

  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;
    var btn = $("paymentSubmitBtn");
    if (!btn) return;
    btn.disabled = isSubmitting;
    btn.textContent = isSubmitting ? "Connecting to Khalti..." : "Pay with Khalti";
    btn.classList.toggle("payment-button--loading", isSubmitting);
  }

  async function loadBooking() {
    if (!window.VehicleBookingService || typeof window.VehicleBookingService.getBookingById !== "function") {
      setStatus("Booking service is unavailable. Please reload the page.", "error");
      return;
    }
    if (!state.bookingId) {
      setStatus("Missing booking id. Please open this page from a booking link.", "error");
      return;
    }
    setStatus("Loading booking details...", "info");
    try {
      var booking = await window.VehicleBookingService.getBookingById(state.bookingId);
      if (!booking) {
        setStatus("Booking not found or you do not have access to it.", "error");
        return;
      }
      hide("paymentLoadingState");
      show("paymentChooserSection");
      renderBooking(booking);
      setStatus("", "info");
    } catch (error) {
      var message = window.VehicleBookingService && typeof window.VehicleBookingService.toPublicError === "function"
        ? window.VehicleBookingService.toPublicError(error, "Could not load this booking.")
        : "Could not load this booking.";
      setStatus(message, "error");
    }
  }

  async function startPayment() {
    if (state.submitting) return;
    if (!state.booking) {
      setStatus("Booking not loaded yet.", "error");
      return;
    }

    if (!window.VehiclePaymentService) {
      setStatus("Payment service is unavailable.", "error");
      return;
    }

    setSubmitting(true);
    setStatus("", "info");

    try {
      var result = await window.VehiclePaymentService.initiatePayment({
        bookingId: state.bookingId,
        paymentType: state.selectedPaymentType,
      });

      if (!result || !result.paymentUrl) {
        throw new Error(result && result.message ? result.message : "Khalti did not return a payment URL.");
      }

      try {
        if (window.sessionStorage) {
          window.sessionStorage.setItem("vrs.activePayment", JSON.stringify({
            bookingId: state.bookingId,
            transactionCode: result.transactionCode,
            pidx: result.pidx,
            amount: result.amount,
            paymentType: result.paymentType,
            startedAt: Date.now(),
          }));
        }
      } catch (_e) { /* ignore */ }

      setStatus("Redirecting to Khalti...", "success");
      window.location.assign(String(result.paymentUrl));
    } catch (error) {
      setSubmitting(false);
      var message = (error && error.message) || "Could not start Khalti payment.";
      setStatus(message, "error");
    }
  }

  function wireOptions() {
    var partialBtn = $("paymentOptionPartial");
    var fullBtn = $("paymentOptionFull");
    if (partialBtn) {
      partialBtn.addEventListener("click", function () {
        if (partialBtn.disabled) return;
        applyPaymentTypeSelection("partial");
      });
    }
    if (fullBtn) {
      fullBtn.addEventListener("click", function () {
        applyPaymentTypeSelection("full");
      });
    }
    var submit = $("paymentSubmitBtn");
    if (submit) {
      submit.addEventListener("click", startPayment);
    }
    var goHome = $("paymentBackHomeBtn");
    if (goHome) {
      goHome.addEventListener("click", function () {
        window.location.assign("index.html");
      });
    }
    var bookingsBtn = $("paymentViewBookingsBtn");
    if (bookingsBtn) {
      bookingsBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (window.VehicleAuthUI && typeof window.VehicleAuthUI.openBookingsPanel === "function") {
          window.VehicleAuthUI.openBookingsPanel({ bookingId: state.bookingId });
        }
      });
    }
  }

  function init() {
    state.bookingId = readBookingIdFromUrl();
    var prefill = readSessionPrefill();
    if (prefill && (prefill.bookingId === state.bookingId || !state.bookingId)) {
      // Optimistic UI even before the DB read completes.
      setText("paymentVehicleName", prefill.vehicleName || "Vehicle");
      setText("paymentBookingCode", prefill.bookingCode || "-");
      setText("paymentBookingDates", formatDate(prefill.startDate) + " \u2192 " + formatDate(prefill.endDate));
      setText("paymentBookingTotal", formatMoney(prefill.totalAmount));
      if (prefill.paymentDeadline) startCountdown(prefill.paymentDeadline);
    }
    wireOptions();
    applyPaymentTypeSelection("partial");
    void loadBooking();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
