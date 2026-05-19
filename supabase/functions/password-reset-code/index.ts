import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonObject = Record<string, unknown>;

type PasswordResetLookupRow = {
  user_id: string;
  email: string;
};

type PasswordResetOtpRow = {
  id: number;
  user_id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  max_attempts: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const PASSWORD_RESET_CODE_PEPPER = (Deno.env.get("PASSWORD_RESET_CODE_PEPPER") ?? "").trim() || "vrs-dev-pepper-change-in-production";
const PASSWORD_RESET_FROM_EMAIL =
  (Deno.env.get("PASSWORD_RESET_FROM_EMAIL") ?? "").trim()
  || "Rent A Vehicle Nepal <onboarding@resend.dev>";
const PASSWORD_RESET_APP_NAME =
  (Deno.env.get("PASSWORD_RESET_APP_NAME") ?? "").trim() || "Rent A Vehicle Nepal";
// Redirect to a single inbox during development (Resend free-tier only
// delivers to the verified account email until a domain is added at
// resend.com/domains). Set RESEND_DEV_REDIRECT_TO explicitly when needed;
// leave empty once a domain is verified so OTPs reach real users.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_DEV_REDIRECT_TO =
  (Deno.env.get("RESEND_DEV_REDIRECT_TO") ?? "").trim().toLowerCase()
  || (PASSWORD_RESET_FROM_EMAIL.includes("@resend.dev") ? "vechilerental@gmail.com" : "");
const PASSWORD_RESET_DEBUG =
  String(Deno.env.get("PASSWORD_RESET_DEBUG") ?? "").trim().toLowerCase() === "1";

const CODE_TTL_MINUTES = parseIntegerEnv("PASSWORD_RESET_CODE_TTL_MINUTES", 10, 5, 30);
const MAX_VERIFY_ATTEMPTS = parseIntegerEnv("PASSWORD_RESET_MAX_VERIFY_ATTEMPTS", 5, 3, 10);
const REQUEST_COOLDOWN_SECONDS = parseIntegerEnv("PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS", 45, 15, 300);
const MAX_REQUESTS_PER_HOUR = parseIntegerEnv("PASSWORD_RESET_MAX_REQUESTS_PER_HOUR", 5, 3, 25);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for password reset function.");
}

