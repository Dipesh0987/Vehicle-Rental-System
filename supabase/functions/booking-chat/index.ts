import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = Record<string, JsonValue>;

type BookingRow = {
  id: string;
  booking_code: string | null;
  vehicle_id: string | null;
  customer_user_id: string | null;
  customer_email: string | null;
  start_date: string | null;
  end_date: string | null;
  pickup_time: string | null;
  status: string | null;
  currency: string | null;
  total_amount: number | null;
  payment_status: string | null;
  is_paid: boolean | null;
  notes: string | null;
  created_at: string | null;
};

type VehicleRow = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
};

type ActionItem = {
  type: "view_booking" | "open_vehicle" | "confirmation_cta" | "contact_support";
  label: string;
  bookingId?: string;
  vehicleId?: string;
  href?: string;
};

type Citation = {
  bookingId: string;
  bookingCode: string;
  source: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("BOOKING_AI_MODEL") ?? "gemini-2.0-flash";
const SUPPORT_EMAIL = Deno.env.get("BOOKING_SUPPORT_EMAIL") ?? "support@rentavehiclenepal.com";
const SUPPORT_PHONE = Deno.env.get("BOOKING_SUPPORT_PHONE") ?? "+977-9862147350";

const corsHeaders: Record<string, string> = {
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

function jsonResponse(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseNotes(rawValue: string | null): { pickupLocation: string; userMessage: string } {
  const raw = normalizeText(rawValue);
  if (!raw) {
    return { pickupLocation: "", userMessage: "" };
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let pickupLocation = "";
  let userMessage = "";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!pickupLocation && lower.startsWith("pickup location:")) {
      pickupLocation = line.slice("pickup location:".length).trim();
      continue;
    }

    if (!userMessage && lower.startsWith("user message:")) {
      userMessage = line.slice("user message:".length).trim();
    }
  }

  return {
    pickupLocation,
    userMessage,
  };
}

function toIsoDate(value: string | null): Date | null {
  const text = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string | null, timezone?: string): string {
  const date = toIsoDate(value);
  if (!date) {
    return "unknown date";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: timezone || "UTC",
    }).format(date);
  } catch {
    return value ?? "unknown date";
  }
}

