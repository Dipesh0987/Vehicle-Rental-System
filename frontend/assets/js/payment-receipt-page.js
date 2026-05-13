/**
 * Payment receipt page.
 * Reads ?payment=<P-XXXX> and renders a printable invoice.
 * Pulls data from `payments` + `payment_receipts` (RLS-scoped to the user
 * by the customer-read policy) and reuses the cached `payment_receipts.payload`
 * snapshot when available.
 */
(function () {
  "use strict";

  var state = {
    transactionCode: "",
    payment: null,
    receipt: null,
    booking: null,
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

  function formatDate(iso) {
    var s = String(iso || "").trim();
    if (!s) return "-";
    var d = new Date(s.length === 10 ? s + "T00:00:00" : s);
    if (Number.isNaN(d.getTime())) return s;
    try {
      return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (_e) { return s; }
  }

  function readQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      state.transactionCode = String(params.get("payment") || "").trim();
    } catch (_e) {
      // ignore
    }
  }

  function setStatus(message, tone) {
    var banner = $("paymentReceiptStatus");
    if (!banner) return;
    if (!message) {
      banner.classList.add("hidden");
      banner.textContent = "";
      return;
    }
    banner.classList.remove("hidden",
      "border-rose-200", "bg-rose-50", "text-rose-700",
      "border-emerald-200", "bg-emerald-50", "text-emerald-700",
      "border-slate-200", "bg-slate-50", "text-slate-700");
    // Remove dark-mode counterparts so they don't linger across calls
    banner.className = banner.className
      .replace(/dark:\S+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (tone === "error") {
      banner.classList.add("border-rose-200", "bg-rose-50", "text-rose-700",
        "dark:border-rose-500/30", "dark:bg-rose-500/10", "dark:text-rose-300");
    } else if (tone === "success") {
      banner.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-700",
        "dark:border-emerald-500/30", "dark:bg-emerald-500/10", "dark:text-emerald-300");
    } else {
      banner.classList.add("border-slate-200", "bg-slate-50", "text-slate-700",
        "dark:border-white/10", "dark:bg-white/5", "dark:text-slate-300");
    }
    banner.textContent = message;
  }

  function renderFromPayloadOrPayment() {
    if (!state.payment) {
      setStatus("Receipt not found for that transaction code.", "error");
      return;
    }

    var payload = (state.receipt && state.receipt.payload) || {};
    var booking = payload.booking || state.booking || {};
    var breakdown = booking.breakdown || {};

    setText("receiptCode", state.receipt ? (state.receipt.receipt_code || "-") : "(pending)");
    setText("receiptTransactionCode", state.payment.transaction_code || "-");
    // Provider-neutral column added in migration 025; falls back to the
    // legacy khalti_* columns if the migration has not run yet so older
    // database snapshots still render a useful receipt.
    setText("receiptEsewaTxn",
      state.payment.provider_transaction_id
      || state.payment.khalti_transaction_id
      || "-");
    setText("receiptPaymentMethod", (state.payment.payment_method || "esewa").toUpperCase());
    setText("receiptPaymentType", state.payment.payment_type || "-");
    setText("receiptStatus", (state.payment.status || "-").toUpperCase());
    setText("receiptPaidAt", formatDate(state.payment.paid_at || state.payment.created_at));
    setText("receiptIssuedAt", formatDate(payload.issuedAt || state.receipt && state.receipt.created_at));

    setText("receiptCustomerName", booking.customerName || "-");
    setText("receiptCustomerEmail", booking.customerEmail || "-");
    setText("receiptCustomerPhone", booking.customerPhone || "-");
    setText("receiptBookingCode", booking.bookingCode || "-");
    setText("receiptBookingDates", formatDate(booking.startDate) + " \u2192 " + formatDate(booking.endDate));

    setText("receiptAmount", formatMoney(state.payment.amount));
    setText("receiptBaseAmount", formatMoney(breakdown.baseAmount));
    setText("receiptServiceFee", formatMoney(breakdown.serviceFee));
    setText("receiptTaxAmount", formatMoney(breakdown.taxAmount));
    setText("receiptDiscount", "- " + formatMoney(breakdown.discountAmount));
    setText("receiptTotalAmount", formatMoney(booking.totalAmount));
    setText("receiptGrandTotal", formatMoney(booking.totalAmount));
    setText("receiptPaidAmount", formatMoney(booking.paidAmount));
    setText("receiptRemainingAmount", formatMoney(booking.remainingAmount));

    var emailStatusEl = $("receiptEmailStatus");
    if (emailStatusEl) {
      if (state.receipt && state.receipt.email_status === "sent") {
        emailStatusEl.textContent = "Sent " + formatDate(state.receipt.email_sent_at) + " to " + state.receipt.email_to;
        emailStatusEl.className = "text-[12px] font-semibold text-emerald-600";
      } else if (state.receipt && state.receipt.email_status === "failed") {
        emailStatusEl.textContent = "Email failed: " + (state.receipt.email_error || "unknown error");
        emailStatusEl.className = "text-[12px] font-semibold text-rose-600";
      } else {
        emailStatusEl.textContent = "Email queued";
        emailStatusEl.className = "text-[12px] font-semibold text-slate-500";
      }
    }

    show("paymentReceiptCard");
    hide("paymentReceiptLoading");
  }

  async function loadReceipt() {
    if (!state.transactionCode) {
      setStatus("Missing transaction code in the URL. Open this page from your bookings.", "error");
      return;
    }

    if (!window.VehiclePaymentService) {
      setStatus("Payment service is unavailable.", "error");
      return;
    }

    try {
      var payment = await window.VehiclePaymentService.getPaymentByTransactionCode(state.transactionCode);
      if (!payment) {
        setStatus("Receipt not found for that transaction code.", "error");
        return;
      }
      state.payment = payment;

      var receipt = await window.VehiclePaymentService.getReceiptForPayment(payment.id);
      state.receipt = receipt;

      // If we don't have the cached snapshot, fall back to a live booking fetch.
      if ((!receipt || !receipt.payload) && window.VehicleBookingService && typeof window.VehicleBookingService.getBookingById === "function") {
        try {
          var booking = await window.VehicleBookingService.getBookingById(payment.booking_id);
          if (booking) {
            state.booking = {
              bookingCode: booking.bookingCode,
              customerName: booking.customerName,
              customerEmail: booking.customerEmail,
              customerPhone: booking.customerPhone,
              startDate: booking.startDate,
              endDate: booking.endDate,
              totalAmount: booking.quote && booking.quote.totalAmount,
              paidAmount: booking.paidAmount,
              remainingAmount: booking.remainingAmount,
              breakdown: booking.quote ? {
                baseAmount: booking.quote.baseAmount,
                serviceFee: booking.quote.serviceFee,
                taxAmount: booking.quote.taxAmount,
                discountAmount: booking.quote.discountAmount,
              } : {},
            };
          }
        } catch (_e) {
          // ignore - render with what we have
        }
      }

      renderFromPayloadOrPayment();
      setStatus("", "info");
    } catch (error) {
      var message = (error && error.message) || "Could not load receipt.";
      setStatus(message, "error");
    }
  }

  function wireActions() {
    var printBtn = $("paymentReceiptPrintBtn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        window.print();
      });
    }
    var resendBtn = $("paymentReceiptResendBtn");
    if (resendBtn) {
      resendBtn.addEventListener("click", async function () {
        if (!state.payment) return;
        resendBtn.disabled = true;
        resendBtn.textContent = "Sending...";
        try {
          await window.VehiclePaymentService.resendReceipt(state.payment.transaction_code);
          setStatus("Receipt re-sent to your email.", "success");
          // Refresh email_status row so the user sees the new sent state.
          var refreshed = await window.VehiclePaymentService.getReceiptForPayment(state.payment.id);
          if (refreshed) {
            state.receipt = refreshed;
            renderFromPayloadOrPayment();
          }
        } catch (error) {
          var message = (error && error.message) || "Could not resend the receipt.";
          setStatus(message, "error");
        } finally {
          resendBtn.disabled = false;
          resendBtn.textContent = "Resend Email";
        }
      });
    }
    var bookingsBtn = $("paymentReceiptBookingsBtn");
    if (bookingsBtn) {
      bookingsBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (window.VehicleAuthUI && typeof window.VehicleAuthUI.openBookingsPanel === "function") {
          var bookingId = state.payment ? state.payment.booking_id : "";
          window.VehicleAuthUI.openBookingsPanel({ bookingId: bookingId });
        }
      });
    }
  }

  function init() {
    readQuery();
    var codeLabel = $("paymentReceiptHeaderCode");
    if (codeLabel) codeLabel.textContent = state.transactionCode || "-";
    wireActions();
    void loadReceipt();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
