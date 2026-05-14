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
  seats?: number | null;
  daily_rate?: number | null;
  price_per_day?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  image_url?: string | null;
  primary_image_url?: string | null;
  features?: string[] | null;
  is_available?: boolean | null;
  status?: string | null;
  rating?: number | null;
  location?: string | null;
};

type ActionItem = {
  type:
    | "view_booking"
    | "open_vehicle"
    | "confirmation_cta"
    | "contact_support"
    | "suggest_vehicle"
    | "book_vehicle"
    | "trip_quote";
  label: string;
  bookingId?: string;
  vehicleId?: string;
  href?: string;
  meta?: Record<string, unknown>;
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
const DEBUG_MODE = (Deno.env.get("BOOKING_CHAT_DEBUG") || "").toLowerCase() === "true";

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

  if (lower.includes("this week")) {
    const day = base.getUTCDay();
    const monday = new Date(base.getTime() - ((day === 0 ? 6 : day - 1) * dayMs));
    const sunday = new Date(monday.getTime() + 6 * dayMs);
    return { start: monday, end: new Date(sunday.getTime() + dayMs - 1) };
  }

  if (lower.includes("next week")) {
    const day = base.getUTCDay();
    const daysUntilNextMonday = ((8 - day) % 7) || 7;
    const monday = new Date(base.getTime() + daysUntilNextMonday * dayMs);
    const sunday = new Date(monday.getTime() + 6 * dayMs);
    return { start: monday, end: new Date(sunday.getTime() + dayMs - 1) };
  }

  if (lower.includes("next month")) {
    const year = now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    const month = (now.getUTCMonth() + 1) % 12;
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    return { start, end: new Date(end.getTime() + dayMs - 1) };
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
  | "greeting"
  | "policy"
  | "modify"
  | "upcoming"
  | "vehicle"
  | "cancellation"
  | "refund"
  | "invoice"
  | "list"
  | "price"
  | "trip"
  | "vehicle_search"
  | "vehicle_compare"
  | "availability"
  | "hours"
  | "fleet"
  | "unknown" {
  const lower = query.toLowerCase().trim();

  /* Bare greetings — route to friendly general handler. */
  if (/^(hi|hii+|hey+|hello+|namaste|namaskar|good\s*(morning|afternoon|evening|day)|yo|sup|thanks|thank you|bye|goodbye)[\s!.?]*$/i.test(lower)) {
    return "greeting";
  }

  if (/(modify|change|resched|update|edit)\b/.test(lower)) {
    return "modify";
  }

  /* Vehicle comparison: "compare X vs Y", "X or Y which is better" */
  if (/(compare|vs\.?|versus|\bor\b.*which.*(better|best|cheaper|bigger|more))/i.test(lower) && /(car|vehicle|suv|sedan|van|[A-Z][a-z]{2,})/i.test(query)) {
    return "vehicle_compare";
  }

  /* Vehicle search: "show me SUVs", "cars under 3000", "do you have Fortuner" */
  if (/(show\s+(me\s+)?|list\s+|find\s+|search\s+|get\s+|any\s+|give\s+me\s+)(all\s+)?(suv|sedan|economy|luxury|van|hatchback|electric|car|vehicle|auto)/i.test(lower) ||
      /(do you have|is there|have you got|got any)\s+/i.test(lower) && /(car|vehicle|suv|sedan|van)/i.test(lower) ||
      /\b(suv|sedan|economy|luxury|van|hatchback|electric)\s*(car|vehicle)?s?\s*(under|below|within|around|for)\s*\d/i.test(lower) ||
      /(cheap|budget|affordable|expensive|premium|best|top)\s*(car|vehicle|suv|sedan|van|rental)?s?\b/i.test(lower) ||
      /\b(show|find|get|list|search|browse)\s+(me\s+)?(cars?|vehicles?)\b/i.test(lower) ||
      /(cars?|vehicles?)\s*(under|below|within|around|for|less than)\s*(npr|rs\.?)?\s*\d/i.test(lower) ||
      /\b(automatic|manual|diesel|petrol|electric)\s*(cars?|vehicles?|options?)\b/i.test(lower)) {
    return "vehicle_search";
  }

  /* Availability: "is X available", "available this weekend" */
  if (/(is\s+.+\s+available|available\s+(this|next|on|for|today|tomorrow)|check\s+availability|free\s+(this|next|on|for))/i.test(lower)) {
    return "availability";
  }

  /* Working hours: "when do you open", "what are your hours" */
  if (/(working\s+hours?|open(ing)?\s+(hours?|time)|close\s+time|when\s+(do\s+you|are\s+you)\s+(open|close)|office\s+hours?|business\s+hours?|timing|what\s+time\s+(do|are)|operating\s+hours?)/.test(lower)) {
    return "hours";
  }

  /* Fleet info: "how many cars", "what types do you have", "your fleet" */
  if (/(how\s+many\s+(cars?|vehicles?|autos?)|fleet\s+(size|info|details)|what\s+(types?|kinds?|categories?)\s+(of\s+)?(cars?|vehicles?)\s*(do\s+you|are)|total\s+(cars?|vehicles?)|your\s+fleet)/.test(lower)) {
    return "fleet";
  }

  if (/(trip|travel|journey|road\s*trip|plan.*trip|vacation|holiday|tour|group.*ride|family.*ride|\d+\s*(people|person|passenger|pax|member|friend|seat)|need.*car.*for|suggest.*vehicle|recommend.*car|which.*car.*for|best.*car|suitable.*vehicle|itinerary|multi[\s-]?stops?|multiple\s+(stops?|places?|destinations?|cities|locations?)|many\s+(stops?|places?)|few\s+(stops?|places?)|several\s+(stops?|places?|cities)|round[\s-]?trip|tour\s+(around|of)|estimate.*(price|cost|package|quote)|package.*(price|deal|quote)|total.*cost.*for|how much.*(trip|tour|travel))/.test(lower)) {
    return "trip";
  }

  /* Multi-stop "<city> to <city> [to <city>] N days" phrasing — even without
   * the word "trip" or any quantity word, route through trip planning. */
  if (/[a-z]+\s+to\s+[a-z]+(?:\s+to\s+[a-z]+)+/.test(lower) && /\d+\s*(day|night|week)/.test(lower)) {
    return "trip";
  }

  /* Generic policy / service questions that don't reference the user's own
   * booking. These should always go through Gemini with a service-aware
   * system prompt rather than hitting booking-specific rule answers. */
  if (/(do you|are you|what.*(documents?|requirements?|process|policy|terms|hours|payment\s+method|insurance|damage|fuel\s+policy|driver|driving\s+license|deposit|age\s+limit|delivery|pickup\s+location|drop\s*off|return|extend|late\s+return|child\s+seat|gps|wifi|extra)|how\s+(do|does|can|long).*(rent|book|pay|deliver|return|process|verify|extend|sign|register)|where\s+(is|are|do)|tell me about|what is|explain|airport\s+(pickup|drop)|home\s+delivery|self\s+drive|chauffeur)/.test(lower)) {
    return "policy";
  }

  if (/(upcoming|next booking|tomorrow|today|weekend|when.*(date|booking|pickup)|this week|next week|next month)\b/.test(lower)) {
    return "upcoming";
  }

  if (/(my\s+vehicle|my\s+car|which one|what.*rented|what.*booked|what.*vehicle.*(i|me)|the\s+vehicle\s+(i|me))/.test(lower)) {
    return "vehicle";
  }

  if (/(cancel|cancellation)\b/.test(lower)) {
    return "cancellation";
  }

  if (/(refund|money back|reimburse|get.*back)\b/.test(lower)) {
    return "refund";
  }

  if (/(invoice|receipt|bill|download.*pdf)\b/.test(lower)) {
    return "invoice";
  }

  if (/(all.*booking|my.*booking|list.*booking|show.*booking|how many.*booking)/.test(lower)) {
    return "list";
  }

  if (/(my\s+(price|cost|total|amount|payment))/.test(lower)) {
    return "price";
  }

  return "unknown";
}

/* ─── Trip Context Parsing ─── */
type TripStop = {
  name: string;
  days: number;
};

type TripContext = {
  people: number;
  budget: number;
  destinationType: string;
  duration: number;
  fuelPref: string;
  stops: TripStop[];
};

/* Approximate one-way road distances between common Nepali destinations (in km).
 * Used purely for rough fuel/package estimation when the user lists multi-stop
 * itineraries. Falls back to a sensible default for unknown city pairs. */
const NEPAL_DISTANCE_KM: Record<string, Record<string, number>> = {
  kathmandu: {
    pokhara: 200,
    chitwan: 150,
    lumbini: 280,
    nagarkot: 32,
    dhulikhel: 30,
    bhaktapur: 13,
    lalitpur: 6,
    patan: 6,
    nuwakot: 75,
    bandipur: 145,
    gorkha: 140,
    janakpur: 230,
    mustang: 380,
    jomsom: 380,
    manang: 250,
    "namche bazaar": 230,
    everest: 230,
    bardiya: 540,
    ilam: 600,
    biratnagar: 540,
    butwal: 260,
    palpa: 290,
    tansen: 290,
  },
  pokhara: {
    chitwan: 160,
    lumbini: 190,
    bandipur: 70,
    mustang: 180,
    jomsom: 180,
    manang: 220,
    bhairahawa: 200,
    butwal: 190,
    palpa: 90,
    tansen: 90,
    gorkha: 100,
  },
  chitwan: {
    lumbini: 150,
    butwal: 90,
    bhairahawa: 100,
    janakpur: 250,
  },
  lumbini: {
    butwal: 25,
    bhairahawa: 22,
    palpa: 80,
    tansen: 80,
  },
};

const DEFAULT_INTERCITY_KM = 180;
const FUEL_RATE_BY_TYPE: Record<string, number> = {
  petrol: 14, // NPR per km approx for typical sedan
  diesel: 12,
  electric: 5,
};

function distanceBetween(cityA: string, cityB: string): number {
  const a = normalizeText(cityA).toLowerCase();
  const b = normalizeText(cityB).toLowerCase();
  if (!a || !b || a === b) return 0;

  const direct = NEPAL_DISTANCE_KM[a]?.[b];
  if (Number.isFinite(direct) && direct! > 0) return direct!;

  const reverse = NEPAL_DISTANCE_KM[b]?.[a];
  if (Number.isFinite(reverse) && reverse! > 0) return reverse!;

  return DEFAULT_INTERCITY_KM;
}

/* Parse multi-stop itinerary expressions such as
 *   "Pokhara 3 days, Chitwan 2 days, Lumbini 1 day"
 *   "Kathmandu to Pokhara to Chitwan, 5 days"
 * Returns an ordered list of stops with day counts (defaults to 1 per stop). */
function parseTripStops(query: string): TripStop[] {
  const text = normalizeText(query);
  if (!text) return [];

  const lower = text.toLowerCase();
  const stops: TripStop[] = [];
  const seen = new Set<string>();

  /* Pattern A: "<city> <N> day(s)" repeated */
  const pairRegex = /([a-z][a-z\s]+?)\s*(\d+)\s*(?:day|night)s?/g;
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(lower)) !== null) {
    const rawName = normalizeText(m[1]).replace(/^(?:to|then|and|via|->|→|,|-)\s*/i, "");
    const cleanName = rawName.replace(/\b(?:my|the|a|an|trip|stop|place|then|and|via|to)\b/g, "").trim();
    const finalName = (cleanName || rawName).replace(/\s+/g, " ").trim();
    if (!finalName) continue;
    const days = Math.max(1, parseInt(m[2], 10) || 1);
    const key = finalName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    stops.push({ name: finalName, days });
  }

  if (stops.length >= 2) return stops;

  /* Pattern B: "Kathmandu to Pokhara to Chitwan" with global day count elsewhere */
  const arrowRegex = /\b([a-z][a-z\s]{1,30}?)\s*(?:to|->|→|then|via|,)\s+/g;
  const candidates: string[] = [];
  let lastIndex = 0;
  let am: RegExpExecArray | null;
  while ((am = arrowRegex.exec(lower)) !== null) {
    candidates.push(am[1].trim());
    lastIndex = arrowRegex.lastIndex;
  }
  if (candidates.length) {
    const tail = lower.slice(lastIndex).split(/[\.,;!?]/)[0].trim();
    const tailWord = tail.split(/\s+/)[0];
    if (tailWord && /^[a-z]+$/.test(tailWord)) candidates.push(tailWord);
  }

  if (candidates.length >= 2) {
    const totalDaysMatch = lower.match(/(\d+)\s*(day|night|week)s?/);
    let totalDays = 0;
    if (totalDaysMatch) {
      const num = parseInt(totalDaysMatch[1], 10);
      totalDays = totalDaysMatch[2].startsWith("week") ? num * 7 : num;
    }
    const perStop = totalDays > 0 ? Math.max(1, Math.floor(totalDays / candidates.length)) : 1;
    candidates.forEach((c) => {
      const finalName = c.replace(/\s+/g, " ").trim();
      const key = finalName.toLowerCase();
      if (!finalName || seen.has(key)) return;
      seen.add(key);
      stops.push({ name: finalName, days: perStop });
    });
  }

  return stops;
}

