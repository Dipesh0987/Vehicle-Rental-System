/**
 * esewa-payment edge function
 * --------------------------------------------------------------------------
 * Single function, multiple actions (mirrors the previous khalti-payment fn
 * so the admin / public site keep the same shape):
 *
 *   - initiate          : create a payments row, compute eSewa HMAC-SHA256
 *                         signature, return the signed form fields the
 *                         browser must POST to the eSewa gateway.
 *   - verify            : decode the base64 ?data param eSewa appends to the
 *                         success_url, verify its signature, double-check via
 *                         the eSewa transaction-status API, mark payment
 *                         completed, generate + email receipt.
 *   - resend_receipt    : resend the email for an existing receipt.
 *   - list_user_payments: paginated payment history for the calling user.
 *   - expire_stale      : admin-only sweep of expired payments.
 *
 * Security
 *   - Client must send a Supabase auth JWT in `Authorization: Bearer <jwt>`.
 *   - Booking ownership is verified before any state mutation.
 *   - All DB writes go through the service role.
 *   - The browser never sees ESEWA_SECRET_KEY - the signature is computed
 *     server-side and only the signed form fields go back to the client.
 *
 * Environment (all required for production)
 *   SUPABASE_URL                 standard
 *   SUPABASE_SERVICE_ROLE_KEY    standard
 *   ESEWA_GATEWAY_URL            eg https://rc-epay.esewa.com.np/api/epay/main/v2/form
 *                                or https://epay.esewa.com.np/api/epay/main/v2/form
 *   ESEWA_STATUS_URL             eg https://rc.esewa.com.np/api/epay/transaction/status/
 *                                or https://epay.esewa.com.np/api/epay/transaction/status/
 *   ESEWA_PRODUCT_CODE           merchant product code (sandbox = EPAYTEST)
 *   ESEWA_SECRET_KEY             merchant secret key (sandbox = 8gBm/:&EnhH.1/q)
 *   PAYMENT_SUCCESS_URL          absolute URL of payment-return.html
 *   PAYMENT_FAILURE_URL          where eSewa redirects on failure (often same)
 *   PAYMENT_WEBSITE_URL          absolute origin of the website
 *   RESEND_API_KEY               for receipt emails
 *   PAYMENT_RECEIPT_FROM_EMAIL   from address (defaults to onboarding@resend)
 *   PAYMENT_APP_NAME             friendly name in emails (defaults RAV)
 *   PARTIAL_PAYMENT_PERCENT      0..1, defaults 0.60
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

type BookingRow = {
  id: string;
  booking_code: string;
  customer_user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  status: string;
  currency: string;
  base_amount: number;
  service_fee: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  payment_deadline: string | null;
  vehicle_id: string;
  created_at: string;
};

type PaymentRow = {
  id: string;
  transaction_code: string;
  booking_id: string;
  customer_user_id: string | null;
  customer_email: string;
  customer_name: string;
  payment_method: string;
  payment_type: string;
  amount: number;
  total_booking_amount: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  provider_reference: string | null;
  provider_transaction_id: string | null;
  provider_response: JsonRecord;
  initiated_at: string;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

type EsewaReturnPayload = {
  transaction_code?: string;
  status?: string;
  total_amount?: string;
  transaction_uuid?: string;
  product_code?: string;
  signed_field_names?: string;
  signature?: string;
};

type EsewaStatusResponse = {
  product_code?: string;
  transaction_uuid?: string;
  total_amount?: number | string;
  status?: string;
  ref_id?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ESEWA_GATEWAY_URL = (Deno.env.get("ESEWA_GATEWAY_URL") ?? "").trim();
const ESEWA_STATUS_URL = (Deno.env.get("ESEWA_STATUS_URL") ?? "").trim().replace(/\/$/, "");
const ESEWA_PRODUCT_CODE = (Deno.env.get("ESEWA_PRODUCT_CODE") ?? "").trim();
const ESEWA_SECRET_KEY = (Deno.env.get("ESEWA_SECRET_KEY") ?? "").trim();
const PAYMENT_SUCCESS_URL = (Deno.env.get("PAYMENT_SUCCESS_URL") ?? "").trim();
const PAYMENT_FAILURE_URL = (Deno.env.get("PAYMENT_FAILURE_URL") ?? "").trim() || PAYMENT_SUCCESS_URL;
const PAYMENT_WEBSITE_URL = (Deno.env.get("PAYMENT_WEBSITE_URL") ?? "").trim();
const RESEND_API_KEY = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const PAYMENT_RECEIPT_FROM_EMAIL =
  (Deno.env.get("PAYMENT_RECEIPT_FROM_EMAIL") ?? "").trim()
  || "Rent A Vehicle Nepal <onboarding@resend.dev>";

const RESEND_DEV_REDIRECT_TO =
  (Deno.env.get("RESEND_DEV_REDIRECT_TO") ?? "").trim().toLowerCase()
  || (PAYMENT_RECEIPT_FROM_EMAIL.includes("@resend.dev") ? "vechilerental@gmail.com" : "");
const PAYMENT_APP_NAME =
  (Deno.env.get("PAYMENT_APP_NAME") ?? "").trim() || "Rent A Vehicle Nepal";
const PARTIAL_PAYMENT_PERCENT = clampPercent(
  Number(Deno.env.get("PARTIAL_PAYMENT_PERCENT") ?? "0.60"),
  0.6,
);

const ALLOWED_ORIGIN = (Deno.env.get("PAYMENT_WEBSITE_URL") ?? "").trim() || "*";
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for esewa-payment.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function clampPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    return fallback;
  }
  return value;
}

function jsonResponse(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(message: string, extra: JsonRecord = {}): Response {
  return jsonResponse(400, { success: false, message, ...extra });
}

function unauthorized(message = "Authentication required."): Response {
  return jsonResponse(401, { success: false, message });
}

function forbidden(message = "Not allowed."): Response {
  return jsonResponse(403, { success: false, message });
}

function serverError(message = "Unexpected error."): Response {
  return jsonResponse(500, { success: false, message });
}

function notConfigured(): Response {
  return jsonResponse(503, {
    success: false,
    message:
      "Payment provider is not configured. Set ESEWA_GATEWAY_URL, ESEWA_STATUS_URL, ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY in the function secrets.",
  });
}

function isPaymentConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY &&
    ESEWA_GATEWAY_URL &&
    ESEWA_STATUS_URL &&
    ESEWA_PRODUCT_CODE &&
    ESEWA_SECRET_KEY,
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * eSewa expects amounts as plain decimal strings WITHOUT thousands separators
 * for the signed payload (e.g. "1100.00") but the response body uses commas
 * for display (e.g. "1,100.00"). Always feed `formatAmountForSign` into the
 * signature computation and `parseAmountFromResponse` when reading replies.
 */
