/**
 * Payment return page (Khalti redirect target).
 * Reads ?pidx and the friend params from Khalti, calls verify, and shows
 * either a success or failure screen with retry option.
 */
(function () {
  "use strict";

  var state = {
    pidx: "",
    transactionCode: "",
    bookingId: "",
    verified: null,
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

  function readQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      state.pidx = String(params.get("pidx") || "").trim();
      var txnId = String(params.get("transaction_id") || "").trim();
      var purchase = String(params.get("purchase_order_id") || "").trim();
      if (purchase) state.transactionCode = purchase;
      state.providerStatus = String(params.get("status") || "").trim();
      state.providerMessage = String(params.get("message") || "").trim();
      state.providerTotal = String(params.get("total_amount") || "").trim();
      state.providerTxn = txnId;
    } catch (_e) {
      // ignore
    }
  }

  function showLoading() {
    show("paymentReturnLoading");
    hide("paymentReturnSuccess");
    hide("paymentReturnFailure");
    hide("paymentReturnPending");
  }

  function showSuccess(payload) {
    hide("paymentReturnLoading");
    hide("paymentReturnFailure");
    hide("paymentReturnPending");
    show("paymentReturnSuccess");

    var booking = (payload && payload.booking) || {};
    setText("paymentReturnTransactionCode", payload.transactionCode || "-");
    setText("paymentReturnKhaltiTxn", payload.khaltiTransactionId || "-");
    setText("paymentReturnAmount", formatMoney(payload.amount));
    setText("paymentReturnPaymentType", payload.paymentType || "-");
    setText("paymentReturnBookingCode", booking.bookingCode || "-");
    setText("paymentReturnPaid", formatMoney(booking.paidAmount));
    setText("paymentReturnRemaining", formatMoney(booking.remainingAmount));
    setText("paymentReturnTotal", formatMoney(booking.totalAmount));

    var remaining = Number(booking.remainingAmount || 0);
    setText(
      "paymentReturnNextStep",
      remaining > 0
        ? "Pay the remaining " + formatMoney(remaining) + " from your bookings panel before the trip starts."
        : "Your booking is fully paid. We will email a copy of the receipt shortly."
    );

    if (booking.id) state.bookingId = booking.id;

    var receiptBtn = $("paymentReturnReceiptBtn");
    if (receiptBtn) {
      receiptBtn.href = "payment-receipt.html?payment=" + encodeURIComponent(payload.transactionCode || "");
    }

    var bookingsBtn = $("paymentReturnBookingsBtn");
    if (bookingsBtn) {
      bookingsBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (window.VehicleAuthUI && typeof window.VehicleAuthUI.openBookingsPanel === "function") {
          window.VehicleAuthUI.openBookingsPanel({ bookingId: state.bookingId });
        }
      });
    }
  }

  function showFailure(payload) {
    hide("paymentReturnLoading");
    hide("paymentReturnSuccess");
    hide("paymentReturnPending");
    show("paymentReturnFailure");

    var reason = (payload && (payload.failureReason || payload.message)) || "Your payment was not completed.";
    setText("paymentReturnFailureReason", reason);
    setText("paymentReturnFailureTransaction", (payload && payload.transactionCode) || "-");

    var retryBtn = $("paymentReturnRetryBtn");
    var booking = (payload && payload.booking) || {};
    var bookingId = booking.id || state.bookingId;
    if (retryBtn) {
      if (bookingId) {
        retryBtn.href = "payment.html?booking=" + encodeURIComponent(bookingId);
      } else {
        retryBtn.href = "vehicles.html";
      }
    }
  }

  function showPending(payload) {
    hide("paymentReturnLoading");
    hide("paymentReturnSuccess");
    hide("paymentReturnFailure");
    show("paymentReturnPending");
    var note = (payload && payload.message) || "Khalti is still processing this transaction. We will email a receipt once it confirms.";
    setText("paymentReturnPendingNote", note);
  }

  async function verify() {
    if (!state.pidx) {
      showFailure({
        message: "We could not find a Khalti payment id (pidx) in the URL. Please retry from your bookings.",
      });
      return;
    }

    if (!window.VehiclePaymentService) {
      showFailure({ message: "Payment service is unavailable." });
      return;
    }

    showLoading();

    try {
      var result = await window.VehiclePaymentService.verifyPayment(state.pidx);
      state.verified = result;

      if (result && result.status === "completed") {
        showSuccess(result);
        return;
      }

      if (result && result.status === "pending") {
        showPending(result);
        return;
      }

      showFailure(result || {});
    } catch (error) {
      var message = (error && error.message) || "Could not verify the payment.";
      showFailure({ message: message });
    }
  }

  function init() {
    readQuery();
    var pidxLabel = $("paymentReturnPidxLabel");
    if (pidxLabel) pidxLabel.textContent = state.pidx || "-";
    void verify();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
