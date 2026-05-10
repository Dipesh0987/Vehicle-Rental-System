/**
 * damage-billing edge function
 * --------------------------------------------------------------------------
 * Handles the full damage charge lifecycle for approved maintenance claims.
 *
 * Actions (all POST with JSON body containing `action`):
 *   initiate        – admin only. Create INV-XXXX bill, build eSewa form,
 *                     send payment-request email to customer.
 *   get_bill        – public (no auth). Return bill details + eSewa form
 *                     fields so the customer payment page can render.
 *   verify          – public. Verify eSewa return payload, mark bill Paid,
 *                     stamp maintenance record as Billed, emit receipts.
 *   resend          – admin only. Re-send the billing email.
 *   escalate_check  – admin only. Call escalate_overdue_damage_bills() RPC.
 *
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ESEWA_GATEWAY_URL          e.g. https://rc-epay.esewa.com.np/api/epay/main/v2/form
 *   ESEWA_STATUS_URL           e.g. https://rc.esewa.com.np/api/epay/transaction/status/
 *   ESEWA_PRODUCT_CODE         EPAYTEST (sandbox) or merchant product code
 *   ESEWA_SECRET_KEY           merchant secret
 *   DAMAGE_PAYMENT_BASE_URL    absolute origin where damage-payment.html lives
 *   RESEND_API_KEY             for notification emails
 *   PAYMENT_RECEIPT_FROM_EMAIL from address
 *   PAYMENT_APP_NAME           friendly app name (default: RentAVehicle Nepal)
 *   RESEND_DEV_REDIRECT_TO     optional – dev inbox override (same as esewa fn)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

type DamageBillRow = {
  id: string;
  bill_code: string;
  transaction_code: string | null;
  maintenance_record_id: string | null;
  maintenance_ref: string;
  booking_ref: string | null;
  customer_name: string;
  customer_email: string;
  amount: number;
  reason: string;
  notes: string | null;
  status: string;
  esewa_uuid: string | null;
  esewa_ref_id: string | null;
  payment_url: string | null;
  billed_at: string;
  due_at: string;
  paid_at: string | null;
  escalated_at: string | null;
  created_at: string;
  updated_at: string;
};

type EsewaStatusResponse = {
  product_code?: string;
  transaction_uuid?: string;
  total_amount?: number | string;
  status?: string;
  ref_id?: string | null;
};

// ── Env ──────────────────────────────────────────────────────────────────
const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")             ?? "";
const SUPABASE_SERVICE_ROLE_KEY= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?? "";
const ESEWA_GATEWAY_URL        = (Deno.env.get("ESEWA_GATEWAY_URL")        ?? "").trim();
const ESEWA_STATUS_URL         = (Deno.env.get("ESEWA_STATUS_URL")         ?? "").trim().replace(/\/$/, "");
const ESEWA_PRODUCT_CODE       = (Deno.env.get("ESEWA_PRODUCT_CODE")       ?? "").trim();
const ESEWA_SECRET_KEY         = (Deno.env.get("ESEWA_SECRET_KEY")         ?? "").trim();
const DAMAGE_PAYMENT_BASE_URL  = (Deno.env.get("DAMAGE_PAYMENT_BASE_URL")  ?? "").trim().replace(/\/$/, "");
const RESEND_API_KEY           = (Deno.env.get("RESEND_API_KEY")           ?? "").trim();
const PAYMENT_RECEIPT_FROM_EMAIL =
  (Deno.env.get("PAYMENT_RECEIPT_FROM_EMAIL") ?? "").trim()
  || `RentAVehicle Billing ${crypto.randomUUID().slice(0,8)} <onboarding@resend.dev>`;
const PAYMENT_APP_NAME         =
  (Deno.env.get("PAYMENT_APP_NAME") ?? "").trim() || "RentAVehicle Nepal";
const RESEND_DEV_REDIRECT_TO   =
  (Deno.env.get("RESEND_DEV_REDIRECT_TO") ?? "").trim().toLowerCase();

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[damage-billing] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Response helpers ──────────────────────────────────────────────────────
function jsonRes(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const ok        = (body: JsonRecord)         => jsonRes(200, { success: true,  ...body });
const badReq    = (message: string)          => jsonRes(400, { success: false, message });
const unauth    = (message = "Authentication required.") => jsonRes(401, { success: false, message });
const forbidden = (message = "Admin access required.")   => jsonRes(403, { success: false, message });
const srvErr    = (message = "Unexpected server error.")  => jsonRes(500, { success: false, message });
const notCfg    = ()                         => jsonRes(503, {
  success: false,
  message: "eSewa payment gateway is not configured. Set ESEWA_GATEWAY_URL, ESEWA_PRODUCT_CODE, and ESEWA_SECRET_KEY.",
});

// ── Utilities ─────────────────────────────────────────────────────────────
function nowIso(): string { return new Date().toISOString(); }

function roundMoney(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function formatAmountForSign(amount: number): string {
  return (Number(amount) || 0).toFixed(2);
}

function parseAmountFromResponse(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function moneyText(amount: number): string {
  return "NPR " + (Number(amount) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return String(iso); }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isEsewaConfigured(): boolean {
  return Boolean(
    SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY &&
    ESEWA_GATEWAY_URL && ESEWA_STATUS_URL &&
    ESEWA_PRODUCT_CODE && ESEWA_SECRET_KEY,
  );
}

// ── eSewa signature (HMAC-SHA256, base64) ────────────────────────────────
async function computeEsewaSignature(
  values: Record<string, string>,
  signedFieldNames: string,
): Promise<string> {
  const keys    = signedFieldNames.split(",").map((s) => s.trim()).filter(Boolean);
  const message = keys.map((k) => `${k}=${values[k] ?? ""}`).join(",");
  const enc     = new TextEncoder();
  const key     = await crypto.subtle.importKey(
    "raw", enc.encode(ESEWA_SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const mac     = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes   = new Uint8Array(mac);
  let   binary  = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64UrlSafeDecodeJson(value: string): JsonRecord | null {
  try {
    let n = String(value).replace(/-/g, "+").replace(/_/g, "/");
    while (n.length % 4 !== 0) n += "=";
    return JSON.parse(atob(n)) as JsonRecord;
  } catch (e) {
    console.error("[damage-billing] base64 decode failed:", e);
    return null;
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────
async function resolveUser(request: Request): Promise<{ id: string; email: string } | null> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: String(data.user.email || "").trim().toLowerCase() };
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("is_admin_user", { check_user: userId });
  if (error) return false;
  return Boolean(data);
}

async function requireAdmin(request: Request): Promise<
  { ok: true; user: { id: string; email: string } } |
  { ok: false; response: Response }
> {
  const user = await resolveUser(request);
  if (!user) return { ok: false, response: unauth() };
  if (!(await isAdmin(user.id))) return { ok: false, response: forbidden() };
  return { ok: true, user };
}

// ── DB helpers ────────────────────────────────────────────────────────────
async function fetchBill(billCode: string): Promise<DamageBillRow | null> {
  const { data, error } = await supabaseAdmin
    .from("damage_bills")
    .select("*")
    .eq("bill_code", billCode)
    .maybeSingle();
  if (error) { console.error("[damage-billing] fetchBill:", error.message); return null; }
  return (data as DamageBillRow) ?? null;
}

async function nextBillCode(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("next_bill_code");
  if (error || !data) {
    const ts = Date.now().toString().slice(-6);
    return `INV-${ts}`;
  }
  return String(data);
}

async function nextTransactionCode(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("next_damage_transaction_code");
  if (error || !data) {
    const ts = Date.now().toString().slice(-5);
    return `P-${ts}`;
  }
  return String(data);
}

// ── Build eSewa form fields ───────────────────────────────────────────────
async function buildEsewaFormFields(params: {
  billCode:   string;
  amount:     number;
  successUrl: string;
  failureUrl: string;
}): Promise<{ formFields: Record<string, string>; gatewayUrl: string; transactionUuid: string }> {
  const amountStr = formatAmountForSign(params.amount);
  const uuid      = `DMG-${params.billCode}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const signedFieldNames = "total_amount,transaction_uuid,product_code";
  const values: Record<string, string> = {
    amount:               amountStr,
    tax_amount:           "0.00",
    total_amount:         amountStr,
    transaction_uuid:     uuid,
    product_code:         ESEWA_PRODUCT_CODE,
    signed_field_names:   signedFieldNames,
    success_url:          params.successUrl,
    failure_url:          params.failureUrl,
  };
  values.signature = await computeEsewaSignature(values, signedFieldNames);

  return { formFields: values, gatewayUrl: ESEWA_GATEWAY_URL, transactionUuid: uuid };
}

// ── Email ─────────────────────────────────────────────────────────────────
async function sendBillingEmail(bill: DamageBillRow, paymentPageUrl: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[damage-billing] RESEND_API_KEY not set — email skipped.");
    return;
  }

  const originalTo = bill.customer_email;
  const isRedirected =
    RESEND_DEV_REDIRECT_TO.length > 0 &&
    RESEND_DEV_REDIRECT_TO !== originalTo.toLowerCase();
  const actualTo = isRedirected ? RESEND_DEV_REDIRECT_TO : originalTo;

  const subject = isRedirected
    ? `[DEV - to: ${originalTo}] ${PAYMENT_APP_NAME} — Damage charge ${bill.bill_code}`
    : `${PAYMENT_APP_NAME} — Damage charge ${bill.bill_code} (${moneyText(bill.amount)})`;

  const html = renderBillingEmailHtml(bill, paymentPageUrl, isRedirected ? originalTo : null);
  const text = renderBillingEmailText(bill, paymentPageUrl);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: PAYMENT_RECEIPT_FROM_EMAIL,
      to:   [actualTo],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[damage-billing] Resend HTTP ${res.status}: ${err}`);
  } else {
    console.log(`[damage-billing] Billing email sent to ${actualTo} for ${bill.bill_code}`);
  }
}

function renderBillingEmailHtml(
  bill: DamageBillRow,
  paymentPageUrl: string,
  devRedirectOriginal: string | null,
): string {
  const dueDate = formatDate(bill.due_at);

  const devBanner = devRedirectOriginal
    ? `<div style="background:#fff7e6;border:1px solid #f5c97d;color:#7a4c0d;padding:12px 16px;border-radius:8px;font-size:13px;margin:0 0 16px 0;">
        <strong>Dev redirect:</strong> originally addressed to <strong>${escapeHtml(devRedirectOriginal)}</strong>.
       </div>`
    : "";

  return `<!doctype html>
<html>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px;color:#1a1a1a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.09)">

    <div style="background:linear-gradient(135deg,#7f1d1d,#b91c1c);padding:24px 28px;color:#fff">
      <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8">${escapeHtml(PAYMENT_APP_NAME)}</p>
      <h1 style="margin:8px 0 0;font-size:22px;font-weight:800">Damage Charge Notice</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:0.9">Invoice ${escapeHtml(bill.bill_code)} &middot; Due ${escapeHtml(dueDate)}</p>
    </div>

    <div style="padding:24px 28px">
      ${devBanner}
      <p style="margin:0 0 20px;font-size:15px">
        Dear <strong>${escapeHtml(bill.customer_name)}</strong>,<br><br>
        A damage charge has been raised against your rental.
        Please review the details below and complete payment within <strong>72 hours</strong>
        to avoid further escalation.
      </p>

      <table cellpadding="0" cellspacing="0"
             style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr style="background:#fef2f2">
          <td style="padding:10px 14px;font-weight:600;color:#7f1d1d;border-radius:8px 0 0 8px">Invoice</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;border-radius:0 8px 8px 0">
            ${escapeHtml(bill.bill_code)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 14px;color:#555">Maintenance Claim</td>
          <td style="padding:8px 14px;text-align:right;font-weight:600">${escapeHtml(bill.maintenance_ref)}</td>
        </tr>
        ${bill.booking_ref
          ? `<tr><td style="padding:8px 14px;color:#555">Booking</td>
               <td style="padding:8px 14px;text-align:right;font-weight:600">${escapeHtml(bill.booking_ref)}</td></tr>`
          : ""}
        <tr>
          <td style="padding:8px 14px;color:#555">Reason</td>
          <td style="padding:8px 14px;text-align:right">${escapeHtml(bill.reason)}</td>
        </tr>
        <tr style="background:#fef2f2;border-radius:8px">
          <td style="padding:12px 14px;font-size:16px;font-weight:700;color:#b91c1c">Amount Due</td>
          <td style="padding:12px 14px;text-align:right;font-size:18px;font-weight:800;color:#b91c1c">
            ${escapeHtml(moneyText(bill.amount))}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 14px;color:#555">Payment Due</td>
          <td style="padding:8px 14px;text-align:right;color:#b91c1c;font-weight:600">
            ${escapeHtml(dueDate)}
          </td>
        </tr>
      </table>

      <div style="text-align:center;margin:24px 0">
        <a href="${escapeHtml(paymentPageUrl)}"
           style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                  font-size:16px;font-weight:700;padding:14px 36px;border-radius:10px;
                  letter-spacing:0.02em">
          Pay Now via eSewa
        </a>
      </div>

      <p style="font-size:12px;color:#888;margin:16px 0 0;text-align:center">
        If you have already settled this charge or believe it was raised in error,
        please contact us immediately at support.
      </p>
    </div>

    <div style="background:#f9fafb;padding:14px 28px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #f0f0f0">
      ${escapeHtml(PAYMENT_APP_NAME)} &middot; Automated billing notice
    </div>
  </div>
</body>
</html>`;
}

function renderBillingEmailText(bill: DamageBillRow, paymentPageUrl: string): string {
  return [
    `${PAYMENT_APP_NAME} — Damage Charge Notice`,
    `Invoice: ${bill.bill_code}`,
    `Claim:   ${bill.maintenance_ref}`,
    bill.booking_ref ? `Booking: ${bill.booking_ref}` : "",
    `Amount:  ${moneyText(bill.amount)}`,
    `Reason:  ${bill.reason}`,
    `Due by:  ${formatDate(bill.due_at)}`,
    "",
    "Pay now via eSewa:",
    paymentPageUrl,
    "",
    "If you believe this was raised in error, contact support immediately.",
  ].filter((l) => l !== undefined).join("\n");
}

// ── Action: initiate ──────────────────────────────────────────────────────
async function handleInitiate(payload: JsonRecord, request: Request): Promise<Response> {
  if (!isEsewaConfigured()) return notCfg();

  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  // Validate inputs
  const maintenanceRef  = String(payload.maintenanceRef  || "").trim();
  const maintenanceId   = String(payload.maintenanceId   || "").trim();
  const customerName    = String(payload.customerName    || "").trim();
  const customerEmail   = String(payload.customerEmail   || "").trim().toLowerCase();
  const rawAmount       = Number(payload.amount);
  const reason          = String(payload.reason          || "").trim();
  const bookingRef      = String(payload.bookingRef      || "").trim();
  const notes           = String(payload.notes           || "").trim();

  if (!maintenanceRef) return badReq("maintenanceRef is required (e.g. M-301).");
  if (!customerName)   return badReq("customerName is required.");
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return badReq("A valid customerEmail is required.");
  }
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return badReq("amount must be a positive number.");
  }
  if (!reason) return badReq("reason is required.");

  const amount   = roundMoney(rawAmount);
  const billCode = await nextBillCode();

  const successUrl = `${DAMAGE_PAYMENT_BASE_URL}/damage-payment-return.html?bill=${encodeURIComponent(billCode)}`;
  const failureUrl = `${DAMAGE_PAYMENT_BASE_URL}/damage-payment.html?bill=${encodeURIComponent(billCode)}&failed=1`;

  const { formFields, gatewayUrl, transactionUuid } =
    await buildEsewaFormFields({ billCode, amount, successUrl, failureUrl });

  const paymentUrl = `${DAMAGE_PAYMENT_BASE_URL}/damage-payment.html?bill=${encodeURIComponent(billCode)}`;

  const insertPayload: JsonRecord = {
    bill_code:             billCode,
    maintenance_ref:       maintenanceRef,
    booking_ref:           bookingRef || null,
    customer_name:         customerName,
    customer_email:        customerEmail,
    amount,
    reason,
    notes:                 notes || null,
    status:                "Pending",
    esewa_uuid:            transactionUuid,
    payment_url:           paymentUrl,
  };
  if (maintenanceId) {
    insertPayload.maintenance_record_id = maintenanceId;
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("damage_bills")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertErr || !inserted) {
    console.error("[damage-billing] insert failed:", insertErr?.message);
    return srvErr("Could not create damage bill. Please try again.");
  }

  const bill = inserted as DamageBillRow;

  // Store eSewa form fields on the row so the payment page can retrieve them
  // without recomputing the signature (transaction_uuid must stay stable).
  await supabaseAdmin
    .from("damage_bills")
    .update({ notes: bill.notes })          // no-op update; real field update below
    .eq("id", bill.id);

  // We store form fields in notes as JSON so the payment page can read them
  // without exposing the secret key. The signature was computed server-side.
  await supabaseAdmin
    .from("damage_bills")
    .update({
      notes: (notes ? notes + "\n" : "") + "__esewa_form__:" + JSON.stringify(formFields),
    })
    .eq("id", bill.id);

  // Mark maintenance record as Billed if UUID supplied
  if (maintenanceId) {
    await supabaseAdmin
      .from("maintenance_records")
      .update({ status: "Billed", updated_at: nowIso() })
      .eq("id", maintenanceId);
  }

  // Admin notification
  await supabaseAdmin.from("notifications").insert({
    user_id:   null,
    is_admin:  true,
    type:      "damage_bill_issued",
    title:     `Damage bill issued — ${billCode}`,
    body:      `${customerName} billed ${moneyText(amount)} for claim ${maintenanceRef}. Payment due within 72 hours.`,
    metadata: {
      billCode,
      maintenanceRef,
      customerName,
      customerEmail,
      amount,
    },
  });

  // Send billing email (non-fatal if it fails)
  try {
    await sendBillingEmail(bill, paymentUrl);
  } catch (emailErr) {
    console.error("[damage-billing] email failed:", emailErr);
  }

  return ok({
    billCode,
    paymentUrl,
    transactionUuid,
    amount,
    dueAt: bill.due_at,
    emailSentTo: customerEmail,
  });
}

// ── Action: get_bill ──────────────────────────────────────────────────────
async function handleGetBill(payload: JsonRecord): Promise<Response> {
  const billCode = String(payload.billCode || "").trim().toUpperCase();
  if (!billCode) return badReq("billCode is required.");

  const bill = await fetchBill(billCode);
  if (!bill) return jsonRes(404, { success: false, message: "Bill not found." });

  // Parse stored eSewa form fields
  let formFields: Record<string, string> | null = null;
  let gatewayUrl = ESEWA_GATEWAY_URL;

  const notesStr = bill.notes ?? "";
  const marker   = "__esewa_form__:";
  const markerIdx = notesStr.lastIndexOf(marker);
  if (markerIdx !== -1) {
    try {
      formFields = JSON.parse(notesStr.slice(markerIdx + marker.length)) as Record<string, string>;
    } catch {
      console.warn("[damage-billing] Could not parse stored form fields for", billCode);
    }
  }

  return ok({
    billCode:       bill.bill_code,
    maintenanceRef: bill.maintenance_ref,
    bookingRef:     bill.booking_ref,
    customerName:   bill.customer_name,
    amount:         bill.amount,
    reason:         bill.reason,
    status:         bill.status,
    dueAt:          bill.due_at,
    billedAt:       bill.billed_at,
    paidAt:         bill.paid_at,
    transactionCode:bill.transaction_code,
    esewa: bill.status === "Pending" || bill.status === "Overdue"
      ? { gatewayUrl, formFields }
      : null,
  });
}

// ── Action: verify ────────────────────────────────────────────────────────
async function handleVerify(payload: JsonRecord): Promise<Response> {
  if (!isEsewaConfigured()) return notCfg();

  const billCode  = String(payload.billCode  || "").trim().toUpperCase();
  const esewaData = String(payload.esewaData || "").trim();

  if (!billCode)  return badReq("billCode is required.");
  if (!esewaData) return badReq("esewaData (base64 from eSewa return URL) is required.");

  // 1. Decode eSewa return payload
  const decoded = base64UrlSafeDecodeJson(esewaData);
  if (!decoded) return badReq("Could not decode eSewa return data.");

  const returnedUuid   = String(decoded.transaction_uuid || "").trim();
  const returnedStatus = String(decoded.status           || "").trim();
  const returnedAmount = parseAmountFromResponse(decoded.total_amount);
  const returnedRefId  = String(decoded.transaction_code || "").trim();

  if (returnedStatus !== "COMPLETE") {
    return jsonRes(200, {
      success:   false,
      paid:      false,
      message:   `eSewa payment status: ${returnedStatus}. Payment was not completed.`,
      esewaStatus: returnedStatus,
    });
  }

  // 2. Fetch the bill and guard against double-processing
  const bill = await fetchBill(billCode);
  if (!bill) return jsonRes(404, { success: false, message: "Bill not found." });

  if (bill.status === "Paid") {
    return ok({
      paid:            true,
      billCode:        bill.bill_code,
      transactionCode: bill.transaction_code,
      message:         "Bill already marked as paid.",
    });
  }

  // 3. Verify transaction_uuid matches what we stored
  if (bill.esewa_uuid && returnedUuid && bill.esewa_uuid !== returnedUuid) {
    console.warn(
      `[damage-billing] UUID mismatch for ${billCode}: stored=${bill.esewa_uuid} returned=${returnedUuid}`,
    );
  }

  // 4. Double-check with eSewa status API
  let verifiedAmount = returnedAmount;
  let esewaRefId     = returnedRefId;

  try {
    const statusRes = await fetch(
      `${ESEWA_STATUS_URL}?product_code=${encodeURIComponent(ESEWA_PRODUCT_CODE)}`
      + `&transaction_uuid=${encodeURIComponent(returnedUuid || bill.esewa_uuid || "")}`
      + `&total_amount=${encodeURIComponent(formatAmountForSign(bill.amount))}`,
    );
    if (statusRes.ok) {
      const statusBody = (await statusRes.json()) as EsewaStatusResponse;
      if (String(statusBody.status || "").toUpperCase() !== "COMPLETE") {
        return jsonRes(200, {
          success:     false,
          paid:        false,
          message:     "eSewa status API did not confirm payment.",
          esewaStatus: statusBody.status,
        });
      }
      verifiedAmount = parseAmountFromResponse(statusBody.total_amount) || verifiedAmount;
      esewaRefId     = String(statusBody.ref_id || esewaRefId || "").trim();
    }
  } catch (statusErr) {
    console.warn("[damage-billing] eSewa status API call failed (proceeding):", statusErr);
  }

  // 5. Generate P-XXXX transaction code
  const transactionCode = await nextTransactionCode();

  // 6. Mark bill as Paid
  await supabaseAdmin
    .from("damage_bills")
    .update({
      status:           "Paid",
      transaction_code: transactionCode,
      esewa_ref_id:     esewaRefId || null,
      paid_at:          nowIso(),
      updated_at:       nowIso(),
    })
    .eq("id", bill.id);

  // 7. Admin notification
  await supabaseAdmin.from("notifications").insert({
    user_id:  null,
    is_admin: true,
    type:     "damage_bill_paid",
    title:    `Damage bill paid — ${billCode}`,
    body:     `${bill.customer_name} paid ${moneyText(verifiedAmount)} for ${billCode} (${bill.maintenance_ref}). Transaction: ${transactionCode}.`,
    metadata: {
      billCode,
      transactionCode,
      maintenanceRef: bill.maintenance_ref,
      customerName:   bill.customer_name,
      amount:         verifiedAmount,
    },
  });

  return ok({
    paid:            true,
    billCode:        bill.bill_code,
    transactionCode,
    amount:          verifiedAmount,
    maintenanceRef:  bill.maintenance_ref,
    customerName:    bill.customer_name,
    message:         "Payment verified. Bill marked as Paid.",
  });
}

// ── Action: resend ────────────────────────────────────────────────────────
async function handleResend(payload: JsonRecord, request: Request): Promise<Response> {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  const billCode = String(payload.billCode || "").trim().toUpperCase();
  if (!billCode) return badReq("billCode is required.");

  const bill = await fetchBill(billCode);
  if (!bill) return jsonRes(404, { success: false, message: "Bill not found." });
  if (bill.status === "Paid") return badReq("Bill is already paid. Resend is not needed.");
  if (bill.status === "Cancelled") return badReq("Bill is cancelled.");
  if (!bill.payment_url) return badReq("Bill has no payment URL. Re-initiate the bill.");

  try {
    await sendBillingEmail(bill, bill.payment_url);
  } catch (e) {
    console.error("[damage-billing] resend email failed:", e);
    return srvErr("Email delivery failed. Please try again.");
  }

  return ok({ billCode, message: `Billing email resent to ${bill.customer_email}.` });
}

// ── Action: escalate_check ────────────────────────────────────────────────
async function handleEscalateCheck(request: Request): Promise<Response> {
  const authResult = await requireAdmin(request);
  if (!authResult.ok) return authResult.response;

  const { data, error } = await supabaseAdmin.rpc("escalate_overdue_damage_bills");
  if (error) {
    console.error("[damage-billing] escalate RPC failed:", error.message);
    return srvErr("Escalation check failed: " + error.message);
  }

  const escalated = Number(data ?? 0);
  return ok({
    escalated,
    message: escalated > 0
      ? `${escalated} bill(s) escalated to Overdue and admins notified.`
      : "No overdue bills found.",
  });
}

// ── Router ────────────────────────────────────────────────────────────────
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonRes(405, { success: false, message: "Method not allowed. Use POST." });
  }

  let payload: JsonRecord;
  try {
    payload = (await request.json()) as JsonRecord;
  } catch {
    return badReq("Request body must be valid JSON.");
  }

  const action = String(payload.action || "").trim().toLowerCase();

  try {
    switch (action) {
      case "initiate":        return await handleInitiate(payload, request);
      case "get_bill":        return await handleGetBill(payload);
      case "verify":          return await handleVerify(payload);
      case "resend":          return await handleResend(payload, request);
      case "escalate_check":  return await handleEscalateCheck(request);
      default:
        return badReq(`Unknown action "${action}". Valid: initiate, get_bill, verify, resend, escalate_check.`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error.";
    console.error("[damage-billing] Unhandled error:", msg);
    return srvErr(msg);
  }
});