function formatAmountForSign(amount: number): string {
  const n = Number(amount) || 0;
  // eSewa accepts integer or two-decimal strings. We always use two decimals
  // so the signed message is deterministic.
  return n.toFixed(2);
}

function parseAmountFromResponse(value: unknown): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function moneyText(amount: number): string {
  const n = Number(amount) || 0;
  return "NPR " + n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------------- */
/* SIGNATURE                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Compute the eSewa HMAC-SHA256 signature.
 *
 *   message = orderedFieldNames.map(k => `${k}=${values[k]}`).join(",")
 *   signature = base64(HMAC_SHA256(secret, message))
 *
 * Order matters - it must match `signed_field_names` exactly.
 */
async function computeEsewaSignature(
  values: Record<string, string>,
  signedFieldNames: string,
): Promise<string> {
  const orderedKeys = signedFieldNames.split(",").map((s) => s.trim()).filter(Boolean);
  const message = orderedKeys.map((k) => `${k}=${values[k] ?? ""}`).join(",");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(ESEWA_SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const macBytes = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufferToBase64(macBytes);
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64UrlSafeDecodeJson(value: string): JsonRecord | null {
  if (!value) return null;
  try {
    // eSewa sometimes returns standard base64, sometimes URL-safe. Normalise.
    let normalised = String(value).replace(/-/g, "+").replace(/_/g, "/");
    while (normalised.length % 4 !== 0) normalised += "=";
    const decoded = atob(normalised);
    return JSON.parse(decoded) as JsonRecord;
  } catch (error) {
    console.error("base64UrlSafeDecodeJson failed:", error);
    return null;
  }
}

/* ------------------------------------------------------------------------- */
/* USER + BOOKING                                                             */
/* ------------------------------------------------------------------------- */

async function resolveUserFromRequest(request: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  return {
    id: data.user.id,
    email: String(data.user.email || "").trim().toLowerCase(),
  };
}

async function fetchBooking(bookingId: string): Promise<BookingRow | null> {
  const { data, error } = await supabaseAdmin
    .from("vehicle_bookings")
    .select(
      "id, booking_code, customer_user_id, customer_name, customer_email, customer_phone," +
      " start_date, end_date, status, currency, base_amount, service_fee, tax_amount," +
      " discount_amount, total_amount, paid_amount, remaining_amount, payment_status," +
      " payment_deadline, vehicle_id, created_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("fetchBooking failed:", error.message);
    return null;
  }
  return (data as BookingRow) ?? null;
}

async function fetchPaymentByReference(reference: string): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("provider_reference", reference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("fetchPaymentByReference failed:", error.message);
    return null;
  }
  return (data as PaymentRow) ?? null;
}

async function fetchPaymentByTransactionCode(code: string): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("transaction_code", code)
    .maybeSingle();

  if (error) {
    console.error("fetchPaymentByTransactionCode failed:", error.message);
    return null;
  }
  return (data as PaymentRow) ?? null;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("is_admin_user", { check_user: userId });
  if (error) return false;
  return Boolean(data);
}

function ensureBookingPayable(
  booking: BookingRow,
  user: { id: string; email: string },
): { ok: true } | { ok: false; status: number; message: string } {
  if (booking.customer_user_id && booking.customer_user_id !== user.id) {
    return { ok: false, status: 403, message: "You cannot pay for someone else's booking." };
  }

  const status = String(booking.status || "").toLowerCase();
  if (status === "cancelled") {
    return { ok: false, status: 400, message: "Booking is cancelled. Payment is not allowed." };
  }

  if (booking.payment_deadline) {
    const deadlineMs = Date.parse(booking.payment_deadline);
    if (Number.isFinite(deadlineMs) && deadlineMs <= Date.now()) {
      return {
        ok: false,
        status: 400,
        message: "Payment window expired (15 minutes from booking creation). Please make a new booking.",
      };
    }
  }

  const remaining = roundMoney(booking.remaining_amount);
  if (remaining <= 0) {
    return { ok: false, status: 400, message: "This booking is already fully paid." };
  }

  return { ok: true };
}

function minutesUntil(iso: string): number {
  const ms = Date.parse(iso) - Date.now();
  return Math.max(0, Math.floor(ms / 60000));
}

/* ------------------------------------------------------------------------- */
/* INITIATE                                                                   */
/* ------------------------------------------------------------------------- */

async function handleInitiate(payload: JsonRecord, request: Request): Promise<Response> {
  if (!isPaymentConfigured()) return notConfigured();

  const user = await resolveUserFromRequest(request);
  if (!user) return unauthorized();

  const bookingId = String(payload.bookingId || "").trim();
  if (!bookingId) return badRequest("bookingId is required.");

  const requestedType = String(payload.paymentType || "").trim().toLowerCase();
  if (!["full", "partial"].includes(requestedType)) {
    return badRequest("paymentType must be 'full' or 'partial'.");
  }

  // Sweep stale rows so the booking ledger is fresh before we read it.
  await supabaseAdmin.rpc("expire_stale_payments");

  const booking = await fetchBooking(bookingId);
  if (!booking) return badRequest("Booking not found.");

  const guard = ensureBookingPayable(booking, user);
  if (!guard.ok) return jsonResponse(guard.status, { success: false, message: guard.message });

  const total = roundMoney(booking.total_amount);
  const alreadyPaid = roundMoney(booking.paid_amount);
  const remaining = roundMoney(booking.remaining_amount);

  let paymentType: "partial" | "full" = requestedType as "partial" | "full";
  let amount = 0;

  if (paymentType === "partial") {
    if (alreadyPaid > 0) {
      return badRequest("Partial payment is only available for the first payment. Please pay the remaining balance.");
    }
    amount = roundMoney(total * PARTIAL_PAYMENT_PERCENT);
  } else {
    amount = remaining;
  }

  if (amount <= 0) return badRequest("Computed payment amount is zero. Nothing to pay.");
  if (amount > remaining + 0.005) {
    return badRequest("Payment amount exceeds the remaining balance.");
  }

  // Cancel any prior open attempts for this booking so we don't have a fan-out
  // of transaction_uuids the admin has to reconcile.
  await supabaseAdmin
    .from("payments")
    .update({ status: "cancelled", failure_reason: "Superseded by new initiate call." })
    .eq("booking_id", booking.id)
    .in("status", ["initiated", "pending"]);

  // payments.expires_at = MIN(booking.payment_deadline, now + 25 min) so that
  // the user can never pay beyond the booking-form 15-min hard rule.
  const fallbackExpiry = new Date(Date.now() + 25 * 60 * 1000).toISOString();
  let expiresAt = fallbackExpiry;
  if (booking.payment_deadline) {
    const deadlineMs = Date.parse(booking.payment_deadline);
    if (Number.isFinite(deadlineMs)) {
      expiresAt = new Date(Math.min(deadlineMs, Date.parse(fallbackExpiry))).toISOString();
    }
  }

  const insertResult = await supabaseAdmin
    .from("payments")
    .insert({
      booking_id: booking.id,
      customer_user_id: user.id,
      customer_email: booking.customer_email,
      customer_name: booking.customer_name,
      payment_method: "esewa",
      payment_type: paymentType,
      amount,
      total_booking_amount: total,
      currency: booking.currency || "NPR",
      status: "initiated",
      expires_at: expiresAt,
    })
    .select("*")
    .limit(1)
    .single();

  if (insertResult.error || !insertResult.data) {
    console.error("payments insert failed:", insertResult.error?.message);
    return serverError("Could not create payment record. Please try again.");
  }

  const payment = insertResult.data as PaymentRow;

  // eSewa transaction_uuid: use our payments transaction_code (P-XXXX) so the
  // two systems stay easy to reconcile. eSewa allows alphanumerics + dash.
  const transactionUuid = payment.transaction_code;

  const totalAmountText = formatAmountForSign(amount);
  const signedFieldNames = "total_amount,transaction_uuid,product_code";
  const signature = await computeEsewaSignature(
    {
      total_amount: totalAmountText,
      transaction_uuid: transactionUuid,
      product_code: ESEWA_PRODUCT_CODE,
    },
    signedFieldNames,
  );

  // The full set of form fields the browser must POST. We hand them to the
  // client and the client builds + auto-submits a hidden <form>. We never
  // build a redirect URL ourselves because eSewa requires POST.
  const formFields: Record<string, string> = {
    amount: formatAmountForSign(amount),
    tax_amount: "0",
    total_amount: totalAmountText,
    transaction_uuid: transactionUuid,
    product_code: ESEWA_PRODUCT_CODE,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: PAYMENT_SUCCESS_URL,
    failure_url: PAYMENT_FAILURE_URL,
    signed_field_names: signedFieldNames,
    signature,
  };

  // Stash the reference and a snapshot of what we sent so verify() can
  // detect tampering (and so the admin sees the exact payload eSewa got).
  await supabaseAdmin
    .from("payments")
    .update({
      provider_reference: transactionUuid,
      provider_response: { initiate: formFields, gatewayUrl: ESEWA_GATEWAY_URL } as JsonRecord,
      status: "pending",
    })
    .eq("id", payment.id);

  await supabaseAdmin.from("notifications").insert({
    user_id: user.id,
    type: "payment_initiated",
    title: "eSewa payment started",
    body:
      "We started an eSewa payment of " + moneyText(amount)
      + " for booking " + booking.booking_code + ". Complete it within "
      + minutesUntil(expiresAt) + " minutes to confirm.",
    link_url: PAYMENT_SUCCESS_URL,
    metadata: {
      transactionCode: payment.transaction_code,
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      amount,
      paymentType,
      transactionUuid,
    },
  });

  return jsonResponse(200, {
    success: true,
    gatewayUrl: ESEWA_GATEWAY_URL,
    formFields,
    transactionCode: payment.transaction_code,
    transactionUuid,
    amount,
    currency: payment.currency,
    paymentType,
    expiresAt,
    expiresInMinutes: minutesUntil(expiresAt),
    booking: {
      id: booking.id,
      bookingCode: booking.booking_code,
      totalAmount: total,
      paidAmount: alreadyPaid,
      remainingAmount: remaining,
      payOnceAmount: amount,
    },
  });
}

/* ------------------------------------------------------------------------- */
/* VERIFY                                                                     */
/* ------------------------------------------------------------------------- */

async function handleVerify(payload: JsonRecord, request: Request): Promise<Response> {
  if (!isPaymentConfigured()) return notConfigured();

  const user = await resolveUserFromRequest(request);
  if (!user) return unauthorized();

  const dataParam = String(payload.data || "").trim();
  const transactionUuidInput = String(payload.transactionUuid || payload.transaction_uuid || "").trim();
  const explicitFailure = Boolean(payload.failed);

  // We accept three call shapes:
  //   1. { data: <base64-json from eSewa success_url> }   -> happy path
  //   2. { transactionUuid: "..." }                        -> retry / pending
  //   3. { failed: true, transactionUuid: "..." }          -> failure_url hit
  let returnPayload: EsewaReturnPayload | null = null;

  if (dataParam) {
    const decoded = base64UrlSafeDecodeJson(dataParam);
    if (!decoded) {
      return badRequest("Could not decode eSewa response data.");
    }
    returnPayload = decoded as EsewaReturnPayload;
  }

  const transactionUuid = (returnPayload?.transaction_uuid || transactionUuidInput || "").trim();
  if (!transactionUuid) {
    return badRequest("transactionUuid (or eSewa data) is required.");
  }

  const payment = await fetchPaymentByReference(transactionUuid);
  if (!payment) return badRequest("Payment record not found for that transaction.");

  if (payment.customer_user_id && payment.customer_user_id !== user.id) {
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) return forbidden("You cannot verify another user's payment.");
  }

  // Idempotent: if already finalized just return the snapshot.
  if (payment.status === "completed" || payment.status === "failed" || payment.status === "expired") {
    return jsonResponse(200, await buildVerifySummary(payment));
  }

  // Caller hit the failure_url - mark as failed and bail.
  if (explicitFailure) {
    await supabaseAdmin
      .from("payments")
      .update({
        status: "failed",
        failure_reason: "Customer cancelled or eSewa redirected to failure_url.",
        provider_response: { ...(payment.provider_response || {}), explicit_failure: true } as JsonRecord,
      })
      .eq("id", payment.id);
    const refreshed = await fetchPaymentByReference(transactionUuid);
    return jsonResponse(200, await buildVerifySummary(refreshed || payment));
  }

  // If we got the success_url payload, verify its HMAC before trusting it.
  if (returnPayload) {
    const sigOk = await verifyReturnPayloadSignature(returnPayload);
    if (!sigOk) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          failure_reason: "eSewa response signature mismatch (possible tampering).",
          provider_response: { ...(payment.provider_response || {}), return: returnPayload } as JsonRecord,
        })
        .eq("id", payment.id);
      return jsonResponse(400, {
        success: false,
        message: "eSewa response signature mismatch. Payment was not finalized.",
      });
    }
  }

  // Always double-check by hitting the eSewa transaction-status API.
  let statusResponse: EsewaStatusResponse | null = null;
  let statusError: string | null = null;
  try {
    statusResponse = await callEsewaStatus({
      transactionUuid,
      totalAmount: payment.amount,
    });
  } catch (error) {
    statusError = error instanceof Error ? error.message : "eSewa status lookup failed.";
    console.error("callEsewaStatus error:", statusError);
  }

  const merged = {
    ...(payment.provider_response || {}),
    return: returnPayload || null,
    status_lookup: statusResponse,
    status_error: statusError,
  };

  const lookupStatus = String(statusResponse?.status || returnPayload?.status || "").trim().toUpperCase();

  if (lookupStatus === "COMPLETE") {
    // Cross-check the amount eSewa says we collected against what we asked.
    const lookupAmount = parseAmountFromResponse(statusResponse?.total_amount ?? returnPayload?.total_amount);
    if (lookupAmount > 0 && Math.abs(lookupAmount - Number(payment.amount)) > 0.01) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          failure_reason: "Amount mismatch: eSewa reported " + lookupAmount + " vs expected " + payment.amount + ".",
          provider_response: merged,
        })
        .eq("id", payment.id);
      return jsonResponse(400, {
        success: false,
        message: "eSewa reported a different amount than expected. Payment marked as failed.",
      });
    }

    const finalizeUpdate = await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        provider_transaction_id: statusResponse?.ref_id ?? returnPayload?.transaction_code ?? null,
        provider_response: merged,
        paid_at: nowIso(),
      })
      .eq("id", payment.id)
      .select("*")
      .limit(1)
      .single();

    if (finalizeUpdate.error) {
      console.error("payments mark-completed failed:", finalizeUpdate.error.message);
      return serverError("Could not finalize payment. Please contact support.");
    }

    const finalizedRow = finalizeUpdate.data as PaymentRow;

    // Receipt is best-effort - the trigger already wrote the booking
    // notification, so even if email fails the user sees the success state.
    try {
      await ensureReceiptForPayment(finalizedRow);
    } catch (error) {
      console.error("ensureReceiptForPayment error:", error);
    }

    return jsonResponse(200, await buildVerifySummary(finalizedRow));
  }

  // Map non-success statuses to our internal states so the frontend can
  // show a clean retry / pending UI.
  let nextStatus: "pending" | "failed" | "expired" = "pending";
  let failureReason: string | null = null;

  if (lookupStatus === "PENDING" || lookupStatus === "AMBIGUOUS") {
    nextStatus = "pending";
    failureReason = "eSewa is still processing this transaction.";
  } else if (lookupStatus === "CANCELED" || lookupStatus === "CANCELLED") {
    nextStatus = "failed";
    failureReason = "Customer cancelled the eSewa payment.";
  } else if (lookupStatus === "NOT_FOUND") {
    nextStatus = "failed";
    failureReason = "eSewa could not find this transaction.";
  } else if (lookupStatus === "FULL_REFUND" || lookupStatus === "PARTIAL_REFUND") {
    nextStatus = "failed";
    failureReason = "Transaction was refunded.";
  } else if (lookupStatus) {
    nextStatus = "failed";
    failureReason = "eSewa returned status: " + lookupStatus;
  } else if (statusError) {
    failureReason = statusError;
  }

  await supabaseAdmin
    .from("payments")
    .update({
      status: nextStatus,
      failure_reason: failureReason,
      provider_response: merged,
      provider_transaction_id: statusResponse?.ref_id ?? returnPayload?.transaction_code ?? null,
    })
    .eq("id", payment.id);

  const refreshed = await fetchPaymentByReference(transactionUuid);
  return jsonResponse(200, await buildVerifySummary(refreshed || payment));
}

