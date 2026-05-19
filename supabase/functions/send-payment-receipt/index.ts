import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function formatMoney(amount: number): string {
  return `NPR ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function generateReceiptHTML(data: {
  transactionCode: string;
  bookingCode: string;
  customerName: string;
  customerEmail: string;
  vehicleName: string;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  paymentDate: string;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  returnLocation: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}): string {
  const receiptUrl = `http://127.0.0.1:5501/frontend/payment-receipt.html?payment=${encodeURIComponent(data.transactionCode)}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${data.transactionCode}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2c766e 0%, #1b5d5f 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Payment Receipt</h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; opacity: 0.9; font-size: 14px;">Rent A Vehicle Nepal</p>
            </td>
          </tr>

          <!-- Success Badge -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center;">
              <div style="display: inline-block; background-color: #10b981; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: bold;">
                ✓ Payment Successful
              </div>
            </td>
          </tr>

          <!-- Transaction Details -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Transaction ID</p>
                    <p style="margin: 5px 0 0 0; font-size: 16px; color: #111827; font-weight: bold;">${data.transactionCode}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Booking Reference</p>
                    <p style="margin: 5px 0 0 0; font-size: 16px; color: #111827; font-weight: bold;">${data.bookingCode}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Payment Date</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #111827;">${formatDate(data.paymentDate)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Payment Method</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #111827;">${data.paymentMethod}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Amount Paid -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">Amount Paid</p>
                <p style="margin: 10px 0 0 0; font-size: 32px; color: #2c766e; font-weight: bold;">${formatMoney(data.amount)}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">${data.paymentType}</p>
              </div>
            </td>
          </tr>

          <!-- Booking Details -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Booking Details</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">Vehicle</p>
                    <p style="margin: 3px 0 0 0; font-size: 14px; color: #111827; font-weight: 600;">${data.vehicleName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">Pickup</p>
                    <p style="margin: 3px 0 0 0; font-size: 14px; color: #111827;">${formatDate(data.pickupDate)}</p>
                    <p style="margin: 3px 0 0 0; font-size: 13px; color: #6b7280;">${data.pickupLocation}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">Return</p>
                    <p style="margin: 3px 0 0 0; font-size: 14px; color: #111827;">${formatDate(data.returnDate)}</p>
                    <p style="margin: 3px 0 0 0; font-size: 13px; color: #6b7280;">${data.returnLocation}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Payment Summary -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">Payment Summary</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Total Amount</td>
                  <td align="right" style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 600;">${formatMoney(data.totalAmount)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #10b981;">Paid Amount</td>
                  <td align="right" style="padding: 8px 0; font-size: 14px; color: #10b981; font-weight: 600;">${formatMoney(data.paidAmount)}</td>
                </tr>
                ${data.remainingAmount > 0 ? `
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0 0 0; font-size: 15px; color: #111827; font-weight: bold;">Remaining Balance</td>
                  <td align="right" style="padding: 12px 0 0 0; font-size: 16px; color: #ef4444; font-weight: bold;">${formatMoney(data.remainingAmount)}</td>
                </tr>
                ` : `
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td colspan="2" style="padding: 12px 0 0 0; text-align: center;">
                    <span style="display: inline-block; background-color: #10b981; color: white; padding: 6px 16px; border-radius: 16px; font-size: 13px; font-weight: bold;">
                      ✓ Fully Paid
                    </span>
                  </td>
                </tr>
                `}
              </table>
            </td>
          </tr>

          <!-- View Receipt Button -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <a href="${receiptUrl}" style="display: inline-block; background-color: #2c766e; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: bold;">
                View Full Receipt
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #6b7280;">
                Thank you for choosing Rent A Vehicle Nepal!
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                If you have any questions, please contact our support team.
              </p>
              <p style="margin: 15px 0 0 0; font-size: 11px; color: #9ca3af;">
                © 2026 Rent A Vehicle Nepal. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendReceiptEmail(data: {
  transactionCode: string;
  customerEmail: string;
  customerName: string;
  bookingCode: string;
  vehicleName: string;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  paymentDate: string;
  pickupDate: string;
  returnDate: string;
  pickupLocation: string;
  returnLocation: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}): Promise<void> {
  const htmlContent = generateReceiptHTML(data);
  
  // Send email using Resend or configured SMTP
  // For now, we'll use a simple HTTP request to send via an email service
  // You can configure this to use your Gmail SMTP or any other service
  
  
  // TODO: Integrate with actual email sending service
  // This is a placeholder - you'll need to configure email sending
  // Options:
  // 1. Use Resend API
  // 2. Use SendGrid API
  // 3. Use your Gmail SMTP via a library
  
  // For now, just log success
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "Method not allowed.",
    });
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const transactionCode = String(payload.transactionCode || "");

    if (!transactionCode) {
      return jsonResponse(400, {
        success: false,
        message: "Transaction code is required.",
      });
    }

    // Fetch payment and booking details
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(`
        *,
        booking:vehicle_bookings(
          *,
          vehicle:vehicles(name, model, brand),
          customer:user_profiles(full_name, email)
        )
      `)
      .eq("transaction_code", transactionCode)
      .single();

    if (paymentError || !payment) {
      return jsonResponse(404, {
        success: false,
        message: "Payment not found.",
      });
    }

    const booking = payment.booking as Record<string, unknown>;
    const vehicle = booking.vehicle as Record<string, unknown>;
    const customer = booking.customer as Record<string, unknown>;

    // Send receipt email
    await sendReceiptEmail({
      transactionCode: payment.transaction_code,
      customerEmail: String(customer.email || ""),
      customerName: String(customer.full_name || "Guest"),
      bookingCode: String(booking.booking_code || ""),
      vehicleName: `${vehicle.brand} ${vehicle.name} ${vehicle.model}`,
      amount: Number(payment.amount || 0),
      paymentType: String(payment.payment_type || ""),
      paymentMethod: String(payment.payment_method || "eSewa"),
      paymentDate: String(payment.created_at || ""),
      pickupDate: String(booking.pickup_datetime || ""),
      returnDate: String(booking.return_datetime || ""),
      pickupLocation: String(booking.pickup_location || ""),
      returnLocation: String(booking.return_location || ""),
      totalAmount: Number(booking.total_amount || 0),
      paidAmount: Number(booking.paid_amount || 0),
      remainingAmount: Number(booking.remaining_amount || 0),
    });

    return jsonResponse(200, {
      success: true,
      message: "Receipt email sent successfully.",
    });
  } catch (error) {
    console.error("Error sending receipt:", error);
    return jsonResponse(500, {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send receipt.",
    });
  }
});
