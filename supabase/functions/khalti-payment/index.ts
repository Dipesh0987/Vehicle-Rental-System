/**
 * khalti-payment edge function
 * --------------------------------------------------------------------------
 * Single function, multiple actions:
 *   - initiate          : create a payments row + call Khalti ePayment v2
 *                          /epayment/initiate, return payment_url
 *   - verify            : look up Khalti by pidx, mark payment as completed
 *                          on success, generate + email receipt
 *   - resend_receipt    : resend the email for an existing receipt
 *   - list_user_payments: paginated payment history for the calling user
 *   - expire_stale      : admin-only sweep of expired payments
 *
 * Security
 *   - Client must send a Supabase auth JWT in `Authorization: Bearer <jwt>`.
 *   - We resolve the user from that JWT and verify booking ownership before
 *     any state mutation.
 *   - All DB writes go through the service role so RLS cannot be tricked
 *     into letting one user pay for another's booking.
 *
 * Environment (all required for production)
 *   SUPABASE_URL                 standard
 *   SUPABASE_SERVICE_ROLE_KEY    standard
 *   KHALTI_BASE_URL              eg https://a.khalti.com/api/v2 (live)
 *                                or https://dev.khalti.com/api/v2 (sandbox)
 *   KHALTI_SECRET_KEY            Khalti merchant secret key
 *   PAYMENT_RETURN_URL           absolute URL of payment-return.html
 *   PAYMENT_WEBSITE_URL          absolute origin of the website
 *   RESEND_API_KEY               for receipt emails
 *   PAYMENT_RECEIPT_FROM_EMAIL   from address (defaults to onboarding@resend)
 *   PAYMENT_APP_NAME             friendly name in emails (defaults RAV)
 *   PARTIAL_PAYMENT_PERCENT      0..1, defaults 0.60
 *
 * Failure mode
 *   If KHALTI_BASE_URL or KHALTI_SECRET_KEY are missing the function returns
 *   503 with a clear message. The rest of the site continues to work.
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
  khalti_pidx: string | null;
  khalti_transaction_id: string | null;
  khalti_payment_url: string | null;
  khalti_response: JsonRecord;
  initiated_at: string;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

type KhaltiInitiateResponse = {
  pidx?: string;
  payment_url?: string;
  expires_at?: string;
  expires_in?: number;
  user_fee?: number;
  detail?: string;
  error_key?: string;
};

type KhaltiLookupResponse = {
  pidx?: string;
  total_amount?: number;
  status?: string;
  transaction_id?: string | null;
  fee?: number;
  refunded?: boolean;
  detail?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const KHALTI_BASE_URL = (Deno.env.get("KHALTI_BASE_URL") ?? "").trim().replace(/\/$/, "");
const KHALTI_SECRET_KEY = (Deno.env.get("KHALTI_SECRET_KEY") ?? "").trim();
const PAYMENT_RETURN_URL = (Deno.env.get("PAYMENT_RETURN_URL") ?? "").trim();
const PAYMENT_WEBSITE_URL = (Deno.env.get("PAYMENT_WEBSITE_URL") ?? "").trim();
const RESEND_API_KEY = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const PAYMENT_RECEIPT_FROM_EMAIL =
  (Deno.env.get("PAYMENT_RECEIPT_FROM_EMAIL") ?? "").trim()
  || "Rent A Vehicle Nepal <onboarding@resend.dev>";
// Resend free-tier only delivers to the verified account email until a
// domain is added at resend.com/domains. Set RESEND_DEV_REDIRECT_TO to
// your Resend account email during development, or leave empty once a
// domain is verified so emails go directly to the real user.
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
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for khalti-payment.");
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
      "Payment provider is not configured. Set KHALTI_BASE_URL and KHALTI_SECRET_KEY in the function secrets.",
  });
}

function isPaymentConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_SERVICE_ROLE_KEY &&
    KHALTI_BASE_URL &&
    KHALTI_SECRET_KEY,
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function paisa(amountInRupees: number): number {
  return Math.round((Number(amountInRupees) || 0) * 100);
}

function rupees(amountInPaisa: number): number {
  return Math.round((Number(amountInPaisa) || 0)) / 100;
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

async function fetchPaymentByPidx(pidx: string): Promise<PaymentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("khalti_pidx", pidx)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("fetchPaymentByPidx failed:", error.message);
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
    // 'full' meaning pay everything that's owed right now.
    amount = remaining;
  }

  if (amount <= 0) return badRequest("Computed payment amount is zero. Nothing to pay.");
  if (amount > remaining + 0.005) {
    return badRequest("Payment amount exceeds the remaining balance.");
  }

  // Cancel any prior open attempts (initiated/pending) for this booking so we
  // don't end up with a fan-out of pidxes the admin would have to reconcile.
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
      payment_method: "khalti",
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

  let khaltiPayload: KhaltiInitiateResponse;
  try {
    khaltiPayload = await callKhaltiInitiate({
      booking,
      payment,
      amount,
      paymentType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Khalti initiate failed.";
    console.error("Khalti initiate error:", message);
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", failure_reason: message.slice(0, 480) })
      .eq("id", payment.id);
    return jsonResponse(502, { success: false, message: "Could not start Khalti payment: " + message });
  }

  if (!khaltiPayload?.pidx || !khaltiPayload?.payment_url) {
    const detail = khaltiPayload?.detail || "Khalti did not return a payment URL.";
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", failure_reason: detail.slice(0, 480) })
      .eq("id", payment.id);
    return jsonResponse(502, { success: false, message: detail });
  }

  await supabaseAdmin
    .from("payments")
    .update({
      khalti_pidx: khaltiPayload.pidx,
      khalti_payment_url: khaltiPayload.payment_url,
      khalti_response: khaltiPayload as JsonRecord,
      status: "pending",
    })
    .eq("id", payment.id);

  await supabaseAdmin.from("notifications").insert({
    user_id: user.id,
    type: "payment_initiated",
    title: "Khalti payment started",
    body:
      "We started a Khalti payment of " + moneyText(amount)
      + " for booking " + booking.booking_code + ". Complete it within "
      + minutesUntil(expiresAt) + " minutes to confirm.",
    link_url: PAYMENT_RETURN_URL,
    metadata: {
      transactionCode: payment.transaction_code,
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      amount,
      paymentType,
      pidx: khaltiPayload.pidx,
    },
  });

  return jsonResponse(200, {
    success: true,
    paymentUrl: khaltiPayload.payment_url,
    pidx: khaltiPayload.pidx,
    transactionCode: payment.transaction_code,
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

function minutesUntil(iso: string): number {
  const ms = Date.parse(iso) - Date.now();
  return Math.max(0, Math.floor(ms / 60000));
}

async function callKhaltiInitiate(input: {
  booking: BookingRow;
  payment: PaymentRow;
  amount: number;
  paymentType: "full" | "partial";
}): Promise<KhaltiInitiateResponse> {
  const { booking, payment, amount, paymentType } = input;

  const body = {
    return_url: PAYMENT_RETURN_URL,
    website_url: PAYMENT_WEBSITE_URL || PAYMENT_RETURN_URL,
    amount: paisa(amount),
    purchase_order_id: payment.transaction_code,
    purchase_order_name:
      "Booking " + (booking.booking_code || booking.id.slice(0, 8))
      + (paymentType === "partial" ? " (60% advance)" : " (full payment)"),
    customer_info: {
      name: (booking.customer_name || "Customer").slice(0, 64),
      email: (booking.customer_email || "").slice(0, 64),
      phone: (booking.customer_phone || "9800000000").replace(/[^\d]/g, "").slice(-10) || "9800000000",
    },
    amount_breakdown: [
      {
        label: paymentType === "partial" ? "60% Advance" : "Booking Total",
        amount: paisa(amount),
      },
    ],
    product_details: [
      {
        identity: booking.id,
        name: "Vehicle Rental " + booking.booking_code,
        total_price: paisa(amount),
        quantity: 1,
        unit_price: paisa(amount),
      },
    ],
    merchant_username: "rent-a-vehicle",
    merchant_extra: payment.transaction_code,
  };

  const url = KHALTI_BASE_URL + "/epayment/initiate/";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Key " + KHALTI_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: KhaltiInitiateResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as KhaltiInitiateResponse) : {};
  } catch {
    /* keep parsed empty, surface text below */
  }

  if (!response.ok) {
    const detail = parsed?.detail || ("Khalti returned HTTP " + response.status + ": " + text.slice(0, 240));
    throw new Error(detail);
  }

  return parsed;
}