async function verifyReturnPayloadSignature(payload: EsewaReturnPayload): Promise<boolean> {
  if (!payload || !payload.signature || !payload.signed_field_names) return false;

  const orderedKeys = payload.signed_field_names.split(",").map((s) => s.trim()).filter(Boolean);
  const values: Record<string, string> = {};
  for (const key of orderedKeys) {
    const v = (payload as Record<string, unknown>)[key];
    values[key] = v == null ? "" : String(v);
  }

  const expected = await computeEsewaSignature(values, payload.signed_field_names);
  return expected === payload.signature;
}

async function callEsewaStatus(input: {
  transactionUuid: string;
  totalAmount: number;
}): Promise<EsewaStatusResponse> {
  const url = ESEWA_STATUS_URL
    + "?product_code=" + encodeURIComponent(ESEWA_PRODUCT_CODE)
    + "&total_amount=" + encodeURIComponent(formatAmountForSign(input.totalAmount))
    + "&transaction_uuid=" + encodeURIComponent(input.transactionUuid);

  const response = await fetch(url, { method: "GET" });
  const text = await response.text();

  let parsed: EsewaStatusResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as EsewaStatusResponse) : {};
  } catch {
    /* keep parsed empty, surface text below */
  }

  if (!response.ok) {
    throw new Error("eSewa status HTTP " + response.status + ": " + text.slice(0, 240));
  }
  return parsed;
}