function parseTripContext(query: string): TripContext {
  const lower = query.toLowerCase();
  let people = 0;
  let budget = 0;
  let destinationType = "";
  let duration = 0;
  let fuelPref = "";

  // People count
  const pMatch = lower.match(/(\d+)\s*(people|person|passenger|pax|member|friend|seat|of us)/);
  if (pMatch) people = Math.max(1, parseInt(pMatch[1], 10));
  else if (/\b(solo|alone|just me|myself)\b/.test(lower)) people = 1;
  else if (/\b(couple|two of us|me and my (wife|husband|partner|friend))\b/.test(lower)) people = 2;
  else if (/\bfamily\b/.test(lower)) people = 5;
  else if (/\bgroup\b/.test(lower)) people = 7;

  // Budget
  const bMatch = lower.match(/(?:budget|under|below|max|upto|up to|within|around|about)\s*(?:npr|rs\.?|rupees?)?\s*(\d[\d,]*)/);
  if (bMatch) budget = parseInt(bMatch[1].replace(/,/g, ""), 10);
  else {
    const bMatch2 = lower.match(/(\d[\d,]*)\s*(?:npr|rs\.?|rupees?)\s*(?:per day|\/day|daily|a day)?/);
    if (bMatch2) budget = parseInt(bMatch2[1].replace(/,/g, ""), 10);
  }

  // Destination type
  if (/\b(mountain|hill|himal|mustang|manang|everest|annapurna|off.?road|rugged|4wd|4x4)\b/.test(lower)) destinationType = "mountain";
  else if (/\b(city|urban|kathmandu|pokhara|lalitpur|bhaktapur|town)\b/.test(lower)) destinationType = "city";
  else if (/\b(highway|long.?drive|terai|chitwan|lumbini|flat)\b/.test(lower)) destinationType = "highway";

  // Duration
  const dMatch = lower.match(/(\d+)\s*(day|night|week)/);
  if (dMatch) {
    const num = parseInt(dMatch[1], 10);
    duration = dMatch[2].startsWith("week") ? num * 7 : num;
  }

  // Fuel preference
  if (/\b(electric|ev|battery)\b/.test(lower)) fuelPref = "electric";
  else if (/\bdiesel\b/.test(lower)) fuelPref = "diesel";
  else if (/\bpetrol|gasoline|gas\b/.test(lower)) fuelPref = "petrol";

  const stops = parseTripStops(query);
  if (stops.length >= 2) {
    const totalStopDays = stops.reduce((sum, s) => sum + s.days, 0);
    if (totalStopDays > duration) duration = totalStopDays;
  }

  return { people, budget, destinationType, duration, fuelPref, stops };
}

function missingTripInfo(ctx: TripContext): string[] {
  const missing: string[] = [];
  if (!ctx.people) missing.push("passengers");
  if (!ctx.budget) missing.push("budget");
  if (!ctx.destinationType && ctx.stops.length < 2) missing.push("destination");
  return missing;
}

function vehiclePrice(v: VehicleRow): number {
  return Number(v.price_per_day || v.daily_rate || 0);
}

function vehicleAvailable(v: VehicleRow): boolean {
  const r = v as Record<string, unknown>;
  if (r.available === false || r.is_available === false) return false;
  const status = normalizeText(v.status).toLowerCase();
  if (status && status !== "available" && status !== "active") return false;
  return true;
}

function vehicleCategory(v: VehicleRow): string {
  return (normalizeText(v.category) || normalizeText((v as Record<string, unknown>).type as string)).toLowerCase();
}

/* Fetch available vehicles using a defensive strategy that doesn't fail when
 * specific columns (price_per_day vs daily_rate, available vs is_available)
 * happen to be NULL on some rows. We pull a generous batch then rank/filter
 * in JS so partial schema variants still produce useful suggestions. */
