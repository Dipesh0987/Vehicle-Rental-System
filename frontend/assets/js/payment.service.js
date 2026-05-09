/**
 * Payment service - thin wrapper around the khalti-payment edge function and
 * direct reads of `payments` / `payment_receipts` for receipt rendering.
 *
 * Exposed as `window.VehiclePaymentService`. Depends on the global
 * `window.SupabaseClient` (from supabase.client.js).
 */
(function () {
  "use strict";

  var FUNCTION_NAME = "khalti-payment";

  function getClient() {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase client is not loaded.");
    }
    return window.SupabaseClient.init();
  }

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function asNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function moneyText(amount) {
    var n = asNumber(amount, 0);
    return "NPR " + n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function pickMessage(payload, fallback) {
    if (payload && typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
    return fallback || "Payment service error.";
  }

  async function invokeFunction(action, body) {
    var client = await getClient();
    var payload = Object.assign({ action: action }, body || {});

    var response = await client.functions.invoke(FUNCTION_NAME, { body: payload });

    if (response.error) {
      // Supabase swallows the response body when the HTTP status is non-2xx.
      // We bubble the message up so the UI can show it to the user.
      var serverPayload = response.data || {};
      var message = pickMessage(serverPayload, response.error.message || "Payment service error.");
      var err = new Error(message);
      err.code = "PAYMENT_API_ERROR";
      err.payload = serverPayload;
      throw err;
    }

    var data = response.data || {};
    if (data && data.success === false) {
      var failMessage = pickMessage(data, "Payment service error.");
      var failError = new Error(failMessage);
      failError.code = "PAYMENT_FAILED";
      failError.payload = data;
      throw failError;
    }

    return data || {};
  }

  async function initiatePayment(input) {
    var bookingId = trim(input && input.bookingId);
    var paymentType = trim(input && input.paymentType).toLowerCase();
    if (!bookingId) {
      throw new Error("bookingId is required.");
    }
    if (paymentType !== "full" && paymentType !== "partial") {
      throw new Error("paymentType must be 'full' or 'partial'.");
    }
    return invokeFunction("initiate", {
      bookingId: bookingId,
      paymentType: paymentType,
    });
  }

  async function verifyPayment(pidx) {
    var p = trim(pidx);
    if (!p) {
      throw new Error("pidx is required.");
    }
    return invokeFunction("verify", { pidx: p });
  }

  async function resendReceipt(transactionCode) {
    var c = trim(transactionCode);
    if (!c) {
      throw new Error("transactionCode is required.");
    }
    return invokeFunction("resend_receipt", { transactionCode: c });
  }

  async function listUserPayments() {
    return invokeFunction("list_user_payments", {});
  }

  async function getPaymentByTransactionCode(code) {
    var transactionCode = trim(code);
    if (!transactionCode) return null;

    var client = await getClient();
    var result = await client
      .from("payments")
      .select("*")
      .eq("transaction_code", transactionCode)
      .limit(1)
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message || "Could not load payment.");
    }
    return result.data || null;
  }

  async function getReceiptForPayment(paymentId) {
    var id = trim(paymentId);
    if (!id) return null;

    var client = await getClient();
    var result = await client
      .from("payment_receipts")
      .select("*")
      .eq("payment_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message || "Could not load receipt.");
    }
    return result.data || null;
  }

  function toPublicError(error, fallback) {
    if (error && error.message) {
      return String(error.message);
    }
    return fallback || "Unable to process payment right now.";
  }

  function formatTimeRemaining(targetIso) {
    var targetMs = Date.parse(String(targetIso || ""));
    if (!Number.isFinite(targetMs)) return null;

    var diffMs = targetMs - Date.now();
    if (diffMs <= 0) {
      return { expired: true, totalSeconds: 0, minutes: 0, seconds: 0, label: "00:00" };
    }

    var totalSeconds = Math.floor(diffMs / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };

    return {
      expired: false,
      totalSeconds: totalSeconds,
      minutes: minutes,
      seconds: seconds,
      label: pad(minutes) + ":" + pad(seconds),
    };
  }

  window.VehiclePaymentService = {
    initiatePayment: initiatePayment,
    verifyPayment: verifyPayment,
    resendReceipt: resendReceipt,
    listUserPayments: listUserPayments,
    getPaymentByTransactionCode: getPaymentByTransactionCode,
    getReceiptForPayment: getReceiptForPayment,
    toPublicError: toPublicError,
    formatTimeRemaining: formatTimeRemaining,
    moneyText: moneyText,
  };
})();