async function buildVerifySummary(payment: PaymentRow): Promise<JsonRecord> {
  const booking = await fetchBooking(payment.booking_id);
  const success = payment.status === "completed";

  return {
    success,
    status: payment.status,
    transactionCode: payment.transaction_code,
    transactionUuid: payment.provider_reference,
    providerTransactionId: payment.provider_transaction_id,
    amount: payment.amount,
    paymentType: payment.payment_type,
    currency: payment.currency,
    failureReason: payment.failure_reason,
    paidAt: payment.paid_at,
    booking: booking ? {
      id: booking.id,
      bookingCode: booking.booking_code,
      totalAmount: booking.total_amount,
      paidAmount: booking.paid_amount,
      remainingAmount: booking.remaining_amount,
      paymentStatus: booking.payment_status,
      startDate: booking.start_date,
      endDate: booking.end_date,
    } : null,
    message: success
      ? "Payment received successfully."
      : (payment.failure_reason
         || (payment.status === "pending"
             ? "eSewa is still processing. Try again in a few seconds."
             : "Payment did not complete.")),
  };
}

/* ------------------------------------------------------------------------- */
/* RECEIPT EMAIL                                                              */
/* ------------------------------------------------------------------------- */

async function ensureReceiptForPayment(payment: PaymentRow): Promise<void> {
  const booking = await fetchBooking(payment.booking_id);
  if (!booking) {
    throw new Error("Cannot build receipt: booking missing.");
  }

  const existing = await supabaseAdmin
    .from("payment_receipts")
    .select("*")
    .eq("payment_id", payment.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    console.error("payment_receipts lookup failed:", existing.error.message);
  }

  const receiptPayload = buildReceiptPayload(booking, payment);

  let receiptRow = (existing.data as JsonRecord | null) || null;

  if (!receiptRow) {
    const insert = await supabaseAdmin
      .from("payment_receipts")
      .insert({
        payment_id: payment.id,
        booking_id: booking.id,
        customer_user_id: payment.customer_user_id,
        email_to: payment.customer_email || booking.customer_email,
        payload: receiptPayload,
      })
      .select("*")
      .limit(1)
      .single();

    if (insert.error || !insert.data) {
      throw new Error("Could not create receipt: " + (insert.error?.message || ""));
    }
    receiptRow = insert.data as JsonRecord;
  } else {
    await supabaseAdmin
      .from("payment_receipts")
      .update({ payload: receiptPayload })
      .eq("id", receiptRow.id as string);
  }

  await sendReceiptEmail({
    receiptId: receiptRow.id as string,
    receiptCode: receiptRow.receipt_code as string,
    payload: receiptPayload,
    to: receiptRow.email_to as string,
  });
}