async function fetchAvailableVehicles(minSeats: number, maxBudget: number, destType: string, fuelPref: string): Promise<VehicleRow[]> {
  const columns = "id,name,brand,type,category,seats,price_per_day,daily_rate,fuel_type,transmission,image_url,primary_image_url,features,available,is_available,status,rating,location";
  const result = await supabaseAdmin
    .from("vehicles")
    .select(columns)
    .order("rating", { ascending: false })
    .limit(60);

  if (result.error) {
    console.error("vehicle fetch error", result.error.message);
    return [];
  }

  let vehicles = ((result.data as VehicleRow[] | null) || []).filter(vehicleAvailable);

  /* Soft seat filter — keep vehicles with no declared seat count. */
  if (minSeats > 0) {
    vehicles = vehicles.filter((v) => {
      const s = Number(v.seats || 0);
      return s === 0 || s >= minSeats;
    });
  }

  /* Soft budget filter — only enforce when at least 3 vehicles still match.
   * Otherwise we relax the cap and surface the cheapest options. */
  if (maxBudget > 0) {
    const within = vehicles.filter((v) => {
      const p = vehiclePrice(v);
      return p === 0 || p <= maxBudget;
    });
    vehicles = within.length >= 3 ? within : vehicles.slice().sort((a, b) => vehiclePrice(a) - vehiclePrice(b));
  }

  /* Fuel preference: hard-prefer match, but keep others as fallback ranking. */
  if (fuelPref) {
    vehicles.sort((a, b) => {
      const af = normalizeText(a.fuel_type).toLowerCase();
      const bf = normalizeText(b.fuel_type).toLowerCase();
      const aMatch = af === fuelPref ? 0 : 1;
      const bMatch = bf === fuelPref ? 0 : 1;
      return aMatch - bMatch;
    });
  }

  /* Destination-type bias. */
  if (destType === "mountain") {
    vehicles.sort((a, b) => {
      const scoreA = (vehicleCategory(a) === "suv" || vehicleCategory(a) === "truck") ? 0 : 1;
      const scoreB = (vehicleCategory(b) === "suv" || vehicleCategory(b) === "truck") ? 0 : 1;
      return scoreA - scoreB;
    });
  } else if (destType === "city") {
    vehicles.sort((a, b) => {
      const scoreA = (vehicleCategory(a) === "sedan" || vehicleCategory(a) === "electric" || vehicleCategory(a) === "hatchback") ? 0 : 1;
      const scoreB = (vehicleCategory(b) === "sedan" || vehicleCategory(b) === "electric" || vehicleCategory(b) === "hatchback") ? 0 : 1;
      return scoreA - scoreB;
    });
  }

  return vehicles;
}

async function handleTripPlanning(input: {
  query: string;
  ctx: TripContext;
  timezone: string;
  now: Date;
}): Promise<{ answer: string; actions: ActionItem[]; citations: Citation[] }> {
  const ctx = input.ctx;
  const missing = missingTripInfo(ctx);

  // Ask clarifying questions if 2+ key details are missing and this looks like an initial vague request
  if (missing.length >= 2 && GEMINI_API_KEY) {
    const clarifyPrompt = [
      "You are RentAVehicle Nepal's friendly AI Booking Assistant.",
      "The user wants to plan a trip but the request is vague. Acknowledge their intent first, then ask 2-3 short clarifying questions to help recommend the best vehicle.",
      "Missing info to gather: " + missing.join(", ") + ".",
      "Cover (in friendly language): number of passengers, daily budget (NPR), and where they want to go OR the type of destination (city/mountain/highway/multi-stop).",
      "Mention that we can plan a multi-stop itinerary if they want to visit several places.",
      "Keep it to 2-3 short sentences. Use warm, conversational tone. End with a question.",
      "",
      "User message: " + input.query,
    ].join("\n");
    const clarifyAnswer = await callGemini(clarifyPrompt, 220);
    if (clarifyAnswer) {
      return {
        answer: clarifyAnswer,
        actions: [],
        citations: [],
      };
    }
    /* Gemini unavailable: still offer a helpful clarification rather than a
     * dead-end "no vehicles" message. */
    return {
      answer: "I'd love to help plan your trip! Could you tell me a bit more — how many passengers, your daily budget (NPR), and where you'd like to go? If you have multiple stops in mind, just say something like \"Pokhara 3 days, Chitwan 2 days\" and I'll quote the whole itinerary for you.",
      actions: [],
      citations: [],
    };
  }

  // Fetch vehicles
  const vehicles = await fetchAvailableVehicles(ctx.people || 1, ctx.budget, ctx.destinationType, ctx.fuelPref);

  if (!vehicles.length) {
    /* No matches under the user's constraints — instead of dead-ending,
     * loosen the filters once and try again so we always surface something.
     * If even the loose fetch is empty (very rare), we hand off to the
     * dynamic general handler for a conversational reply. */
    const fallback = await fetchAvailableVehicles(1, 0, "", "");
    if (fallback.length) {
      const top = fallback.slice(0, 3);
      const summary = top.map((v) => {
        const name = (normalizeText(v.brand) + " " + normalizeText(v.name)).trim() || "Vehicle";
        const seats = v.seats || 5;
        const price = vehiclePrice(v);
        return `${name} (${seats} seats, NPR ${Math.round(price).toLocaleString()}/day)`;
      }).join("; ");
      const constraintNote = ctx.people
        ? `with ${ctx.people}+ seats${ctx.budget ? " under NPR " + ctx.budget : ""}`
        : "matching all your filters";
      return {
        answer: `I couldn't find vehicles ${constraintNote} right now, but here are some options that are close: ${summary}. Want me to relax the budget or seat count?`,
        actions: top.map((v, i) => ({
          type: "suggest_vehicle" as const,
          label: ((normalizeText(v.brand) + " " + normalizeText(v.name)).trim()) || "Vehicle",
          vehicleId: v.id,
          meta: {
            seats: v.seats || 5,
            price: vehiclePrice(v),
            fuel: normalizeText(v.fuel_type) || "Petrol",
            transmission: normalizeText(v.transmission) || "Automatic",
            image: normalizeText(v.primary_image_url) || normalizeText(v.image_url) || "",
            category: vehicleCategory(v) || "sedan",
            rating: v.rating || 0,
            location: normalizeText(v.location) || "",
            reason: "",
            rank: i + 1,
          },
        })),
        citations: [],
      };
    }
    /* DB really has nothing usable — at least respond conversationally. */
    return {
      answer: "I'm having trouble finding live vehicle data at the moment. While I get that sorted, you can browse our full fleet on the Vehicles page or I can connect you to support.",
      actions: [defaultSupportAction()],
      citations: [],
    };
  }

  const top = vehicles.slice(0, 3);
  const vehicleSummary = top.map((v, i) => {
    const name = (normalizeText(v.brand) + " " + normalizeText(v.name)).trim();
    const seats = v.seats || 5;
    const price = vehiclePrice(v);
    const fuel = normalizeText(v.fuel_type) || "Petrol";
    const cat = vehicleCategory(v) || "sedan";
    return `#${i + 1} ${name} | ${cat} | ${seats} seats | NPR ${Math.round(price).toLocaleString()}/day | ${fuel}`;
  }).join("\n");

  const contextLabel = [
    ctx.people ? `${ctx.people} passengers` : "",
    ctx.budget ? `budget NPR ${ctx.budget}/day` : "",
    ctx.destinationType || "",
    ctx.duration ? `${ctx.duration} days` : "",
  ].filter(Boolean).join(", ");

  let answer = "";
  let reasons: string[] = [];

  if (GEMINI_API_KEY) {
    const prompt = [
      "You are a friendly vehicle rental assistant for RentAVehicle Nepal.",
      "The user wants to plan a trip" + (contextLabel ? " (" + contextLabel + ")" : "") + ".",
      "Below are the top 3 available vehicles ranked by suitability.",
      "For EACH vehicle, write ONE short sentence explaining why it's a good fit for this trip.",
      "Then write a brief 1-2 sentence overall recommendation.",
      "Format EXACTLY like this (no markdown):",
      "REASON1: <reason for vehicle 1>",
      "REASON2: <reason for vehicle 2>",
      "REASON3: <reason for vehicle 3>",
      "SUMMARY: <overall recommendation>",
      "",
      "VEHICLES:",
      vehicleSummary,
      "",
      "User query: " + input.query,
    ].join("\n");
    const geminiOut = await callGemini(prompt, 400);

    if (geminiOut) {
      const r1 = geminiOut.match(/REASON1:\s*(.+?)(?=REASON2:|$)/s);
      const r2 = geminiOut.match(/REASON2:\s*(.+?)(?=REASON3:|$)/s);
      const r3 = geminiOut.match(/REASON3:\s*(.+?)(?=SUMMARY:|$)/s);
      const summary = geminiOut.match(/SUMMARY:\s*(.+)/s);
      reasons = [
        normalizeText(r1?.[1]),
        normalizeText(r2?.[1]),
        normalizeText(r3?.[1]),
      ];
      answer = normalizeText(summary?.[1]) || geminiOut;
    }
  }

  if (!answer) {
    answer = `Here are my top 3 recommendations${contextLabel ? " for " + contextLabel : ""}. Tap "Book this" to start your reservation!`;
  }

  const actions: ActionItem[] = top.map((v, i) => ({
    type: "suggest_vehicle" as const,
    label: ((normalizeText(v.brand) + " " + normalizeText(v.name)).trim()) || "Vehicle",
    vehicleId: v.id,
    meta: {
      seats: v.seats || 5,
      price: vehiclePrice(v),
      fuel: normalizeText(v.fuel_type) || "Petrol",
      transmission: normalizeText(v.transmission) || "Automatic",
      image: normalizeText(v.primary_image_url) || normalizeText(v.image_url) || "",
      category: vehicleCategory(v) || "sedan",
      rating: v.rating || 0,
      location: normalizeText(v.location) || "",
      reason: reasons[i] || "",
      rank: i + 1,
    },
  }));
  actions.push(defaultSupportAction());

  return { answer, actions, citations: [] };
}

