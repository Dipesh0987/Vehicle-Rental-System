(function () {
  "use strict";

  var clientInitPromise = null;
  var SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
  var PROFILE_IMAGE_BUCKET = "profile-images";
  var PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
  var PROFILE_IMAGE_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
  var PROFILE_IMAGE_MAX_DIMENSION = 768;
  var PROFILE_IMAGE_QUALITY = 0.86;
  var PROFILE_IMAGE_MAX_DATA_URL_CHARS = 7 * 1024 * 1024;
  var VERIFICATION_STATUSES = ["not_submitted", "pending", "approved", "rejected"];
  var VERIFICATION_GENDERS = ["male", "female", "other", "prefer_not_to_say"];
  var VERIFICATION_DOCUMENT_TYPES = ["driving_license", "national_id", "passport", "other"];
  var PROFILE_COLUMNS_SELECT = "id,email,full_name,avatar_url,updated_at";
  var PROFILE_COLUMNS_WITHOUT_AVATAR_SELECT = "id,email,full_name,updated_at";
  var VERIFICATION_COLUMNS_SELECT = "phone_number,gender,date_of_birth,address_line,city,country,postal_code,document_type,document_number,document_image_url,document_expiry_date,verification_status,verification_submitted_at,verification_reviewed_at,verification_reviewed_by,verification_note";
  var PROFILE_COLUMNS_WITH_VERIFICATION_SELECT = PROFILE_COLUMNS_SELECT + "," + VERIFICATION_COLUMNS_SELECT;

  (function resolveProfileImageBucket() {
    var localConfig = window.SUPABASE_LOCAL_CONFIG || {};
    var runtimeConfig = window.SUPABASE_CONFIG || {};
    var configured = trim(localConfig.profileImageBucket || runtimeConfig.profileImageBucket);

    if (configured) {
      PROFILE_IMAGE_BUCKET = configured;
    }
  })();

  function trim(value) {
    return String(value || "").trim();
  }

  function getErrorMessage(error) {
    return String(error && error.message ? error.message : "").toLowerCase();
  }

  function isBucketNotFoundStorageError(error) {
    var message = getErrorMessage(error);
    var status = Number(error && (error.status || error.statusCode));

    return (
      status === 404 && message.indexOf("bucket") >= 0
    ) || (
      message.indexOf("bucket not found") >= 0
    );
  }

  function isKnownPlaceholderAvatarUrl(value) {
    var raw = trim(value);
    if (!raw) {
      return false;
    }

    var normalized = raw.split("#")[0].split("?")[0].toLowerCase();
    return (
      normalized.indexOf("assets/images/car-transparent.png") >= 0 ||
      normalized.indexOf("default-avatar") >= 0 ||
      normalized.indexOf("avatar-placeholder") >= 0
    );
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

    if (/\s/.test(raw)) {
      return {
        valid: false,
        message: "Password cannot contain spaces or whitespace characters.",
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

    if (isMissingVerificationColumnError(error)) {
      return "User verification workflow schema is missing. Run database/migrations/012_user_profile_verification_workflow.sql and database/migrations/013_verification_document_image_url.sql in Supabase SQL Editor.";
    }

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

    if (
      message.indexOf("failed to fetch") >= 0 ||
      message.indexOf("networkerror") >= 0 ||
      message.indexOf("name_not_resolved") >= 0 ||
      message.indexOf("missing supabase url") >= 0 ||
      message.indexOf("missing supabase_config") >= 0
    ) {
      return "Cannot connect to Supabase. Check network access and verify frontend/assets/js/supabase.config.js (shared) or frontend/assets/js/supabase.config.local.js (local override).";
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

  function isMissingVerificationColumnError(error) {
    var message = getErrorMessage(error);
    if (message.indexOf("column") < 0 || message.indexOf("does not exist") < 0) {
      return false;
    }

    return (
      message.indexOf("phone_number") >= 0 ||
      message.indexOf("gender") >= 0 ||
      message.indexOf("date_of_birth") >= 0 ||
      message.indexOf("address_line") >= 0 ||
      message.indexOf("document_type") >= 0 ||
      message.indexOf("document_number") >= 0 ||
      message.indexOf("document_image_url") >= 0 ||
      message.indexOf("verification_status") >= 0 ||
      message.indexOf("verification_submitted_at") >= 0 ||
      message.indexOf("verification_reviewed_at") >= 0 ||
      message.indexOf("verification_reviewed_by") >= 0 ||
      message.indexOf("verification_note") >= 0
    );
  }

  function normalizeVerificationStatus(value) {
    var normalized = trim(value).toLowerCase();
    if (VERIFICATION_STATUSES.indexOf(normalized) >= 0) {
      return normalized;
    }

    return "not_submitted";
  }

  function normalizeVerificationGender(value) {
    var normalized = trim(value).toLowerCase();
    if (VERIFICATION_GENDERS.indexOf(normalized) >= 0) {
      return normalized;
    }

    return "";
  }

  function normalizeVerificationDocumentType(value) {
    var normalized = trim(value).toLowerCase();
    if (VERIFICATION_DOCUMENT_TYPES.indexOf(normalized) >= 0) {
      return normalized;
    }

    return "";
  }

  function normalizeIsoDate(value) {
    var normalized = trim(value);
    if (!normalized) {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  function normalizePhoneNumber(value) {
    return trim(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeVerificationSubmissionPayload(input) {
    var payload = input && typeof input === "object" ? input : {};

    var phoneNumber = normalizePhoneNumber(payload.phoneNumber || payload.phone_number);
    var phoneDigits = phoneNumber.replace(/[^\d]/g, "");
    var gender = normalizeVerificationGender(payload.gender);
    var dateOfBirth = normalizeIsoDate(payload.dateOfBirth || payload.date_of_birth);
    var addressLine = trim(payload.addressLine || payload.address_line);
    var city = trim(payload.city);
    var country = trim(payload.country) || "Nepal";
    var postalCode = trim(payload.postalCode || payload.postal_code);
    var documentType = normalizeVerificationDocumentType(payload.documentType || payload.document_type);
    var documentNumber = trim(payload.documentNumber || payload.document_number).toUpperCase();
    var documentImageUrl = trim(payload.documentImageUrl || payload.document_image_url);
    var documentExpiryDate = normalizeIsoDate(payload.documentExpiryDate || payload.document_expiry_date);

    if (!phoneNumber || phoneDigits.length < 7 || phoneDigits.length > 15) {
      throw new Error("Phone number must contain 7 to 15 digits.");
    }

    if (!gender) {
      throw new Error("Gender is required.");
    }

    if (!dateOfBirth) {
      throw new Error("Date of birth is required.");
    }

    if (!addressLine) {
      throw new Error("Address line is required.");
    }

    if (!city) {
      throw new Error("City is required.");
    }

    if (!documentType) {
      throw new Error("Document type is required.");
    }

    if (!documentNumber || documentNumber.length < 4) {
      throw new Error("Document number is required.");
    }

    if (!documentImageUrl) {
      throw new Error("Document image is required.");
    }

    if (documentImageUrl.indexOf("data:image/") === 0) {
      documentImageUrl = normalizeDataImageUrlForStorage(documentImageUrl);
      if (!documentImageUrl) {
        throw new Error("Document image data is invalid. Please upload the image again.");
      }
    }

    return {
      phone_number: phoneNumber,
      gender: gender,
      date_of_birth: dateOfBirth,
      address_line: addressLine,
      city: city,
      country: country,
      postal_code: postalCode || null,
      document_type: documentType,
      document_number: documentNumber,
      document_image_url: documentImageUrl,
      document_expiry_date: documentExpiryDate,
      verification_status: "pending",
      verification_submitted_at: new Date().toISOString(),
      verification_reviewed_at: null,
      verification_reviewed_by: null,
      verification_note: null,
    };
  }

  function mapProfileRow(row) {
    var source = row || {};

    return {
      id: source.id,
      email: source.email,
      full_name: source.full_name,
      avatar_url: source.avatar_url || null,
      phone_number: trim(source.phone_number) || null,
      gender: normalizeVerificationGender(source.gender) || null,
      date_of_birth: normalizeIsoDate(source.date_of_birth),
      address_line: trim(source.address_line) || null,
      city: trim(source.city) || null,
      country: trim(source.country) || "Nepal",
      postal_code: trim(source.postal_code) || null,
      document_type: normalizeVerificationDocumentType(source.document_type) || null,
      document_number: trim(source.document_number) || null,
      document_image_url: trim(source.document_image_url) || null,
      document_expiry_date: normalizeIsoDate(source.document_expiry_date),
      verification_status: normalizeVerificationStatus(source.verification_status),
      verification_submitted_at: source.verification_submitted_at || null,
      verification_reviewed_at: source.verification_reviewed_at || null,
      verification_reviewed_by: source.verification_reviewed_by || null,
      verification_note: trim(source.verification_note) || null,
      updated_at: source.updated_at,
    };
  }

  function normalizeProfilePayload(profileInput, session) {
    var input = profileInput;
    var fullName = "";
    var email = "";
    var avatarUrl = "";

    if (typeof input === "string") {
      fullName = trim(input);
    } else if (input && typeof input === "object") {
      fullName = trim(input.fullName || input.full_name);
      email = trim(input.email).toLowerCase();
      avatarUrl = trim(input.avatarUrl || input.avatar_url);
    }

    if (!email) {
      email = trim(session && session.user && session.user.email).toLowerCase();
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
      email: email,
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

  function normalizeDataImageUrlForStorage(value) {
    var raw = trim(value);
    if (!raw || raw.length > PROFILE_IMAGE_MAX_DATA_URL_CHARS) {
      return "";
    }

    var headerMatch = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if (!headerMatch || !headerMatch[1]) {
      return "";
    }

    if (!isSupportedProfileImageMime(headerMatch[1])) {
      return "";
    }

    return raw;
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

  async function removeOldProfileImages(storageBucket, userId, keepPath, filePrefix) {
    var existingPaths = await listStoredProfileImagePaths(storageBucket, userId);
    var normalizedPrefix = trim(filePrefix).toLowerCase();
    var stalePaths = existingPaths.filter(function (path) {
      if (path === keepPath) {
        return false;
      }

      if (!normalizedPrefix) {
        return true;
      }

      var name = String(path || "").split("/").pop().toLowerCase();
      return name.indexOf(normalizedPrefix) === 0;
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

  function readBlobAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (event) {
        resolve(String(event && event.target && event.target.result ? event.target.result : ""));
      };
      reader.onerror = function () {
        reject(new Error("Unable to process profile image."));
      };
      reader.readAsDataURL(blob);
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

  async function resendConfirmationEmail(email, redirectPath) {
    var client = await getClient();
    var result = await client.auth.resend({
      email: trim(email),
      type: "signup",
      options: {
        emailRedirectTo: getEmailRedirectUrl(redirectPath || "index.html"),
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
      if (isBucketNotFoundStorageError(upload.error)) {
        var dataUrlFallback = await readBlobAsDataUrl(optimizedBlob);
        var normalizedFallback = normalizeDataImageUrlForStorage(dataUrlFallback);

        if (!normalizedFallback) {
          throw new Error("Storage bucket missing and data fallback failed. Configure profile image bucket and retry.");
        }

        return normalizedFallback;
      }

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
      await removeOldProfileImages(storageBucket, session.user.id, objectPath, "avatar-");
    } catch (cleanupError) {
      // console.warn("Old profile image cleanup skipped:", cleanupError && cleanupError.message ? cleanupError.message : cleanupError);
    }

    return publicUrl + "?v=" + Date.now();
  }

  async function uploadVerificationDocumentImage(file) {
    if (!file) {
      throw new Error("No document image selected.");
    }

    var mimeType = String(file.type || "").toLowerCase();
    if (!isSupportedProfileImageMime(mimeType)) {
      throw new Error("Please select a JPG, PNG, or WEBP document image.");
    }

    if (Number(file.size || 0) > PROFILE_IMAGE_MAX_SOURCE_BYTES) {
      throw new Error("Document image is too large. Please choose a file under 20 MB.");
    }

    var optimizedBlob = await optimizeProfileImage(file);
    if (Number(optimizedBlob.size || 0) > PROFILE_IMAGE_MAX_BYTES) {
      throw new Error("Document image is too large after optimization. Please choose a smaller image.");
    }

    var client = await getClient();
    var session = await getSession();

    if (!session || !session.user) {
      throw new Error("You must be signed in to upload a verification document image.");
    }

    var extension = getProfileImageExtension(optimizedBlob.type || mimeType);
    var uniqueSuffix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    var filePrefix = "verification-document-";
    var objectPath = session.user.id + "/" + filePrefix + uniqueSuffix + "." + extension;
    var storageBucket = client.storage.from(PROFILE_IMAGE_BUCKET);

    var upload = await storageBucket
      .upload(objectPath, optimizedBlob, {
        upsert: false,
        contentType: optimizedBlob.type || "image/jpeg",
        cacheControl: "3600",
      });

    if (upload.error) {
      if (isBucketNotFoundStorageError(upload.error)) {
        var dataUrlFallback = await readBlobAsDataUrl(optimizedBlob);
        var normalizedFallback = normalizeDataImageUrlForStorage(dataUrlFallback);

        if (!normalizedFallback) {
          throw new Error("Storage bucket missing and document image fallback failed. Configure profile image bucket and retry.");
        }

        return normalizedFallback;
      }

      throw upload.error;
    }

    var publicUrlResponse = storageBucket.getPublicUrl(objectPath);
    var publicUrl = publicUrlResponse && publicUrlResponse.data
      ? String(publicUrlResponse.data.publicUrl || "")
      : "";

    if (!publicUrl) {
      throw new Error("Document image upload succeeded but URL generation failed.");
    }

    try {
      await removeOldProfileImages(storageBucket, session.user.id, objectPath, filePrefix);
    } catch (cleanupError) {
      // console.warn("Old verification document cleanup skipped:", cleanupError && cleanupError.message ? cleanupError.message : cleanupError);
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
      .select(PROFILE_COLUMNS_WITH_VERIFICATION_SELECT)
      .eq("id", session.user.id)
      .maybeSingle();

    if (response.error && (isMissingVerificationColumnError(response.error) || isMissingAvatarColumnError(response.error))) {
      response = await client
        .from("user_profiles")
        .select(PROFILE_COLUMNS_SELECT)
        .eq("id", session.user.id)
        .maybeSingle();
    }

    if (response.error && isMissingAvatarColumnError(response.error)) {
      response = await client
        .from("user_profiles")
        .select(PROFILE_COLUMNS_WITHOUT_AVATAR_SELECT)
        .eq("id", session.user.id)
        .maybeSingle();
    }

    if (response.error) {
      // console.warn("Profile read skipped:", response.error.message);
      return null;
    }

    if (!response.data) {
      return null;
    }

    return mapProfileRow(response.data);
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
      email: profile.email,
      avatar_url: profile.avatar_url,
      updated_at: new Date().toISOString(),
    };

    var response = await client
      .from("user_profiles")
      .upsert(payload, { onConflict: "id" })
      .select(PROFILE_COLUMNS_WITH_VERIFICATION_SELECT)
      .single();

    if (response.error && (isMissingVerificationColumnError(response.error) || isMissingAvatarColumnError(response.error))) {
      response = await client
        .from("user_profiles")
        .upsert(payload, { onConflict: "id" })
        .select(PROFILE_COLUMNS_SELECT)
        .single();
    }

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
        .select(PROFILE_COLUMNS_WITHOUT_AVATAR_SELECT)
        .single();
    }

    if (response.error) {
      // console.warn("Profile upsert skipped:", response.error.message);
      return {
        success: false,
        data: null,
        error: response.error,
      };
    }

    return {
      success: true,
      data: mapProfileRow(response.data),
      error: null,
    };
  }

  async function submitVerification(verificationInput) {
    var client = await getClient();
    var session = await getSession();

    if (!session || !session.user) {
      return {
        success: false,
        data: null,
        error: new Error("No active session for verification submission."),
      };
    }

    var normalizedVerification;
    try {
      normalizedVerification = normalizeVerificationSubmissionPayload(verificationInput);
    } catch (validationError) {
      return {
        success: false,
        data: null,
        error: validationError,
      };
    }

    var fullName = trim(
      verificationInput && typeof verificationInput === "object"
        ? (verificationInput.fullName || verificationInput.full_name)
        : ""
    );
    var email = trim(
      verificationInput && typeof verificationInput === "object"
        ? verificationInput.email
        : ""
    ).toLowerCase();

    if (!email) {
      email = trim(session.user.email).toLowerCase();
    }

    if (!fullName) {
      var metadata = (session.user && session.user.user_metadata) || {};
      fullName = trim(metadata.full_name || metadata.display_name);
    }

    if (!fullName) {
      fullName = getDisplayNameFromEmail(email || session.user.email);
    }

    var payload = {
      id: session.user.id,
      email: email,
      full_name: fullName || "User",
      phone_number: normalizedVerification.phone_number,
      gender: normalizedVerification.gender,
      date_of_birth: normalizedVerification.date_of_birth,
      address_line: normalizedVerification.address_line,
      city: normalizedVerification.city,
      country: normalizedVerification.country,
      postal_code: normalizedVerification.postal_code,
      document_type: normalizedVerification.document_type,
      document_number: normalizedVerification.document_number,
      document_image_url: normalizedVerification.document_image_url,
      document_expiry_date: normalizedVerification.document_expiry_date,
      verification_status: normalizedVerification.verification_status,
      verification_submitted_at: normalizedVerification.verification_submitted_at,
      verification_reviewed_at: normalizedVerification.verification_reviewed_at,
      verification_reviewed_by: normalizedVerification.verification_reviewed_by,
      verification_note: normalizedVerification.verification_note,
      updated_at: new Date().toISOString(),
    };

    var response = await client
      .from("user_profiles")
      .upsert(payload, { onConflict: "id" })
      .select(PROFILE_COLUMNS_WITH_VERIFICATION_SELECT)
      .single();

    if (response.error && isMissingAvatarColumnError(response.error)) {
      response = await client
        .from("user_profiles")
        .select(PROFILE_COLUMNS_WITHOUT_AVATAR_SELECT + "," + VERIFICATION_COLUMNS_SELECT)
        .eq("id", session.user.id)
        .maybeSingle();
    }

    if (response.error && isMissingVerificationColumnError(response.error)) {
      return {
        success: false,
        data: null,
        error: new Error("User verification workflow schema is missing. Run database/migrations/012_user_profile_verification_workflow.sql."),
      };
    }

    if (response.error) {
      return {
        success: false,
        data: null,
        error: response.error,
      };
    }

    return {
      success: true,
      data: mapProfileRow(response.data),
      error: null,
    };
  }

  window.VehicleAuthService = {
    getClient: getClient,
    getSession: getSession,
    getProfile: getProfile,
    uploadProfileImage: uploadProfileImage,
    uploadVerificationDocumentImage: uploadVerificationDocumentImage,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    signInWithGoogle: signInWithGoogle,
    sendPasswordReset: sendPasswordReset,
    resendConfirmationEmail: resendConfirmationEmail,
    upsertProfile: upsertProfile,
    submitVerification: submitVerification,
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