/* ------------------------------------------------------------------------- */
/* VERIFY                                                                     */
/* ------------------------------------------------------------------------- */

async function handleVerify(payload: JsonRecord, request: Request): Promise<Response> {
  if (!isPaymentConfigured()) return notConfigured();

  const user = await resolveUserFromRequest(request);
  if (!user) return unauthorized();

  const pidx = String(payload.pidx || "").trim();
  if (!pidx) return badRequest("pidx is required.");

  const payment = await fetchPaymentByPidx(pidx);
  if (!payment) return badRequest("Payment record not found for that pidx.");

  if (payment.customer_user_id && payment.customer_user_id !== user.id) {
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) return forbidden("You cannot verify another user's payment.");
  }

  // Idempotent: if already finalized, just return current snapshot.
  if (payment.status === "completed" || payment.status === "failed" || payment.status === "expired") {
    return jsonResponse(200, await buildVerifySummary(payment));
  }

  let lookup: KhaltiLookupResponse;
  try {
    lookup = await callKhaltiLookup(pidx);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Khalti lookup failed.";
    console.error("Khalti lookup error:", message);
    return jsonResponse(502, { success: false, message });
  }

  const lookupStatus = String(lookup.status || "").trim().toLowerCase();
  const merged = { ...(payment.khalti_response || {}), lookup };

  if (lookupStatus === "completed") {
    const finalizeUpdate = await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        khalti_transaction_id: lookup.transaction_id ?? null,
        khalti_response: merged,
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

    // Receipt is best-effort. The trigger has already created the booking
    // notification, so even if email fails the user sees the success state.
    try {
      await ensureReceiptForPayment(finalizedRow);
    } catch (error) {
      console.error("ensureReceiptForPayment error:", error);
    }

    return jsonResponse(200, await buildVerifySummary(finalizedRow));
  }

  // Anything that is not a success path becomes either pending, failed, or
  // expired so the frontend can show a clear retry option.
  let nextStatus: "pending" | "failed" | "expired" = "pending";
  let failureReason: string | null = null;

  if (["expired"].includes(lookupStatus)) {
    nextStatus = "expired";
    failureReason = "Khalti reported the payment session expired.";
  } else if (["user canceled", "user_canceled", "canceled"].includes(lookupStatus)) {
    nextStatus = "failed";
    failureReason = "Customer cancelled the payment on Khalti.";
  } else if (["failed", "refunded", "partially refunded"].includes(lookupStatus)) {
    nextStatus = "failed";
    failureReason = "Khalti returned status: " + lookup.status;
  }

  await supabaseAdmin
    .from("payments")
    .update({
      status: nextStatus,
      failure_reason: failureReason,
      khalti_response: merged,
      khalti_transaction_id: lookup.transaction_id ?? null,
    })
    .eq("id", payment.id);

  const refreshed = await fetchPaymentByPidx(pidx);
  return jsonResponse(200, await buildVerifySummary(refreshed || payment));
}