/* ─── Multi-leg trip quote ───
 * Builds a per-stop itinerary, estimated total kilometers, fuel cost band,
 * and an end-to-end package price using the cheapest 3 suitable vehicles. */
async function handleMultiLegQuote(input: {
  query: string;
  ctx: TripContext;
  timezone: string;
  now: Date;
}): Promise<{ answer: string; actions: ActionItem[]; citations: Citation[] }> {
  const ctx = input.ctx;
  const stops = ctx.stops;

  if (stops.length < 2) {
    /* Falls back to standard trip planning when stops aren't multi. */
    return handleTripPlanning(input);
  }

  /* Compute per-leg distances (round trip ends back at the start so the
   * traveller can return to base — common for rental contracts). */
  let totalKm = 0;
  const legs: Array<{ from: string; to: string; km: number }> = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i].name;
    const to = stops[i + 1].name;
    const km = distanceBetween(from, to);
    totalKm += km;
    legs.push({ from, to, km });
  }
  /* Return leg back to start city. */
  const start = stops[0].name;
  const lastStop = stops[stops.length - 1].name;
  const returnKm = distanceBetween(lastStop, start);
  totalKm += returnKm;
  legs.push({ from: lastStop, to: start, km: returnKm });

  const totalDays = stops.reduce((sum, s) => sum + s.days, 0) || 1;
  const fuelKey = ctx.fuelPref || "petrol";
  const fuelRate = FUEL_RATE_BY_TYPE[fuelKey] ?? FUEL_RATE_BY_TYPE.petrol;
  const fuelCostLow = Math.round(totalKm * fuelRate * 0.9);
  const fuelCostHigh = Math.round(totalKm * fuelRate * 1.15);

  let vehicles = await fetchAvailableVehicles(ctx.people || 1, ctx.budget, ctx.destinationType, ctx.fuelPref);
  /* If strict filters returned nothing, loosen them so the user still gets
   * an itinerary with realistic vehicle options instead of a dead-end. */
  if (!vehicles.length) {
    vehicles = await fetchAvailableVehicles(1, 0, "", "");
  }
  const top = vehicles.slice(0, 3);

  /* Per-vehicle package estimates: rental + fuel band. */
  const quoteRows = top.map((v) => {
    const dailyRate = vehiclePrice(v);
    const rentalSubtotal = Math.round(dailyRate * totalDays);
    const packageLow = rentalSubtotal + fuelCostLow;
    const packageHigh = rentalSubtotal + fuelCostHigh;
    return {
      vehicle: v,
      dailyRate,
      rentalSubtotal,
      packageLow,
      packageHigh,
    };
  });

  const itineraryLines = stops
    .map((s, i) => `${i + 1}. ${s.name} \u2014 ${s.days} day${s.days === 1 ? "" : "s"}`)
    .join("\n");

  const legsLines = legs
    .map((l) => `\u2022 ${l.from} \u2192 ${l.to}: ~${l.km} km`)
    .join("\n");

  const headerLines: string[] = [];
  headerLines.push(`Multi-stop trip plan (${totalDays} days, ~${totalKm} km round trip):`);
  headerLines.push("");
  headerLines.push("Itinerary:");
  headerLines.push(itineraryLines);
  headerLines.push("");
  headerLines.push("Legs:");
  headerLines.push(legsLines);
  headerLines.push("");
  headerLines.push(`Estimated fuel band (${fuelKey}): NPR ${fuelCostLow.toLocaleString()} \u2013 ${fuelCostHigh.toLocaleString()}.`);

  if (quoteRows.length) {
    headerLines.push("");
    headerLines.push("Package estimates (vehicle rental + fuel):");
    quoteRows.forEach((row, i) => {
      const name = (normalizeText(row.vehicle.brand) + " " + normalizeText(row.vehicle.name)).trim() || "Vehicle";
      headerLines.push(
        `#${i + 1} ${name} \u2014 NPR ${row.rentalSubtotal.toLocaleString()} rental + NPR ${fuelCostLow.toLocaleString()}\u2013${fuelCostHigh.toLocaleString()} fuel = NPR ${row.packageLow.toLocaleString()}\u2013${row.packageHigh.toLocaleString()} total`
      );
    });
  } else {
    headerLines.push("");
    headerLines.push("I couldn't find a perfectly matching vehicle for this itinerary right now. Please contact our support team for a custom quote.");
  }

  let answer = headerLines.join("\n");

  /* Optional Gemini polish layer for friendlier prose under the numbers. */
  if (GEMINI_API_KEY && quoteRows.length) {
    const polishPrompt = [
      "You are a friendly trip planner for RentAVehicle Nepal.",
      "Write 2 short sentences ONLY (no markdown, no lists) summarising this multi-stop trip and inviting the user to pick a vehicle below.",
      "Keep the warm tone. Do not invent prices or distances.",
      "",
      "Itinerary summary:",
      itineraryLines,
      "Total: " + totalDays + " days, ~" + totalKm + " km, fuel NPR " + fuelCostLow + "-" + fuelCostHigh,
    ].join("\n");
    const polished = await callGemini(polishPrompt, 200);
    if (polished) {
      answer = polished + "\n\n" + answer;
    }
  }

  /* trip_quote action surfaces all numbers in a styled card on the frontend. */
  const actions: ActionItem[] = [
    {
      type: "trip_quote" as const,
      label: "Trip quote",
      meta: {
        totalDays,
        totalKm,
        fuelType: fuelKey,
        fuelLow: fuelCostLow,
        fuelHigh: fuelCostHigh,
        stops: stops.map((s) => ({ name: s.name, days: s.days })),
        legs,
        quotes: quoteRows.map((row, i) => ({
          rank: i + 1,
          vehicleId: row.vehicle.id,
          vehicleLabel: ((normalizeText(row.vehicle.brand) + " " + normalizeText(row.vehicle.name)).trim()) || "Vehicle",
          dailyRate: row.dailyRate,
          rentalSubtotal: row.rentalSubtotal,
          packageLow: row.packageLow,
          packageHigh: row.packageHigh,
        })),
      },
    },
  ];

  /* Append vehicle cards so the user can immediately tap "Book this". */
  top.forEach((v, i) => {
    actions.push({
      type: "suggest_vehicle" as const,
      label: ((normalizeText(v.brand) + " " + normalizeText(v.name)).trim()) || "Vehicle",
      vehicleId: v.id,
      meta: {
        seats: v.seats || 5,
        price: vehiclePrice(v),
        fuel: normalizeText(v.fuel_type) || "Petrol",
        transmission: normalizeText(v.transmission) || "Automatic",
        image: normalizeText(v.primary_image_url) || normalizeText(v.image_url) || "",
        category: vehicleCategory(v) || "sedan",
        rating: v.rating || 0,
        location: normalizeText(v.location) || "",
        reason: `~NPR ${quoteRows[i]?.packageLow.toLocaleString() || 0}\u2013${quoteRows[i]?.packageHigh.toLocaleString() || 0} total for this itinerary`,
        rank: i + 1,
      },
    });
  });

  actions.push(defaultSupportAction());

  return { answer, actions, citations: [] };
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

/* ─── Smart Follow-up Suggestions ───
 * Returns contextual quick-reply chip labels based on the current intent
 * so users always have a clear next step after each response. */
