(function () {
  "use strict";

  var STORAGE_SESSION = "vrs_auth_session";
  var STORAGE_PROFILE = "vrs_profile";
  var STORAGE_PROFILE_PREFIX = "vrs_profile::";
  var ALLOWED_GENDERS = ["male", "female", "other", "prefer_not_to_say"];
  var ALLOWED_DOCUMENT_TYPES = ["driving_license", "national_id", "passport", "other"];
  var FIELD_ORDER = [
    "fullName",
    "email",
    "phoneNumber",
    "gender",
    "dateOfBirth",
    "addressLine",
    "city",
    "country",
    "postalCode",
    "documentType",
    "documentNumber",
    "documentExpiryDate",
  ];

  var form = document.getElementById("profileVerificationForm");
  var banner = document.getElementById("verificationBanner");
  var submitBtn = document.getElementById("submitVerificationBtn");
  var successPanel = document.getElementById("verifySuccessPanel");
  var statusBadge = document.getElementById("verificationStatusBadge");
  var statusSubtext = document.getElementById("verificationStatusSubtext");

  if (!form || !banner || !submitBtn || !statusBadge || !statusSubtext) {
    return;
  }

  var auth = window.VehicleAuthService || null;
  var activeSessionData = null;
  var isSubmitting = false;

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function trim(value) {
    return String(value || "").trim();
  }

  function normalizeSession(session) {
    if (!session || typeof session !== "object") {
      return null;
    }

    var userId = trim(session.userId);
    var email = trim(session.email).toLowerCase();
    var accessToken = trim(session.accessToken);

    if (!userId && (!email || !accessToken)) {
      return null;
    }

    return {
      userId: userId,
      email: email,
      accessToken: accessToken,
    };
  }

  function getStoredSession() {
    var raw = sessionStorage.getItem(STORAGE_SESSION) || localStorage.getItem(STORAGE_SESSION);
    return normalizeSession(safeParse(raw, null));
  }

  function getOwnerKey(sessionLike, sessionData) {
    var userId = trim(
      (sessionLike && sessionLike.userId) ||
      (sessionData && sessionData.user && sessionData.user.id)
    );

    if (userId) {
      return "uid:" + userId;
    }

    var email = trim(
      (sessionLike && sessionLike.email) ||
      (sessionData && sessionData.user && sessionData.user.email)
    ).toLowerCase();

    if (email) {
      return "email:" + email;
    }

    return "";
  }

  function readStoredProfile(sessionLike, sessionData) {
    var ownerKey = getOwnerKey(sessionLike, sessionData);
    if (ownerKey) {
      var scopedRaw = localStorage.getItem(STORAGE_PROFILE_PREFIX + ownerKey);
      var scopedProfile = safeParse(scopedRaw, null);
      if (scopedProfile && typeof scopedProfile === "object") {
        return scopedProfile;
      }
    }

    var legacy = safeParse(localStorage.getItem(STORAGE_PROFILE), null);
    return legacy && typeof legacy === "object" ? legacy : null;
  }

  function persistProfileCache(profile, sessionLike, sessionData) {
    var ownerKey = getOwnerKey(sessionLike, sessionData);
    var payload = {
      username: trim(profile && profile.full_name),
      email: trim(profile && profile.email),
      phoneNumber: trim(profile && profile.phone_number),
      gender: trim(profile && profile.gender),
      dateOfBirth: trim(profile && profile.date_of_birth),
      addressLine: trim(profile && profile.address_line),
      city: trim(profile && profile.city),
      country: trim(profile && profile.country) || "Nepal",
      postalCode: trim(profile && profile.postal_code),
      documentType: trim(profile && profile.document_type),
      documentNumber: trim(profile && profile.document_number),
      documentExpiryDate: trim(profile && profile.document_expiry_date),
      verificationStatus: trim(profile && profile.verification_status) || "pending",
      verificationSubmittedAt: trim(profile && profile.verification_submitted_at),
      verificationReviewedAt: trim(profile && profile.verification_reviewed_at),
      verificationNote: trim(profile && profile.verification_note),
    };

    if (ownerKey) {
      localStorage.setItem(STORAGE_PROFILE_PREFIX + ownerKey, JSON.stringify(payload));
      localStorage.removeItem(STORAGE_PROFILE);
      return;
    }

    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(payload));
  }

  function getField(name) {
    return form.elements.namedItem(name);
  }

  function setBanner(mode, text) {
    banner.classList.remove("hidden");
    banner.textContent = String(text || "");

    banner.style.borderWidth = "1px";
    banner.style.borderStyle = "solid";

    if (mode === "success") {
      banner.style.borderColor = "rgba(74,159,108,0.42)";
      banner.style.backgroundColor = "rgba(74,159,108,0.14)";
      banner.style.color = "#1f6a43";
      return;
    }

    if (mode === "error") {
      banner.style.borderColor = "rgba(190,59,59,0.36)";
      banner.style.backgroundColor = "rgba(190,59,59,0.1)";
      banner.style.color = "#9f2d2d";
      return;
    }

    banner.style.borderColor = "rgba(44,118,110,0.28)";
    banner.style.backgroundColor = "rgba(44,118,110,0.1)";
    banner.style.color = "#1f5551";
  }

  function setSubmitState(loading, label) {
    submitBtn.disabled = Boolean(loading);
    submitBtn.classList.toggle("opacity-75", Boolean(loading));
    submitBtn.classList.toggle("cursor-not-allowed", Boolean(loading));
    submitBtn.textContent = loading ? String(label || "Submitting...") : "Submit Verification";
  }

  function setStatusBadge(status, submittedAt) {
    var normalized = trim(status).toLowerCase();
    var hasSubmission = Boolean(trim(submittedAt));

    statusBadge.className = "mt-1 inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold";

    if (normalized === "approved") {
      statusBadge.classList.add("bg-emerald-100", "text-emerald-700");
      statusBadge.textContent = "Approved";
      statusSubtext.textContent = "Your profile has already been verified.";
      return;
    }

    if (normalized === "rejected") {
      statusBadge.classList.add("bg-rose-100", "text-rose-700");
      statusBadge.textContent = "Rejected";
      statusSubtext.textContent = "Please correct details and submit again.";
      return;
    }

    statusBadge.classList.add("bg-amber-100", "text-amber-700");
    statusBadge.textContent = hasSubmission ? "Pending Review" : "Pending";
    statusSubtext.textContent = hasSubmission
      ? "Submission received and currently under admin review."
      : "No completed submission yet.";
  }

  function clearFieldError(fieldName) {
    var field = getField(fieldName);
    var errorNode = form.querySelector('[data-error-for="' + fieldName + '"]');

    if (field) {
      field.style.removeProperty("border-color");
      field.style.removeProperty("background-color");
      field.style.removeProperty("box-shadow");
    }

    if (errorNode) {
      errorNode.textContent = "";
      errorNode.classList.add("hidden");
    }
  }

  function setFieldError(fieldName, message) {
    var field = getField(fieldName);
    var errorNode = form.querySelector('[data-error-for="' + fieldName + '"]');

    if (field) {
      field.style.borderColor = "rgba(244,63,94,0.8)";
      field.style.backgroundColor = "rgba(255,241,242,0.7)";
      field.style.boxShadow = "0 0 0 3px rgba(244,63,94,0.14)";
    }

    if (errorNode) {
      errorNode.textContent = String(message || "Invalid value.");
      errorNode.classList.remove("hidden");
    }
  }

  function clearAllFieldErrors() {
    FIELD_ORDER.forEach(clearFieldError);
  }

  function parseIsoDate(value) {
    var text = trim(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return null;
    }

    var parsed = new Date(text + "T00:00:00");
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(email));
  }

  function yearsBetween(dateObj) {
    var today = new Date();
    var years = today.getFullYear() - dateObj.getFullYear();
    var monthDiff = today.getMonth() - dateObj.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateObj.getDate())) {
      years -= 1;
    }

    return years;
  }

  function getDateOnlyToday() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function normalizePayload(raw) {
    var payload = raw || {};

    return {
      fullName: trim(payload.fullName),
      email: trim(payload.email).toLowerCase(),
      phoneNumber: trim(payload.phoneNumber).replace(/\s+/g, " "),
      gender: trim(payload.gender).toLowerCase(),
      dateOfBirth: trim(payload.dateOfBirth),
      addressLine: trim(payload.addressLine),
      city: trim(payload.city),
      country: trim(payload.country),
      postalCode: trim(payload.postalCode),
      documentType: trim(payload.documentType).toLowerCase(),
      documentNumber: trim(payload.documentNumber).toUpperCase(),
      documentExpiryDate: trim(payload.documentExpiryDate),
    };
  }

  function validateField(fieldName, payload) {
    if (fieldName === "fullName") {
      if (!payload.fullName) return "Full name is required.";
      if (!/^[A-Za-z][A-Za-z\s.'-]{1,79}$/.test(payload.fullName)) {
        return "Use 2-80 letters and valid name characters only.";
      }
      return "";
    }

    if (fieldName === "email") {
      if (!payload.email) return "Email is required.";
      if (!isEmail(payload.email)) return "Enter a valid email address.";
      return "";
    }

    if (fieldName === "phoneNumber") {
      var digits = payload.phoneNumber.replace(/[^\d]/g, "");
      if (!payload.phoneNumber) return "Phone number is required.";
      if (!/^\+?[0-9][0-9\s-]{6,17}$/.test(payload.phoneNumber)) {
        return "Use only digits, spaces, and optional leading +.";
      }
      if (digits.length < 7 || digits.length > 15) {
        return "Phone number must include 7 to 15 digits.";
      }
      return "";
    }

    if (fieldName === "gender") {
      if (!payload.gender) return "Gender is required.";
      if (ALLOWED_GENDERS.indexOf(payload.gender) < 0) return "Select a valid gender option.";
      return "";
    }

    if (fieldName === "dateOfBirth") {
      var dob = parseIsoDate(payload.dateOfBirth);
      if (!payload.dateOfBirth) return "Date of birth is required.";
      if (!dob) return "Enter date of birth in YYYY-MM-DD format.";
      if (dob > getDateOnlyToday()) return "Date of birth cannot be in the future.";

      var age = yearsBetween(dob);
      if (age < 18) return "You must be at least 18 years old to verify profile.";
      if (age > 100) return "Please enter a realistic date of birth.";
      return "";
    }

    if (fieldName === "addressLine") {
      if (!payload.addressLine) return "Address line is required.";
      if (payload.addressLine.length < 8 || payload.addressLine.length > 160) {
        return "Address must be 8 to 160 characters.";
      }
      if (!/[A-Za-z0-9]/.test(payload.addressLine)) {
        return "Address should include letters or numbers.";
      }
      return "";
    }

    if (fieldName === "city") {
      if (!payload.city) return "City is required.";
      if (!/^[A-Za-z][A-Za-z\s.'-]{1,79}$/.test(payload.city)) {
        return "City must be 2-80 letters with valid separators.";
      }
      return "";
    }

    if (fieldName === "country") {
      if (!payload.country) return "Country is required.";
      if (!/^[A-Za-z][A-Za-z\s.'-]{1,79}$/.test(payload.country)) {
        return "Country must be 2-80 letters with valid separators.";
      }
      return "";
    }

    if (fieldName === "postalCode") {
      if (!payload.postalCode) return "Postal code is required.";
      if (!/^[A-Za-z0-9][A-Za-z0-9\-\s]{2,11}$/.test(payload.postalCode)) {
        return "Postal code must be 3-12 letters, digits, spaces, or -.";
      }
      return "";
    }

    if (fieldName === "documentType") {
      if (!payload.documentType) return "Document type is required.";
      if (ALLOWED_DOCUMENT_TYPES.indexOf(payload.documentType) < 0) {
        return "Select a valid document type.";
      }
      return "";
    }

    if (fieldName === "documentNumber") {
      if (!payload.documentNumber) return "Document number is required.";

      if (payload.documentType === "passport") {
        if (!/^[A-Z0-9]{6,12}$/.test(payload.documentNumber)) {
          return "Passport number must be 6-12 uppercase letters or digits.";
        }
        return "";
      }

      if (payload.documentType === "national_id") {
        if (!/^[A-Z0-9-]{6,20}$/.test(payload.documentNumber)) {
          return "National ID must be 6-20 uppercase letters, digits, or -.";
        }
        return "";
      }

      if (payload.documentType === "driving_license") {
        if (!/^[A-Z0-9\-/]{5,24}$/.test(payload.documentNumber)) {
          return "Driving license must be 5-24 uppercase letters, digits, -, or /.";
        }
        return "";
      }

      if (!/^[A-Z0-9\-/]{4,32}$/.test(payload.documentNumber)) {
        return "Document number must be 4-32 uppercase letters, digits, -, or /.";
      }

      return "";
    }

    if (fieldName === "documentExpiryDate") {
      var expiry = parseIsoDate(payload.documentExpiryDate);
      if (!payload.documentExpiryDate) return "Document expiry date is required.";
      if (!expiry) return "Enter expiry date in YYYY-MM-DD format.";
      if (expiry < getDateOnlyToday()) return "Document expiry date cannot be in the past.";
      return "";
    }

    return "";
  }

  function validatePayload(payload) {
    var firstInvalidField = "";

    FIELD_ORDER.forEach(function (fieldName) {
      clearFieldError(fieldName);
      var message = validateField(fieldName, payload);
      if (!message) {
        return;
      }

      setFieldError(fieldName, message);
      if (!firstInvalidField) {
        firstInvalidField = fieldName;
      }
    });

    return firstInvalidField;
  }

  function readPayloadFromForm() {
    return normalizePayload({
      fullName: getField("fullName") ? getField("fullName").value : "",
      email: getField("email") ? getField("email").value : "",
      phoneNumber: getField("phoneNumber") ? getField("phoneNumber").value : "",
      gender: getField("gender") ? getField("gender").value : "",
      dateOfBirth: getField("dateOfBirth") ? getField("dateOfBirth").value : "",
      addressLine: getField("addressLine") ? getField("addressLine").value : "",
      city: getField("city") ? getField("city").value : "",
      country: getField("country") ? getField("country").value : "",
      postalCode: getField("postalCode") ? getField("postalCode").value : "",
      documentType: getField("documentType") ? getField("documentType").value : "",
      documentNumber: getField("documentNumber") ? getField("documentNumber").value : "",
      documentExpiryDate: getField("documentExpiryDate") ? getField("documentExpiryDate").value : "",
    });
  }

  function getDisplayNameFromEmail(email) {
    var left = trim(email).split("@")[0] || "User";
    return left.replace(/[._-]+/g, " ").replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  }

  function mapLocalProfile(localProfile) {
    var source = localProfile || {};

    return {
      full_name: trim(source.full_name || source.username),
      email: trim(source.email),
      phone_number: trim(source.phone_number || source.phoneNumber),
      gender: trim(source.gender).toLowerCase(),
      date_of_birth: trim(source.date_of_birth || source.dateOfBirth),
      address_line: trim(source.address_line || source.addressLine),
      city: trim(source.city),
      country: trim(source.country) || "Nepal",
      postal_code: trim(source.postal_code || source.postalCode),
      document_type: trim(source.document_type || source.documentType).toLowerCase(),
      document_number: trim(source.document_number || source.documentNumber),
      document_expiry_date: trim(source.document_expiry_date || source.documentExpiryDate),
      verification_status: trim(source.verification_status || source.verificationStatus).toLowerCase() || "pending",
      verification_submitted_at: trim(source.verification_submitted_at || source.verificationSubmittedAt),
      verification_note: trim(source.verification_note || source.verificationNote),
    };
  }

  function mergeProfile(remoteProfile, localProfile, sessionData) {
    var sessionUser = sessionData && sessionData.user ? sessionData.user : {};
    var metadata = sessionUser.user_metadata || {};
    var remote = remoteProfile || {};
    var local = mapLocalProfile(localProfile);

    var fullName = trim(remote.full_name || local.full_name || metadata.full_name || metadata.display_name);
    var email = trim(remote.email || local.email || sessionUser.email).toLowerCase();

    return {
      full_name: fullName || getDisplayNameFromEmail(email),
      email: email,
      phone_number: trim(remote.phone_number || local.phone_number),
      gender: trim(remote.gender || local.gender).toLowerCase(),
      date_of_birth: trim(remote.date_of_birth || local.date_of_birth),
      address_line: trim(remote.address_line || local.address_line),
      city: trim(remote.city || local.city),
      country: trim(remote.country || local.country) || "Nepal",
      postal_code: trim(remote.postal_code || local.postal_code),
      document_type: trim(remote.document_type || local.document_type).toLowerCase(),
      document_number: trim(remote.document_number || local.document_number),
      document_expiry_date: trim(remote.document_expiry_date || local.document_expiry_date),
      verification_status: trim(remote.verification_status || local.verification_status).toLowerCase() || "pending",
      verification_submitted_at: trim(remote.verification_submitted_at || local.verification_submitted_at),
      verification_note: trim(remote.verification_note || local.verification_note),
    };
  }

  function fillForm(profile) {
    var source = profile || {};

    if (getField("fullName")) getField("fullName").value = trim(source.full_name);
    if (getField("email")) getField("email").value = trim(source.email);
    if (getField("phoneNumber")) getField("phoneNumber").value = trim(source.phone_number);
    if (getField("gender")) getField("gender").value = trim(source.gender).toLowerCase();
    if (getField("dateOfBirth")) getField("dateOfBirth").value = trim(source.date_of_birth);
    if (getField("addressLine")) getField("addressLine").value = trim(source.address_line);
    if (getField("city")) getField("city").value = trim(source.city);
    if (getField("country")) getField("country").value = trim(source.country) || "Nepal";
    if (getField("postalCode")) getField("postalCode").value = trim(source.postal_code);
    if (getField("documentType")) getField("documentType").value = trim(source.document_type).toLowerCase();
    if (getField("documentNumber")) getField("documentNumber").value = trim(source.document_number).toUpperCase();
    if (getField("documentExpiryDate")) getField("documentExpiryDate").value = trim(source.document_expiry_date);
  }

  function bindLiveValidation() {
    FIELD_ORDER.forEach(function (fieldName) {
      var field = getField(fieldName);
      if (!field) {
        return;
      }

      var eventName = field.tagName === "SELECT" ? "change" : "input";

      field.addEventListener(eventName, function () {
        if (fieldName === "documentNumber") {
          field.value = trim(field.value).toUpperCase();
        }

        var payload = readPayloadFromForm();
        var error = validateField(fieldName, payload);

        if (error) {
          setFieldError(fieldName, error);
          return;
        }

        clearFieldError(fieldName);
      });

      field.addEventListener("blur", function () {
        var payload = readPayloadFromForm();
        var error = validateField(fieldName, payload);

        if (error) {
          setFieldError(fieldName, error);
          return;
        }

        clearFieldError(fieldName);
      });
    });
  }

  async function initializePage() {
    if (!auth || typeof auth.getSession !== "function" || typeof auth.getProfile !== "function") {
      setBanner("error", "Authentication runtime is unavailable. Please refresh and try again.");
      return;
    }

    setSubmitState(true, "Loading profile...");

    try {
      var storedSession = getStoredSession();
      var sessionData = await auth.getSession();
      activeSessionData = sessionData;

      if (!sessionData || !sessionData.user) {
        try {
          sessionData = await auth.getSession();
          activeSessionData = sessionData;
        } catch (_secondReadError) {
          sessionData = null;
        }
      }

      if (!sessionData || !sessionData.user) {
        var fallbackProfile = readStoredProfile(storedSession, null);
        if (fallbackProfile) {
          var fallbackMerged = mergeProfile(null, fallbackProfile, null);
          fillForm(fallbackMerged);
          setStatusBadge(fallbackMerged.verification_status, fallbackMerged.verification_submitted_at);
          setBanner("error", "Session could not be confirmed. Please sign in again before submitting verification.");
          return;
        }

        setBanner("error", "No active session found. Please sign in and reopen verification.");
        return;
      }

      var localProfile = readStoredProfile(storedSession, sessionData);
      var remoteProfile = null;

      try {
        remoteProfile = await auth.getProfile();
      } catch (_readError) {
        remoteProfile = null;
      }

      var merged = mergeProfile(remoteProfile, localProfile, sessionData);
      fillForm(merged);
      setStatusBadge(merged.verification_status, merged.verification_submitted_at);

      setBanner("info", "Fill every required field carefully. Submission is blocked until all strict checks pass.");
    } catch (error) {
      var readable = auth && typeof auth.toPublicError === "function"
        ? auth.toPublicError(error, "Unable to load verification details right now.")
        : "Unable to load verification details right now.";
      setBanner("error", readable);
    } finally {
      setSubmitState(false, "Submit Verification");
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!auth || typeof auth.submitVerification !== "function") {
      setBanner("error", "Verification service is unavailable. Please refresh and try again.");
      return;
    }

    try {
      var liveSession = await auth.getSession();
      if (!liveSession || !liveSession.user) {
        setBanner("error", "Your session expired. Please sign in again before submitting verification.");
        return;
      }
      activeSessionData = liveSession;
    } catch (_sessionError) {
      setBanner("error", "Could not verify current session. Please sign in again.");
      return;
    }

    clearAllFieldErrors();

    var payload = readPayloadFromForm();
    var firstInvalid = validatePayload(payload);

    if (firstInvalid) {
      setBanner("error", "Please correct highlighted fields before submitting verification.");
      var firstInvalidField = getField(firstInvalid);
      if (firstInvalidField && typeof firstInvalidField.focus === "function") {
        firstInvalidField.focus();
      }
      return;
    }

    isSubmitting = true;
    setSubmitState(true, "Submitting verification...");
    setBanner("info", "Submitting verification details securely...");

    try {
      var result = await auth.submitVerification(payload);
      if (!result || !result.success || !result.data) {
        throw (result && result.error) || new Error("Unable to submit verification details right now.");
      }

      fillForm(result.data);
      setStatusBadge(result.data.verification_status, result.data.verification_submitted_at);

      var storedSession = getStoredSession();
      persistProfileCache(result.data, storedSession, activeSessionData);

      setBanner("success", "Verification submitted successfully. Your status is now pending review.");

      if (successPanel) {
        successPanel.classList.remove("hidden");
        successPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (error) {
      var humanMessage = auth && typeof auth.toPublicError === "function"
        ? auth.toPublicError(error, "Unable to submit verification details right now.")
        : String(error && error.message ? error.message : "Unable to submit verification details right now.");

      setBanner("error", humanMessage);
    } finally {
      isSubmitting = false;
      setSubmitState(false, "Submit Verification");
    }
  });

  bindLiveValidation();
  initializePage();
})();
