(function () {
  "use strict";

  var STORAGE_SESSION = "vrs_auth_session";
  var STORAGE_PROFILE = "vrs_profile";
  var STORAGE_PROFILE_PREFIX = "vrs_profile::";
  var ALLOWED_GENDERS = ["male", "female", "other", "prefer_not_to_say"];
  var ALLOWED_DOCUMENT_TYPES = ["driving_license", "national_id", "passport", "other"];
  var ALLOWED_PROFILE_IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  var MAX_PROFILE_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
  var ALLOWED_DOCUMENT_IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  var MAX_DOCUMENT_IMAGE_SOURCE_BYTES = 20 * 1024 * 1024;
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
    "documentImage",
  ];

  var form = document.getElementById("profileVerificationForm");
  var banner = document.getElementById("verificationBanner");
  var submitBtn = document.getElementById("submitVerificationBtn");
  var successPanel = document.getElementById("verifySuccessPanel");
  var statusBadge = document.getElementById("verificationStatusBadge");
  var statusSubtext = document.getElementById("verificationStatusSubtext");
  var profileAvatarFrame = document.getElementById("verifyProfileAvatarFrame");
  var profileAvatarImage = document.getElementById("verifyProfileAvatarImage");
  var profileAvatarInitial = document.getElementById("verifyProfileAvatarInitial");
  var profileNameDisplay = document.getElementById("verifyProfileNameDisplay");
  var profileEmailDisplay = document.getElementById("verifyProfileEmailDisplay");
  var profileImageInput = document.getElementById("verifyProfileImage");
  var profileImageEditBtn = document.getElementById("verifyProfileImageEditBtn");
  var profileImageOptions = document.getElementById("verifyProfileImageOptions");
  var profileImageReplaceBtn = document.getElementById("verifyProfileImageReplaceBtn");
  var profileImageRemoveBtn = document.getElementById("verifyProfileImageRemoveBtn");
  var documentImageInput = document.getElementById("verifyDocumentImage");
  var documentPreviewImage = document.getElementById("verifyDocumentPreview");
  var documentPreviewEmpty = document.getElementById("verifyDocumentPreviewEmpty");
  var documentPreviewShell = document.getElementById("verifyDocumentPreviewShell");
  var documentFileName = document.getElementById("verifyDocumentFileName");
  var documentOpenLink = document.getElementById("verifyDocumentOpenLink");
  var documentClearBtn = document.getElementById("verifyDocumentClearBtn");
  var documentReplaceBtn = document.getElementById("verifyDocumentReplaceBtn");

  if (!form || !banner || !submitBtn || !statusBadge || !statusSubtext) {
    return;
  }

  var auth = window.VehicleAuthService || null;
  var activeSessionData = null;
  var currentProfileRecord = null;
  var isSubmitting = false;
  var profileImageBusy = false;
  var profileImageOptionsOpen = false;
  var selectedProfileImageFile = null;
  var persistedProfileImageUrl = "";
  var temporaryProfilePreviewUrl = "";
  var selectedDocumentImageFile = null;
  var persistedDocumentImageUrl = "";
  var temporaryDocumentPreviewUrl = "";

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

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source || {}, key);
  }

  function isAllowedProfileImageMime(mimeType) {
    return ALLOWED_PROFILE_IMAGE_MIME_TYPES.indexOf(String(mimeType || "").toLowerCase()) >= 0;
  }

  function isAllowedDocumentImageMime(mimeType) {
    return ALLOWED_DOCUMENT_IMAGE_MIME_TYPES.indexOf(String(mimeType || "").toLowerCase()) >= 0;
  }

  function normalizeDocumentImageUrl(value) {
    var raw = trim(value);
    if (!raw) {
      return "";
    }

    var lowered = raw.toLowerCase();
    if (lowered === "null" || lowered === "undefined" || lowered === "[object object]") {
      return "";
    }

    if (
      raw.indexOf("data:image/") === 0 ||
      raw.indexOf("blob:") === 0 ||
      raw.indexOf("https://") === 0 ||
      raw.indexOf("http://") === 0 ||
      raw.charAt(0) === "/"
    ) {
      return raw;
    }

    return "";
  }

  function normalizeProfileImageUrl(value) {
    return normalizeDocumentImageUrl(value);
  }

  function clearTemporaryProfilePreviewUrl() {
    if (!temporaryProfilePreviewUrl) {
      return;
    }

    try {
      URL.revokeObjectURL(temporaryProfilePreviewUrl);
    } catch (_error) {
      // No-op when browser has already released the object URL.
    }

    temporaryProfilePreviewUrl = "";
  }

  function deriveProfileIdentityName(name, email) {
    var trimmedName = trim(name);
    if (trimmedName) {
      return trimmedName;
    }

    return getDisplayNameFromEmail(email);
  }

  function deriveProfileInitials(name, email) {
    var label = deriveProfileIdentityName(name, email);
    var parts = label.split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return "U";
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function setProfileImageOptionsOpen(open) {
    profileImageOptionsOpen = Boolean(open);

    if (profileImageOptions) {
      profileImageOptions.classList.toggle("hidden", !profileImageOptionsOpen);
      profileImageOptions.classList.toggle("flex", profileImageOptionsOpen);
    }

    if (profileImageEditBtn) {
      profileImageEditBtn.setAttribute("aria-expanded", profileImageOptionsOpen ? "true" : "false");
    }
  }

  function setProfileImageBusyState(isBusy) {
    profileImageBusy = Boolean(isBusy);

    if (profileImageEditBtn) {
      profileImageEditBtn.disabled = profileImageBusy;
      profileImageEditBtn.classList.toggle("opacity-70", profileImageBusy);
      profileImageEditBtn.classList.toggle("cursor-not-allowed", profileImageBusy);
    }

    if (profileImageReplaceBtn) {
      profileImageReplaceBtn.disabled = profileImageBusy;
      profileImageReplaceBtn.classList.toggle("opacity-70", profileImageBusy);
      profileImageReplaceBtn.classList.toggle("cursor-not-allowed", profileImageBusy);
    }

    if (profileImageRemoveBtn) {
      var canRemove = Boolean(persistedProfileImageUrl || selectedProfileImageFile);
      profileImageRemoveBtn.disabled = profileImageBusy || !canRemove;
      profileImageRemoveBtn.classList.toggle("opacity-70", profileImageRemoveBtn.disabled);
      profileImageRemoveBtn.classList.toggle("cursor-not-allowed", profileImageRemoveBtn.disabled);
    }
  }

  function renderProfileIdentity(previewImageUrl, fromSelection) {
    var fullName = trim(getField("fullName") && getField("fullName").value) || trim(currentProfileRecord && currentProfileRecord.full_name);
    var email = trim(getField("email") && getField("email").value) || trim(currentProfileRecord && currentProfileRecord.email);
    var displayName = deriveProfileIdentityName(fullName, email);
    var normalizedImage = normalizeProfileImageUrl(previewImageUrl);

    if (!fromSelection) {
      clearTemporaryProfilePreviewUrl();
    }

    if (profileNameDisplay) {
      profileNameDisplay.textContent = displayName || "User Profile";
    }

    if (profileEmailDisplay) {
      profileEmailDisplay.textContent = email || "Signed-in account";
    }

    if (profileAvatarImage) {
      if (normalizedImage) {
        profileAvatarImage.src = normalizedImage;
        profileAvatarImage.classList.remove("hidden");
      } else {
        profileAvatarImage.removeAttribute("src");
        profileAvatarImage.classList.add("hidden");
      }
    }

    if (profileAvatarInitial) {
      profileAvatarInitial.textContent = deriveProfileInitials(displayName, email);
      profileAvatarInitial.classList.toggle("hidden", Boolean(normalizedImage));
    }

    setProfileImageBusyState(profileImageBusy);
  }

  function setPersistedProfileImage(url) {
    persistedProfileImageUrl = normalizeProfileImageUrl(url);
    renderProfileIdentity(persistedProfileImageUrl, false);
  }

  function clearProfileImageSelection() {
    selectedProfileImageFile = null;

    if (profileImageInput) {
      profileImageInput.value = "";
    }

    clearTemporaryProfilePreviewUrl();
    renderProfileIdentity(persistedProfileImageUrl, false);
  }

  function openProfileImagePicker() {
    if (profileImageBusy || !profileImageInput) {
      return;
    }

    profileImageInput.click();
  }

  function isRenderableDocumentImageUrl(value) {
    return Boolean(normalizeDocumentImageUrl(value));
  }

  function clearTemporaryDocumentPreviewUrl() {
    if (!temporaryDocumentPreviewUrl) {
      return;
    }

    try {
      URL.revokeObjectURL(temporaryDocumentPreviewUrl);
    } catch (_error) {
      // No-op when browser has already released the object URL.
    }

    temporaryDocumentPreviewUrl = "";
  }

  function getFileNameFromImageUrl(url) {
    var normalized = normalizeDocumentImageUrl(url);
    if (!normalized) {
      return "No image selected";
    }

    if (normalized.indexOf("data:image/") === 0) {
      return "Uploaded image";
    }

    var withoutQuery = normalized.split("?")[0];
    var parts = withoutQuery.split("/");
    return trim(parts[parts.length - 1]) || "Uploaded image";
  }

  function renderDocumentPreview(imageUrl, labelText, fromSelection) {
    var normalized = normalizeDocumentImageUrl(imageUrl);

    if (!fromSelection) {
      clearTemporaryDocumentPreviewUrl();
    }

    if (documentPreviewImage) {
      if (normalized) {
        documentPreviewImage.src = normalized;
        documentPreviewImage.classList.remove("hidden");
      } else {
        documentPreviewImage.removeAttribute("src");
        documentPreviewImage.classList.add("hidden");
      }
    }

    if (documentPreviewEmpty) {
      documentPreviewEmpty.classList.toggle("hidden", Boolean(normalized));
    }

    if (documentOpenLink) {
      if (normalized) {
        documentOpenLink.href = normalized;
        documentOpenLink.classList.remove("hidden");
        documentOpenLink.classList.add("inline-flex");
      } else {
        documentOpenLink.removeAttribute("href");
        documentOpenLink.classList.add("hidden");
        documentOpenLink.classList.remove("inline-flex");
      }
    }

    if (documentFileName) {
      documentFileName.textContent = trim(labelText) || getFileNameFromImageUrl(normalized);
    }

    if (documentReplaceBtn) {
      documentReplaceBtn.disabled = false;
      documentReplaceBtn.classList.remove("opacity-60", "cursor-not-allowed");
    }

    if (documentClearBtn) {
      documentClearBtn.disabled = !normalized && !selectedDocumentImageFile;
      documentClearBtn.classList.toggle("opacity-60", documentClearBtn.disabled);
      documentClearBtn.classList.toggle("cursor-not-allowed", documentClearBtn.disabled);
    }
  }

  function setPersistedDocumentImage(url) {
    persistedDocumentImageUrl = normalizeDocumentImageUrl(url);
    renderDocumentPreview(persistedDocumentImageUrl, "", false);
  }

  function clearDocumentImageState() {
    selectedDocumentImageFile = null;
    persistedDocumentImageUrl = "";

    if (documentImageInput) {
      documentImageInput.value = "";
    }

    renderDocumentPreview("", "No image selected", false);
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
      avatarUrl: normalizeProfileImageUrl(
        (profile && profile.avatar_url) || (profile && profile.avatarUrl)
      ),
      phoneNumber: trim(profile && profile.phone_number),
      gender: trim(profile && profile.gender),
      dateOfBirth: trim(profile && profile.date_of_birth),
      addressLine: trim(profile && profile.address_line),
      city: trim(profile && profile.city),
      country: trim(profile && profile.country) || "Nepal",
      postalCode: trim(profile && profile.postal_code),
      documentType: trim(profile && profile.document_type),
      documentNumber: trim(profile && profile.document_number),
      documentImageUrl: normalizeDocumentImageUrl(profile && profile.document_image_url),
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

  function getErrorNode(fieldName) {
    return form.querySelector('[data-error-for="' + fieldName + '"]') ||
      document.querySelector('[data-error-for="' + fieldName + '"]');
  }

  function setBanner(mode, text) {
    var isDarkTheme = document.documentElement.getAttribute("data-theme") === "dark";

    banner.classList.remove("hidden");
    banner.textContent = String(text || "");

    banner.style.borderWidth = "1px";
    banner.style.borderStyle = "solid";

    if (mode === "success") {
      banner.style.borderColor = isDarkTheme ? "rgba(115,193,152,0.52)" : "rgba(74,159,108,0.42)";
      banner.style.backgroundColor = isDarkTheme ? "rgba(35,80,61,0.5)" : "rgba(74,159,108,0.14)";
      banner.style.color = isDarkTheme ? "#dcf7e8" : "#1f6a43";
      return;
    }

    if (mode === "error") {
      banner.style.borderColor = isDarkTheme ? "rgba(224,112,112,0.52)" : "rgba(190,59,59,0.36)";
      banner.style.backgroundColor = isDarkTheme ? "rgba(90,35,35,0.48)" : "rgba(190,59,59,0.1)";
      banner.style.color = isDarkTheme ? "#ffe1e1" : "#9f2d2d";
      return;
    }

    banner.style.borderColor = isDarkTheme ? "rgba(111,170,175,0.46)" : "rgba(44,118,110,0.28)";
    banner.style.backgroundColor = isDarkTheme ? "rgba(26,52,60,0.55)" : "rgba(44,118,110,0.1)";
    banner.style.color = isDarkTheme ? "#dcedf1" : "#1f5551";
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
    var errorNode = getErrorNode(fieldName);

    if (field) {
      field.style.removeProperty("border-color");
      field.style.removeProperty("background-color");
      field.style.removeProperty("box-shadow");
    }

    if (errorNode) {
      errorNode.textContent = "";
      errorNode.classList.add("hidden");
    }

    if (fieldName === "documentImage" && documentPreviewShell) {
      documentPreviewShell.style.removeProperty("border-color");
      documentPreviewShell.style.removeProperty("box-shadow");
      documentPreviewShell.style.removeProperty("background-color");
    }

    if (fieldName === "profileImage" && profileAvatarFrame) {
      profileAvatarFrame.style.removeProperty("border-color");
      profileAvatarFrame.style.removeProperty("box-shadow");
      profileAvatarFrame.style.removeProperty("background-color");
    }
  }

  function setFieldError(fieldName, message) {
    var field = getField(fieldName);
    var errorNode = getErrorNode(fieldName);

    if (field) {
      field.style.borderColor = "rgba(244,63,94,0.8)";
      field.style.backgroundColor = "rgba(255,241,242,0.7)";
      field.style.boxShadow = "0 0 0 3px rgba(244,63,94,0.14)";
    }

    if (errorNode) {
      errorNode.textContent = String(message || "Invalid value.");
      errorNode.classList.remove("hidden");
    }

    if (fieldName === "documentImage" && documentPreviewShell) {
      documentPreviewShell.style.borderColor = "rgba(244,63,94,0.8)";
      documentPreviewShell.style.boxShadow = "0 0 0 3px rgba(244,63,94,0.14)";
      documentPreviewShell.style.backgroundColor = "rgba(255,241,242,0.42)";
    }

    if (fieldName === "profileImage" && profileAvatarFrame) {
      profileAvatarFrame.style.borderColor = "rgba(244,63,94,0.8)";
      profileAvatarFrame.style.boxShadow = "0 0 0 4px rgba(244,63,94,0.18)";
      profileAvatarFrame.style.backgroundColor = "rgba(255,241,242,0.55)";
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
      documentImageUrl: normalizeDocumentImageUrl(payload.documentImageUrl),
      hasSelectedDocumentImage: Boolean(payload.hasSelectedDocumentImage),
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

    if (fieldName === "documentImage") {
      if (!payload.documentImageUrl && !payload.hasSelectedDocumentImage) {
        return "Document image is required.";
      }

      if (payload.documentImageUrl && !isRenderableDocumentImageUrl(payload.documentImageUrl)) {
        return "Document image format is invalid.";
      }

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
      documentImageUrl: persistedDocumentImageUrl,
      hasSelectedDocumentImage: Boolean(selectedDocumentImageFile),
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
      avatar_url: normalizeProfileImageUrl(source.avatar_url || source.avatarUrl),
      phone_number: trim(source.phone_number || source.phoneNumber),
      gender: trim(source.gender).toLowerCase(),
      date_of_birth: trim(source.date_of_birth || source.dateOfBirth),
      address_line: trim(source.address_line || source.addressLine),
      city: trim(source.city),
      country: trim(source.country) || "Nepal",
      postal_code: trim(source.postal_code || source.postalCode),
      document_type: trim(source.document_type || source.documentType).toLowerCase(),
      document_number: trim(source.document_number || source.documentNumber),
      document_image_url: normalizeDocumentImageUrl(source.document_image_url || source.documentImageUrl),
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
      avatar_url: normalizeProfileImageUrl(remote.avatar_url || local.avatar_url),
      phone_number: trim(remote.phone_number || local.phone_number),
      gender: trim(remote.gender || local.gender).toLowerCase(),
      date_of_birth: trim(remote.date_of_birth || local.date_of_birth),
      address_line: trim(remote.address_line || local.address_line),
      city: trim(remote.city || local.city),
      country: trim(remote.country || local.country) || "Nepal",
      postal_code: trim(remote.postal_code || local.postal_code),
      document_type: trim(remote.document_type || local.document_type).toLowerCase(),
      document_number: trim(remote.document_number || local.document_number),
      document_image_url: normalizeDocumentImageUrl(remote.document_image_url || local.document_image_url),
      document_expiry_date: trim(remote.document_expiry_date || local.document_expiry_date),
      verification_status: trim(remote.verification_status || local.verification_status).toLowerCase() || "pending",
      verification_submitted_at: trim(remote.verification_submitted_at || local.verification_submitted_at),
      verification_note: trim(remote.verification_note || local.verification_note),
    };
  }

  function fillForm(profile) {
    var source = profile || {};

    currentProfileRecord = Object.assign({}, currentProfileRecord || {}, source);

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

    if (hasOwn(source, "avatar_url") || hasOwn(source, "avatarUrl")) {
      setPersistedProfileImage(source.avatar_url || source.avatarUrl);
    } else {
      renderProfileIdentity(persistedProfileImageUrl, false);
    }

    setPersistedDocumentImage(source.document_image_url);

    selectedDocumentImageFile = null;
    if (documentImageInput) {
      documentImageInput.value = "";
    }

    clearFieldError("profileImage");
    clearFieldError("documentImage");
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

        if (fieldName === "fullName" || fieldName === "email") {
          var identityImageUrl = selectedProfileImageFile && temporaryProfilePreviewUrl
            ? temporaryProfilePreviewUrl
            : persistedProfileImageUrl;
          renderProfileIdentity(identityImageUrl, Boolean(selectedProfileImageFile && temporaryProfilePreviewUrl));
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

  function resolvePublicError(error, fallbackMessage) {
    if (auth && typeof auth.toPublicError === "function") {
      return auth.toPublicError(error, fallbackMessage);
    }

    return String((error && error.message) || fallbackMessage || "Something went wrong.");
  }

  function getResolvedProfileName() {
    return trim(getField("fullName") && getField("fullName").value) ||
      trim(currentProfileRecord && currentProfileRecord.full_name) ||
      "User";
  }

  function applyProfileRecordUpdate(update) {
    var payload = update && typeof update === "object" ? update : {};
    currentProfileRecord = Object.assign({}, currentProfileRecord || {}, payload);

    if (!trim(currentProfileRecord.full_name)) {
      currentProfileRecord.full_name = getResolvedProfileName();
    }

    if (!trim(currentProfileRecord.email)) {
      currentProfileRecord.email = trim(getField("email") && getField("email").value);
    }
  }

  async function uploadAndPersistProfileImage(file) {
    if (!file || profileImageBusy) {
      return;
    }

    if (!auth || typeof auth.uploadProfileImage !== "function" || typeof auth.upsertProfile !== "function") {
      var serviceError = "Profile image service is unavailable. Please refresh and try again.";
      setFieldError("profileImage", serviceError);
      renderProfileIdentity(persistedProfileImageUrl, false);
      return;
    }

    setProfileImageBusyState(true);

    try {
      var liveSession = await auth.getSession();
      if (!liveSession || !liveSession.user) {
        throw new Error("Your session expired. Please sign in again before updating profile image.");
      }
      activeSessionData = liveSession;

      var uploadedAvatarUrl = await auth.uploadProfileImage(file);
      var upsertResult = await auth.upsertProfile({
        fullName: getResolvedProfileName(),
        avatarUrl: uploadedAvatarUrl,
      });

      if (!upsertResult || !upsertResult.success) {
        throw (upsertResult && upsertResult.error) || new Error("Unable to save profile image right now.");
      }

      var updatedProfile = upsertResult.data || {};
      if (!trim(updatedProfile.avatar_url)) {
        updatedProfile.avatar_url = uploadedAvatarUrl;
      }

      applyProfileRecordUpdate(updatedProfile);
      setPersistedProfileImage(updatedProfile.avatar_url);

      selectedProfileImageFile = null;
      if (profileImageInput) {
        profileImageInput.value = "";
      }

      clearFieldError("profileImage");
      setProfileImageOptionsOpen(false);

      var storedSession = getStoredSession();
      persistProfileCache(currentProfileRecord, storedSession, activeSessionData);
    } catch (error) {
      var readable = resolvePublicError(error, "Unable to update profile image right now.");
      selectedProfileImageFile = null;

      if (profileImageInput) {
        profileImageInput.value = "";
      }

      clearTemporaryProfilePreviewUrl();
      renderProfileIdentity(persistedProfileImageUrl, false);
      setFieldError("profileImage", readable);
    } finally {
      setProfileImageBusyState(false);
    }
  }

  async function removePersistedProfileImage() {
    if (profileImageBusy) {
      return;
    }

    if (!persistedProfileImageUrl && !selectedProfileImageFile) {
      return;
    }

    if (!auth || typeof auth.upsertProfile !== "function") {
      var serviceError = "Profile update service is unavailable. Please refresh and try again.";
      setFieldError("profileImage", serviceError);
      return;
    }

    setProfileImageBusyState(true);

    try {
      var liveSession = await auth.getSession();
      if (!liveSession || !liveSession.user) {
        throw new Error("Your session expired. Please sign in again before removing profile image.");
      }
      activeSessionData = liveSession;

      var upsertResult = await auth.upsertProfile({
        fullName: getResolvedProfileName(),
        avatarUrl: null,
      });

      if (!upsertResult || !upsertResult.success) {
        throw (upsertResult && upsertResult.error) || new Error("Unable to remove profile image right now.");
      }

      applyProfileRecordUpdate(upsertResult.data || {});
      currentProfileRecord.avatar_url = "";

      setPersistedProfileImage("");
      clearProfileImageSelection();

      clearFieldError("profileImage");
      setProfileImageOptionsOpen(false);

      var storedSession = getStoredSession();
      persistProfileCache(currentProfileRecord, storedSession, activeSessionData);
    } catch (error) {
      var readable = resolvePublicError(error, "Unable to remove profile image right now.");
      setFieldError("profileImage", readable);
    } finally {
      setProfileImageBusyState(false);
      renderProfileIdentity(persistedProfileImageUrl, false);
    }
  }

  function bindProfileImageControls() {
    if (!profileImageInput) {
      renderProfileIdentity(persistedProfileImageUrl, false);
      return;
    }

    if (profileImageEditBtn) {
      profileImageEditBtn.addEventListener("click", function () {
        if (profileImageBusy) {
          return;
        }

        setProfileImageOptionsOpen(!profileImageOptionsOpen);
      });
    }

    if (profileImageReplaceBtn) {
      profileImageReplaceBtn.addEventListener("click", openProfileImagePicker);
    }

    profileImageInput.addEventListener("change", function () {
      var file = profileImageInput.files && profileImageInput.files.length
        ? profileImageInput.files[0]
        : null;

      if (!file) {
        selectedProfileImageFile = null;
        renderProfileIdentity(persistedProfileImageUrl, false);
        return;
      }

      var mimeType = String(file.type || "").toLowerCase();
      if (!isAllowedProfileImageMime(mimeType)) {
        profileImageInput.value = "";
        selectedProfileImageFile = null;
        setFieldError("profileImage", "Only JPG, PNG, or WEBP profile images are allowed.");
        renderProfileIdentity(persistedProfileImageUrl, false);
        return;
      }

      if (Number(file.size || 0) > MAX_PROFILE_IMAGE_SOURCE_BYTES) {
        profileImageInput.value = "";
        selectedProfileImageFile = null;
        setFieldError("profileImage", "Profile image must be under 20 MB.");
        renderProfileIdentity(persistedProfileImageUrl, false);
        return;
      }

      clearFieldError("profileImage");
      clearTemporaryProfilePreviewUrl();
      temporaryProfilePreviewUrl = URL.createObjectURL(file);
      selectedProfileImageFile = file;
      renderProfileIdentity(temporaryProfilePreviewUrl, true);

      void uploadAndPersistProfileImage(file);
    });

    if (profileImageRemoveBtn) {
      profileImageRemoveBtn.addEventListener("click", function () {
        clearFieldError("profileImage");
        void removePersistedProfileImage();
      });
    }

    setProfileImageOptionsOpen(false);
    renderProfileIdentity(persistedProfileImageUrl, false);
  }

  function bindDocumentImageControls() {
    if (!documentImageInput) {
      return;
    }

    documentImageInput.addEventListener("change", function () {
      var file = documentImageInput.files && documentImageInput.files.length
        ? documentImageInput.files[0]
        : null;

      if (!file) {
        selectedDocumentImageFile = null;
        renderDocumentPreview(persistedDocumentImageUrl, "", false);
        return;
      }

      var mimeType = String(file.type || "").toLowerCase();
      if (!isAllowedDocumentImageMime(mimeType)) {
        documentImageInput.value = "";
        selectedDocumentImageFile = null;
        setFieldError("documentImage", "Only JPG, PNG, or WEBP document images are allowed.");
        return;
      }

      if (Number(file.size || 0) > MAX_DOCUMENT_IMAGE_SOURCE_BYTES) {
        documentImageInput.value = "";
        selectedDocumentImageFile = null;
        setFieldError("documentImage", "Document image must be under 20 MB.");
        return;
      }

      clearFieldError("documentImage");
      clearTemporaryDocumentPreviewUrl();
      temporaryDocumentPreviewUrl = URL.createObjectURL(file);
      selectedDocumentImageFile = file;
      renderDocumentPreview(temporaryDocumentPreviewUrl, file.name, true);
    });

    if (documentReplaceBtn) {
      documentReplaceBtn.addEventListener("click", function () {
        if (documentImageInput) {
          documentImageInput.click();
        }
      });
    }

    if (documentClearBtn) {
      documentClearBtn.addEventListener("click", function () {
        clearFieldError("documentImage");
        clearDocumentImageState();
      });
    }
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
      if (firstInvalid === "documentImage" && documentReplaceBtn && typeof documentReplaceBtn.focus === "function") {
        documentReplaceBtn.focus();
        return;
      }

      var firstInvalidField = getField(firstInvalid);
      if (firstInvalidField && typeof firstInvalidField.focus === "function") {
        firstInvalidField.focus();
      }
      return;
    }

    isSubmitting = true;
    setSubmitState(true, "Preparing submission...");
    setBanner("info", "Preparing verification details...");

    try {
      if (selectedDocumentImageFile) {
        if (!auth || typeof auth.uploadVerificationDocumentImage !== "function") {
          throw new Error("Verification image upload service is unavailable. Please refresh and try again.");
        }

        setSubmitState(true, "Uploading document image...");
        setBanner("info", "Uploading document image securely...");
        payload.documentImageUrl = await auth.uploadVerificationDocumentImage(selectedDocumentImageFile);
        payload.hasSelectedDocumentImage = false;
      }

      setSubmitState(true, "Submitting verification...");
      setBanner("info", "Submitting verification details securely...");

      var result = await auth.submitVerification(payload);
      if (!result || !result.success || !result.data) {
        throw (result && result.error) || new Error("Unable to submit verification details right now.");
      }

      fillForm(result.data);
      setStatusBadge(result.data.verification_status, result.data.verification_submitted_at);

      setPersistedDocumentImage(result.data.document_image_url || payload.documentImageUrl);
      selectedDocumentImageFile = null;
      if (documentImageInput) {
        documentImageInput.value = "";
      }

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

  window.addEventListener("beforeunload", function () {
    clearTemporaryProfilePreviewUrl();
    clearTemporaryDocumentPreviewUrl();
  });

  bindLiveValidation();
  bindProfileImageControls();
  bindDocumentImageControls();
  renderDocumentPreview("", "No image selected", false);
  initializePage();
})();