function buildReceiptPayload(booking: BookingRow, payment: PaymentRow): JsonRecord {
  return {
    transactionCode: payment.transaction_code,
    providerTransactionId: payment.provider_transaction_id,
    transactionUuid: payment.provider_reference,
    paymentMethod: payment.payment_method,
    paymentType: payment.payment_type,
    paidAt: payment.paid_at,
    amount: roundMoney(payment.amount),
    currency: payment.currency,
    booking: {
      id: booking.id,
      bookingCode: booking.booking_code,
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      customerPhone: booking.customer_phone,
      startDate: booking.start_date,
      endDate: booking.end_date,
      totalAmount: roundMoney(booking.total_amount),
      paidAmount: roundMoney(booking.paid_amount),
      remainingAmount: roundMoney(booking.remaining_amount),
      paymentStatus: booking.payment_status,
      breakdown: {
        baseAmount: roundMoney(booking.base_amount),
        serviceFee: roundMoney(booking.service_fee),
        taxAmount: roundMoney(booking.tax_amount),
        discountAmount: roundMoney(booking.discount_amount),
      },
    },
    business: {
      name: PAYMENT_APP_NAME,
      website: PAYMENT_WEBSITE_URL,
      currency: "NPR",
      country: "Nepal",
    },
    issuedAt: nowIso(),
  };
}

