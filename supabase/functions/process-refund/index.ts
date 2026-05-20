/**
 * process-refund edge function
 * --------------------------------------------------------------------------
 * Actions:
 *   - send_refund_email : Send email notification to customer about refund status
 *   - check_eligibility : Check refund eligibility for a booking (wrapper around DB fn)
 *
 * Security:
 *   - Requires valid Supabase auth JWT (admin role for mutations)
 *   - Uses service_role for DB writes
 *
 * Environment:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
 *   RESEND_API_KEY (for email sending)
 *   PAYMENT_RECEIPT_FROM_EMAIL (optional, defaults to onboarding@resend.dev)
 *   PAYMENT_APP_NAME (optional, defaults to "RENT A VEHICLE")
 *   PAYMENT_WEBSITE_URL (optional, for links in emails)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("PAYMENT_RECEIPT_FROM_EMAIL") || "onboarding@resend.dev";
    const appName = Deno.env.get("PAYMENT_APP_NAME") || "RENT A VEHICLE";
    const websiteUrl = Deno.env.get("PAYMENT_WEBSITE_URL") || "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration missing." }, 500);
    }

    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization." }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
      return jsonResponse({ error: "Invalid or expired token." }, 401);
    }

    // Parse body
    const body: JsonRecord = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    if (!action) {
      return jsonResponse({ error: "Missing action parameter." }, 400);
    }

    // ─── Action: send_refund_email ───────────────────────────────────────
    if (action === "send_refund_email") {
      const refundId = String(body.refundId || "").trim();
      if (!refundId) {
        return jsonResponse({ error: "Missing refundId." }, 400);
      }

      // Fetch refund record
      const { data: refund, error: refundError } = await supabaseAdmin
        .from("refunds")
        .select("*")
        .eq("id", refundId)
        .single();

      if (refundError || !refund) {
        return jsonResponse({ error: "Refund not found." }, 404);
      }

      const customerEmail = String(refund.customer_email || "").trim();
      if (!customerEmail) {
        return jsonResponse({ error: "No customer email on refund record." }, 400);
      }

      if (!resendApiKey) {
        // Mark as sent=false but don't fail the whole request
        await supabaseAdmin
          .from("refunds")
          .update({ email_sent: false, updated_at: new Date().toISOString() })
          .eq("id", refundId);
        return jsonResponse({ success: true, emailSent: false, reason: "No RESEND_API_KEY configured." });
      }

      // Build email HTML
      const refundCode = String(refund.refund_code || "");
      const refundAmount = Number(refund.refund_amount || 0);
      const customerName = String(refund.customer_name || "Customer");
      const refundMethod = String(refund.refund_method || "original");
      const status = String(refund.status || "completed");
      const policyRule = String(refund.policy_rule || "manual");

      const methodLabel = refundMethod === "original" ? "your original eSewa wallet"
        : refundMethod === "cash" ? "cash"
        : refundMethod === "bank_transfer" ? "bank transfer"
        : refundMethod;

      const policyLabel = policyRule === "full_refund" ? "Full refund (cancelled >24 hours before pickup)"
        : policyRule === "partial_refund_50" ? "50% refund (cancelled 2-24 hours before pickup)"
        : "Manual refund";

      const statusLabel = status === "completed" ? "Completed"
        : status === "processing" ? "Processing"
        : status === "approved" ? "Approved"
        : status;

      const arrivalTime = refundMethod === "original" ? "1-3 business days"
        : refundMethod === "cash" ? "upon collection"
        : "3-5 business days";

      const emailHtml = buildRefundEmailHtml({
        appName,
        websiteUrl,
        customerName,
        refundCode,
        refundAmount,
        methodLabel,
        policyLabel,
        statusLabel,
        arrivalTime,
      });

      // Send via Resend
      const emailPayload = {
        from: `${appName} <${fromEmail}>`,
        to: [customerEmail],
        subject: `Refund ${statusLabel} — ${refundCode} | ${appName}`,
        html: emailHtml,
      };

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      const emailResult = await emailRes.json().catch(() => ({}));
      const emailSuccess = emailRes.ok && emailResult && emailResult.id;

      // Update refund record
      await supabaseAdmin
        .from("refunds")
        .update({
          email_sent: emailSuccess,
          email_sent_at: emailSuccess ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", refundId);

      return jsonResponse({
        success: true,
        emailSent: emailSuccess,
        emailId: emailResult?.id || null,
      });
    }

    // ─── Action: check_eligibility ───────────────────────────────────────
    if (action === "check_eligibility") {
      const bookingId = String(body.bookingId || "").trim();
      if (!bookingId) {
        return jsonResponse({ error: "Missing bookingId." }, 400);
      }

      const { data, error } = await supabaseAdmin.rpc("calculate_refund_eligibility", {
        p_booking_id: bookingId,
      });

      if (error) {
        return jsonResponse({ error: error.message || "Eligibility check failed." }, 500);
      }

      return jsonResponse({ success: true, eligibility: data });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data: JsonRecord, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildRefundEmailHtml(opts: {
  appName: string;
  websiteUrl: string;
  customerName: string;
  refundCode: string;
  refundAmount: number;
  methodLabel: string;
  policyLabel: string;
  statusLabel: string;
  arrivalTime: string;
}): string {
  const amountFormatted = `NPR ${opts.refundAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:580px;margin:30px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08)">
    
    <div style="background:linear-gradient(135deg,#1a4a4d,#2c766e);padding:32px 28px;text-align:center">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">${opts.appName}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Refund Notification</p>
    </div>

    <div style="padding:32px 28px">
      <p style="margin:0 0 16px;font-size:15px;color:#1e293b">Hi <strong>${escapeHtmlEmail(opts.customerName)}</strong>,</p>
      
      <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6">
        ${opts.statusLabel === "Completed" 
          ? "Great news! Your refund has been processed successfully."
          : `Your refund status has been updated to <strong>${escapeHtmlEmail(opts.statusLabel)}</strong>.`}
      </p>

      <div style="background:#f8faf9;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155">
          <tr>
            <td style="padding:6px 0;font-weight:600;color:#64748b">Refund Code</td>
            <td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtmlEmail(opts.refundCode)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:600;color:#64748b">Amount</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#16a34a">${escapeHtmlEmail(amountFormatted)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:600;color:#64748b">Method</td>
            <td style="padding:6px 0;text-align:right">${escapeHtmlEmail(opts.methodLabel)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:600;color:#64748b">Policy</td>
            <td style="padding:6px 0;text-align:right">${escapeHtmlEmail(opts.policyLabel)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:600;color:#64748b">Expected Arrival</td>
            <td style="padding:6px 0;text-align:right;font-weight:700;color:#2563eb">${escapeHtmlEmail(opts.arrivalTime)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-weight:600;color:#64748b">Status</td>
            <td style="padding:6px 0;text-align:right"><span style="display:inline-block;background:${opts.statusLabel === 'Completed' ? '#dcfce7' : '#dbeafe'};color:${opts.statusLabel === 'Completed' ? '#166534' : '#1e40af'};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${escapeHtmlEmail(opts.statusLabel)}</span></td>
          </tr>
        </table>
      </div>

      ${opts.statusLabel === "Completed" ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#166534;font-weight:600">✓ Refund completed! The amount will arrive in ${escapeHtmlEmail(opts.methodLabel)} within ${escapeHtmlEmail(opts.arrivalTime)}.</p>
      </div>
      ` : `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600">Your refund is being processed. You'll receive another email when it's complete.</p>
      </div>
      `}

      <p style="margin:0 0 8px;font-size:13px;color:#64748b">You can track your refund status in your booking history.</p>
      
      ${opts.websiteUrl ? `<a href="${escapeHtmlEmail(opts.websiteUrl)}" style="display:inline-block;margin-top:12px;padding:10px 24px;background:#2c766e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">View Booking History</a>` : ''}
    </div>

    <div style="background:#f8faf9;padding:20px 28px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">This is an automated email from ${escapeHtmlEmail(opts.appName)}. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtmlEmail(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
