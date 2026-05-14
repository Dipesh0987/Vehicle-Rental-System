/**
 * Payment return page (eSewa redirect target).
 *
 * eSewa hits two URLs:
 *   - PAYMENT_SUCCESS_URL?data=<base64-json>      on success or pending
 *   - PAYMENT_FAILURE_URL?... (no signed payload)  on cancel/failure
 *
 * We read whichever query parameters are present, call the edge function's
 * `verify` action with either {data} (happy path) or {failed, transactionUuid}
 * (cancel path), and render success / failure / pending UI accordingly.
 */
(function () {
  "use strict";

  var state = {
    data: "",
    transactionUuid: "",
    transactionCode: "",
    bookingId: "",
    failed: false,
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

  // Best-effort base64 decode so we can show the transaction code in the
  // loading screen before verification finishes.
  function tryDecodeData(b64) {
    if (!b64) return null;
    try {
      var normalised = String(b64).replace(/-/g, "+").replace(/_/g, "/");
      while (normalised.length % 4 !== 0) normalised += "=";
      var decoded = atob(normalised);
      return JSON.parse(decoded);
    } catch (_e) {
      return null;
    }
  }

  function readQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      state.data = String(params.get("data") || "").trim();

      // ?status=failed (or status=Cancelled) is how some eSewa flows mark a
      // failure_url redirect. Combined with ?transaction_uuid we can tell
      // verify() exactly which payment row to mark failed.
      var statusParam = String(params.get("status") || "").trim().toLowerCase();
      var failureParam = String(params.get("failed") || "").trim().toLowerCase();
      state.failed =
        statusParam === "failed"
        || statusParam === "cancelled"
        || statusParam === "canceled"
        || failureParam === "true"
        || failureParam === "1";

      state.transactionUuid =
        String(params.get("transaction_uuid") || params.get("transactionUuid") || "").trim();

      if (state.data) {
        var decoded = tryDecodeData(state.data);
        if (decoded) {
          if (!state.transactionUuid && decoded.transaction_uuid) {
            state.transactionUuid = String(decoded.transaction_uuid);
          }
          if (decoded.transaction_code) {
            // eSewa's transaction_code is its own ref id, not our P-XXXX.
            // We still surface it so the user can quote it to support.
            state.providerRefId = String(decoded.transaction_code);
          }
          state.providerStatus = String(decoded.status || "");
          state.providerTotal = String(decoded.total_amount || "");
        }
      }

      // Our internal P-XXXX code is the same value as transactionUuid
      // because the edge function reuses it as eSewa's transaction_uuid.
      state.transactionCode = state.transactionUuid;
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
    setText("paymentReturnEsewaTxn", payload.providerTransactionId || "-");
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
    var note = (payload && payload.message) || "eSewa is still processing this transaction. We will email a receipt once it confirms.";
    setText("paymentReturnPendingNote", note);
  }

  async function verify() {
    if (!state.data && !state.transactionUuid) {
      showFailure({
        message: "We could not find an eSewa transaction reference in the URL. Please retry from your bookings.",
      });
      return;
    }

    if (!window.VehiclePaymentService) {
      showFailure({ message: "Payment service is unavailable." });
      return;
    }

    showLoading();

    try {
      var args = {};
      if (state.failed) {
        // failure_url path - no signed data, just mark the row failed.
        args.failed = true;
        if (state.transactionUuid) args.transactionUuid = state.transactionUuid;
      } else if (state.data) {
        // success_url path - send the base64 payload so the edge function
        // can verify the eSewa HMAC and double-check via the status API.
        args.data = state.data;
      } else {
        args.transactionUuid = state.transactionUuid;
      }

      var result = await window.VehiclePaymentService.verifyPayment(args);
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
    var refLabel = $("paymentReturnRefLabel");
    if (refLabel) refLabel.textContent = state.transactionUuid || state.providerRefId || "-";
    void verify();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