async function sendReceiptEmail(params: {
  receiptId: string;
  receiptCode: string;
  payload: JsonRecord;
  to: string;
}): Promise<void> {
  if (!RESEND_API_KEY || !params.to) {
    await supabaseAdmin
      .from("payment_receipts")
      .update({
        email_status: "failed",
        email_error: !RESEND_API_KEY ? "RESEND_API_KEY missing" : "Customer email missing",
      })
      .eq("id", params.receiptId);
    return;
  }

  // Dev-redirect: on Resend free tier (from = @resend.dev) emails can ONLY
  // be delivered to the verified account email. Always redirect in that case
  // to avoid 403 errors. The original recipient is preserved in the subject.
  const originalRecipient = params.to;
  const isFreeTier = PAYMENT_RECEIPT_FROM_EMAIL.includes("@resend.dev");
  const isRedirected =
    isFreeTier && RESEND_DEV_REDIRECT_TO.length > 0;
  const actualRecipient = isRedirected ? RESEND_DEV_REDIRECT_TO : originalRecipient;

  const subject = isRedirected
    ? "[DEV - to: " + originalRecipient + "] " + PAYMENT_APP_NAME + " payment receipt " + params.receiptCode
    : PAYMENT_APP_NAME + " payment receipt " + params.receiptCode;

  let html = renderReceiptHtml(params.receiptCode, params.payload);
  let text = renderReceiptText(params.receiptCode, params.payload);

  if (isRedirected) {
    const banner =
      '<div style="background:#fff7e6;border:1px solid #f5c97d;color:#7a4c0d;padding:12px 16px;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;margin:0 0 16px 0;">'
      + "<strong>Dev redirect:</strong> this receipt was originally addressed to <strong>"
      + escapeHtml(originalRecipient)
      + "</strong>. It was rerouted here because no Resend domain is verified. Set <code>RESEND_DEV_REDIRECT_TO</code> to empty after verifying a domain at resend.com/domains."
      + "</div>";
    html = banner + html;
    text =
      "[DEV REDIRECT] Originally addressed to: "
      + originalRecipient
      + "\nResend free-tier only delivers to the verified Resend account email until a domain is added at resend.com/domains.\n\n"
      + text;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: PAYMENT_RECEIPT_FROM_EMAIL,
      to: [actualRecipient],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    // Check if this is the expected "dev redirect" 403 error
    const is403DevRedirect = response.status === 403 && 
      errorText.includes("validation_error") && 
      errorText.includes("testing emails") &&
      RESEND_DEV_REDIRECT_TO.length > 0;
    
    if (is403DevRedirect) {
      // Resend free-tier rejected because recipient isn't the verified
      // account email. Retry sending to the dev redirect email directly.
      const retryTo = RESEND_DEV_REDIRECT_TO;
      const retrySubject = "[DEV - to: " + originalRecipient + "] " + PAYMENT_APP_NAME + " payment receipt " + params.receiptCode;
      const retryBanner =
        '<div style="background:#fff7e6;border:1px solid #f5c97d;color:#7a4c0d;padding:12px 16px;border-radius:8px;font-family:Arial,sans-serif;font-size:13px;margin:0 0 16px 0;">'
        + "<strong>Dev redirect:</strong> this receipt was originally addressed to <strong>"
        + escapeHtml(originalRecipient)
        + "</strong>.</div>";
      const retryHtml = retryBanner + renderReceiptHtml(params.receiptCode, params.payload);
      const retryText = "[DEV REDIRECT] Originally to: " + originalRecipient + "\n\n" + renderReceiptText(params.receiptCode, params.payload);

      const retryResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: PAYMENT_RECEIPT_FROM_EMAIL,
          to: [retryTo],
          subject: retrySubject,
          html: retryHtml,
          text: retryText,
        }),
      });

      const retryOk = retryResponse.ok;
      await supabaseAdmin
        .from("payment_receipts")
        .update({
          email_status: retryOk ? "sent_dev_redirect" : "failed",
          email_sent_at: retryOk ? nowIso() : null,
          email_error: retryOk
            ? "Dev mode: Redirected to " + retryTo + " (intended for " + originalRecipient + ")"
            : ("Retry also failed: " + (await retryResponse.text()).slice(0, 300)),
        })
        .eq("id", params.receiptId);

      if (retryOk) {
        const userId = (params.payload as JsonRecord).customerUserId as string | undefined;
        if (userId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            type: "receipt_sent",
            title: "Payment receipt emailed",
            body: "Receipt " + params.receiptCode + " was sent to " + originalRecipient + ".",
            link_url: "/frontend/payment-receipt.html?payment=" + params.receiptCode,
            metadata: { receiptCode: params.receiptCode },
          });
        }
      }
      return;
    }
    
    // Real error - not the dev redirect 403
    await supabaseAdmin
      .from("payment_receipts")
      .update({
        email_status: "failed",
        email_error: ("Resend HTTP " + response.status + ": " + errorText).slice(0, 480),
      })
      .eq("id", params.receiptId);
    return;
  }

  await supabaseAdmin
    .from("payment_receipts")
    .update({
      email_status: isRedirected ? "sent_dev_redirect" : "sent",
      email_sent_at: nowIso(),
      email_error: isRedirected
        ? "Redirected to dev inbox " + actualRecipient + " (intended for " + originalRecipient + ")"
        : null,
    })
    .eq("id", params.receiptId);

  const userId = (params.payload as JsonRecord).booking
    ? ((params.payload as JsonRecord).customerUserId as string | undefined)
    : undefined;

  if (userId) {
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "receipt_sent",
      title: "Payment receipt emailed",
      body: "Receipt " + params.receiptCode + " was sent to " + originalRecipient + ".",
      link_url: "/frontend/payment-receipt.html?payment=" + params.receiptCode,
      metadata: { receiptCode: params.receiptCode },
    });
  }
}

