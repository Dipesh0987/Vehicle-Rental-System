(function () {
  "use strict";

  var clientInitPromise = null;
  var SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

  function trim(value) {
    return String(value || "").trim();
  }

  function getErrorMessage(error) {
    return String(error && error.message ? error.message : "").toLowerCase();
  }

  function parseRetryAfterSeconds(error) {
    var message = String(error && error.message ? error.message : "");
    var match = message.match(/after\s+(\d+)\s*(second|seconds|minute|minutes|hour|hours)/i);

    if (match) {
      var count = Number(match[1]);
      if (Number.isFinite(count) && count > 0) {
        var unit = String(match[2] || "").toLowerCase();
        if (unit.indexOf("hour") >= 0) {
          return count * 3600;
        }
        if (unit.indexOf("minute") >= 0) {
          return count * 60;
        }
        return count;
      }
    }

    var retryHeader = Number(
      error && (
        error.retry_after ||
        error.retryAfter ||
        error.retry_after_seconds
      )
    );

    if (Number.isFinite(retryHeader) && retryHeader > 0) {
      return Math.round(retryHeader);
    }

    return 0;
  }

  function isRateLimitError(error) {
    var message = getErrorMessage(error);
    var status = Number(error && (error.status || error.statusCode));
    return (
      status === 429 ||
      message.indexOf("too many requests") >= 0 ||
      message.indexOf("rate limit") >= 0 ||
      message.indexOf("over request rate") >= 0
    );
  }

  function isEmailProviderQuotaError(error) {
    var message = getErrorMessage(error);
    var code = String(error && (error.code || error.error_code) ? (error.code || error.error_code) : "").toLowerCase();

    return (
      code.indexOf("over_email_send_rate_limit") >= 0 ||
      message.indexOf("email rate limit") >= 0 ||
      message.indexOf("email send") >= 0 ||
      message.indexOf("too many email") >= 0
    );
  }

  function validatePassword(password) {
    var raw = String(password || "");

    if (raw.length < 8) {
      return {
        valid: false,
        message: "Password must be at least 8 characters long.",
      };
    }

    if (!SPECIAL_CHAR_REGEX.test(raw)) {
      return {
        valid: false,
        message: "Password must include at least one special character.",
      };
    }

    return {
      valid: true,
      message: "",
    };
  }

  function toPublicError(error, fallbackMessage) {
    if (!error) {
      return fallbackMessage;
    }

    var message = getErrorMessage(error);

    if (isRateLimitError(error)) {
      if (isEmailProviderQuotaError(error)) {
        return "Supabase email quota reached. Built-in email has strict limits; configure custom SMTP in Authentication > Email to remove this bottleneck.";
      }

      return "Signup is temporarily rate-limited by Supabase. Please retry shortly; for production, increase Auth rate limits in the Supabase dashboard.";
    }

    if (message.indexOf("invalid login credentials") >= 0) {
      return "Invalid email or password.";
    }

    if (message.indexOf("email not confirmed") >= 0) {
      return "Please verify your email first, then sign in.";
    }

    if (message.indexOf("user already registered") >= 0) {
      return "This email is already registered. Please sign in instead.";
    }

    if (
      message.indexOf("redirect") >= 0 &&
      (
        message.indexOf("not allowed") >= 0 ||
        message.indexOf("allowlist") >= 0 ||
        message.indexOf("allow list") >= 0 ||
        message.indexOf("invalid") >= 0
      )
    ) {
      return "Registration blocked by Supabase redirect URL settings. Add your local login URL in Authentication > URL Configuration.";
    }

    if (message.indexOf("captcha") >= 0) {
      return "Registration blocked by CAPTCHA verification. Disable CAPTCHA for local development or configure CAPTCHA token flow.";
    }

    if (
      message.indexOf("signup is disabled") >= 0 ||
      message.indexOf("signups not allowed") >= 0 ||
      message.indexOf("email signups are disabled") >= 0
    ) {
      return "Email registration is disabled in Supabase Authentication settings.";
    }

    if (message.indexOf("password") >= 0 && message.indexOf("weak") >= 0) {
      return "Password is too weak. Use at least 8 characters and one special character.";
    }

    return fallbackMessage;
  }

  function isRedirectUrlError(error) {
    var message = getErrorMessage(error);
    return (
      message.indexOf("redirect") >= 0 &&
      (
        message.indexOf("not allowed") >= 0 ||
        message.indexOf("allowlist") >= 0 ||
        message.indexOf("allow list") >= 0 ||
        message.indexOf("invalid") >= 0
      )
    );
  }

  function getEmailRedirectUrl(pathname) {
    var path = trim(pathname) || "login.html";

    try {
      return new URL(path, window.location.href).toString();
    } catch (_err) {
      return window.location.origin + "/frontend/" + path;
    }
  }

  async function getClient() {
    if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
      return window.SupabaseRuntime.client;
    }

    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase client runtime is unavailable.");
    }

    if (!clientInitPromise) {
      clientInitPromise = window.SupabaseClient.init();
    }

    return clientInitPromise;
  }

  async function getSession() {
    var client = await getClient();
    var response = await client.auth.getSession();
    if (response.error) {
      throw response.error;
    }
    return response.data.session || null;
  }

  async function signUp(payload) {
    var client = await getClient();
    var email = trim(payload && payload.email);
    var fullName = trim(payload && payload.fullName);
    var password = String((payload && payload.password) || "");
    var redirectTo = getEmailRedirectUrl(payload && payload.redirectPath);

    if (!email || !fullName) {
      throw new Error("Missing required registration fields.");
    }

    var policy = validatePassword(password);
    if (!policy.valid) {
      throw new Error(policy.message);
    }

    var signUpPayload = {
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          display_name: fullName,
        },
      },
    };

    if (redirectTo) {
      signUpPayload.options.emailRedirectTo = redirectTo;
    }

    var result = await client.auth.signUp(signUpPayload);

    // Fallback: if redirect URL is not allow-listed, retry without custom redirect.
    if (result.error && isRedirectUrlError(result.error) && !isRateLimitError(result.error)) {
      delete signUpPayload.options.emailRedirectTo;
      result = await client.auth.signUp(signUpPayload);
    }

    if (result.error) {
      if (isRateLimitError(result.error)) {
        result.error.waitSeconds = parseRetryAfterSeconds(result.error);
      }
      throw result.error;
    }

    return result.data;
  }

  async function signIn(payload) {
    var client = await getClient();
    var result = await client.auth.signInWithPassword({
      email: trim(payload && payload.email),
      password: String((payload && payload.password) || ""),
    });

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function sendPasswordReset(email, redirectPath) {
    var client = await getClient();
    var result = await client.auth.resetPasswordForEmail(trim(email), {
      redirectTo: getEmailRedirectUrl(redirectPath || "login.html"),
    });

    if (result.error) {
      throw result.error;
    }
  }

  async function signOut() {
    var client = await getClient();
    var result = await client.auth.signOut();
    if (result.error) {
      throw result.error;
    }
  }

  async function signInWithGoogle(redirectPath) {
    var client = await getClient();
    var result = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getEmailRedirectUrl(redirectPath || "index.html"),
      },
    });

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  async function upsertProfile(fullName) {
    var client = await getClient();
    var session = await getSession();

    if (!session || !session.user) {
      return;
    }

    var name = trim(fullName) || trim(session.user.user_metadata && session.user.user_metadata.full_name);
    if (!name) {
      return;
    }

    var response = await client.from("user_profiles").upsert(
      {
        id: session.user.id,
        full_name: name,
        email: session.user.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (response.error) {
      console.warn("Profile upsert skipped:", response.error.message);
    }
  }

  window.VehicleAuthService = {
    getClient: getClient,
    getSession: getSession,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    signInWithGoogle: signInWithGoogle,
    sendPasswordReset: sendPasswordReset,
    upsertProfile: upsertProfile,
    validatePassword: validatePassword,
    toPublicError: toPublicError,
    isRateLimitError: isRateLimitError,
    isEmailProviderQuotaError: isEmailProviderQuotaError,
    parseRetryAfterSeconds: parseRetryAfterSeconds,
    getEmailRedirectUrl: getEmailRedirectUrl,
  };
})();