function formatMoney(amount: number | null, currency: string | null): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const safeCurrency = normalizeText(currency).toUpperCase() || "NPR";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${safeCurrency} ${safeAmount.toFixed(2)}`;
  }
}

function isUpcoming(booking: BookingRow, today: Date): boolean {
  const status = normalizeText(booking.status).toLowerCase();
  if (status === "cancelled" || status === "completed") {
    return false;
  }

  const start = toIsoDate(booking.start_date);
  if (!start) {
    return false;
  }

  return start.getTime() >= Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

function readRelativeWindow(query: string, now: Date): { start: Date; end: Date } | null {
  const lower = query.toLowerCase();
  const dayMs = 24 * 60 * 60 * 1000;
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (/(^|\b)today(\b|$)/.test(lower)) {
    return { start: base, end: new Date(base.getTime() + dayMs - 1) };
  }

  if (/(^|\b)tomorrow(\b|$)/.test(lower)) {
    const next = new Date(base.getTime() + dayMs);
    return { start: next, end: new Date(next.getTime() + dayMs - 1) };
  }

  if (lower.includes("this weekend")) {
    const day = base.getUTCDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const saturday = new Date(base.getTime() + daysUntilSaturday * dayMs);
    const sunday = new Date(saturday.getTime() + dayMs);
    return { start: saturday, end: new Date(sunday.getTime() + dayMs - 1) };
  }

  if (lower.includes("next weekend")) {
    const day = base.getUTCDay();
    const daysUntilNextSaturday = ((6 - day + 7) % 7) + 7;
    const saturday = new Date(base.getTime() + daysUntilNextSaturday * dayMs);
    const sunday = new Date(saturday.getTime() + dayMs);
    return { start: saturday, end: new Date(sunday.getTime() + dayMs - 1) };
  }

  return null;
}

function bookingTouchesWindow(booking: BookingRow, window: { start: Date; end: Date }): boolean {
  const start = toIsoDate(booking.start_date);
  const end = toIsoDate(booking.end_date);
  if (!start || !end) {
    return false;
  }

  return start.getTime() <= window.end.getTime() && end.getTime() >= window.start.getTime();
}

function classifyIntent(query: string):
  | "modify"
  | "upcoming"
  | "vehicle"
  | "cancellation"
  | "refund"
  | "invoice"
  | "unknown" {
  const lower = query.toLowerCase();

  if (/(modify|change|resched|update|edit)\b/.test(lower)) {
    return "modify";
  }

  if (/(upcoming|next booking|tomorrow|today|weekend|when|date)\b/.test(lower)) {
    return "upcoming";
  }

  if (/(vehicle|car|which one|model|details)\b/.test(lower)) {
    return "vehicle";
  }

  if (/(cancel|cancellation policy|can i cancel|policy)\b/.test(lower)) {
    return "cancellation";
  }

  if (/(refund|money back|reimburse)\b/.test(lower)) {
    return "refund";
  }

  if (/(invoice|receipt|bill)\b/.test(lower)) {
    return "invoice";
  }

  return "unknown";
}

async function fetchBookingsForUser(userId: string, email: string): Promise<BookingRow[]> {
  let query = supabaseAdmin
    .from("vehicle_bookings")
    .select("id,booking_code,vehicle_id,customer_user_id,customer_email,start_date,end_date,pickup_time,status,currency,total_amount,payment_status,is_paid,notes,created_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .eq("customer_user_id", userId);

  let result = await query;

  if (result.error) {
    throw new Error(`Failed to read bookings: ${result.error.message}`);
  }

  let rows = Array.isArray(result.data) ? (result.data as BookingRow[]) : [];

  if (!rows.length && email) {
    result = await supabaseAdmin
      .from("vehicle_bookings")
      .select("id,booking_code,vehicle_id,customer_user_id,customer_email,start_date,end_date,pickup_time,status,currency,total_amount,payment_status,is_paid,notes,created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .eq("customer_email", email);

    if (result.error) {
      throw new Error(`Failed to read bookings by email: ${result.error.message}`);
    }

    rows = Array.isArray(result.data) ? (result.data as BookingRow[]) : [];
  }

  return rows;
}

async function fetchVehicleMap(bookings: BookingRow[]): Promise<Record<string, VehicleRow>> {
  const ids = Array.from(new Set(bookings.map((b) => normalizeText(b.vehicle_id)).filter(Boolean)));
  if (!ids.length) {
    return {};
  }

  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .select("id,name,brand,category")
    .in("id", ids);

  if (error) {
    return {};
  }

  const rows = Array.isArray(data) ? (data as VehicleRow[]) : [];
  return rows.reduce<Record<string, VehicleRow>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

function vehicleName(booking: BookingRow, vehicleMap: Record<string, VehicleRow>): string {
  const vehicleId = normalizeText(booking.vehicle_id);
  const row = vehicleMap[vehicleId];
  if (!row) {
    return "Vehicle";
  }

  const brand = normalizeText(row.brand);
  const name = normalizeText(row.name);
  return normalizeText(`${brand} ${name}`) || "Vehicle";
}

function bookingCode(booking: BookingRow): string {
  return normalizeText(booking.booking_code) || normalizeText(booking.id) || "unknown-booking";
}

function citationFrom(booking: BookingRow): Citation {
  return {
    bookingId: booking.id,
    bookingCode: bookingCode(booking),
    source: "vehicle_bookings",
  };
}

function sourcePrefix(citation: Citation): string {
  return `Based on your booking ${citation.bookingCode} in ${citation.source}:`;
}

function defaultSupportAction(): ActionItem {
  return {
    type: "contact_support",
    label: "Connect to Support",
    href: `mailto:${SUPPORT_EMAIL}`,
  };
}

function buildRuleAnswer(params: {
  query: string;
  now: Date;
  timezone: string;
  bookings: BookingRow[];
  vehicleMap: Record<string, VehicleRow>;
}): { answer: string; actions: ActionItem[]; citations: Citation[]; unresolved: boolean } {
  const { query, now, timezone, bookings, vehicleMap } = params;
  const intent = classifyIntent(query);

  if (!bookings.length) {
    return {
      answer: "I could not find any bookings linked to your current account in this session.",
      actions: [defaultSupportAction()],
      citations: [],
      unresolved: true,
    };
  }

  const upcomingBookings = bookings.filter((booking) => isUpcoming(booking, now));
  const latestBooking = bookings[0];
  const relativeWindow = readRelativeWindow(query, now);
  const windowMatches = relativeWindow
    ? bookings.filter((booking) => bookingTouchesWindow(booking, relativeWindow))
    : [];

  if (intent === "modify") {
    const target = latestBooking;
    const cite = citationFrom(target);
    return {
      answer: `${sourcePrefix(cite)} I cannot modify bookings directly from chat. Tap the confirmation action to continue your change request safely.`,
      actions: [
        {
          type: "confirmation_cta",
          label: "Confirm and Open Booking Modification",
          bookingId: target.id,
          href: "modify-booking.html",
        },
        {
          type: "view_booking",
          label: "Here is your booking - tap to view",
          bookingId: target.id,
        },
      ],
      citations: [cite],
      unresolved: false,
    };
  }

  if (intent === "upcoming") {
    const target = windowMatches[0] || upcomingBookings[0] || latestBooking;
    const cite = citationFrom(target);
    return {
      answer: `${sourcePrefix(cite)} your next reservation is ${vehicleName(target, vehicleMap)} from ${formatDate(target.start_date, timezone)} to ${formatDate(target.end_date, timezone)}.`,
      actions: [
        {
          type: "view_booking",
          label: "Here is your booking - tap to view",
          bookingId: target.id,
        },
      ],
      citations: [cite],
      unresolved: false,
    };
  }

  if (intent === "vehicle") {
    const target = latestBooking;
    const cite = citationFrom(target);
    return {
      answer: `${sourcePrefix(cite)} this booking is for ${vehicleName(target, vehicleMap)}. Pickup starts on ${formatDate(target.start_date, timezone)} at ${normalizeText(target.pickup_time) || "10:00"}.`,
      actions: [
        {
          type: "view_booking",
          label: "Here is your booking - tap to view",
          bookingId: target.id,
        },
        {
          type: "open_vehicle",
          label: "Open vehicle detail",
          vehicleId: normalizeText(target.vehicle_id),
        },
      ],
      citations: [cite],
      unresolved: false,
    };
  }

  if (intent === "cancellation") {
    const target = latestBooking;
    const cite = citationFrom(target);
    return {
      answer: `${sourcePrefix(cite)} cancellation is handled by admin review in this system. I cannot cancel directly, but you can submit a cancellation request from your booking detail view.`,
      actions: [
        {
          type: "view_booking",
          label: "Here is your booking - tap to view",
          bookingId: target.id,
        },
        {
          type: "confirmation_cta",
          label: "Request cancellation with confirmation",
          bookingId: target.id,
        },
      ],
      citations: [cite],
      unresolved: false,
    };
  }

  if (intent === "refund") {
    const cancelled = bookings.find((booking) => normalizeText(booking.status).toLowerCase() === "cancelled") || latestBooking;
    const cite = citationFrom(cancelled);
    const paid = Boolean(cancelled.is_paid) || normalizeText(cancelled.payment_status).toLowerCase() === "paid";
    const amount = formatMoney(cancelled.total_amount, cancelled.currency);
    const message = paid
      ? `${sourcePrefix(cite)} this booking shows payment of ${amount}. Refund processing status is not fully exposed in your current dataset, so please contact support for the final payout timeline.`
      : `${sourcePrefix(cite)} this booking is not marked as paid, so no refund is currently expected.`;

    return {
      answer: message,
      actions: [defaultSupportAction()],
      citations: [cite],
      unresolved: false,
    };
  }

  if (intent === "invoice") {
    const paidBooking = bookings.find((booking) => Boolean(booking.is_paid) || normalizeText(booking.payment_status).toLowerCase() === "paid") || latestBooking;
    const cite = citationFrom(paidBooking);
    const paid = Boolean(paidBooking.is_paid) || normalizeText(paidBooking.payment_status).toLowerCase() === "paid";

    const message = paid
      ? `${sourcePrefix(cite)} invoice data is available for this paid booking. Tap your booking details, and if you need an issued invoice copy, support can share it.`
      : `${sourcePrefix(cite)} this booking is not marked as paid yet, so invoice availability is limited until payment is completed.`;

    return {
      answer: message,
      actions: [
        {
          type: "view_booking",
          label: "Here is your booking - tap to view",
          bookingId: paidBooking.id,
        },
        defaultSupportAction(),
      ],
      citations: [cite],
      unresolved: false,
    };
  }

  return {
    answer: "I could not confidently resolve that booking request from available fields.",
    actions: [defaultSupportAction()],
    citations: [citationFrom(latestBooking)],
    unresolved: true,
  };
}

async function maybeRefineWithGemini(input: {
  query: string;
  draftAnswer: string;
  citations: Citation[];
  actions: ActionItem[];
}): Promise<string> {
  if (!GEMINI_API_KEY) {
    return input.draftAnswer;
  }

  const citationText = input.citations.length
    ? input.citations.map((citation) => `${citation.bookingCode} (${citation.source})`).join(", ")
    : "none";

  const prompt = [
    "You are a booking support assistant for a vehicle rental app.",
    "Rewrite the provided draft answer to be concise, user-friendly, and accurate.",
    "Never claim to modify bookings directly.",
    "If modification is needed, ask user to tap confirmation CTA.",
    "Always preserve citation context exactly.",
    "Draft:",
    input.draftAnswer,
    `Citations: ${citationText}`,
    `User query: ${input.query}`,
  ].join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 260,
      },
    }),
  });

  if (!response.ok) {
    return input.draftAnswer;
  }

  const payload = await response.json();
  const outputText = normalizeText(
    payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => normalizeText(part?.text)).join(" ")
  );
  return outputText || input.draftAnswer;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "Method not allowed.",
    });
  }

  try {
    const authHeader = normalizeText(request.headers.get("authorization"));
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonResponse(401, {
        success: false,
        message: "Missing access token.",
      });
    }

    const token = authHeader.slice(7).trim();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse(401, {
        success: false,
        message: "Invalid or expired session.",
      });
    }

    const body = (await request.json()) as JsonObject;
    const query = normalizeText(body.query);
    const timezone = normalizeText(body.timezone) || "UTC";
    const nowIso = normalizeText(body.nowIso);

    if (!query) {
      return jsonResponse(400, {
        success: false,
        message: "Query is required.",
      });
    }

    const now = nowIso ? new Date(nowIso) : new Date();
    const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;

    const userId = authData.user.id;
    const email = normalizeText(authData.user.email).toLowerCase();

    const bookings = await fetchBookingsForUser(userId, email);
    const vehicleMap = await fetchVehicleMap(bookings);

    const ruleAnswer = buildRuleAnswer({
      query,
      now: safeNow,
      timezone,
      bookings,
      vehicleMap,
    });

    const refinedAnswer = await maybeRefineWithGemini({
      query,
      draftAnswer: ruleAnswer.answer,
      citations: ruleAnswer.citations,
      actions: ruleAnswer.actions,
    });

    const citations = ruleAnswer.citations;
    const answerWithCitation = citations.length
      ? refinedAnswer
      : `${refinedAnswer} Based on your booking data source: vehicle_bookings.`;

    return jsonResponse(200, {
      success: true,
      answer: answerWithCitation,
      actions: ruleAnswer.actions as unknown as JsonValue,
      citations: citations as unknown as JsonValue,
      unresolved: ruleAnswer.unresolved,
      support: {
        email: SUPPORT_EMAIL,
        phone: SUPPORT_PHONE,
      } as unknown as JsonValue,
      source: "vehicle_bookings",
    });
  } catch (error) {
    console.error("booking-chat error", error);
    return jsonResponse(500, {
      success: false,
      message: "Unable to resolve booking query right now.",
      fallback: {
        supportEmail: SUPPORT_EMAIL,
        supportPhone: SUPPORT_PHONE,
      } as unknown as JsonValue,
    });
  }
});