function renderReceiptHtml(receiptCode: string, payload: JsonRecord): string {
  const booking = (payload.booking as JsonRecord) || {};
  const breakdown = (booking.breakdown as JsonRecord) || {};
  const total = Number(booking.totalAmount || 0);
  const paid = Number(booking.paidAmount || 0);
  const remaining = Number(booking.remainingAmount || 0);
  const amount = Number(payload.amount || 0);
  const isFull = remaining <= 0.005;

  return `<!doctype html>
<html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f7f6;margin:0;padding:24px;color:#0f2a2c">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 22px rgba(8,32,34,0.08)">
    <div style="background:linear-gradient(135deg,#0e3a3d,#1d6e63);padding:22px 26px;color:#fff">
      <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85">${escapeHtml(PAYMENT_APP_NAME)}</p>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;letter-spacing:-0.01em">Payment Receipt ${escapeHtml(receiptCode)}</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.9">Transaction ${escapeHtml(String(payload.transactionCode || "-"))} &middot; ${escapeHtml(formatDate(String(payload.paidAt || payload.issuedAt || "")))}</p>
    </div>
    <div style="padding:22px 26px">
      <p style="margin:0 0 14px;font-size:15px">Hi ${escapeHtml(String(booking.customerName || "there"))}, your payment of <strong>${escapeHtml(moneyText(amount))}</strong> was received successfully.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13.5px">
        <tr><td style="padding:6px 0;color:#54716f">Booking</td><td style="text-align:right;font-weight:600">${escapeHtml(String(booking.bookingCode || "-"))}</td></tr>
        <tr><td style="padding:6px 0;color:#54716f">eSewa Reference</td><td style="text-align:right;font-weight:600">${escapeHtml(String(payload.providerTransactionId || "-"))}</td></tr>
        <tr><td style="padding:6px 0;color:#54716f">Travel Dates</td><td style="text-align:right">${escapeHtml(formatDate(String(booking.startDate || "")))} &rarr; ${escapeHtml(formatDate(String(booking.endDate || "")))}</td></tr>
        <tr><td style="padding:6px 0;color:#54716f">Payment Type</td><td style="text-align:right;text-transform:capitalize">${escapeHtml(String(payload.paymentType || ""))}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e3eae8;margin:18px 0">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13.5px">
        <tr><td style="padding:4px 0;color:#54716f">Base</td><td style="text-align:right">${escapeHtml(moneyText(Number(breakdown.baseAmount || 0)))}</td></tr>
        <tr><td style="padding:4px 0;color:#54716f">Service Fee</td><td style="text-align:right">${escapeHtml(moneyText(Number(breakdown.serviceFee || 0)))}</td></tr>
        <tr><td style="padding:4px 0;color:#54716f">Tax</td><td style="text-align:right">${escapeHtml(moneyText(Number(breakdown.taxAmount || 0)))}</td></tr>
        <tr><td style="padding:4px 0;color:#54716f">Discount</td><td style="text-align:right;color:#10916b">- ${escapeHtml(moneyText(Number(breakdown.discountAmount || 0)))}</td></tr>
        <tr><td style="padding:8px 0 0;font-weight:700">Booking Total</td><td style="text-align:right;font-weight:700">${escapeHtml(moneyText(total))}</td></tr>
      </table>
      <div style="margin-top:18px;padding:14px 16px;border-radius:12px;background:${isFull ? "#e7f6ee" : "#fff5e6"};border:1px solid ${isFull ? "#bce0c9" : "#f4d9b1"}">
        <p style="margin:0;font-size:13px;color:#3d5a48">${isFull ? "Booking fully paid. Thank you!" : "Partial payment received. Remaining balance:"}</p>
        ${isFull ? "" : `<p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#7a4711">${escapeHtml(moneyText(remaining))}</p>`}
        <p style="margin:8px 0 0;font-size:13px;color:#54716f">Paid so far: <strong>${escapeHtml(moneyText(paid))}</strong> of ${escapeHtml(moneyText(total))}</p>
      </div>
      <p style="margin:22px 0 0;font-size:12px;color:#728d8c">Issued by ${escapeHtml(PAYMENT_APP_NAME)}. Reach us at support if anything looks off.</p>
    </div>
  </div>
</body></html>`;
}

function renderReceiptText(receiptCode: string, payload: JsonRecord): string {
  const booking = (payload.booking as JsonRecord) || {};
  const total = Number(booking.totalAmount || 0);
  const paid = Number(booking.paidAmount || 0);
  const remaining = Number(booking.remainingAmount || 0);
  const amount = Number(payload.amount || 0);

  return [
    PAYMENT_APP_NAME + " - Payment Receipt " + receiptCode,
    "Booking: " + (booking.bookingCode || "-"),
    "Transaction: " + (payload.transactionCode || "-"),
    "eSewa Ref: " + (payload.providerTransactionId || "-"),
    "Amount: " + moneyText(amount),
    "Total: " + moneyText(total),
    "Paid: " + moneyText(paid),
    "Remaining: " + moneyText(remaining),
    "Issued at: " + (payload.paidAt || payload.issuedAt || ""),
  ].join("\n");
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ------------------------------------------------------------------------- */
/* RESEND RECEIPT                                                             */
/* ------------------------------------------------------------------------- */

async function handleResendReceipt(payload: JsonRecord, request: Request): Promise<Response> {
  const user = await resolveUserFromRequest(request);
  if (!user) return unauthorized();

  const txCode = String(payload.transactionCode || "").trim();
  if (!txCode) return badRequest("transactionCode is required.");

  const payment = await fetchPaymentByTransactionCode(txCode);
  if (!payment) return badRequest("Payment not found.");

  if (payment.customer_user_id && payment.customer_user_id !== user.id) {
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) return forbidden("You cannot resend another user's receipt.");
  }

  if (payment.status !== "completed") {
    return badRequest("Receipts can only be resent for completed payments.");
  }

  try {
    await ensureReceiptForPayment(payment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receipt resend failed.";
    return serverError(message);
  }

  return jsonResponse(200, {
    success: true,
    message: "Receipt resent.",
    transactionCode: txCode,
  });
}

/* ------------------------------------------------------------------------- */
/* LIST USER PAYMENTS                                                         */
/* ------------------------------------------------------------------------- */

async function handleListUserPayments(_payload: JsonRecord, request: Request): Promise<Response> {
  const user = await resolveUserFromRequest(request);
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("list_user_payments failed:", error.message);
    return serverError("Could not load payments.");
  }

  return jsonResponse(200, {
    success: true,
    payments: data || [],
  });
}

/* ------------------------------------------------------------------------- */
/* EXPIRE STALE                                                               */
/* ------------------------------------------------------------------------- */

async function handleExpireStale(_payload: JsonRecord, request: Request): Promise<Response> {
  const user = await resolveUserFromRequest(request);
  if (!user) return unauthorized();
  if (!(await isAdmin(user.id))) return forbidden("Admin only.");

  const { data, error } = await supabaseAdmin.rpc("expire_stale_payments");
  if (error) return serverError(error.message);

  return jsonResponse(200, { success: true, expired: Number(data || 0) });
}

/* ------------------------------------------------------------------------- */
/* HTTP ENTRY                                                                 */
/* ------------------------------------------------------------------------- */

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { success: false, message: "Method not allowed." });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, {
      success: false,
      message: "Function configuration is incomplete.",
    });
  }

  let payload: JsonRecord;
  try {
    payload = (await request.json()) as JsonRecord;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const action = String(payload.action || "").trim().toLowerCase();

  try {
    switch (action) {
      case "initiate":
        return await handleInitiate(payload, request);
      case "verify":
        return await handleVerify(payload, request);
      case "resend_receipt":
        return await handleResendReceipt(payload, request);
      case "list_user_payments":
        return await handleListUserPayments(payload, request);
      case "expire_stale":
        return await handleExpireStale(payload, request);
      default:
        return badRequest("Unsupported action. Use initiate / verify / resend_receipt / list_user_payments / expire_stale.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    console.error("esewa-payment unhandled:", message);
    return serverError(message);
  }
});