function getSuggestions(intent: string, hasBookings: boolean): string[] {
  switch (intent) {
    case "greeting":
      return ["Show me SUVs", "Plan a trip", "My bookings", "What documents do I need?"];
    case "vehicle_search":
      return ["Compare these vehicles", "Show cheaper options", "Plan a trip", "Check availability"];
    case "vehicle_compare":
      return ["Book the best one", "Show more options", "Plan a trip"];
    case "trip":
      return ["Show me vehicles", "Get a multi-stop quote", "What's included in the price?"];
    case "fleet":
      return ["Show me SUVs", "Show sedans", "Cheapest cars", "Luxury vehicles"];
    case "hours":
      return ["How do I book?", "Where is your office?", "Show vehicles"];
    case "availability":
      return ["Show similar vehicles", "Plan a trip", "Book this vehicle"];
    case "policy":
      return ["Show vehicles", "Plan a trip", "My bookings", "Contact support"];
    case "upcoming":
      return hasBookings ? ["Cancel booking", "Modify booking", "Download invoice"] : ["Browse vehicles", "Plan a trip"];
    case "vehicle":
      return hasBookings ? ["View booking details", "Check next booking", "Download invoice"] : ["Browse vehicles"];
    case "cancellation":
      return ["Refund status", "View my bookings", "Contact support"];
    case "refund":
      return ["View my bookings", "Contact support"];
    case "invoice":
      return ["View my bookings", "Contact support"];
    case "list":
      return ["View latest booking", "Plan a new trip", "Browse vehicles"];
    case "price":
      return ["Download invoice", "View booking", "Contact support"];
    case "modify":
      return ["View booking", "Cancel booking", "Contact support"];
    default:
      return ["Show vehicles", "Plan a trip", "My bookings", "Working hours"];
  }
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

  if (intent === "list") {
    const summaryLines = bookings.slice(0, 5).map((b, i) => {
      const code = bookingCode(b);
      const vName = vehicleName(b, vehicleMap);
      const status = normalizeText(b.status) || "unknown";
      return `${i + 1}. ${code} — ${vName} (${status})`;
    });
    const cite = citationFrom(latestBooking);
    return {
      answer: `${sourcePrefix(cite)} here are your recent bookings:\n${summaryLines.join("\n")}${bookings.length > 5 ? "\n...and " + (bookings.length - 5) + " more." : ""}`,
      actions: bookings.slice(0, 3).map((b) => ({
        type: "view_booking" as const,
        label: `View ${bookingCode(b)}`,
        bookingId: b.id,
      })),
      citations: [cite],
      unresolved: false,
    };
  }

  if (intent === "price") {
    const target = latestBooking;
    const cite = citationFrom(target);
    const amount = formatMoney(target.total_amount, target.currency);
    const paid = Boolean(target.is_paid) || normalizeText(target.payment_status).toLowerCase() === "paid";
    return {
      answer: `${sourcePrefix(cite)} the total for ${vehicleName(target, vehicleMap)} is ${amount}. Payment status: ${paid ? "Paid" : "Pending"}.`,
      actions: [
        { type: "view_booking" as const, label: "Here is your booking \u2014 tap to view", bookingId: target.id },
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

type ChatHistoryMessage = { role: "user" | "assistant"; text: string };

async function callGemini(
  prompt: string,
  maxTokens = 300,
  history?: ChatHistoryMessage[]
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "";
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  /* Build multi-turn contents array when conversation history is available. */
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (history && history.length) {
    for (const msg of history.slice(-10)) {
      const role = msg.role === "user" ? "user" : "model";
      const text = normalizeText(msg.text);
      if (text) {
        contents.push({ role, parts: [{ text }] });
      }
    }
  }

  contents.push({ role: "user", parts: [{ text: prompt }] });

  const requestBody = JSON.stringify({
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: maxTokens,
    },
  });

  /* Retry logic — 1 retry with 1.5s delay for transient failures. */
  const MAX_RETRIES = 1;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      if (!response.ok) {
        const status = response.status;
        /* Don't retry on client errors (400, 401, 403) — only server/rate errors */
        if (status >= 400 && status < 500 && status !== 429) {
          try { const txt = await response.text(); console.error("gemini client error", status, txt); } catch (_) {}
          return "";
        }
        if (attempt < MAX_RETRIES) {
          console.warn(`gemini attempt ${attempt + 1} failed (${status}), retrying...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        try { const txt = await response.text(); console.error("gemini error after retry", status, txt); } catch (_) {}
        return "";
      }

      const payload = await response.json();
      return normalizeText(
        payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => normalizeText(part?.text)).join(" ")
      );
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(`gemini network error attempt ${attempt + 1}, retrying...`, err);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      console.error("gemini network error after retry", err);
      return "";
    }
  }

  return "";
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

  const result = await callGemini(prompt, 260);
  return result || input.draftAnswer;
}

/* ─── Vehicle Search Handler ───
 * Parses the query for type, brand, name, budget, fuel, transmission
 * and returns matching vehicles from the database as cards. */
function parseSearchCriteria(query: string): {
  type: string; brand: string; name: string;
  maxBudget: number; fuel: string; transmission: string; minSeats: number;
} {
  const lower = query.toLowerCase();
  let type = "";
  let brand = "";
  let name = "";
  let maxBudget = 0;
  let fuel = "";
  let transmission = "";
  let minSeats = 0;

  // Vehicle type
  if (/\bsuv\b/.test(lower)) type = "suv";
  else if (/\bsedan\b/.test(lower)) type = "sedan";
  else if (/\b(economy|hatchback|compact|cheap)\b/.test(lower)) type = "economy";
  else if (/\b(luxury|premium)\b/.test(lower)) type = "luxury";
  else if (/\b(van|minivan|mpv)\b/.test(lower)) type = "van";

  // Budget
  const budgetMatch = lower.match(/(?:under|below|within|less than|max|upto|up to|around|about)\s*(?:npr|rs\.?)?\s*(\d[\d,]*)/);
  if (budgetMatch) maxBudget = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
  const budgetMatch2 = lower.match(/(\d[\d,]*)\s*(?:npr|rs\.?)/);
  if (!maxBudget && budgetMatch2) maxBudget = parseInt(budgetMatch2[1].replace(/,/g, ""), 10);

  // Fuel
  if (/\bdiesel\b/.test(lower)) fuel = "diesel";
  else if (/\b(petrol|gasoline)\b/.test(lower)) fuel = "petrol";
  else if (/\b(electric|ev)\b/.test(lower)) fuel = "electric";

  // Transmission
  if (/\bautomatic\b/.test(lower)) transmission = "automatic";
  else if (/\bmanual\b/.test(lower)) transmission = "manual";

  // Seats
  const seatMatch = lower.match(/(\d+)\s*(?:seat|seater)/);
  if (seatMatch) minSeats = parseInt(seatMatch[1], 10);

  // Known brands
  const brands = ["toyota", "honda", "suzuki", "hyundai", "tata", "kia", "mahindra", "renault", "skoda", "bmw", "mercedes", "audi", "volvo", "jaguar", "ford", "mg"];
  for (const b of brands) {
    if (lower.includes(b)) { brand = b; break; }
  }

  // Specific vehicle names (check original case query for proper names)
  const knownNames = ["Swift", "Creta", "Seltos", "Fortuner", "Civic", "Corolla", "Verna", "City", "Brezza", "Tiago",
    "WagonR", "Alto", "Kwid", "Santro", "Celerio", "Ignis", "Brio", "Ciaz", "Elantra", "Dzire", "Amaze", "Yaris",
    "Rapid", "Tuscon", "Hector", "XUV700", "Scorpio", "EcoSport", "Venue", "5 Series", "E-Class", "A6", "XF", "S90",
    "Camry", "Superb", "Accord", "GLC", "X5", "Innova", "Ertiga", "Carnival", "Staria", "XL6", "Carens", "Marazzo", "Hexa", "Lodgy"];
  for (const n of knownNames) {
    if (lower.includes(n.toLowerCase())) { name = n; break; }
  }

  return { type, brand, name, maxBudget, fuel, transmission, minSeats };
}

async function handleVehicleSearch(input: {
  query: string; history?: ChatHistoryMessage[];
}): Promise<{ answer: string; actions: ActionItem[]; citations: Citation[] }> {
  const criteria = parseSearchCriteria(input.query);

  let query = supabaseAdmin.from("vehicles").select("id,name,brand,type,category,seats,price_per_day,daily_rate,fuel_type,transmission,image_url,primary_image_url,features,available,is_available,status,rating,location").order("rating", { ascending: false }).limit(30);

  // Apply filters
  if (criteria.name) {
    query = query.ilike("name", `%${criteria.name}%`);
  }
  if (criteria.brand) {
    query = query.ilike("brand", `%${criteria.brand}%`);
  }
  if (criteria.type) {
    query = query.ilike("type", `%${criteria.type}%`);
  }
  if (criteria.fuel) {
    query = query.ilike("fuel_type", `%${criteria.fuel}%`);
  }
  if (criteria.transmission) {
    query = query.ilike("transmission", `%${criteria.transmission}%`);
  }

  const result = await query;
  if (result.error) {
    return { answer: "I had trouble searching our fleet. Please try again.", actions: [defaultSupportAction()], citations: [] };
  }

  let vehicles = ((result.data as VehicleRow[] | null) || []).filter(vehicleAvailable);

  if (criteria.minSeats > 0) {
    vehicles = vehicles.filter(v => { const s = Number(v.seats || 0); return s === 0 || s >= criteria.minSeats; });
  }
  if (criteria.maxBudget > 0) {
    const within = vehicles.filter(v => { const p = vehiclePrice(v); return p === 0 || p <= criteria.maxBudget; });
    vehicles = within.length >= 1 ? within : vehicles.sort((a, b) => vehiclePrice(a) - vehiclePrice(b));
  }

  if (!vehicles.length) {
    return {
      answer: "I couldn't find any vehicles matching your criteria. Try broadening your search — for example, ask for \"SUVs\" or \"cars under 5000\".",
      actions: [defaultSupportAction()],
      citations: [],
    };
  }

  const top = vehicles.slice(0, 5);
  const vehicleSummary = top.map((v, i) => {
    const vName = (normalizeText(v.brand) + " " + normalizeText(v.name)).trim();
    return `${i + 1}. ${vName} — ${vehicleCategory(v)} | ${v.seats || 5} seats | NPR ${Math.round(vehiclePrice(v)).toLocaleString()}/day | ${normalizeText(v.fuel_type) || "Petrol"}`;
  }).join("\n");

  let answer = `I found ${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} matching your search. Here are the top picks:\n${vehicleSummary}`;

  if (GEMINI_API_KEY) {
    const prompt = [
      "You are a friendly vehicle rental assistant for RentAVehicle Nepal.",
      "The user searched for vehicles. Write a brief 2-3 sentence summary of the results.",
      "Be helpful and suggest the best option. Do not use markdown.",
      "",
      "Search results:", vehicleSummary,
      "User query: " + input.query,
    ].join("\n");
    const geminiAnswer = await callGemini(prompt, 200, input.history);
    if (geminiAnswer) answer = geminiAnswer;
  }

  const actions: ActionItem[] = top.map((v, i) => ({
    type: "suggest_vehicle" as const,
    label: ((normalizeText(v.brand) + " " + normalizeText(v.name)).trim()) || "Vehicle",
    vehicleId: v.id,
    meta: {
      seats: v.seats || 5,
      price: vehiclePrice(v),
      fuel: normalizeText(v.fuel_type) || "Petrol",
      transmission: normalizeText(v.transmission) || "Automatic",
      image: normalizeText(v.primary_image_url) || normalizeText(v.image_url) || "",
      category: vehicleCategory(v) || "sedan",
      rating: v.rating || 0,
      location: normalizeText(v.location) || "",
      reason: "",
      rank: i + 1,
    },
  }));

  return { answer, actions, citations: [] };
}

/* ─── Vehicle Compare Handler ─── */
async function handleVehicleCompare(input: {
  query: string; history?: ChatHistoryMessage[];
}): Promise<{ answer: string; actions: ActionItem[]; citations: Citation[] }> {
  // Extract vehicle names from the query
  const knownNames = ["Swift", "Creta", "Seltos", "Fortuner", "Civic", "Corolla", "Verna", "City", "Brezza", "Tiago",
    "WagonR", "Alto", "Kwid", "Santro", "Celerio", "Ignis", "Brio", "Ciaz", "Elantra", "Dzire", "Amaze", "Yaris",
    "Rapid", "Tuscon", "Hector", "XUV700", "Scorpio", "EcoSport", "Venue", "5 Series", "E-Class", "A6", "XF", "S90",
    "Camry", "Superb", "Accord", "GLC", "X5", "Innova", "Ertiga", "Carnival", "Staria", "XL6", "Carens", "Marazzo", "Hexa", "Lodgy"];

  const lower = input.query.toLowerCase();
  const matched: string[] = [];
  for (const n of knownNames) {
    if (lower.includes(n.toLowerCase()) && !matched.includes(n)) {
      matched.push(n);
    }
  }

  if (matched.length < 2) {
    // Try to compare types instead
    return {
      answer: "I'd love to compare vehicles for you! Please mention 2 or 3 specific vehicle names, like \"compare Creta vs Seltos\" or \"Civic or Corolla which is better?\"",
      actions: [],
      citations: [],
    };
  }

  // Fetch vehicles by name
  const results = await supabaseAdmin.from("vehicles")
    .select("id,name,brand,type,category,seats,price_per_day,daily_rate,fuel_type,transmission,image_url,primary_image_url,features,rating,location")
    .in("name", matched.slice(0, 3))
    .limit(3);

  const vehicles = ((results.data as VehicleRow[] | null) || []);
  if (vehicles.length < 2) {
    return {
      answer: "I couldn't find all the vehicles you mentioned in our fleet. Please check the names and try again.",
      actions: [defaultSupportAction()],
      citations: [],
    };
  }

  const comparisonTable = vehicles.map(v => {
    const vName = (normalizeText(v.brand) + " " + normalizeText(v.name)).trim();
    return `${vName}: ${vehicleCategory(v)} | ${v.seats || 5} seats | NPR ${Math.round(vehiclePrice(v)).toLocaleString()}/day | ${normalizeText(v.fuel_type) || "Petrol"} | ${normalizeText(v.transmission) || "Auto"} | Rating: ${v.rating || "N/A"}`;
  }).join("\n");

  let answer = "";
  if (GEMINI_API_KEY) {
    const prompt = [
      "You are a friendly vehicle rental assistant for RentAVehicle Nepal.",
      "The user wants to compare these vehicles. Write a clear, helpful comparison in 4-5 sentences.",
      "Mention key differences (price, seats, fuel, category) and give a recommendation.",
      "Do not use markdown formatting. Be conversational.",
      "",
      "Vehicles:", comparisonTable,
      "User query: " + input.query,
    ].join("\n");
    answer = await callGemini(prompt, 350, input.history);
  }
  if (!answer) {
    answer = "Here's a comparison of the vehicles you asked about:\n" + comparisonTable;
  }

  const actions: ActionItem[] = vehicles.map((v, i) => ({
    type: "suggest_vehicle" as const,
    label: ((normalizeText(v.brand) + " " + normalizeText(v.name)).trim()) || "Vehicle",
    vehicleId: v.id,
    meta: {
      seats: v.seats || 5,
      price: vehiclePrice(v),
      fuel: normalizeText(v.fuel_type) || "Petrol",
      transmission: normalizeText(v.transmission) || "Automatic",
      image: normalizeText(v.primary_image_url) || normalizeText(v.image_url) || "",
      category: vehicleCategory(v) || "sedan",
      rating: v.rating || 0,
      location: normalizeText(v.location) || "",
      reason: "",
      rank: i + 1,
    },
  }));

  return { answer, actions, citations: [] };
}

/* ─── Fleet Info Handler ─── */
async function handleFleetInfo(input: {
  query: string; history?: ChatHistoryMessage[];
}): Promise<{ answer: string; actions: ActionItem[]; citations: Citation[] }> {
  const result = await supabaseAdmin.from("vehicles")
    .select("id,type,category")
    .eq("is_active", true);

  const vehicles = ((result.data as Array<{ id: string; type: string; category: string }> | null) || []);
  const total = vehicles.length;

  const typeCounts: Record<string, number> = {};
  vehicles.forEach(v => {
    const cat = normalizeText(v.type || v.category).toLowerCase() || "other";
    typeCounts[cat] = (typeCounts[cat] || 0) + 1;
  });

  const breakdown = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}`)
    .join(", ");

  let answer = `We have ${total} vehicles in our fleet! Here's the breakdown: ${breakdown}. Would you like me to show you vehicles in any specific category?`;

  if (GEMINI_API_KEY) {
    const prompt = [
      "You are a friendly vehicle rental assistant for RentAVehicle Nepal.",
      `Our fleet has ${total} vehicles: ${breakdown}.`,
      "Write a brief, enthusiastic 2-3 sentence response about the fleet.",
      "Invite the user to explore a category. Do not use markdown.",
      "User query: " + input.query,
    ].join("\n");
    const geminiAnswer = await callGemini(prompt, 200, input.history);
    if (geminiAnswer) answer = geminiAnswer;
  }

  return { answer, actions: [], citations: [] };
}

/* ─── Hours Handler ─── */
function handleHoursQuery(): { answer: string; actions: ActionItem[]; citations: Citation[] } {
  return {
    answer: "Our office is open daily from 7:00 AM to 8:00 PM (Nepal Time). " +
      "You can book online 24/7 through our website, and pickups/drop-offs are handled during office hours. " +
      "For urgent after-hours assistance, please contact our support team.",
    actions: [defaultSupportAction()],
    citations: [],
  };
}

/* ─── Availability Handler ─── */
async function handleAvailabilityCheck(input: {
  query: string; history?: ChatHistoryMessage[];
}): Promise<{ answer: string; actions: ActionItem[]; citations: Citation[] }> {
  const criteria = parseSearchCriteria(input.query);

  if (criteria.name) {
    const result = await supabaseAdmin.from("vehicles")
      .select("id,name,brand,type,category,seats,price_per_day,daily_rate,fuel_type,transmission,image_url,primary_image_url,status,available,is_available,rating,location")
      .ilike("name", `%${criteria.name}%`)
      .limit(3);

    const vehicles = ((result.data as VehicleRow[] | null) || []);
    if (!vehicles.length) {
      return {
        answer: `I couldn't find a vehicle named "${criteria.name}" in our fleet. Would you like me to search for something similar?`,
        actions: [],
        citations: [],
      };
    }

    const v = vehicles[0];
    const available = vehicleAvailable(v);
    const vName = (normalizeText(v.brand) + " " + normalizeText(v.name)).trim();
    const answer = available
      ? `Great news! The ${vName} is currently available. It's a ${vehicleCategory(v)} with ${v.seats || 5} seats at NPR ${Math.round(vehiclePrice(v)).toLocaleString()}/day. Would you like to book it?`
      : `Unfortunately, the ${vName} is not available right now. Would you like me to suggest similar vehicles?`;

    const actions: ActionItem[] = available ? [{
      type: "suggest_vehicle" as const,
      label: vName,
      vehicleId: v.id,
      meta: {
        seats: v.seats || 5,
        price: vehiclePrice(v),
        fuel: normalizeText(v.fuel_type) || "Petrol",
        transmission: normalizeText(v.transmission) || "Automatic",
        image: normalizeText(v.primary_image_url) || normalizeText(v.image_url) || "",
        category: vehicleCategory(v) || "sedan",
        rating: v.rating || 0,
        location: normalizeText(v.location) || "",
        reason: "Available now",
        rank: 1,
      },
    }] : [];

    return { answer, actions, citations: [] };
  }

  // Generic availability check
  return {
    answer: "I can check availability for specific vehicles. Just tell me the vehicle name — for example, \"Is the Creta available?\" or \"Check availability for Civic\".",
    actions: [],
    citations: [],
  };
}

function summarizeBookings(bookings: BookingRow[], vehicleMap: Record<string, VehicleRow>): string {
  if (!bookings.length) {
    return "No bookings found for this user.";
  }

  return bookings.slice(0, 5).map((b) => {
    const code = bookingCode(b);
    const vName = vehicleName(b, vehicleMap);
    const status = normalizeText(b.status) || "unknown";
    const start = normalizeText(b.start_date) || "?";
    const end = normalizeText(b.end_date) || "?";
    const amount = formatMoney(b.total_amount, b.currency);
    return `- ${code}: ${vName}, ${start} to ${end}, status: ${status}, amount: ${amount}`;
  }).join("\n");
}

async function handleGeneralQuery(input: {
  query: string;
  bookings: BookingRow[];
  vehicleMap: Record<string, VehicleRow>;
  timezone: string;
  now: Date;
  intent?: string;
  history?: ChatHistoryMessage[];
}): Promise<{ answer: string; actions: ActionItem[]; citations: Citation[] }> {
  const bookingSummary = summarizeBookings(input.bookings, input.vehicleMap);
  const latestBooking = input.bookings[0] || null;
  const intent = input.intent || "unknown";

  /* A richer system prompt grounded in the actual rental policy + service
   * surface. The model is told what the platform supports so it can answer
   * general questions ("how does pickup work?", "do you provide child
   * seats?", etc.) without inventing data. */
  const systemSection = [
    "You are RentAVehicle Nepal's friendly, professional AI Booking Assistant.",
    "Your audience: customers using a self-service vehicle rental platform in Nepal.",
    "",
    "=== PLATFORM KNOWLEDGE BASE (use this for general questions) ===",
    "",
    "FLEET:",
    "- Vehicle categories: Economy, Sedan, SUV, Luxury, Van/MPV",
    "- Brands available: Toyota, Honda, Suzuki, Hyundai, Tata, Kia, Mahindra, BMW, Mercedes, Audi, Volvo, Jaguar, Skoda, Renault, Ford, MG",
    "- All vehicles are well-maintained, regularly serviced, and fully insured",
    "",
    "WORKING HOURS:",
    "- Office hours: 7:00 AM to 8:00 PM daily (Nepal Time), including weekends",
    "- Online booking: Available 24/7 through the website",
    "- Vehicle pickup/drop-off: During office hours only",
    "- After-hours emergency: Contact support team",
    "",
    "REQUIRED DOCUMENTS:",
    "- Valid driving license (Nepali or International)",
    "- Government-issued photo ID (citizenship card or passport)",
    "- Completed KYC (profile verification) on the website",
    "- Age requirement: Minimum 21 years for standard vehicles, 25 for luxury/premium",
    "",
    "BOOKING PROCESS:",
    "- Step 1: Browse fleet and select vehicle",
    "- Step 2: Choose dates, pickup time, and rental options",
    "- Step 3: Submit booking request for admin approval",
    "- Step 4: Once approved, complete payment",
    "- Step 5: Pick up vehicle from office or receive delivery",
    "- Step 6: Return vehicle at end of rental period",
    "",
    "PRICING & PAYMENT:",
    "- Prices shown per day in NPR (Nepali Rupees)",
    "- Payment methods: eSewa, Khalti, bank transfer, cash at office",
    "- Security deposit: NPR 5,000 for economy, NPR 10,000 for sedan/SUV, NPR 25,000 for luxury",
    "- Deposit is fully refundable upon safe return of vehicle",
    "",
    "RENTAL OPTIONS:",
    "- Self-drive: Standard option, customer drives",
    "- With driver: Professional driver available at NPR 2,000/day extra",
    "- Insurance: Basic (included free), Premium (NPR 500/day — lower deductible), Comprehensive (NPR 1,000/day — zero deductible)",
    "",
    "FUEL POLICY:",
    "- Vehicles are provided with a full tank",
    "- Return with the same fuel level",
    "- Refueling charge: NPR 200 service fee + actual fuel cost if not returned full",
    "",
    "DELIVERY & PICKUP:",
    "- Kathmandu Valley: Free delivery/pickup",
    "- Outside Kathmandu: NPR 15/km delivery charge",
    "- Airport pickup/drop: Available (NPR 500 flat fee)",
    "- Home delivery: Available within Kathmandu Valley",
    "",
    "LATE RETURN & EXTENSIONS:",
    "- Late return fee: NPR 500/hour for the first 3 hours, then full day rate applies",
    "- Extensions: Must be requested at least 6 hours before return time via app or support",
    "- Extensions subject to vehicle availability",
    "",
    "CANCELLATION & REFUND:",
    "- Free cancellation: Up to 24 hours before pickup time",
    "- Late cancellation (within 24 hours): 25% cancellation fee",
    "- No-show: 50% of total rental charged",
    "- Refund processing: 5-7 business days to original payment method",
    "- Cancellation requires admin review from the booking modification page",
    "",
    "EXTRAS & ADD-ONS:",
    "- Child seat: NPR 300/day",
    "- GPS navigation: NPR 200/day",
    "- WiFi hotspot: NPR 250/day",
    "- Roof rack/carrier: NPR 400/day",
    "",
    "DAMAGE POLICY:",
    "- Minor scratches/dents: Covered by basic insurance (up to NPR 5,000 deductible)",
    "- Major damage: Customer liable for deductible amount based on insurance tier",
    "- Accident: Must report immediately to support and local authorities",
    "",
    "POPULAR DESTINATIONS FROM KATHMANDU:",
    "- Pokhara: ~200 km, 6-7 hrs drive",
    "- Chitwan: ~150 km, 4-5 hrs drive",
    "- Lumbini: ~280 km, 7-8 hrs drive",
    "- Nagarkot: ~32 km, 1.5 hrs drive",
    "- Bandipur: ~145 km, 4-5 hrs drive",
    "- Mustang/Jomsom: ~380 km, requires SUV/4WD",
    "",
    "SUPPORT:",
    "- Email: " + SUPPORT_EMAIL,
    "- Phone: " + SUPPORT_PHONE,
    "- Live chat: Available during office hours",
    "",
    "=== RULES ===",
    "- Be warm, concise, and helpful (2-4 sentences typically; longer only when explicitly asked).",
    "- If the user greets you, greet them back warmly and briefly mention top capabilities.",
    "- For general policy/service questions, answer using the knowledge base above. NEVER invent details not listed.",
    "- If the user asks about THEIR booking, ONLY use the booking data below. NEVER fabricate booking data.",
    "- If something requires admin/support action, say so and offer the support contact.",
    "- You CANNOT modify, cancel, or create bookings directly. Direct the user to the booking modification page or support.",
    "- Always mention the booking code (e.g. BK-XXXX) when referencing a specific booking.",
    "- Use NPR for all prices.",
    "- If the user asks about vehicle availability/search/comparison, tell them you can help and suggest they ask specifically.",
    "- Maintain conversation context — reference earlier messages when relevant.",
    "- Current date/time: " + input.now.toISOString() + " (" + input.timezone + ")",
    "- Detected intent: " + intent,
    "",
    "USER'S BOOKING DATA (from vehicle_bookings table):",
    bookingSummary,
    "",
    "User message: " + input.query,
  ];

  const prompt = systemSection.join("\n");
  const result = await callGemini(prompt, 450, input.history);

  /* Rich fallback responses when Gemini is unavailable — each intent gets a
   * genuinely helpful response so the chatbot never feels dead. */
  let answer = result;
  if (!answer) {
    const fallbacks: Record<string, string> = {
      greeting: "Namaste! 👋 I'm your AI Booking Assistant at RentAVehicle Nepal. I can help you with:\n• 🚗 Searching & comparing vehicles\n• 🗺️ Planning trips with cost estimates\n• 📋 Checking your bookings\n• 💰 Pricing, refunds & invoices\n• 📄 Documents & policies\n\nWhat would you like to do today?",
      policy: "Here's what you need to know about our rental service:\n\n📄 Required documents: Valid driving license, government ID, and KYC verification on our website.\n🕐 Office hours: 7 AM – 8 PM daily.\n💳 Payment: eSewa, Khalti, bank transfer, or cash.\n🚗 Self-drive or with-driver (NPR 2,000/day extra).\n⛽ Full tank provided — return with same level.\n📦 Extras: Child seat (NPR 300/day), GPS (NPR 200/day), WiFi (NPR 250/day).\n\nNeed more details? Just ask about any specific policy!",
      unknown: "I'd love to help! Here's what I can do:\n\n• Search vehicles by type, budget, or brand\n• Compare vehicles side by side\n• Plan trips with cost estimates\n• Check your booking status\n• Answer policy questions\n\nTry asking something like \"show me SUVs\" or \"plan a trip to Pokhara\"!",
    };
    answer = fallbacks[intent] || fallbacks.unknown;
  }

  const actions: ActionItem[] = [];
  const citations: Citation[] = [];
  if (latestBooking) {
    citations.push(citationFrom(latestBooking));
    actions.push({
      type: "view_booking",
      label: "View your latest booking",
      bookingId: latestBooking.id,
    });
  }
  actions.push(defaultSupportAction());

  return { answer, actions, citations };
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

    /* Conversation history — last N messages for multi-turn context. */
    const rawHistory = Array.isArray(body.history) ? body.history as Array<{ role?: string; text?: string }> : [];
    const history: ChatHistoryMessage[] = rawHistory
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && normalizeText(m.text))
      .map((m) => ({ role: m.role as "user" | "assistant", text: normalizeText(m.text) }))
      .slice(-10);

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

    const intent = classifyIntent(query);

    // Handle trip planning separately (doesn't need bookings).
    // If 2+ stops are detected we go through the multi-leg quote handler that
    // also outputs a per-stop fuel + package estimate alongside vehicle cards.
    if (intent === "trip") {
      const ctx = parseTripContext(query);
      const tripResult = ctx.stops.length >= 2
        ? await handleMultiLegQuote({ query, ctx, timezone, now: safeNow })
        : await handleTripPlanning({ query, ctx, timezone, now: safeNow });
      return jsonResponse(200, {
        success: true,
        answer: tripResult.answer,
        actions: tripResult.actions as unknown as JsonValue,
        citations: tripResult.citations as unknown as JsonValue,
        unresolved: false,
        support: { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE } as unknown as JsonValue,
        source: "vehicles",
        suggestions: getSuggestions("trip", bookings.length > 0) as unknown as JsonValue,
      });
    }

    /* Vehicle search: "show me SUVs", "cars under 3000" */
    if (intent === "vehicle_search") {
      const searchResult = await handleVehicleSearch({ query, history });
      return jsonResponse(200, {
        success: true,
        answer: searchResult.answer,
        actions: searchResult.actions as unknown as JsonValue,
        citations: searchResult.citations as unknown as JsonValue,
        unresolved: false,
        support: { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE } as unknown as JsonValue,
        source: "vehicles",
        suggestions: getSuggestions("vehicle_search", bookings.length > 0) as unknown as JsonValue,
      });
    }

    /* Vehicle compare: "compare Creta vs Seltos" */
    if (intent === "vehicle_compare") {
      const compareResult = await handleVehicleCompare({ query, history });
      return jsonResponse(200, {
        success: true,
        answer: compareResult.answer,
        actions: compareResult.actions as unknown as JsonValue,
        citations: compareResult.citations as unknown as JsonValue,
        unresolved: false,
        support: { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE } as unknown as JsonValue,
        source: "vehicles",
        suggestions: getSuggestions("vehicle_compare", bookings.length > 0) as unknown as JsonValue,
      });
    }

    /* Fleet info: "how many cars do you have" */
    if (intent === "fleet") {
      const fleetResult = await handleFleetInfo({ query, history });
      return jsonResponse(200, {
        success: true,
        answer: fleetResult.answer,
        actions: fleetResult.actions as unknown as JsonValue,
        citations: fleetResult.citations as unknown as JsonValue,
        unresolved: false,
        support: { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE } as unknown as JsonValue,
        source: "vehicles",
        suggestions: getSuggestions("fleet", bookings.length > 0) as unknown as JsonValue,
      });
    }

    /* Working hours */
    if (intent === "hours") {
      const hoursResult = handleHoursQuery();
      return jsonResponse(200, {
        success: true,
        answer: hoursResult.answer,
        actions: hoursResult.actions as unknown as JsonValue,
        citations: hoursResult.citations as unknown as JsonValue,
        unresolved: false,
        support: { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE } as unknown as JsonValue,
        source: "policy",
        suggestions: getSuggestions("hours", bookings.length > 0) as unknown as JsonValue,
      });
    }

    /* Availability check: "is Creta available" */
    if (intent === "availability") {
      const availResult = await handleAvailabilityCheck({ query, history });
      return jsonResponse(200, {
        success: true,
        answer: availResult.answer,
        actions: availResult.actions as unknown as JsonValue,
        citations: availResult.citations as unknown as JsonValue,
        unresolved: false,
        support: { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE } as unknown as JsonValue,
        source: "vehicles",
        suggestions: getSuggestions("availability", bookings.length > 0) as unknown as JsonValue,
      });
    }

    /* Greetings, generic policy/service questions, and unknowns go straight
     * through the dynamic Gemini-backed general handler so the assistant
     * actually responds rather than falling back to a canned booking line. */
    if (intent === "greeting" || intent === "policy" || intent === "unknown") {
      const generalResult = await handleGeneralQuery({
        query,
        bookings,
        vehicleMap,
        timezone,
        now: safeNow,
        intent,
        history,
      });
      return jsonResponse(200, {
        success: true,
        answer: generalResult.answer,
        actions: generalResult.actions as unknown as JsonValue,
        citations: generalResult.citations as unknown as JsonValue,
        unresolved: false,
        support: { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE } as unknown as JsonValue,
        source: intent,
        suggestions: getSuggestions(intent, bookings.length > 0) as unknown as JsonValue,
      });
    }

    const ruleAnswer = buildRuleAnswer({
      query,
      now: safeNow,
      timezone,
      bookings,
      vehicleMap,
    });

    let finalAnswer: string;
    let finalActions = ruleAnswer.actions;
    let finalCitations = ruleAnswer.citations;

    if (ruleAnswer.unresolved && GEMINI_API_KEY) {
      const geminiResult = await handleGeneralQuery({ query, bookings, vehicleMap, timezone, now: safeNow, intent, history });
      finalAnswer = geminiResult.answer;
      finalActions = geminiResult.actions;
      finalCitations = geminiResult.citations;
    } else {
      finalAnswer = await maybeRefineWithGemini({
        query,
        draftAnswer: ruleAnswer.answer,
        citations: ruleAnswer.citations,
        actions: ruleAnswer.actions,
      });
    }

    return jsonResponse(200, {
      success: true,
      answer: finalAnswer,
      actions: finalActions as unknown as JsonValue,
      citations: finalCitations as unknown as JsonValue,
      unresolved: ruleAnswer.unresolved,
      support: {
        email: SUPPORT_EMAIL,
        phone: SUPPORT_PHONE,
      } as unknown as JsonValue,
      source: "vehicle_bookings",
      suggestions: getSuggestions(intent, bookings.length > 0) as unknown as JsonValue,
    });
  } catch (error) {
    console.error("booking-chat error", error);
    const payload: JsonObject = {
      success: false,
      message: "Unable to resolve booking query right now.",
      fallback: {
        supportEmail: SUPPORT_EMAIL,
        supportPhone: SUPPORT_PHONE,
      } as unknown as JsonValue,
    };

    if (DEBUG_MODE) {
      payload.debug = {
        errorMessage: String(error?.message || error),
        stack: String(error?.stack || ""),
      } as unknown as JsonValue;
    }

    return jsonResponse(500, payload);
  }
});