async function callKhaltiLookup(pidx: string): Promise<KhaltiLookupResponse> {
  const response = await fetch(KHALTI_BASE_URL + "/epayment/lookup/", {
    method: "POST",
    headers: {
      Authorization: "Key " + KHALTI_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pidx }),
  });

  const text = await response.text();
  let parsed: KhaltiLookupResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as KhaltiLookupResponse) : {};
  } catch {
    /* keep parsed empty */
  }

  if (!response.ok) {
    const detail = parsed?.detail || ("Khalti lookup HTTP " + response.status + ": " + text.slice(0, 240));
    throw new Error(detail);
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
    khaltiTransactionId: payment.khalti_transaction_id,
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
             ? "Khalti is still processing. Try again in a few seconds."
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
    khaltiTransactionId: payment.khalti_transaction_id,
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

  // Dev-redirect: reroute to the single Resend-verified inbox during
  // testing. Original recipient is preserved in subject + banner.
  const originalRecipient = params.to;
  const isRedirected =
    RESEND_DEV_REDIRECT_TO.length > 0
    && RESEND_DEV_REDIRECT_TO !== originalRecipient.toLowerCase();
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
      + "</strong>. It was rerouted here because no Resend domain is verified.</div>";
    html = banner + html;
    text =
      "[DEV REDIRECT] Originally addressed to: "
      + originalRecipient
      + "\nResend free-tier only delivers to the verified account email until a domain is added at resend.com/domains.\n\n"
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
      
      return; // Exit successfully
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
      email_status: "sent",
      email_sent_at: nowIso(),
      email_error: null,
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
      body: "Receipt " + params.receiptCode + " was sent to " + params.to + ".",
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
        <tr><td style="padding:6px 0;color:#54716f">Khalti Transaction</td><td style="text-align:right;font-weight:600">${escapeHtml(String(payload.khaltiTransactionId || "-"))}</td></tr>
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
    "Khalti Txn: " + (payload.khaltiTransactionId || "-"),
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
    console.error("khalti-payment unhandled:", message);
    return serverError(message);
  }
});
