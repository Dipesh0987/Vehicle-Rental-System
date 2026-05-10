/**
 * Payment service - thin wrapper around the esewa-payment edge function and
 * direct reads of `payments` / `payment_receipts` for receipt rendering.
 *
 * Exposed as `window.VehiclePaymentService`. Depends on the global
 * `window.SupabaseClient` (from supabase.client.js).
 */
(function () {
  "use strict";

  var FUNCTION_NAME = "esewa-payment";

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

  function describeNetworkError(rawMessage) {
    var msg = String(rawMessage || "").toLowerCase();
    var isNetwork =
      msg.indexOf("failed to send a request") >= 0
      || msg.indexOf("failed to fetch") >= 0
      || msg.indexOf("networkerror") >= 0
      || msg.indexOf("network error") >= 0;
    if (!isNetwork) return "";
    return [
      "Payment service is unreachable.",
      "Make sure the 'esewa-payment' edge function is deployed",
      "and that ESEWA_GATEWAY_URL + ESEWA_STATUS_URL + ESEWA_PRODUCT_CODE + ESEWA_SECRET_KEY secrets are set.",
    ].join(" ");
  }

  // FunctionsHttpError responses include a `context` Response object whose
  // body holds the JSON payload our edge function returned. Read it so we
  // can show the real reason instead of "Edge Function returned a non-2xx
  // status code".
  async function readFunctionErrorBody(error) {
    if (!error) return null;
    var ctx = error.context;
    if (!ctx || typeof ctx.json !== "function") return null;
    try {
      return await ctx.json();
    } catch (_jsonErr) {
      try {
        var text = typeof ctx.text === "function" ? await ctx.text() : "";
        return text ? { message: text } : null;
      } catch (_textErr) {
        return null;
      }
    }
  }

  async function invokeFunction(action, body) {
    var client = await getClient();
    var payload = Object.assign({ action: action }, body || {});

    var response;
    try {
      response = await client.functions.invoke(FUNCTION_NAME, { body: payload });
    } catch (networkError) {
      var networkHint = describeNetworkError(networkError && networkError.message);
      var networkErr = new Error(networkHint || (networkError && networkError.message) || "Payment service unreachable.");
      networkErr.code = "PAYMENT_NETWORK_ERROR";
      throw networkErr;
    }

    if (response.error) {
      var serverPayload = response.data || (await readFunctionErrorBody(response.error)) || {};
      var rawMessage = response.error.message || "";
      var apiHint = describeNetworkError(rawMessage);
      var apiMessage = apiHint || pickMessage(serverPayload, rawMessage || "Payment service error.");
      var apiErr = new Error(apiMessage);
      apiErr.code = apiHint ? "PAYMENT_NETWORK_ERROR" : "PAYMENT_API_ERROR";
      apiErr.payload = serverPayload;
      throw apiErr;
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

  /**
   * Verify a returning eSewa redirect.
   *
   * Accepts:
   *   - { data: "<base64-json from eSewa success_url>" }
   *   - { transactionUuid: "..." }                         (manual retry)
   *   - { failed: true, transactionUuid: "..." }            (failure_url hit)
   */
  async function verifyPayment(input) {
    var args = (input && typeof input === "object") ? input : { data: String(input || "") };
    var body = {};
    if (args.data) body.data = String(args.data);
    if (args.transactionUuid) body.transactionUuid = String(args.transactionUuid);
    if (args.failed) body.failed = true;
    if (!body.data && !body.transactionUuid) {
      throw new Error("Provide either 'data' or 'transactionUuid' to verify.");
    }
    return invokeFunction("verify", body);
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
