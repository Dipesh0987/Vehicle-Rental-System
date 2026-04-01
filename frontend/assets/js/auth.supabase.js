(function () {
  "use strict";

  var clientInitPromise = null;
  var SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
  var PROFILE_IMAGE_BUCKET = "profile-images";
  var PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
  var PROFILE_IMAGE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
  var PROFILE_IMAGE_MAX_DIMENSION = 768;
  var PROFILE_IMAGE_QUALITY = 0.86;

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

  function isConfirmationEmailDeliveryError(error) {
    var message = getErrorMessage(error);
    var code = String(error && (error.code || error.error_code) ? (error.code || error.error_code) : "").toLowerCase();

    return (
      message.indexOf("error sending confirmation email") >= 0 ||
      message.indexOf("confirmation email") >= 0 ||
      (code.indexOf("unexpected_failure") >= 0 && message.indexOf("email") >= 0) ||
      (message.indexOf("smtp") >= 0 && message.indexOf("send") >= 0)
    );
  }

  function isEmailNotConfirmedError(error) {
    var message = getErrorMessage(error);
    return message.indexOf("email not confirmed") >= 0;
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

    if (
      message.indexOf("profile-images") >= 0 &&
      (message.indexOf("bucket") >= 0 || message.indexOf("not found") >= 0)
    ) {
      return "Profile image bucket is missing. Run database/migrations/003_profile_images_storage.sql in Supabase SQL Editor.";
    }

    if (
      message.indexOf("storage") >= 0 &&
      message.indexOf("row-level security") >= 0
    ) {
      return "Profile image upload is blocked by Storage policies. Run database/migrations/003_profile_images_storage.sql to create correct storage policies.";
    }

    if (
      message.indexOf("mime type") >= 0 &&
      message.indexOf("not allowed") >= 0
    ) {
      return "Only JPG, PNG, and WEBP profile images are allowed.";
    }

    if (
      message.indexOf("entity too large") >= 0 ||
      message.indexOf("payload too large") >= 0
    ) {
      return "Image is too large. Use a smaller image file and try again.";
    }

    if (isConfirmationEmailDeliveryError(error)) {
      return "Supabase could not send the confirmation email. Configure Authentication > Email SMTP and verify sender/domain, or temporarily disable Confirm email in Supabase and retry signup.";
    }

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

  function getDisplayNameFromEmail(email) {
    var left = String(email || "").split("@")[0] || "User";
    return left.replace(/[._-]+/g, " ").replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  }

  function isMissingAvatarColumnError(error) {
    var message = getErrorMessage(error);
    return (
      message.indexOf("avatar_url") >= 0 &&
      message.indexOf("column") >= 0 &&
      message.indexOf("does not exist") >= 0
    );
  }

  function normalizeProfilePayload(profileInput, session) {
    var input = profileInput;
    var fullName = "";
    var avatarUrl = "";

    if (typeof input === "string") {
      fullName = trim(input);
    } else if (input && typeof input === "object") {
      fullName = trim(input.fullName || input.full_name);
      avatarUrl = trim(input.avatarUrl || input.avatar_url);
    }

    if (!fullName) {
      var metadata = (session && session.user && session.user.user_metadata) || {};
      fullName = trim(metadata.full_name || metadata.display_name);
    }

    if (!fullName) {
      fullName = getDisplayNameFromEmail(session && session.user && session.user.email);
    }

    return {
      full_name: fullName || "User",
      avatar_url: avatarUrl || null,
    };
  }

  function isSupportedProfileImageMime(mimeType) {
    var type = String(mimeType || "").toLowerCase();
    return (
      type === "image/jpeg" ||
      type === "image/jpg" ||
      type === "image/png" ||
      type === "image/webp"
    );
  }

  function getProfileImageExtension(mimeType) {
    var type = String(mimeType || "").toLowerCase();

    if (type === "image/png") {
      return "png";
    }

    if (type === "image/webp") {
      return "webp";
    }

    return "jpg";
  }

  async function listStoredProfileImagePaths(storageBucket, userId) {
    var paths = [];
    var offset = 0;
    var limit = 100;

    while (true) {
      var listed = await storageBucket.list(userId, {
        limit: limit,
        offset: offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

      if (listed.error) {
        throw listed.error;
      }

      var items = Array.isArray(listed.data) ? listed.data : [];

      items.forEach(function (item) {
        var name = String(item && item.name ? item.name : "").replace(/^\/+/, "");
        if (name) {
          paths.push(userId + "/" + name);
        }
      });

      if (items.length < limit) {
        break;
      }

      offset += items.length;
    }

    return paths;
  }

  async function removeOldProfileImages(storageBucket, userId, keepPath) {
    var existingPaths = await listStoredProfileImagePaths(storageBucket, userId);
    var stalePaths = existingPaths.filter(function (path) {
      return path !== keepPath;
    });

    if (!stalePaths.length) {
      return;
    }

    var removed = await storageBucket.remove(stalePaths);
    if (removed.error) {
      throw removed.error;
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (event) {
        resolve(String(event && event.target && event.target.result ? event.target.result : ""));
      };
      reader.onerror = function () {
        reject(new Error("Unable to read image file."));
      };
      reader.readAsDataURL(file);
    });
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject(new Error("Unable to load selected image."));
      };
      image.src = dataUrl;
    });
  }

  function dataUrlToBlob(dataUrl) {
    var parts = String(dataUrl || "").split(",");
    if (parts.length < 2) {
      return null;
    }

    var mimeMatch = parts[0].match(/data:(.*?);base64/i);
    var mimeType = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "application/octet-stream";
    var binary = atob(parts[1]);
    var length = binary.length;
    var bytes = new Uint8Array(length);

    for (var i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise(function (resolve) {
      if (!canvas || typeof canvas.toBlob !== "function") {
        resolve(null);
        return;
      }

      canvas.toBlob(function (blob) {
        resolve(blob || null);
      }, mimeType, quality);
    });
  }

  async function optimizeProfileImage(file) {
    var dataUrl = await readFileAsDataUrl(file);
    var image = await loadImageFromDataUrl(dataUrl);
    var width = Number(image.naturalWidth || image.width || 0);
    var height = Number(image.naturalHeight || image.height || 0);

    if (!width || !height) {
      throw new Error("Selected image is invalid.");
    }

    var longestSide = Math.max(width, height);
    var scale = longestSide > PROFILE_IMAGE_MAX_DIMENSION
      ? PROFILE_IMAGE_MAX_DIMENSION / longestSide
      : 1;

    var targetWidth = Math.max(1, Math.round(width * scale));
    var targetHeight = Math.max(1, Math.round(height * scale));

    var canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    var ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Image optimization failed.");
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    var optimizedBlob = await canvasToBlob(canvas, "image/webp", PROFILE_IMAGE_QUALITY);
    if (!optimizedBlob) {
      optimizedBlob = await canvasToBlob(canvas, "image/jpeg", PROFILE_IMAGE_QUALITY);
    }

    if (!optimizedBlob) {
      optimizedBlob = dataUrlToBlob(canvas.toDataURL("image/jpeg", PROFILE_IMAGE_QUALITY));
    }

    if (!optimizedBlob) {
      throw new Error("Unable to process profile image.");
    }

    return optimizedBlob;
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

  async function uploadProfileImage(file) {
    if (!file) {
      throw new Error("No image selected.");
    }

    var mimeType = String(file.type || "").toLowerCase();
    if (!isSupportedProfileImageMime(mimeType)) {
      throw new Error("Please select a JPG, PNG, or WEBP image.");
    }

    if (Number(file.size || 0) > PROFILE_IMAGE_MAX_SOURCE_BYTES) {
      throw new Error("Image is too large. Please choose a file under 20 MB.");
    }

    var optimizedBlob = await optimizeProfileImage(file);
    if (Number(optimizedBlob.size || 0) > PROFILE_IMAGE_MAX_BYTES) {
      throw new Error("Image is too large after optimization. Please choose a smaller image.");
    }

    var client = await getClient();
    var session = await getSession();

    if (!session || !session.user) {
      throw new Error("You must be signed in to upload a profile image.");
    }

    var extension = getProfileImageExtension(optimizedBlob.type || mimeType);
    var uniqueSuffix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    var objectPath = session.user.id + "/avatar-" + uniqueSuffix + "." + extension;
    var storageBucket = client.storage.from(PROFILE_IMAGE_BUCKET);

    var upload = await storageBucket
      .upload(objectPath, optimizedBlob, {
        upsert: false,
        contentType: optimizedBlob.type || "image/jpeg",
        cacheControl: "3600",
      });

    if (upload.error) {
      throw upload.error;
    }

    var publicUrlResponse = storageBucket.getPublicUrl(objectPath);

    var publicUrl = publicUrlResponse && publicUrlResponse.data
      ? String(publicUrlResponse.data.publicUrl || "")
      : "";

    if (!publicUrl) {
      throw new Error("Profile image upload succeeded but URL generation failed.");
    }

    try {
      await removeOldProfileImages(storageBucket, session.user.id, objectPath);
    } catch (cleanupError) {
      console.warn("Old profile image cleanup skipped:", cleanupError && cleanupError.message ? cleanupError.message : cleanupError);
    }

    return publicUrl + "?v=" + Date.now();
  }

  async function getProfile() {
    var client = await getClient();
    var session = await getSession();

    if (!session || !session.user) {
      return null;
    }

    var response = await client
      .from("user_profiles")
      .select("id, email, full_name, avatar_url, updated_at")
      .eq("id", session.user.id)
      .maybeSingle();

    if (response.error && isMissingAvatarColumnError(response.error)) {
      response = await client
        .from("user_profiles")
        .select("id, email, full_name, updated_at")
        .eq("id", session.user.id)
        .maybeSingle();
    }

    if (response.error) {
      console.warn("Profile read skipped:", response.error.message);
      return null;
    }

    if (!response.data) {
      return null;
    }

    return {
      id: response.data.id,
      email: response.data.email,
      full_name: response.data.full_name,
      avatar_url: response.data.avatar_url || null,
      updated_at: response.data.updated_at,
    };
  }

  async function upsertProfile(profileInput) {
    var client = await getClient();
    var session = await getSession();

    if (!session || !session.user) {
      return {
        success: false,
        data: null,
        error: new Error("No active session for profile sync."),
      };
    }

    var profile = normalizeProfilePayload(profileInput, session);
    var payload = {
      id: session.user.id,
      full_name: profile.full_name,
      email: session.user.email,
      avatar_url: profile.avatar_url,
      updated_at: new Date().toISOString(),
    };

    var response = await client
      .from("user_profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, email, full_name, avatar_url, updated_at")
      .single();

    if (response.error && isMissingAvatarColumnError(response.error)) {
      var legacyPayload = {
        id: payload.id,
        full_name: payload.full_name,
        email: payload.email,
        updated_at: payload.updated_at,
      };

      response = await client
        .from("user_profiles")
        .upsert(legacyPayload, { onConflict: "id" })
        .select("id, email, full_name, updated_at")
        .single();
    }

    if (response.error) {
      console.warn("Profile upsert skipped:", response.error.message);
      return {
        success: false,
        data: null,
        error: response.error,
      };
    }

    return {
      success: true,
      data: {
        id: response.data.id,
        email: response.data.email,
        full_name: response.data.full_name,
        avatar_url: response.data.avatar_url || null,
        updated_at: response.data.updated_at,
      },
      error: null,
    };
  }

  window.VehicleAuthService = {
    getClient: getClient,
    getSession: getSession,
    getProfile: getProfile,
    uploadProfileImage: uploadProfileImage,
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
    isConfirmationEmailDeliveryError: isConfirmationEmailDeliveryError,
    isEmailNotConfirmedError: isEmailNotConfirmedError,
    parseRetryAfterSeconds: parseRetryAfterSeconds,
    getEmailRedirectUrl: getEmailRedirectUrl,
  };
})();