if ((Deno.env.get("PASSWORD_RESET_CODE_PEPPER") ?? "").trim() === "") {
  console.warn("PASSWORD_RESET_CODE_PEPPER is missing. Using temporary development pepper fallback.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function parseIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Deno.env.get(name);
  const parsed = Number.parseInt(String(raw ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed < min) {
    return min;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
}

function jsonResponse(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return null;
  }

  const firstIp = forwardedFor.split(",")[0]?.trim();
  return firstIp || null;
}

function getClientUserAgent(request: Request): string {
  return String(request.headers.get("user-agent") ?? "").slice(0, 500);
}

function generateSixDigitCode(): string {
  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return randomValue.toString().padStart(6, "0");
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashResetCode(email: string, userId: string, code: string): Promise<string> {
  return sha256Hex([PASSWORD_RESET_CODE_PEPPER, email, userId, code].join("|"));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (/\s/.test(password)) {
    return "Password cannot contain spaces or whitespace characters.";
  }

  if (!specialCharRegex.test(password)) {
    return "Password must include at least one special character.";
  }

  return null;
}

function obfuscateEmail(email: string): string {
  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) {
    return email;
  }

  const visibleLocal = localPart.slice(0, Math.min(2, localPart.length));
  return `${visibleLocal}***@${domainPart}`;
}

function isEmailDeliveryConfigured(): boolean {
  return Boolean(RESEND_API_KEY && PASSWORD_RESET_FROM_EMAIL);
}

function emailDeliveryConfigError(): string {
  if (!RESEND_API_KEY) {
    return "Password reset email delivery is not configured. Set RESEND_API_KEY in the password-reset-code function secrets, then redeploy the function.";
  }

  if (PASSWORD_RESET_FROM_EMAIL.includes("@resend.dev") && !RESEND_DEV_REDIRECT_TO) {
    return "Password reset email delivery is using a resend.dev sender, but RESEND_DEV_REDIRECT_TO is not set. Either set RESEND_DEV_REDIRECT_TO to a verified inbox for testing or configure a verified custom sender/domain and remove the resend.dev sender.";
  }

  return "";
}

function missingEmailConfigMessage(): string {
  return emailDeliveryConfigError() || "Password reset email delivery is not configured. Set RESEND_API_KEY and PASSWORD_RESET_FROM_EMAIL in the password-reset-code function secrets, then redeploy the function.";
}

async function sendResetCodeEmail(params: {
  to: string;
  code: string;
}): Promise<void> {
  const configError = emailDeliveryConfigError();
  if (configError) {
    throw new Error(configError);
  }

  const originalTo = params.to;
  const isRedirected =
    RESEND_DEV_REDIRECT_TO.length > 0 &&
    RESEND_DEV_REDIRECT_TO !== originalTo.toLowerCase();
  const actualTo = isRedirected ? RESEND_DEV_REDIRECT_TO : originalTo;

  const devBanner = isRedirected
    ? `<div style="background:#fff7e6;border:1px solid #f5c97d;color:#7a4c0d;padding:10px 14px;border-radius:8px;font-family:Arial,sans-serif;font-size:12px;margin:0 0 14px 0;"><strong>Dev redirect:</strong> originally addressed to <strong>${originalTo}</strong>. Clear RESEND_DEV_REDIRECT_TO once domain is verified at resend.com/domains.</div>`
    : "";

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f7faf9;color:#103437;">
    ${devBanner}
    <div style="margin-bottom:18px;">
      <span style="font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#2c766e;">${PASSWORD_RESET_APP_NAME}</span>
    </div>
    <h2 style="margin:0 0 12px;font-size:24px;font-weight:800;">Password reset code</h2>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#2a4c50;">Use the 6-digit code below to reset your password. It expires in <strong>${CODE_TTL_MINUTES} minutes</strong>.</p>
    <div style="display:inline-block;padding:16px 24px;background:#0e3a3d;color:#ffffff;border-radius:12px;font-size:32px;letter-spacing:8px;font-weight:800;font-family:monospace;">
      ${params.code}
    </div>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#4a6668;">This code can only be used once. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
    <hr style="margin:20px 0;border:none;border-top:1px solid rgba(16,52,55,0.12);" />
    <p style="margin:0;font-size:12px;color:#6a8c8e;">${PASSWORD_RESET_APP_NAME} &mdash; Automated notification, please do not reply.</p>
  </div>
  `;

  const subject = isRedirected
    ? `[DEV → ${originalTo}] ${PASSWORD_RESET_APP_NAME} password reset code`
    : `${PASSWORD_RESET_APP_NAME} — your password reset code`;

  const text = [
    `${PASSWORD_RESET_APP_NAME} password reset code: ${params.code}`,
    `This code expires in ${CODE_TTL_MINUTES} minutes and can be used only once.`,
    "If you did not request this, you can ignore this email.",
    isRedirected ? `\n[DEV] Originally addressed to: ${originalTo}` : "",
  ].filter(Boolean).join("\n");

  const finalHtml = isRedirected
    ? `<div style="background:#fff7e6;border:1px solid #f5c97d;color:#7a4c0d;padding:12px 16px;border-radius:8px;font-size:13px;margin:0 0 16px 0;"><strong>Dev redirect:</strong> originally for <strong>${originalTo}</strong></div>` + html
    : html;

  console.info("Sending password reset email", {
    originalTo,
    actualTo,
    from: PASSWORD_RESET_FROM_EMAIL,
    redirected: isRedirected,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: PASSWORD_RESET_FROM_EMAIL,
      to: [actualTo],
      subject,
      html: finalHtml,
      text,
    }),
  });

  if (!response.ok) {
    const providerMessage = await response.text();
    throw new Error(`Email send failed (${response.status}): ${providerMessage}`);
  }
}

async function lookupUserByEmail(email: string): Promise<PasswordResetLookupRow | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await supabaseAdmin.rpc("password_reset_lookup_user", {
    p_email: normalizedEmail,
  });

  if (error) {
    throw new Error(`User lookup failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  const userData = rows.find((row) => normalizeEmail((row as PasswordResetLookupRow).email) === normalizedEmail) as PasswordResetLookupRow | undefined;

  if (!userData || !userData.user_id || !userData.email) {
    console.info("Password reset request ignored: email not found or not approved", {
      email: normalizedEmail,
    });
    return null;
  }

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("verification_status")
    .eq("id", userData.user_id)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw new Error(`User profile lookup failed: ${profileError.message}`);
  }

  if (String(profileData?.verification_status ?? "").trim().toLowerCase() !== "approved") {
    console.info("Password reset request ignored: user not approved", {
      user_id: userData.user_id,
      email: normalizeEmail(userData.email),
      verification_status: profileData?.verification_status,
    });
    return null;
  }

  return {
    user_id: userData.user_id,
    email: normalizeEmail(userData.email),
  };
}

async function enforceRequestRateLimit(email: string): Promise<void> {
  const now = Date.now();
  const cooldownCutoff = new Date(now - REQUEST_COOLDOWN_SECONDS * 1000).toISOString();
  const oneHourCutoff = new Date(now - 60 * 60 * 1000).toISOString();

  const { data: cooldownRow, error: cooldownError } = await supabaseAdmin
    .from("password_reset_otps")
    .select("created_at")
    .eq("email", email)
    .gte("created_at", cooldownCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cooldownError) {
    throw new Error(`Rate limit check failed: ${cooldownError.message}`);
  }

  if (cooldownRow) {
    throw new Error(`Please wait ${REQUEST_COOLDOWN_SECONDS} seconds before requesting another code.`);
  }

  const { count, error: hourlyCountError } = await supabaseAdmin
    .from("password_reset_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", oneHourCutoff);

  if (hourlyCountError) {
    throw new Error(`Rate limit check failed: ${hourlyCountError.message}`);
  }

  if (Number(count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    throw new Error("Too many reset requests. Please try again in about one hour.");
  }
}

async function issueResetCode(payload: JsonObject, request: Request): Promise<Response> {
  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    return jsonResponse(400, {
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  if (!isEmailDeliveryConfigured()) {
    return jsonResponse(503, {
      success: false,
      message: missingEmailConfigMessage(),
    });
  }

  const configError = emailDeliveryConfigError();
  if (configError) {
    return jsonResponse(503, {
      success: false,
      message: configError,
    });
  }

  let user: PasswordResetLookupRow | null = null;

  try {
    user = await lookupUserByEmail(email);
  } catch (error) {
    console.error("Password reset lookup error:", error);
    return jsonResponse(500, {
      success: false,
      message: PASSWORD_RESET_DEBUG
        ? String(error instanceof Error ? error.message : error)
        : "Unable to process password reset right now. Please try again shortly.",
    });
  }

  if (!user) {
    return jsonResponse(404, {
      success: false,
      message: "No account found for that email address.",
    });
  }

  try {
    await enforceRequestRateLimit(email);
  } catch (error) {
    return jsonResponse(429, {
      success: false,
      message: error instanceof Error ? error.message : "Too many requests. Please wait and try again.",
    });
  }

  const resetCode = generateSixDigitCode();
  const codeHash = await hashResetCode(email, user.user_id, resetCode);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { error: invalidateError } = await supabaseAdmin
    .from("password_reset_otps")
    .update({ consumed_at: nowIso })
    .eq("user_id", user.user_id)
    .is("consumed_at", null);

  if (invalidateError) {
    console.error("Failed to invalidate previous reset codes:", invalidateError.message);
  }

  const { data: insertRow, error: insertError } = await supabaseAdmin
    .from("password_reset_otps")
    .insert({
      user_id: user.user_id,
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: MAX_VERIFY_ATTEMPTS,
      requested_ip: getClientIp(request),
      requested_user_agent: getClientUserAgent(request),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Failed to store reset code:", insertError.message);
    return jsonResponse(500, {
      success: false,
      message: "Unable to process password reset right now. Please try again shortly.",
    });
  }

  try {
    await sendResetCodeEmail({
      to: email,
      code: resetCode,
    });
  } catch (error) {
    console.error("Reset code email send failed:", error);

    await supabaseAdmin
      .from("password_reset_otps")
      .delete()
      .eq("id", insertRow.id);

    return jsonResponse(500, {
      success: false,
      message: "Could not send reset code email. Please try again later.",
    });
  }

  return jsonResponse(200, {
    success: true,
    email: obfuscateEmail(email),
    expiresInMinutes: CODE_TTL_MINUTES,
    message: "A 6-digit reset code has been sent to your email.",
  });
}

async function consumeResetCode(payload: JsonObject): Promise<Response> {
  const email = normalizeEmail(payload.email);
  const resetCode = String(payload.code ?? "").trim();
  const newPassword = String(payload.newPassword ?? "");

  if (!isValidEmail(email)) {
    return jsonResponse(400, {
      success: false,
      message: "Please enter a valid email address.",
    });
  }

  if (!/^\d{6}$/.test(resetCode)) {
    return jsonResponse(400, {
      success: false,
      message: "Reset code must be exactly 6 digits.",
    });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return jsonResponse(400, {
      success: false,
      message: passwordError,
    });
  }

  const nowIso = new Date().toISOString();

  const { data: otpRow, error: otpLookupError } = await supabaseAdmin
    .from("password_reset_otps")
    .select("id,user_id,email,code_hash,expires_at,attempts,max_attempts")
    .eq("email", email)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otpLookupError) {
    console.error("Failed to fetch OTP row:", otpLookupError.message);
    return jsonResponse(500, {
      success: false,
      message: "Unable to verify reset code right now. Please try again.",
    });
  }

  if (!otpRow) {
    return jsonResponse(400, {
      success: false,
      message: "Reset code is invalid or expired. Request a new code.",
    });
  }

  const typedOtpRow = otpRow as PasswordResetOtpRow;
  const expiresAtMs = Date.parse(typedOtpRow.expires_at);

  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    await supabaseAdmin
      .from("password_reset_otps")
      .update({ consumed_at: nowIso })
      .eq("id", typedOtpRow.id);

    return jsonResponse(400, {
      success: false,
      message: "Reset code has expired. Request a new code.",
    });
  }

  const expectedHash = await hashResetCode(email, typedOtpRow.user_id, resetCode);

  if (!timingSafeEqual(expectedHash, typedOtpRow.code_hash)) {
    const nextAttempts = Number(typedOtpRow.attempts || 0) + 1;
    const hasReachedLimit = nextAttempts >= Number(typedOtpRow.max_attempts || MAX_VERIFY_ATTEMPTS);

    await supabaseAdmin
      .from("password_reset_otps")
      .update({
        attempts: nextAttempts,
        consumed_at: hasReachedLimit ? nowIso : null,
      })
      .eq("id", typedOtpRow.id);

    return jsonResponse(400, {
      success: false,
      message: hasReachedLimit
        ? "Too many incorrect attempts. Request a new reset code."
        : "Incorrect reset code. Please try again.",
    });
  }

  const { error: passwordUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    typedOtpRow.user_id,
    {
      password: newPassword,
    },
  );

  if (passwordUpdateError) {
    console.error("Password update failed:", passwordUpdateError.message);
    return jsonResponse(500, {
      success: false,
      message: "Unable to update password right now. Please try again later.",
    });
  }

  await supabaseAdmin
    .from("password_reset_otps")
    .update({ consumed_at: nowIso })
    .eq("user_id", typedOtpRow.user_id)
    .is("consumed_at", null);

  return jsonResponse(200, {
    success: true,
    message: "Password reset successful. You can now sign in with your new password.",
  });
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, {
      success: false,
      message: "Function configuration is incomplete.",
    });
  }

  let payload: JsonObject;

  try {
    payload = (await request.json()) as JsonObject;
  } catch {
    return jsonResponse(400, {
      success: false,
      message: "Invalid request payload.",
    });
  }

  const action = String(payload.action ?? "").trim().toLowerCase();

  if (action === "request") {
    return issueResetCode(payload, request);
  }

  if (action === "confirm") {
    return consumeResetCode(payload);
  }

  return jsonResponse(400, {
    success: false,
    message: "Unsupported action. Use 'request' or 'confirm'.",
  });
});
