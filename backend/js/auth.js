(function () {
  "use strict";

  var STORAGE_SESSION = "vrs_auth_session";
  var STORAGE_PROFILE = "vrs_profile";
  var STORAGE_PROFILE_PREFIX = "vrs_profile::";
  var STORAGE_ATTEMPTS = "vrs_login_attempts";
  var PROFILE_UPDATED_EVENT = "vrs:profile-updated";
  var BROKEN_AVATAR_SYNC_CACHE = {};
  var MAX_ATTEMPTS_WARNING = 3;
  var BOOKING_GUARD_REDIRECT_TIMER = null;
  var BOOKING_GUARD_TOAST_HIDE_TIMER = null;
  var PROFILE_VERIFICATION_STATUSES = ["not_submitted", "pending", "approved", "rejected"];
  var PROFILE_VERIFICATION_GENDERS = ["male", "female", "other", "prefer_not_to_say"];
  var PROFILE_VERIFICATION_DOCUMENT_TYPES = ["driving_license", "national_id", "passport", "other"];

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function normalizeSession(session) {
    if (!session || typeof session !== "object") {
      return null;
    }

    var userId = String(session.userId || "").trim();
    var email = String(session.email || "").trim().toLowerCase();
    var accessToken = String(session.accessToken || "").trim();

    // Guard against legacy placeholder session objects from older local-only auth flows.
    if (email === "guest@example.com") {
      return null;
    }

    if (!userId) {
      if (!email || !accessToken) {
        return null;
      }
    }

    return session;
  }

  function getSession() {
    var sessionRaw = sessionStorage.getItem(STORAGE_SESSION) || localStorage.getItem(STORAGE_SESSION);
    var parsed = safeParse(sessionRaw, null);
    var normalized = normalizeSession(parsed);

    if (parsed && !normalized) {
      clearSession();
    }

    return normalized;
  }

  function normalizeAvatarValue(value) {
    var raw = String(value || "").trim();

    if (!raw) {
      return "";
    }

    var lowered = raw.toLowerCase();
    if (
      lowered === "null" ||
      lowered === "undefined" ||
      lowered === "[object object]"
    ) {
      return "";
    }

    var normalizedPath = raw.split("#")[0].split("?")[0].toLowerCase();
    if (
      normalizedPath.indexOf("assets/images/car-transparent.png") >= 0 ||
      normalizedPath.indexOf("default-avatar") >= 0 ||
      normalizedPath.indexOf("avatar-placeholder") >= 0
    ) {
      return "";
    }

    return raw;
  }

  function isRenderableAvatarValue(value) {
    var avatar = normalizeAvatarValue(value);
    if (!avatar) {
      return false;
    }

    return (
      avatar.indexOf("data:image/") === 0 ||
      avatar.indexOf("blob:") === 0 ||
      avatar.indexOf("https://") === 0 ||
      avatar.indexOf("http://") === 0 ||
      avatar.charAt(0) === "/"
    );
  }

  function getCloudAvatarValue(value) {
    var avatar = normalizeAvatarValue(value);
    if (!avatar) {
      return null;
    }

    if (avatar.indexOf("blob:") === 0) {
      return null;
    }

    if (avatar.indexOf("data:image/") === 0) {
      return avatar;
    }

    if (avatar.indexOf("data:") === 0) {
      return null;
    }

    var withoutHash = avatar.split("#")[0];
    var withoutQuery = withoutHash.split("?")[0];
    return withoutQuery || null;
  }

  function normalizeVerificationStatus(value) {
    var normalized = String(value || "").trim().toLowerCase();
    if (PROFILE_VERIFICATION_STATUSES.indexOf(normalized) >= 0) {
      return normalized;
    }

    return "pending";
  }

  function normalizeVerificationGender(value) {
    var normalized = String(value || "").trim().toLowerCase();
    if (PROFILE_VERIFICATION_GENDERS.indexOf(normalized) >= 0) {
      return normalized;
    }

    return "";
  }

  function normalizeVerificationDocumentType(value) {
    var normalized = String(value || "").trim().toLowerCase();
    if (PROFILE_VERIFICATION_DOCUMENT_TYPES.indexOf(normalized) >= 0) {
      return normalized;
    }

    return "";
  }

  function normalizeShortText(value, maxLength) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }

    if (!Number.isFinite(maxLength) || maxLength <= 0) {
      return text;
    }

    return text.slice(0, maxLength);
  }

  function normalizeIsoDate(value) {
    var text = normalizeShortText(value, 32);
    if (!text) {
      return "";
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function formatProfileDate(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }

    var parsed = new Date(text + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      parsed = new Date(text);
    }

    if (Number.isNaN(parsed.getTime())) {
      return text;
    }

    try {
      return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (_error) {
      return text;
    }
  }

  function profileVerificationStatusMeta(statusValue) {
    var status = normalizeVerificationStatus(statusValue);

    if (status === "approved") {
      return {
        key: "approved",
        label: "Approved",
        toneClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
        description: "Your account is verified."
      };
    }

    if (status === "pending") {
      return {
        key: "pending",
        label: "Pending Review",
        toneClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
        description: "Your submitted details are under review."
      };
    }

    if (status === "rejected") {
      return {
        key: "rejected",
        label: "Rejected",
        toneClass: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
        description: "Your submission needs correction and resubmission."
      };
    }

    return {
      key: "not_submitted",
      label: "Pending",
      toneClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      description: "Complete verification details and submit for admin approval."
    };
  }

  function setQuickVerifyButtonState(node, meta, hasSubmission) {
    if (!node || !meta) {
      return;
    }

    node.className = "ml-4 inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-5 py-2.5 text-[13px] font-semibold leading-none tracking-[0.01em] transition duration-200 hover:-translate-y-[1px]";
    node.disabled = false;

    if (meta.key === "approved") {
      node.classList.add("bg-emerald-100", "text-emerald-700", "dark:bg-emerald-500/20", "dark:text-emerald-300");
      node.innerHTML = "<svg viewBox=\"0 0 20 20\" fill=\"currentColor\" aria-hidden=\"true\" class=\"h-3.5 w-3.5\"><path fill-rule=\"evenodd\" d=\"M16.704 5.29a1 1 0 010 1.415l-7.2 7.2a1 1 0 01-1.415 0l-3-3a1 1 0 011.415-1.414L8.8 11.786l6.493-6.496a1 1 0 011.41 0z\" clip-rule=\"evenodd\"></path></svg><span>Approved</span>";
      return;
    }

    if (meta.key === "rejected") {
      node.classList.add("bg-rose-100", "text-rose-700", "dark:bg-rose-500/20", "dark:text-rose-300");
      node.textContent = "Verify Account";
      return;
    }

    if (hasSubmission) {
      node.classList.add("bg-amber-100", "text-amber-700", "dark:bg-amber-500/20", "dark:text-amber-300");
      node.textContent = "Pending Review";
      return;
    }

    node.classList.add("bg-accent", "text-white", "hover:brightness-105");
    node.textContent = "Verify Account";
  }

  function setVerificationBadgeState(node, meta, compact) {
    if (!node || !meta) {
      return;
    }

    var badgeClass = compact
      ? "mt-1 inline-flex self-start w-auto max-w-max items-center justify-center gap-1 whitespace-nowrap text-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none "
      : "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ";

    node.className = badgeClass + meta.toneClass;

    if (meta.key === "approved") {
      node.innerHTML = "<svg viewBox=\"0 0 20 20\" fill=\"currentColor\" aria-hidden=\"true\" class=\"h-3.5 w-3.5\"><path fill-rule=\"evenodd\" d=\"M16.704 5.29a1 1 0 010 1.415l-7.2 7.2a1 1 0 01-1.415 0l-3-3a1 1 0 011.415-1.414L8.8 11.786l6.493-6.496a1 1 0 011.41 0z\" clip-rule=\"evenodd\"></path></svg><span>" + meta.label + "</span>";
      return;
    }

    node.textContent = meta.label;
  }

  function formatVerificationDocumentLabel(value) {
    var normalized = normalizeVerificationDocumentType(value);
    if (normalized === "driving_license") {
      return "Driving License";
    }
    if (normalized === "national_id") {
      return "National ID";
    }
    if (normalized === "passport") {
      return "Passport";
    }
    if (normalized === "other") {
      return "Other";
    }

    return "";
  }

  function renderVerificationProfileState(profileLike, emailLike) {
    var profile = toLocalProfileShape(profileLike);
    var email = String(emailLike || profile.email || "").trim();
    var statusMeta = profileVerificationStatusMeta(profile.verificationStatus);
    var hasSubmission = Boolean(String(profile.verificationSubmittedAt || "").trim());
    var isPendingSetup =
      statusMeta.key === "not_submitted" ||
      (statusMeta.key === "pending" && !hasSubmission);
    var effectiveStatusLabel = isPendingSetup ? "Pending" : statusMeta.label;

    var headerBadge = document.querySelector("[data-profile-identity-status]");
    if (headerBadge) {
      setVerificationBadgeState(headerBadge, statusMeta, true);
      if (isPendingSetup) {
        headerBadge.textContent = "Pending";
      }
    }

    var panelHeadingBadge = document.querySelector("[data-profile-panel-heading-status]");
    if (panelHeadingBadge) {
      setVerificationBadgeState(panelHeadingBadge, statusMeta, true);
      if (isPendingSetup) {
        panelHeadingBadge.textContent = "Pending";
      }
    }

    var panelBadge = document.querySelector("[data-profile-verification-badge]");
    if (panelBadge) {
      setVerificationBadgeState(panelBadge, statusMeta, false);
      if (isPendingSetup) {
        panelBadge.textContent = "Pending";
      }
    }

    var statusText = document.querySelector("[data-profile-verification-status-text]");
    if (statusText) {
      statusText.textContent = effectiveStatusLabel;
    }

    var statusSubText = document.querySelector("[data-profile-verification-status-subtext]");
    if (statusSubText) {
      if (isPendingSetup) {
        statusSubText.textContent = "Verification details are pending. Click Verify Account to continue.";
      } else {
        statusSubText.textContent = statusMeta.description;
      }
    }

    var submittedText = document.querySelector("[data-profile-verification-submitted]");
    if (submittedText) {
      var submittedDate = formatProfileDate(profile.verificationSubmittedAt);
      submittedText.textContent = submittedDate ? ("Submitted: " + submittedDate) : "";
      submittedText.classList.toggle("hidden", !submittedDate);
    }

    var noteText = document.querySelector("[data-profile-verification-note]");
    if (noteText) {
      var noteValue = normalizeShortText(profile.verificationNote, 260);
      if (noteValue) {
        noteText.textContent = noteValue;
        noteText.classList.remove("hidden");
      } else {
        noteText.textContent = "";
        noteText.classList.add("hidden");
      }
    }

    var verifyToggle = document.querySelector("[data-profile-verification-toggle]");
    if (verifyToggle) {
      if (statusMeta.key === "approved") {
        verifyToggle.classList.add("hidden");
      } else {
        verifyToggle.classList.remove("hidden");
      }

      if (statusMeta.key === "approved") {
        verifyToggle.textContent = "Verify Account";
      } else if (statusMeta.key === "pending" && hasSubmission) {
        verifyToggle.textContent = "View Submission";
      } else {
        verifyToggle.textContent = "Verify Account";
      }
    }

    var quickVerifyBtn = document.querySelector("[data-profile-verify-cta]");
    if (quickVerifyBtn) {
      if (statusMeta.key === "approved") {
        quickVerifyBtn.classList.add("hidden");
      } else {
        quickVerifyBtn.classList.remove("hidden");
        setQuickVerifyButtonState(quickVerifyBtn, statusMeta, hasSubmission);
      }
    }

    var modalStatusBadge = document.querySelector("[data-profile-verification-modal-badge]");
    if (modalStatusBadge) {
      setVerificationBadgeState(modalStatusBadge, statusMeta, false);
      if (isPendingSetup) {
        modalStatusBadge.textContent = "Pending";
      }
    }

    var modalStatusText = document.querySelector("[data-profile-verification-modal-status]");
    if (modalStatusText) {
      modalStatusText.textContent = effectiveStatusLabel;
    }

    var modalStatusNote = document.querySelector("[data-profile-verification-modal-subtext]");
    if (modalStatusNote) {
      if (isPendingSetup) {
        modalStatusNote.textContent = "Verification details are pending. Submit your profile for admin review.";
      } else {
        modalStatusNote.textContent = statusMeta.description;
      }
    }

    var verifyFullNameInput = document.querySelector("[data-verify-full-name]");
    if (verifyFullNameInput) {
      verifyFullNameInput.value = profile.username || "User";
    }

    var verifyEmailInput = document.querySelector("[data-verify-email]");
    if (verifyEmailInput) {
      verifyEmailInput.value = email;
    }

    var verifyPhoneInput = document.querySelector("[data-verify-phone]");
    if (verifyPhoneInput) {
      verifyPhoneInput.value = profile.phoneNumber || "";
    }

    var verifyGenderSelect = document.querySelector("[data-verify-gender]");
    if (verifyGenderSelect) {
      verifyGenderSelect.value = profile.gender || "";
    }

    var verifyDobInput = document.querySelector("[data-verify-dob]");
    if (verifyDobInput) {
      verifyDobInput.value = profile.dateOfBirth || "";
    }

    var verifyAddressInput = document.querySelector("[data-verify-address]");
    if (verifyAddressInput) {
      verifyAddressInput.value = profile.addressLine || "";
    }

    var verifyCityInput = document.querySelector("[data-verify-city]");
    if (verifyCityInput) {
      verifyCityInput.value = profile.city || "";
    }

    var verifyCountryInput = document.querySelector("[data-verify-country]");
    if (verifyCountryInput) {
      verifyCountryInput.value = profile.country || "Nepal";
    }

    var verifyPostalInput = document.querySelector("[data-verify-postal]");
    if (verifyPostalInput) {
      verifyPostalInput.value = profile.postalCode || "";
    }

    var verifyDocumentTypeInput = document.querySelector("[data-verify-document-type]");
    if (verifyDocumentTypeInput) {
      verifyDocumentTypeInput.value = profile.documentType || "";
    }

    var verifyDocumentNumberInput = document.querySelector("[data-verify-document-number]");
    if (verifyDocumentNumberInput) {
      verifyDocumentNumberInput.value = profile.documentNumber || "";
    }

    var verifyDocumentExpiryInput = document.querySelector("[data-verify-document-expiry]");
    if (verifyDocumentExpiryInput) {
      verifyDocumentExpiryInput.value = profile.documentExpiryDate || "";
    }

    var verifyDocumentLabel = document.querySelector("[data-profile-document-label]");
    if (verifyDocumentLabel) {
      var docLabel = formatVerificationDocumentLabel(profile.documentType);
      verifyDocumentLabel.textContent = docLabel || "No document submitted";
    }
  }

  function toLocalProfileShape(profile) {
    var input = profile || {};

    return {
      username: String(input.username || "Guest User"),
      avatarDataUrl: normalizeAvatarValue(input.avatarDataUrl),
      email: String(input.email || ""),
      phoneNumber: normalizeShortText(input.phoneNumber || input.phone_number, 40),
      gender: normalizeVerificationGender(input.gender),
      dateOfBirth: normalizeIsoDate(input.dateOfBirth || input.date_of_birth),
      addressLine: normalizeShortText(input.addressLine || input.address_line, 160),
      city: normalizeShortText(input.city, 80),
      country: normalizeShortText(input.country, 80) || "Nepal",
      postalCode: normalizeShortText(input.postalCode || input.postal_code, 20),
      documentType: normalizeVerificationDocumentType(input.documentType || input.document_type),
      documentNumber: normalizeShortText(input.documentNumber || input.document_number, 64),
      documentExpiryDate: normalizeIsoDate(input.documentExpiryDate || input.document_expiry_date),
      verificationStatus: normalizeVerificationStatus(input.verificationStatus || input.verification_status),
      verificationSubmittedAt: normalizeShortText(input.verificationSubmittedAt || input.verification_submitted_at, 64),
      verificationReviewedAt: normalizeShortText(input.verificationReviewedAt || input.verification_reviewed_at, 64),
      verificationNote: normalizeShortText(input.verificationNote || input.verification_note, 260),
    };
  }

  function renderAvatarFallback(avatarEl, username) {
    if (!avatarEl) {
      return;
    }

    avatarEl.innerHTML = "";
    avatarEl.textContent = getInitials(username || "User");
  }

  function renderAvatarImage(avatarEl, avatarUrl, username, onBrokenAvatar) {
    if (!avatarEl) {
      return;
    }

    var normalizedUrl = normalizeAvatarValue(avatarUrl);
    avatarEl.innerHTML = "";

    if (normalizedUrl && isRenderableAvatarValue(normalizedUrl)) {
      var img = document.createElement("img");
      img.src = normalizedUrl;
      img.alt = "Profile image";
      img.className = "h-full w-full object-cover";
      img.onerror = function () {
        renderAvatarFallback(avatarEl, username);
        if (typeof onBrokenAvatar === "function") {
          onBrokenAvatar(normalizedUrl);
        }
      };
      avatarEl.appendChild(img);
      return;
    }

    renderAvatarFallback(avatarEl, username);
  }

  function clearBrokenAvatarFromCloud(profile, brokenAvatarUrl) {
    var normalizedBrokenAvatar = normalizeAvatarValue(brokenAvatarUrl);
    if (!normalizedBrokenAvatar) {
      return;
    }

    var localProfile = toLocalProfileShape(profile);
    if (normalizeAvatarValue(localProfile.avatarDataUrl) === normalizedBrokenAvatar) {
      localProfile.avatarDataUrl = "";
      setProfile(localProfile);
    }

    if (BROKEN_AVATAR_SYNC_CACHE[normalizedBrokenAvatar]) {
      return;
    }

    // Prevent repeated writes for the same failing URL while the page is open.
    BROKEN_AVATAR_SYNC_CACHE[normalizedBrokenAvatar] = true;

    var auth = getAuthService();
    if (!auth || typeof auth.upsertProfile !== "function") {
      return;
    }

    auth.upsertProfile({
      fullName: localProfile.username,
      avatarUrl: null,
    })
      .then(function (syncResult) {
        if (syncResult && syncResult.success && syncResult.data) {
          setProfile(mapRemoteProfileToLocal(syncResult.data, localProfile));
        }
      })
      .catch(function () {
        // Keep local fallback avatar even if cloud cleanup fails.
      });
  }

  function setSession(session, rememberMe) {
    var raw = JSON.stringify(session);

    if (rememberMe) {
      localStorage.setItem(STORAGE_SESSION, raw);
      sessionStorage.removeItem(STORAGE_SESSION);
      return;
    }

    sessionStorage.setItem(STORAGE_SESSION, raw);
    localStorage.removeItem(STORAGE_SESSION);
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_SESSION);
    sessionStorage.removeItem(STORAGE_SESSION);
  }

  function getProfileOwnerKey(sessionLike) {
    var session = sessionLike || getSession();
    var userId = String(session && session.userId ? session.userId : "").trim();
    if (userId) {
      return "uid:" + userId;
    }

    var email = String(session && session.email ? session.email : "").trim().toLowerCase();
    if (email) {
      return "email:" + email;
    }

    return "";
  }

  function getScopedProfileStorageKey(sessionLike) {
    var owner = getProfileOwnerKey(sessionLike);
    return owner ? STORAGE_PROFILE_PREFIX + owner : "";
  }

  function readLegacyProfileForSession(sessionLike) {
    var legacy = safeParse(localStorage.getItem(STORAGE_PROFILE), null);
    if (!legacy || typeof legacy !== "object") {
      return null;
    }

    var session = sessionLike || getSession();
    var sessionEmail = String(session && session.email ? session.email : "").trim().toLowerCase();
    if (!sessionEmail) {
      return null;
    }

    var legacyEmail = String(legacy.email || "").trim().toLowerCase();
    if (legacyEmail && legacyEmail === sessionEmail) {
      return toLocalProfileShape(legacy);
    }

    return null;
  }

  function getProfile() {
    var session = getSession();
    var fallback = {
      username: "Guest User",
      avatarDataUrl: "",
      email: String(session && session.email ? session.email : ""),
    };

    var scopedKey = getScopedProfileStorageKey(session);
    if (scopedKey) {
      var scopedProfile = safeParse(localStorage.getItem(scopedKey), null);
      if (scopedProfile && typeof scopedProfile === "object") {
        return toLocalProfileShape(Object.assign(fallback, scopedProfile));
      }

      var legacyProfile = readLegacyProfileForSession(session);
      if (legacyProfile) {
        localStorage.setItem(scopedKey, JSON.stringify(legacyProfile));
        localStorage.removeItem(STORAGE_PROFILE);
        return toLocalProfileShape(Object.assign(fallback, legacyProfile));
      }
    }

    return toLocalProfileShape(fallback);
  }

  function setProfile(profile) {
    var nextProfile = toLocalProfileShape(profile);
    var scopedKey = getScopedProfileStorageKey();

    if (scopedKey) {
      localStorage.setItem(scopedKey, JSON.stringify(nextProfile));
      localStorage.removeItem(STORAGE_PROFILE);
    } else {
      localStorage.setItem(STORAGE_PROFILE, JSON.stringify(nextProfile));
    }

    try {
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, {
        detail: nextProfile,
      }));
    } catch (_eventError) {
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function attemptsValue() {
    var value = Number(localStorage.getItem(STORAGE_ATTEMPTS) || "0");
    return Number.isFinite(value) ? value : 0;
  }

  function setAttempts(value) {
    localStorage.setItem(STORAGE_ATTEMPTS, String(value));
  }

  function resetAttempts() {
    setAttempts(0);
  }

  function getInitials(name) {
    if (!name) {
      return "GU";
    }

    var cleaned = name.trim();
    if (!cleaned) {
      return "GU";
    }

    var parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function getDisplayNameFromEmail(email) {
    if (!email) {
      return "User";
    }

    var left = email.split("@")[0] || "User";
    return left.replace(/[._-]+/g, " ").replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  }

  function getAuthService() {
    return window.VehicleAuthService || null;
  }

  function getDisplayNameFromUser(user) {
    if (!user) {
      return "User";
    }

    var metadata = user.user_metadata || {};
    var fullName = String(metadata.full_name || metadata.display_name || "").trim();
    if (fullName) {
      return fullName;
    }

    return getDisplayNameFromEmail(user.email);
  }

  function mapRemoteProfileToLocal(remoteProfile, fallbackProfile) {
    var fallback = fallbackProfile || {};

    return {
      username: String(
        (remoteProfile && remoteProfile.full_name) ||
        fallback.username ||
        "User"
      ),
      avatarDataUrl: normalizeAvatarValue(
        (remoteProfile && remoteProfile.avatar_url) ||
        fallback.avatarDataUrl ||
        ""
      ),
      email: String(
        (remoteProfile && remoteProfile.email) ||
        fallback.email ||
        ""
      ),
      phoneNumber: normalizeShortText(
        (remoteProfile && remoteProfile.phone_number) ||
        fallback.phoneNumber ||
        "",
        40
      ),
      gender: normalizeVerificationGender(
        (remoteProfile && remoteProfile.gender) ||
        fallback.gender ||
        ""
      ),
      dateOfBirth: normalizeIsoDate(
        (remoteProfile && remoteProfile.date_of_birth) ||
        fallback.dateOfBirth ||
        ""
      ),
      addressLine: normalizeShortText(
        (remoteProfile && remoteProfile.address_line) ||
        fallback.addressLine ||
        "",
        160
      ),
      city: normalizeShortText(
        (remoteProfile && remoteProfile.city) ||
        fallback.city ||
        "",
        80
      ),
      country: normalizeShortText(
        (remoteProfile && remoteProfile.country) ||
        fallback.country ||
        "Nepal",
        80
      ) || "Nepal",
      postalCode: normalizeShortText(
        (remoteProfile && remoteProfile.postal_code) ||
        fallback.postalCode ||
        "",
        20
      ),
      documentType: normalizeVerificationDocumentType(
        (remoteProfile && remoteProfile.document_type) ||
        fallback.documentType ||
        ""
      ),
      documentNumber: normalizeShortText(
        (remoteProfile && remoteProfile.document_number) ||
        fallback.documentNumber ||
        "",
        64
      ),
      documentExpiryDate: normalizeIsoDate(
        (remoteProfile && remoteProfile.document_expiry_date) ||
        fallback.documentExpiryDate ||
        ""
      ),
      verificationStatus: normalizeVerificationStatus(
        (remoteProfile && remoteProfile.verification_status) ||
        fallback.verificationStatus ||
        "pending"
      ),
      verificationSubmittedAt: normalizeShortText(
        (remoteProfile && remoteProfile.verification_submitted_at) ||
        fallback.verificationSubmittedAt ||
        "",
        64
      ),
      verificationReviewedAt: normalizeShortText(
        (remoteProfile && remoteProfile.verification_reviewed_at) ||
        fallback.verificationReviewedAt ||
        "",
        64
      ),
      verificationNote: normalizeShortText(
        (remoteProfile && remoteProfile.verification_note) ||
        fallback.verificationNote ||
        "",
        260
      ),
    };
  }

  function mapSupabaseSession(sessionData) {
    if (!sessionData || !sessionData.user) {
      return null;
    }

    return {
      email: sessionData.user.email || "",
      provider: (sessionData.user.app_metadata && sessionData.user.app_metadata.provider) || "password",
      userId: sessionData.user.id,
      accessToken: sessionData.access_token || "",
      refreshToken: sessionData.refresh_token || "",
      loggedInAt: Date.now(),
    };
  }

  function syncLocalAuthFromSupabase() {
    var auth = getAuthService();
    if (!auth || typeof auth.getSession !== "function") {
      return Promise.resolve(getSession());
    }

    return auth.getSession()
      .then(async function (sessionData) {
        if (!sessionData || !sessionData.user) {
          return getSession();
        }

        var mapped = mapSupabaseSession(sessionData);
        if (mapped) {
          setSession(mapped, true);

          var existingProfile = getProfile();
          var fallbackProfile = {
            username: getDisplayNameFromUser(sessionData.user),
            avatarDataUrl: existingProfile.avatarDataUrl || "",
            email: sessionData.user.email || existingProfile.email || "",
            phoneNumber: existingProfile.phoneNumber || "",
            gender: existingProfile.gender || "",
            dateOfBirth: existingProfile.dateOfBirth || "",
            addressLine: existingProfile.addressLine || "",
            city: existingProfile.city || "",
            country: existingProfile.country || "Nepal",
            postalCode: existingProfile.postalCode || "",
            documentType: existingProfile.documentType || "",
            documentNumber: existingProfile.documentNumber || "",
            documentExpiryDate: existingProfile.documentExpiryDate || "",
            verificationStatus: existingProfile.verificationStatus || "pending",
            verificationSubmittedAt: existingProfile.verificationSubmittedAt || "",
            verificationReviewedAt: existingProfile.verificationReviewedAt || "",
            verificationNote: existingProfile.verificationNote || "",
          };

          var remoteProfile = null;
          if (typeof auth.getProfile === "function") {
            try {
              remoteProfile = await auth.getProfile();
            } catch (_readError) {
              remoteProfile = null;
            }
          }

          var syncedProfile = remoteProfile
            ? mapRemoteProfileToLocal(remoteProfile, fallbackProfile)
            : fallbackProfile;

          setProfile(syncedProfile);

          if (!remoteProfile && typeof auth.upsertProfile === "function") {
            auth.upsertProfile({
              fullName: syncedProfile.username,
              avatarUrl: getCloudAvatarValue(syncedProfile.avatarDataUrl),
            }).catch(function () {
              // Keep UI functional even if profile table migration is not applied yet.
            });
          }
        }

        return mapped;
      })
      .catch(function () {
        return getSession();
      });
  }

  function performLogout() {
    var auth = getAuthService();

    function finish() {
      clearSession();
      window.location.href = "index.html";
    }

    if (!auth || typeof auth.signOut !== "function") {
      finish();
      return;
    }

    auth.signOut()
      .catch(function () {
        // Ignore sign-out transport failures and still clear local app state.
      })
      .finally(finish);
  }

  function isBucketNotFoundUploadError(error) {
    var message = String(error && error.message ? error.message : "").toLowerCase();
    var status = Number(error && (error.status || error.statusCode));

    return (
      message.indexOf("bucket not found") >= 0 ||
      (status === 404 && message.indexOf("bucket") >= 0)
    );
  }

  function ensureBookingGuardToast() {
    var toast = document.querySelector("[data-booking-guard-toast]");
    if (toast) {
      return toast;
    }

    toast = document.createElement("div");
    toast.setAttribute("data-booking-guard-toast", "true");
    toast.className = "pointer-events-none fixed bottom-5 left-1/2 z-[260] w-[min(92vw,520px)] -translate-x-1/2 translate-y-2 rounded-2xl border px-4 py-3 text-[13px] font-semibold shadow-[0_20px_48px_rgba(0,0,0,0.34)] opacity-0 transition duration-200";
    document.body.appendChild(toast);
    return toast;
  }

  function showBookingGuardToast(message, mode) {
    var toast = ensureBookingGuardToast();
    toast.textContent = String(message || "Please register or sign in to continue.");

    if (mode === "error") {
      toast.style.background = "linear-gradient(145deg, rgba(127, 29, 29, 0.97), rgba(153, 27, 27, 0.97))";
      toast.style.borderColor = "rgba(252, 165, 165, 0.56)";
      toast.style.color = "#fff1f2";
    } else {
      toast.style.background = "linear-gradient(145deg, rgba(18, 94, 82, 0.97), rgba(15, 76, 67, 0.97))";
      toast.style.borderColor = "rgba(110, 231, 183, 0.56)";
      toast.style.color = "#ecfdf5";
    }

    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, 0)";

    if (BOOKING_GUARD_TOAST_HIDE_TIMER) {
      window.clearTimeout(BOOKING_GUARD_TOAST_HIDE_TIMER);
    }

    BOOKING_GUARD_TOAST_HIDE_TIMER = window.setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%, 8px)";
    }, 2200);
  }

  function requireBookingAccess(options) {
    var session = getSession();
    var hasAccount = Boolean(
      session &&
      (
        String(session.userId || "").trim() ||
        String(session.email || "").trim()
      )
    );

    if (hasAccount) {
      return true;
    }

    var opts = options || {};
    var redirectEnabled = opts.autoRedirect !== false;
    var delayMs = Number(opts.delayMs || 650);
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      delayMs = 650;
    }

    showBookingGuardToast(
      opts.message || "Please register or sign in to continue with vehicle booking. Redirecting to registration...",
      opts.mode || "info"
    );

    if (!redirectEnabled) {
      return false;
    }

    var registrationUrl = String(opts.redirectUrl || "registration.html").trim() || "registration.html";
    var pathname = String(window.location.pathname || "").toLowerCase();
    if (pathname.indexOf("registration.html") >= 0) {
      return false;
    }

    if (BOOKING_GUARD_REDIRECT_TIMER) {
      window.clearTimeout(BOOKING_GUARD_REDIRECT_TIMER);
    }

    BOOKING_GUARD_REDIRECT_TIMER = window.setTimeout(function () {
      window.location.href = registrationUrl;
    }, delayMs);

    return false;
  }

  function bookingStatusMeta(statusValue) {
    var normalized = String(statusValue || "").toLowerCase();
    if (normalized === "pending") {
      return { key: "upcoming", label: "Pending" };
    }
    if (normalized === "confirmed" || normalized === "upcoming") {
      return { key: "upcoming", label: "Confirmed" };
    }
    if (normalized === "completed") {
      return { key: "completed", label: "Completed" };
    }
    if (normalized === "cancelled") {
      return { key: "cancelled", label: "Cancelled" };
    }

    return { key: "upcoming", label: "Confirmed" };
  }

  function bookingStatusPillClass(status) {
    var meta = bookingStatusMeta(status);
    if (meta.key === "completed") {
      return "vrs-booking-status vrs-booking-status--completed rounded-full px-2.5 py-0.5 text-[10px] font-semibold";
    }

    if (meta.key === "cancelled") {
      return "vrs-booking-status vrs-booking-status--cancelled rounded-full px-2.5 py-0.5 text-[10px] font-semibold";
    }

    return "vrs-booking-status vrs-booking-status--upcoming rounded-full px-2.5 py-0.5 text-[10px] font-semibold";
  }

  function formatBookingMoney(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      numeric = 0;
    }

    return "$" + numeric.toFixed(2);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBookingDate(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "-";
    }

    var parsed = new Date(text + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      parsed = new Date(text);
    }

    if (Number.isNaN(parsed.getTime())) {
      return text;
    }

    try {
      return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (_error) {
      return text;
    }
  }

  function formatBookingDateTime(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "-";
    }

    var parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return text;
    }

    try {
      return parsed.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_error) {
      return text;
    }
  }

  function normalizeBookingHistoryItem(row, index) {
    var booking = row || {};
    var quote = booking.quote || {};
    var statusMeta = bookingStatusMeta(booking.status || booking.statusLabel);
    var bookingId = String(booking.id || "").trim();
    var reference = String(booking.bookingCode || booking.reference || bookingId || ("BK-" + String(index + 1))).trim();
    var pickupLocation = String(booking.pickupLocation || "").trim() || "Location not specified";

    return {
      id: bookingId || reference,
      reference: reference,
      vehicle: String(booking.vehicleName || booking.vehicle || "Vehicle").trim() || "Vehicle",
      category: String(booking.type || booking.category || "Vehicle").trim() || "Vehicle",
      pickupDate: formatBookingDate(booking.startDate || booking.pickupDate),
      pickupTime: String(booking.pickupTime || "10:00").trim() || "10:00",
      dropoffDate: formatBookingDate(booking.endDate || booking.dropoffDate),
      dropoffTime: String(booking.dropoffTime || "-").trim() || "-",
      pickupLocation: pickupLocation,
      dropoffLocation: pickupLocation,
      status: statusMeta.label,
      statusKey: statusMeta.key,
      amount: formatBookingMoney(quote.totalAmount || booking.totalAmount),
      baseAmount: formatBookingMoney(quote.baseAmount || booking.baseAmount),
      serviceFee: formatBookingMoney(quote.serviceFee || booking.serviceFee),
      tax: formatBookingMoney(quote.taxAmount || booking.taxAmount),
      discount: "-" + formatBookingMoney(quote.discountAmount || booking.discountAmount),
      driverName: String(booking.driverOptionLabel || booking.driverOption || "Self Drive").trim() || "Self Drive",
      paymentMethod: "Online",
      customerEmail: String(booking.customerEmail || "").trim() || "Not provided",
      customerPhone: String(booking.customerPhone || "").trim() || "Not provided",
      addOns: [],
      createdAtRaw: String(booking.createdAt || booking.lastUpdated || ""),
      lastUpdated: formatBookingDateTime(booking.createdAt || booking.lastUpdated),
      customerUserId: String(booking.customerUserId || "").trim(),
    };
  }

  async function loadCurrentUserBookings() {
    var session = getSession();
    var currentEmail = String(session && session.email ? session.email : "").trim().toLowerCase();
    var currentUserId = String(session && session.userId ? session.userId : "").trim();

    if (!currentEmail && !currentUserId) {
      return [];
    }

    if (!window.VehicleBookingService || typeof window.VehicleBookingService.listBookings !== "function") {
      return [];
    }

    var rows = await window.VehicleBookingService.listBookings();
    if (!Array.isArray(rows)) {
      return [];
    }

    var filtered = rows.filter(function (row) {
      var bookingUserId = String(row && row.customerUserId ? row.customerUserId : "").trim();
      if (currentUserId && bookingUserId && bookingUserId === currentUserId) {
        return true;
      }

      var bookingEmail = String(row && row.customerEmail ? row.customerEmail : "").trim().toLowerCase();
      if (currentEmail && bookingEmail && bookingEmail === currentEmail) {
        return true;
      }

      return false;
    }).map(normalizeBookingHistoryItem);

    filtered.sort(function (a, b) {
      var dateA = Date.parse(String(a && a.createdAtRaw ? a.createdAtRaw : ""));
      var dateB = Date.parse(String(b && b.createdAtRaw ? b.createdAtRaw : ""));

      if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }

      return String(b && b.reference ? b.reference : "").localeCompare(String(a && a.reference ? a.reference : ""));
    });

    return filtered;
  }

  function renderBookingsWorkspaceMessage(container, message) {
    if (!container) {
      return;
    }

    container.innerHTML = "<p class=\"vrs-bookings-message rounded-2xl px-4 py-3 text-[13px]\">" + escapeHtml(message || "No records available.") + "</p>";
  }

  function renderBookingDetail(detail, booking) {
    if (!detail || !booking) {
      return;
    }

    detail.innerHTML = "";

    var top = document.createElement("div");
    top.className = "flex flex-wrap items-start justify-between gap-2";

    var titleWrap = document.createElement("div");
    var title = document.createElement("h3");
    title.className = "text-[20px] font-bold leading-tight";
    title.textContent = booking.vehicle;

    var sub = document.createElement("p");
    sub.className = "vrs-bookings-subline mt-1 text-[12px]";
    sub.textContent = booking.reference + " • " + booking.category;
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    var status = document.createElement("span");
    status.className = bookingStatusPillClass(booking.status);
    status.textContent = booking.status;

    top.appendChild(titleWrap);
    top.appendChild(status);

    var timeline = document.createElement("div");
    timeline.className = "vrs-bookings-detail-grid mt-4 grid grid-cols-1 gap-2 rounded-2xl p-3 text-[12px] sm:grid-cols-2";
    timeline.innerHTML =
      "<p><span class=\"vrs-bookings-field-label block\">Pick-up</span>" + escapeHtml(booking.pickupDate) + " at " + escapeHtml(booking.pickupTime) + "</p>" +
      "<p><span class=\"vrs-bookings-field-label block\">Drop-off</span>" + escapeHtml(booking.dropoffDate) + "</p>" +
      "<p><span class=\"vrs-bookings-field-label block\">From</span>" + escapeHtml(booking.pickupLocation) + "</p>" +
      "<p><span class=\"vrs-bookings-field-label block\">To</span>" + escapeHtml(booking.dropoffLocation) + "</p>";

    var money = document.createElement("div");
    money.className = "vrs-bookings-money mt-3 rounded-2xl p-3 text-[12px]";
    money.innerHTML =
      "<div class=\"mb-2 flex items-center justify-between\"><span class=\"vrs-bookings-money-label\">Total Paid</span><strong class=\"vrs-bookings-money-total text-[16px]\">" + escapeHtml(booking.amount) + "</strong></div>" +
      "<div class=\"vrs-bookings-money-lines space-y-1\">" +
      "<p class=\"flex justify-between\"><span>Base Amount</span><span>" + escapeHtml(booking.baseAmount) + "</span></p>" +
      "<p class=\"flex justify-between\"><span>Service Fee</span><span>" + escapeHtml(booking.serviceFee) + "</span></p>" +
      "<p class=\"flex justify-between\"><span>Tax</span><span>" + escapeHtml(booking.tax) + "</span></p>" +
      "<p class=\"flex justify-between\"><span>Discount</span><span>" + escapeHtml(booking.discount) + "</span></p>" +
      "</div>";

    var extra = document.createElement("div");
    extra.className = "vrs-bookings-extra mt-3 grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2";
    extra.innerHTML =
      "<p class=\"vrs-bookings-extra-item rounded-xl px-3 py-2\"><span class=\"vrs-bookings-field-label block\">Driver Option</span>" + escapeHtml(booking.driverName) + "</p>" +
      "<p class=\"vrs-bookings-extra-item rounded-xl px-3 py-2\"><span class=\"vrs-bookings-field-label block\">Payment</span>" + escapeHtml(booking.paymentMethod) + "</p>" +
      "<p class=\"vrs-bookings-extra-item rounded-xl px-3 py-2\"><span class=\"vrs-bookings-field-label block\">Contact Email</span>" + escapeHtml(booking.customerEmail) + "</p>" +
      "<p class=\"vrs-bookings-extra-item rounded-xl px-3 py-2\"><span class=\"vrs-bookings-field-label block\">Contact Phone</span>" + escapeHtml(booking.customerPhone) + "</p>" +
      "<p class=\"vrs-bookings-extra-item rounded-xl px-3 py-2 sm:col-span-2\"><span class=\"vrs-bookings-field-label block\">Last Updated</span>" + escapeHtml(booking.lastUpdated) + "</p>";

    detail.appendChild(top);
    detail.appendChild(timeline);
    detail.appendChild(money);
    detail.appendChild(extra);
  }

  async function renderBookingsWorkspace(modalRoot) {
    var list = modalRoot.querySelector("[data-bookings-modal-list]");
    var detail = modalRoot.querySelector("[data-bookings-modal-detail]");
    var total = modalRoot.querySelector("[data-bookings-total]");
    var upcoming = modalRoot.querySelector("[data-bookings-upcoming]");
    var completed = modalRoot.querySelector("[data-bookings-completed]");

    if (!list || !detail) {
      return;
    }

    if (total) {
      total.textContent = "0";
    }
    if (upcoming) {
      upcoming.textContent = "0";
    }
    if (completed) {
      completed.textContent = "0";
    }

    renderBookingsWorkspaceMessage(list, "Loading your bookings...");
    renderBookingsWorkspaceMessage(detail, "Preparing booking details...");

    var session = getSession();
    if (!session) {
      renderBookingsWorkspaceMessage(list, "Please sign in to view your bookings.");
      renderBookingsWorkspaceMessage(detail, "Booking details will appear here after you sign in.");
      return;
    }

    if (!window.VehicleBookingService || typeof window.VehicleBookingService.listBookings !== "function") {
      renderBookingsWorkspaceMessage(list, "Booking service is not available on this page.");
      renderBookingsWorkspaceMessage(detail, "Reload the page and try again.");
      return;
    }

    var bookings = [];

    try {
      bookings = await loadCurrentUserBookings();
    } catch (error) {
      var errorMessage =
        window.VehicleBookingService && typeof window.VehicleBookingService.toPublicError === "function"
          ? window.VehicleBookingService.toPublicError(error, "Unable to load bookings right now.")
          : "Unable to load bookings right now.";
      renderBookingsWorkspaceMessage(list, errorMessage);
      renderBookingsWorkspaceMessage(detail, "Please try again in a moment.");
      return;
    }

    if (total) {
      total.textContent = String(bookings.length);
    }
    if (upcoming) {
      upcoming.textContent = String(bookings.filter(function (booking) {
        return String(booking.statusKey || "").toLowerCase() === "upcoming";
      }).length);
    }
    if (completed) {
      completed.textContent = String(bookings.filter(function (booking) {
        return String(booking.statusKey || "").toLowerCase() === "completed";
      }).length);
    }

    if (!bookings.length) {
      renderBookingsWorkspaceMessage(list, "No bookings found for your account yet.");
      renderBookingsWorkspaceMessage(detail, "Once you complete a reservation, full details will appear here.");
      return;
    }

    list.innerHTML = "";
    var activeId = bookings[0].id;
    var rowLookup = {};

    function setActive(id) {
      activeId = id;

      bookings.forEach(function (booking) {
        var row = rowLookup[booking.id];
        if (!row) {
          return;
        }

        var isActive = booking.id === activeId;
        row.className = isActive
          ? "vrs-bookings-row is-active w-full rounded-2xl px-3 py-3 text-left transition"
          : "vrs-bookings-row w-full rounded-2xl px-3 py-3 text-left transition";
        row.setAttribute("data-active", isActive ? "true" : "false");
      });

      var selected = bookings.find(function (booking) {
        return booking.id === activeId;
      }) || bookings[0];

      renderBookingDetail(detail, selected);
    }

    bookings.forEach(function (booking) {
      var row = document.createElement("button");
      row.type = "button";
      row.setAttribute("data-booking-id", booking.id);

      var top = document.createElement("div");
      top.className = "flex items-center justify-between gap-2";

      var title = document.createElement("p");
      title.className = "vrs-bookings-row-title text-[13px] font-semibold";
      title.textContent = booking.vehicle;

      var status = document.createElement("span");
      status.className = bookingStatusPillClass(booking.status);
      status.textContent = booking.status;

      var reference = document.createElement("p");
      reference.className = "vrs-bookings-row-reference mt-1 text-[11px]";
      reference.textContent = booking.reference;

      var meta = document.createElement("p");
      meta.className = "vrs-bookings-row-meta mt-1 text-[11px]";
      meta.textContent = booking.pickupDate + " to " + booking.dropoffDate + " • " + booking.amount;

      top.appendChild(title);
      top.appendChild(status);
      row.appendChild(top);
      row.appendChild(reference);
      row.appendChild(meta);
      list.appendChild(row);

      rowLookup[booking.id] = row;
      row.addEventListener("click", function () {
        setActive(booking.id);
      });
    });

    setActive(activeId);
  }

  function ensureBookingsModal() {
    var existingOverlay = document.querySelector("[data-bookings-modal-overlay]");
    if (existingOverlay) {
      return existingOverlay;
    }

    var overlay = document.createElement("div");
    overlay.setAttribute("data-bookings-modal-overlay", "true");
    overlay.className = "pointer-events-none fixed inset-0 z-[250] flex items-center justify-center bg-[rgba(7,22,24,0.52)] opacity-0 transition duration-200";

    var card = document.createElement("section");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.className = "vrs-bookings-card mx-4 w-full max-w-[1060px] rounded-3xl p-5 shadow-[0_28px_70px_rgba(7,31,34,0.24)] sm:p-6";

    var top = document.createElement("div");
    top.className = "flex items-start justify-between gap-3";

    var titleWrap = document.createElement("div");
    var heading = document.createElement("h2");
    heading.className = "vrs-bookings-heading text-[22px] font-bold tracking-[-0.01em]";
    heading.textContent = "Your Bookings";
    var subtitle = document.createElement("p");
    subtitle.className = "vrs-bookings-subtitle mt-1 text-[13px]";
    subtitle.textContent = "Recent and upcoming reservations in one place.";
    titleWrap.appendChild(heading);
    titleWrap.appendChild(subtitle);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("data-bookings-modal-close", "true");
    closeBtn.className = "vrs-bookings-close rounded-full px-3 py-1.5 text-[12px] font-semibold transition hover:-translate-y-[1px]";
    closeBtn.textContent = "Close";

    top.appendChild(titleWrap);
    top.appendChild(closeBtn);

    var summary = document.createElement("div");
    summary.className = "vrs-bookings-summary mt-4 grid grid-cols-3 gap-2 text-[12px] font-semibold";
    summary.innerHTML =
      "<p class=\"vrs-bookings-summary-item rounded-xl px-3 py-2\">Total <span data-bookings-total class=\"vrs-bookings-summary-value ml-1\">0</span></p>" +
      "<p class=\"vrs-bookings-summary-item is-upcoming rounded-xl px-3 py-2\">Upcoming <span data-bookings-upcoming class=\"vrs-bookings-summary-value ml-1\">0</span></p>" +
      "<p class=\"vrs-bookings-summary-item is-completed rounded-xl px-3 py-2\">Completed <span data-bookings-completed class=\"vrs-bookings-summary-value ml-1\">0</span></p>";

    var workspace = document.createElement("div");
    workspace.className = "mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[0.95fr,1.35fr]";

    var list = document.createElement("div");
    list.setAttribute("data-bookings-modal-list", "true");
    list.className = "vrs-bookings-list max-h-[58vh] space-y-2 overflow-y-auto pr-1";

    var detail = document.createElement("div");
    detail.setAttribute("data-bookings-modal-detail", "true");
    detail.className = "vrs-bookings-detail max-h-[58vh] overflow-y-auto rounded-2xl p-4";

    card.appendChild(top);
    card.appendChild(summary);
    workspace.appendChild(list);
    workspace.appendChild(detail);
    card.appendChild(workspace);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    return overlay;
  }

  function openBookingsModal() {
    var overlay = ensureBookingsModal();
    void renderBookingsWorkspace(overlay);

    overlay.classList.remove("opacity-0", "pointer-events-none");
    overlay.classList.add("opacity-100", "pointer-events-auto");
    document.body.classList.add("overflow-hidden");
  }

  function closeBookingsModal() {
    var overlay = document.querySelector("[data-bookings-modal-overlay]");
    if (!overlay) {
      return;
    }

    overlay.classList.remove("opacity-100", "pointer-events-auto");
    overlay.classList.add("opacity-0", "pointer-events-none");
    document.body.classList.remove("overflow-hidden");
  }

  function wireBookingsModal() {
    var bookingsNavLinks = document.querySelectorAll("[data-open-bookings-panel]");
    if (!bookingsNavLinks.length) {
      return;
    }

    var overlay = ensureBookingsModal();
    var closeBtn = overlay.querySelector("[data-bookings-modal-close]");
    var card = overlay.firstElementChild;

    bookingsNavLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();

        if (!requireBookingAccess({
          message: "Please register or sign in to view your bookings. Redirecting to registration...",
          autoRedirect: true,
          delayMs: 700,
        })) {
          return;
        }

        openBookingsModal();
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeBookingsModal();
      });
    }

    overlay.addEventListener("click", function (event) {
      if (card && !card.contains(event.target)) {
        closeBookingsModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeBookingsModal();
      }
    });
  }

  function wireBookingAccessGuards() {
    var bookingLinks = document.querySelectorAll("a[href]");
    if (!bookingLinks.length) {
      return;
    }

    bookingLinks.forEach(function (link) {
      var href = String(link.getAttribute("href") || "").toLowerCase();
      if (href.indexOf("booking.html") < 0) {
        return;
      }

      link.addEventListener("click", function (event) {
        if (event.defaultPrevented) {
          return;
        }

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        if (event.button !== 0) {
          return;
        }

        if (requireBookingAccess({
          message: "Please register or sign in before booking a vehicle. Redirecting to registration...",
          autoRedirect: true,
          delayMs: 700,
        })) {
          return;
        }

        event.preventDefault();
      });
    });
  }

  function setBanner(el, message, mode) {
    if (!el) {
      return;
    }

    var errorClasses = [
      "border",
      "border-[rgba(190,59,59,0.4)]",
      "bg-[rgba(190,59,59,0.12)]",
      "text-[#be3b3b]",
    ];
    var successClasses = [
      "border",
      "border-[rgba(74,159,108,0.42)]",
      "bg-[rgba(74,159,108,0.16)]",
      "text-[#275f3f]",
    ];

    if (!message) {
      el.textContent = "";
      el.classList.add("hidden");
      el.classList.remove.apply(el.classList, errorClasses);
      el.classList.remove.apply(el.classList, successClasses);
      return;
    }

    el.textContent = message;
    el.classList.remove("hidden");
    el.classList.remove.apply(el.classList, errorClasses);
    el.classList.remove.apply(el.classList, successClasses);
    if (mode === "success") {
      el.classList.add.apply(el.classList, successClasses);
    } else {
      el.classList.add.apply(el.classList, errorClasses);
    }
  }

  function renderNavbarAuth() {
    var session = getSession();
    var guest = document.querySelector("[data-auth-guest]");
    var user = document.querySelector("[data-auth-user]");
    var profilePanel = document.querySelector("[data-profile-panel]");
    var profileTrigger = document.querySelector("[data-profile-trigger]");
    var bookingsLinks = document.querySelectorAll("[data-auth-bookings-link]");

    document.body.classList.remove("auth-logged-in", "auth-guest");

    if (session) {
      document.body.classList.add("auth-logged-in");
      if (guest) {
        guest.classList.add("hidden");
        guest.classList.remove("lg:flex");
      }
      if (user) {
        user.classList.remove("hidden");
        user.classList.add("lg:flex");
      }
      bookingsLinks.forEach(function (link) {
        link.classList.remove("hidden");
      });
    } else {
      document.body.classList.add("auth-guest");
      if (guest) {
        guest.classList.remove("hidden");
        guest.classList.add("lg:flex");
      }
      if (user) {
        user.classList.add("hidden");
        user.classList.remove("lg:flex");
      }
      bookingsLinks.forEach(function (link) {
        link.classList.add("hidden");
      });

      if (profilePanel) {
        profilePanel.classList.remove("opacity-100", "translate-y-0", "scale-100", "pointer-events-auto");
        profilePanel.classList.add("opacity-0", "-translate-y-2", "scale-95", "pointer-events-none");
        profilePanel.setAttribute("aria-hidden", "true");
      }

      if (profileTrigger) {
        profileTrigger.setAttribute("aria-expanded", "false");
      }
    }

    renderProfileChip();
  }

  function renderProfileChip() {
    var profile = getProfile();
    var session = getSession();
    var email = String(profile.email || (session && session.email) || "");
    var avatarUrl = normalizeAvatarValue(profile.avatarDataUrl);
    var nameEl = document.querySelector("[data-profile-name]");
    var avatarEl = document.querySelector("[data-profile-avatar]");
    var panelAvatarPreviewEl = document.querySelector("[data-profile-avatar-preview]");
    var emailEls = document.querySelectorAll("[data-profile-email]");

    if (nameEl) {
      nameEl.textContent = profile.username || "User";
    }

    if (emailEls && emailEls.length) {
      emailEls.forEach(function (el) {
        el.textContent = email || "No email";
      });
    }

    renderAvatarImage(avatarEl, avatarUrl, profile.username, function (brokenAvatarUrl) {
      var latestProfile = getProfile();
      if (normalizeAvatarValue(latestProfile.avatarDataUrl) === brokenAvatarUrl) {
        clearBrokenAvatarFromCloud(latestProfile, brokenAvatarUrl);
      }
    });

    renderAvatarImage(panelAvatarPreviewEl, avatarUrl, profile.username);

    var panelName = document.getElementById("profileName");
    if (panelName && !panelName.value) {
      panelName.value = profile.username || "User";
    }

    var panelEmail = document.getElementById("profileEmail");
    if (panelEmail) {
      panelEmail.value = email;
    }

    renderVerificationProfileState(profile, email);
  }

  function wireRealtimeProfileRefresh() {
    if (window.__vrsRealtimeProfileWired) {
      return;
    }

    window.__vrsRealtimeProfileWired = true;

    window.addEventListener(PROFILE_UPDATED_EVENT, function () {
      renderProfileChip();
    });

    window.addEventListener("storage", function (event) {
      if (!event) {
        return;
      }

      if (event.key === STORAGE_PROFILE || (typeof event.key === "string" && event.key.indexOf(STORAGE_PROFILE_PREFIX) === 0)) {
        renderProfileChip();
        return;
      }

      if (event.key === STORAGE_SESSION) {
        renderNavbarAuth();
      }
    });
  }

  function ensureProfileIdentityVerificationChip(trigger) {
    if (!trigger) {
      return;
    }

    var existing = trigger.querySelector("[data-profile-identity-status]");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  function ensureProfilePanelHeaderStatusBadge(panel) {
    if (!panel) {
      return;
    }

    var panelHeading = null;
    var headingCandidates = panel.querySelectorAll("p.font-semibold");
    for (var i = 0; i < headingCandidates.length; i += 1) {
      var nextHeading = headingCandidates[i];
      if (String(nextHeading.textContent || "").trim().toLowerCase() === "edit profile") {
        panelHeading = nextHeading;
        break;
      }
    }

    if (!panelHeading && headingCandidates.length) {
      panelHeading = headingCandidates[0];
    }

    if (!panelHeading) {
      return null;
    }

    panelHeading.classList.add("flex", "w-full", "items-center", "justify-between", "gap-3");

    var existing = panelHeading.querySelector("[data-profile-panel-heading-status]");
    if (existing) {
      return existing;
    }

    var statusChip = document.createElement("span");
    statusChip.setAttribute("data-profile-panel-heading-status", "true");
    statusChip.className = "inline-flex w-auto max-w-max items-center justify-center whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold leading-none text-amber-700";
    statusChip.textContent = "Pending";
    panelHeading.appendChild(statusChip);

    return statusChip;
  }

  function ensureProfileViewProfileButton(panel) {
    if (!panel) {
      return null;
    }

    var saveBtn = panel.querySelector("#saveProfile");
    if (!saveBtn || !saveBtn.parentNode) {
      return null;
    }

    var actionRow = saveBtn.parentNode;
    var existing = actionRow.querySelector("[data-profile-view-profile]");
    if (existing) {
      return existing;
    }

    var viewProfileBtn = document.createElement("button");
    viewProfileBtn.type = "button";
    viewProfileBtn.setAttribute("data-profile-view-profile", "true");
    viewProfileBtn.className = "rounded-full border border-white/40 bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:bg-white/20";
    viewProfileBtn.textContent = "View Profile";
    actionRow.insertBefore(viewProfileBtn, saveBtn);

    return viewProfileBtn;
  }

  function ensureProfileQuickVerifyButton(trigger) {
    if (!trigger || !trigger.parentNode) {
      return null;
    }

    var container = trigger.parentNode;
    var existing = container.querySelector("[data-profile-verify-cta]");
    if (existing) {
      return existing;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-profile-verify-cta", "true");
    button.className = "ml-4 inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold leading-none tracking-[0.01em] text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105";
    button.textContent = "Verify Account";

    container.insertBefore(button, trigger.nextSibling);
    return button;
  }

  function ensureVerificationPanelMarkup(panel) {
    if (!panel || panel.querySelector("[data-profile-verification-shell]")) {
      return;
    }

    var verificationMarkup = `
      <div data-profile-verification-shell class="mt-3 rounded-xl border border-white/20 bg-white/5 px-3 py-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">Account Verification</p>
            <p data-profile-verification-status-text class="mt-1 text-[13px] font-semibold text-white">Pending</p>
            <p data-profile-verification-status-subtext class="mt-1 text-[11px] text-white/75">Verification details are pending. Click Verify Account to continue.</p>
          </div>
          <span data-profile-verification-badge class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Pending</span>
        </div>
        <p data-profile-verification-submitted class="mt-2 hidden text-[11px] text-white/80"></p>
        <p data-profile-verification-note class="mt-1 hidden text-[11px] text-rose-200"></p>
        <p data-profile-document-label class="mt-1 text-[11px] text-white/70">No document submitted</p>
        <button type="button" data-profile-verification-toggle class="mt-3 inline-flex items-center rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105">Verify Account</button>
      </div>
    `;

    var profileNote = panel.querySelector("#profileNote");
    if (profileNote && profileNote.parentNode) {
      profileNote.insertAdjacentHTML("afterend", verificationMarkup);
      return;
    }

    panel.insertAdjacentHTML("beforeend", verificationMarkup);
  }

  function ensureVerificationModalMarkup() {
    var existing = document.querySelector("[data-profile-verification-modal]");
    if (existing) {
      return existing;
    }

    var modalMarkup = `
      <div data-profile-verification-modal role="dialog" aria-modal="true" aria-hidden="true" class="fixed inset-0 z-[240] hidden items-center justify-center p-3 sm:p-5 lg:p-8">
        <div data-profile-verification-modal-backdrop class="absolute inset-0 bg-slate-950/60 opacity-0 backdrop-blur-md transition duration-200"></div>
        <div data-profile-verification-modal-card class="relative z-10 w-full max-w-6xl max-h-[96vh] overflow-hidden rounded-[24px] border border-white/25 bg-[linear-gradient(155deg,rgba(17,48,52,0.98),rgba(10,28,31,0.98))] text-white shadow-[0_45px_110px_rgba(0,0,0,0.45)] opacity-0 translate-y-4 scale-[0.98] transition duration-300 ease-out sm:rounded-[30px]">
          <div class="flex items-start justify-between gap-4 border-b border-white/15 px-4 py-3 sm:px-6 sm:py-5">
            <div class="space-y-1">
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Account Verification</p>
              <h3 class="text-lg font-semibold sm:text-xl">Secure Identity Check</h3>
              <p data-profile-verification-modal-status class="text-sm font-semibold text-amber-200">Pending</p>
              <p data-profile-verification-modal-subtext class="text-[12px] text-white/75">Submit your details for admin approval and unlock full booking features.</p>
            </div>
            <div class="flex items-center gap-2">
              <span data-profile-verification-modal-badge class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Pending</span>
              <button type="button" data-profile-verification-modal-close aria-label="Close verification form" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 text-white/80 transition duration-200 hover:bg-white/10 hover:text-white">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" class="h-4 w-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                  <path d="M5 5l10 10"></path>
                  <path d="M15 5L5 15"></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="grid max-h-[calc(96vh-84px)] grid-cols-1 overflow-y-auto sm:max-h-[calc(92vh-98px)] lg:grid-cols-[0.92fr_1.08fr]">
            <aside class="border-b border-white/15 bg-white/5 px-4 py-4 sm:px-6 sm:py-5 lg:border-b-0 lg:border-r lg:border-r-white/15">
              <p class="text-sm text-white/80">Verification helps us keep bookings secure and ensures a faster approval process for every reservation.</p>
              <ul class="mt-4 space-y-2 text-[12px] text-white/75">
                <li class="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Use your legal full name and matching document details.</li>
                <li class="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Phone number and address are required for booking validation.</li>
                <li class="rounded-xl border border-white/10 bg-white/5 px-3 py-2">Approved profiles are marked with a verified badge.</li>
              </ul>
            </aside>

            <form data-profile-verification-form class="space-y-4 px-4 py-4 sm:px-6 sm:py-5" novalidate>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Full Name</span>
                  <input data-verify-full-name type="text" readonly class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white/90 outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Email</span>
                  <input data-verify-email type="email" readonly class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white/90 outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Phone Number *</span>
                  <input data-verify-phone type="tel" required placeholder="e.g. +977 98XXXXXXXX" class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Gender *</span>
                  <select data-verify-gender required class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none">
                    <option value="" class="text-slate-900">Select</option>
                    <option value="male" class="text-slate-900">Male</option>
                    <option value="female" class="text-slate-900">Female</option>
                    <option value="other" class="text-slate-900">Other</option>
                    <option value="prefer_not_to_say" class="text-slate-900">Prefer not to say</option>
                  </select>
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Date of Birth *</span>
                  <input data-verify-dob type="date" required class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
                <label class="space-y-1 sm:col-span-2">
                  <span class="text-[11px] text-white/80">Address Line *</span>
                  <input data-verify-address type="text" required placeholder="Street, area" class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">City *</span>
                  <input data-verify-city type="text" required class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Country *</span>
                  <input data-verify-country type="text" required class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Postal Code</span>
                  <input data-verify-postal type="text" class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Document Type *</span>
                  <select data-verify-document-type required class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none">
                    <option value="" class="text-slate-900">Select</option>
                    <option value="driving_license" class="text-slate-900">Driving License</option>
                    <option value="national_id" class="text-slate-900">National ID</option>
                    <option value="passport" class="text-slate-900">Passport</option>
                    <option value="other" class="text-slate-900">Other</option>
                  </select>
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Document Number *</span>
                  <input data-verify-document-number type="text" required class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
                <label class="space-y-1">
                  <span class="text-[11px] text-white/80">Document Expiry</span>
                  <input data-verify-document-expiry type="date" class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[12px] text-white outline-none" />
                </label>
              </div>

              <p data-profile-verification-error class="hidden rounded-lg border border-rose-300/40 bg-rose-500/20 px-3 py-2 text-[11px] text-rose-100"></p>

              <div class="flex flex-wrap items-center gap-2 pt-1">
                <button type="submit" data-profile-verification-submit class="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white transition duration-200 hover:-translate-y-[1px] hover:brightness-105">Submit Verification</button>
                <button type="button" data-profile-verification-cancel class="rounded-full border border-white/35 px-4 py-2 text-[12px] font-semibold text-white transition duration-200 hover:-translate-y-[1px]">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalMarkup);
    return document.querySelector("[data-profile-verification-modal]");
  }

  function refreshProfileFromCloud() {
    var auth = getAuthService();
    if (!auth || typeof auth.getProfile !== "function") {
      return Promise.resolve(null);
    }

    return auth.getProfile()
      .then(function (remoteProfile) {
        if (!remoteProfile) {
          return null;
        }

        var currentProfile = getProfile();
        var syncedProfile = mapRemoteProfileToLocal(remoteProfile, currentProfile);
        setProfile(syncedProfile);
        renderProfileChip();
        return syncedProfile;
      })
      .catch(function () {
        return null;
      });
  }

  function wireProfilePanel() {
    var trigger = document.querySelector("[data-profile-trigger]");
    var panel = document.querySelector("[data-profile-panel]");
    var panelCloseBtn = panel ? panel.querySelector("[data-profile-panel-close]") : null;

    if (!trigger || !panel) {
      return;
    }

    if (trigger.getAttribute("data-profile-panel-wired") === "true") {
      return;
    }

    trigger.setAttribute("data-profile-panel-wired", "true");

    var quickVerifyBtn = null;
    var viewProfileBtn = null;

    try {
      ensureProfileIdentityVerificationChip(trigger);
      ensureProfilePanelHeaderStatusBadge(panel);
      ensureVerificationPanelMarkup(panel);
      quickVerifyBtn = ensureProfileQuickVerifyButton(trigger);
      viewProfileBtn = ensureProfileViewProfileButton(panel);
    } catch (panelEnhancementError) {
      console.warn("Profile panel enhancement skipped:", panelEnhancementError && panelEnhancementError.message ? panelEnhancementError.message : panelEnhancementError);
    }

    if (!quickVerifyBtn) {
      try {
        quickVerifyBtn = ensureProfileQuickVerifyButton(trigger);
      } catch (_quickButtonError) {
        quickVerifyBtn = null;
      }
    }

    if (!viewProfileBtn) {
      try {
        viewProfileBtn = ensureProfileViewProfileButton(panel);
      } catch (_viewButtonError) {
        viewProfileBtn = null;
      }
    }
    var verificationModal = null;

    var verificationToggleBtn = panel.querySelector("[data-profile-verification-toggle]");
    var verificationForm = verificationModal ? verificationModal.querySelector("[data-profile-verification-form]") : null;
    var verificationCancelBtn = verificationModal ? verificationModal.querySelector("[data-profile-verification-cancel]") : null;
    var verificationSubmitBtn = verificationModal ? verificationModal.querySelector("[data-profile-verification-submit]") : null;
    var verificationErrorEl = verificationModal ? verificationModal.querySelector("[data-profile-verification-error]") : null;
    var verificationModalCloseBtn = verificationModal ? verificationModal.querySelector("[data-profile-verification-modal-close]") : null;
    var verificationModalBackdrop = verificationModal ? verificationModal.querySelector("[data-profile-verification-modal-backdrop]") : null;
    var verificationModalCard = verificationModal ? verificationModal.querySelector("[data-profile-verification-modal-card]") : null;
    var verificationFormVisible = false;
    var verificationSubmitting = false;
    var verificationModalHideTimerId = null;
    var verificationFocusSource = null;

    var isPanelOpen = false;
    var restoreTimerId = null;
    var hidePanelTimerId = null;
    var panelHomeParent = panel.parentNode;
    var panelHomeNextSibling = panel.nextSibling;
    var mobileBackdrop = null;

    function isMobileViewport() {
      if (typeof window.matchMedia !== "function") {
        return window.innerWidth <= 1024;
      }

      return window.matchMedia("(max-width: 1024px)").matches;
    }

    function ensureMobileBackdrop() {
      if (mobileBackdrop && document.body.contains(mobileBackdrop)) {
        return mobileBackdrop;
      }

      mobileBackdrop = document.createElement("div");
      mobileBackdrop.setAttribute("data-profile-mobile-backdrop", "true");
      mobileBackdrop.className = "fixed inset-0 z-[120]";
      mobileBackdrop.style.background = "rgba(14, 29, 32, 0.52)";
      mobileBackdrop.style.opacity = "0";
      mobileBackdrop.style.pointerEvents = "none";
      mobileBackdrop.style.backdropFilter = "blur(0px)";
      mobileBackdrop.style.webkitBackdropFilter = "blur(0px)";
      mobileBackdrop.style.transition =
        "opacity 260ms ease, backdrop-filter 260ms ease, -webkit-backdrop-filter 260ms ease";
      mobileBackdrop.addEventListener("click", function () {
        closePanel();
      });
      document.body.appendChild(mobileBackdrop);
      return mobileBackdrop;
    }

    function showMobileBackdrop() {
      var backdrop = ensureMobileBackdrop();
      backdrop.style.opacity = "1";
      backdrop.style.pointerEvents = "auto";
      backdrop.style.backdropFilter = "blur(6px)";
      backdrop.style.webkitBackdropFilter = "blur(6px)";
    }

    function hideMobileBackdrop() {
      if (!mobileBackdrop) {
        return;
      }

      mobileBackdrop.style.opacity = "0";
      mobileBackdrop.style.pointerEvents = "none";
      mobileBackdrop.style.backdropFilter = "blur(0px)";
      mobileBackdrop.style.webkitBackdropFilter = "blur(0px)";
    }

    function mountPanelForMobile() {
      if (panel.parentNode === document.body) {
        return;
      }

      panelHomeParent = panelHomeParent || panel.parentNode;
      panelHomeNextSibling = panel.nextSibling;
      document.body.appendChild(panel);
    }

    function restorePanelPlacement() {
      if (!panelHomeParent || panel.parentNode !== document.body) {
        return;
      }

      if (panelHomeNextSibling && panelHomeNextSibling.parentNode === panelHomeParent) {
        panelHomeParent.insertBefore(panel, panelHomeNextSibling);
      } else {
        panelHomeParent.appendChild(panel);
      }
    }

    function clearMobilePanelStyles() {
      panel.style.removeProperty("position");
      panel.style.removeProperty("top");
      panel.style.removeProperty("left");
      panel.style.removeProperty("right");
      panel.style.removeProperty("z-index");
      panel.style.removeProperty("width");
      panel.style.removeProperty("max-height");
      panel.style.removeProperty("transform");
      panel.style.removeProperty("transform-origin");
      panel.style.removeProperty("will-change");
      panel.style.removeProperty("transition");
      panel.style.removeProperty("box-shadow");
    }

    function applyMobilePanelStyles(isOpenState) {
      var viewportWidth = Math.max(
        document.documentElement ? document.documentElement.clientWidth : 0,
        window.innerWidth || 0
      );
      var isSmallViewport = viewportWidth <= 640;

      panel.style.position = "fixed";
      panel.style.zIndex = "130";
      panel.style.top = "50%";
      panel.style.left = "50%";
      panel.style.right = "auto";
      panel.style.width = isSmallViewport ? "94vw" : "92vw";
      panel.style.maxWidth = isSmallViewport ? "408px" : "420px";
      panel.style.minWidth = "0";
      panel.style.maxHeight = isSmallViewport ? "84vh" : "80vh";
      panel.style.transformOrigin = "50% 50%";
      panel.style.willChange = "transform, opacity";
      panel.style.transition =
        "opacity 220ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease";
      panel.style.boxShadow = "0 30px 70px rgba(7, 31, 34, 0.32)";
      panel.style.transform = isOpenState
        ? "translate(-50%, -50%) scale(1)"
        : "translate(-50%, -46%) scale(0.935)";
    }

    function hasAuthenticatedSession() {
      var session = getSession();
      var hasSessionIdentity = Boolean(
        session &&
        String(session.email || "").trim() ||
        String(session.userId || "").trim()
      );

      if (hasSessionIdentity) {
        return true;
      }

      var profile = getProfile();
      return Boolean(String(profile && profile.email ? profile.email : "").trim());
    }

    function openVerificationPage() {
      var targetPath = "profile-verification.html";
      var currentPath = String(window.location.pathname || "").toLowerCase();

      if (currentPath.indexOf("profile-verification.html") >= 0) {
        return;
      }

      window.location.href = targetPath;
    }

    function clearHidePanelTimer() {
      if (!hidePanelTimerId) {
        return;
      }

      window.clearTimeout(hidePanelTimerId);
      hidePanelTimerId = null;
    }

    function showPanelElement() {
      clearHidePanelTimer();
      panel.style.display = "block";
    }

    function scheduleHidePanel(delay) {
      clearHidePanelTimer();

      hidePanelTimerId = window.setTimeout(function () {
        if (isPanelOpen) {
          return;
        }

        panel.style.display = "none";
        hidePanelTimerId = null;
      }, Math.max(0, Number(delay) || 0));
    }

    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");
    panel.style.display = "none";

    function openPanel() {
      if (!hasAuthenticatedSession()) {
        closePanel();
        return;
      }

      if (restoreTimerId) {
        window.clearTimeout(restoreTimerId);
        restoreTimerId = null;
      }

      showPanelElement();

      if (isPanelOpen) {
        return;
      }

      if (isMobileViewport()) {
        mountPanelForMobile();
        applyMobilePanelStyles(false);
        showMobileBackdrop();
        document.body.classList.add("overflow-hidden");
      } else {
        hideMobileBackdrop();
        if (!verificationFormVisible) {
          document.body.classList.remove("overflow-hidden");
        }
        clearMobilePanelStyles();
        restorePanelPlacement();
      }

      isPanelOpen = true;
      panel.classList.remove("opacity-0", "-translate-y-2", "scale-95", "pointer-events-none");
      panel.classList.add("opacity-100", "translate-y-0", "scale-100", "pointer-events-auto");
      trigger.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");

      if (isMobileViewport()) {
        window.requestAnimationFrame(function () {
          if (!isPanelOpen) {
            return;
          }
          applyMobilePanelStyles(true);
        });
      }

      void refreshProfileFromCloud();
    }

    function closePanel() {
      if (!isPanelOpen && !panel.classList.contains("opacity-100")) {
        return;
      }

      toggleVerificationForm(false);
      isPanelOpen = false;
      panel.classList.remove("opacity-100", "translate-y-0", "scale-100", "pointer-events-auto");
      panel.classList.add("opacity-0", "-translate-y-2", "scale-95", "pointer-events-none");
      trigger.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
      scheduleHidePanel(isMobileViewport() ? 300 : 220);

      if (isMobileViewport()) {
        applyMobilePanelStyles(false);
        hideMobileBackdrop();
        if (!verificationFormVisible) {
          document.body.classList.remove("overflow-hidden");
        }

        if (restoreTimerId) {
          window.clearTimeout(restoreTimerId);
        }

        restoreTimerId = window.setTimeout(function () {
          if (isPanelOpen) {
            return;
          }
          clearMobilePanelStyles();
          restorePanelPlacement();
          restoreTimerId = null;
        }, 300);
      } else {
        clearMobilePanelStyles();
        restorePanelPlacement();
      }
    }

    trigger.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      if (!hasAuthenticatedSession()) {
        closePanel();
        return;
      }

      if (isPanelOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });

    panel.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    if (panelCloseBtn) {
      panelCloseBtn.addEventListener("click", function (event) {
        event.preventDefault();
        closePanel();
      });
    }

    document.addEventListener("click", function (event) {
      if (!isPanelOpen) {
        return;
      }

      if (!panel.contains(event.target) && !trigger.contains(event.target)) {
        closePanel();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (verificationFormVisible) {
          toggleVerificationForm(false);
          return;
        }

        closePanel();
      }
    });

    window.addEventListener("resize", function () {
      if (isPanelOpen) {
        if (isMobileViewport()) {
          mountPanelForMobile();
          applyMobilePanelStyles(true);
          showMobileBackdrop();
          document.body.classList.add("overflow-hidden");
        } else {
          hideMobileBackdrop();
          if (!verificationFormVisible) {
            document.body.classList.remove("overflow-hidden");
          }
          clearMobilePanelStyles();
          restorePanelPlacement();
        }
        return;
      }

      hideMobileBackdrop();
      if (!verificationFormVisible) {
        document.body.classList.remove("overflow-hidden");
      }
      clearMobilePanelStyles();
      restorePanelPlacement();
    });

    var saveBtn = document.getElementById("saveProfile");
    var nameInput = document.getElementById("profileName");
    var photoInput = document.getElementById("profilePhoto");
    var photoFileLabel = document.getElementById("profileFileLabel");
    var photoShell = panel ? panel.querySelector(".profile-photo-shell") : null;
    var note = document.getElementById("profileNote");
    var noteDefaultText = note ? String(note.textContent || "").trim() : "";
    var noteFadeTimerId = null;
    var noteResetTimerId = null;
    var profileToastNode = null;
    var profileToastHideTimerId = null;

    function setVerificationError(message) {
      if (!verificationErrorEl) {
        return;
      }

      if (!message) {
        verificationErrorEl.textContent = "";
        verificationErrorEl.classList.add("hidden");
        return;
      }

      verificationErrorEl.textContent = String(message);
      verificationErrorEl.classList.remove("hidden");
    }

    function clearVerificationModalHideTimer() {
      if (!verificationModalHideTimerId) {
        return;
      }

      window.clearTimeout(verificationModalHideTimerId);
      verificationModalHideTimerId = null;
    }

    function toggleVerificationForm(nextVisible) {
      if (!verificationModal || !verificationForm) {
        verificationFormVisible = false;
        return;
      }

      var shouldOpen = Boolean(nextVisible);
      clearVerificationModalHideTimer();

      if (!shouldOpen && !verificationFormVisible && verificationModal.classList.contains("hidden")) {
        setVerificationError("");
        return;
      }

      if (shouldOpen) {
        verificationFormVisible = true;
        verificationFocusSource = document.activeElement;
        setVerificationError("");
        verificationModal.classList.remove("hidden");
        verificationModal.classList.add("flex");
        verificationModal.setAttribute("aria-hidden", "false");
        document.body.classList.add("overflow-hidden");

        window.requestAnimationFrame(function () {
          if (!verificationFormVisible) {
            return;
          }

          if (verificationModalBackdrop) {
            verificationModalBackdrop.classList.remove("opacity-0");
            verificationModalBackdrop.classList.add("opacity-100");
          }

          if (verificationModalCard) {
            verificationModalCard.classList.remove("opacity-0", "translate-y-4", "scale-[0.98]");
            verificationModalCard.classList.add("opacity-100", "translate-y-0", "scale-100");
          }

          var firstEditableField = verificationForm.querySelector("[data-verify-phone]");
          if (firstEditableField && typeof firstEditableField.focus === "function") {
            firstEditableField.focus();
          }
        });

        return;
      }

      verificationFormVisible = false;
      setVerificationError("");
      verificationModal.setAttribute("aria-hidden", "true");

      if (verificationModalBackdrop) {
        verificationModalBackdrop.classList.add("opacity-0");
        verificationModalBackdrop.classList.remove("opacity-100");
      }

      if (verificationModalCard) {
        verificationModalCard.classList.add("opacity-0", "translate-y-4", "scale-[0.98]");
        verificationModalCard.classList.remove("opacity-100", "translate-y-0", "scale-100");
      }

      verificationModalHideTimerId = window.setTimeout(function () {
        if (verificationFormVisible) {
          return;
        }

        verificationModal.classList.remove("flex");
        verificationModal.classList.add("hidden");

        if (!(isPanelOpen && isMobileViewport())) {
          document.body.classList.remove("overflow-hidden");
        }

        if (verificationFocusSource && typeof verificationFocusSource.focus === "function") {
          verificationFocusSource.focus();
        }
        verificationFocusSource = null;
        verificationModalHideTimerId = null;
      }, 320);

    }

    function setVerificationSubmitting(isSubmitting) {
      verificationSubmitting = Boolean(isSubmitting);

      if (!verificationSubmitBtn) {
        return;
      }

      verificationSubmitBtn.disabled = verificationSubmitting;
      verificationSubmitBtn.classList.toggle("opacity-70", verificationSubmitting);
      verificationSubmitBtn.classList.toggle("cursor-not-allowed", verificationSubmitting);
      verificationSubmitBtn.textContent = verificationSubmitting ? "Submitting..." : "Submit Verification";
    }

    function readVerificationFormPayload() {
      function readVerificationField(selector) {
        if (!verificationForm) {
          return "";
        }

        var input = verificationForm.querySelector(selector);
        return input ? input.value : "";
      }

      return {
        fullName: readVerificationField("[data-verify-full-name]"),
        email: readVerificationField("[data-verify-email]"),
        phoneNumber: readVerificationField("[data-verify-phone]"),
        gender: readVerificationField("[data-verify-gender]"),
        dateOfBirth: readVerificationField("[data-verify-dob]"),
        addressLine: readVerificationField("[data-verify-address]"),
        city: readVerificationField("[data-verify-city]"),
        country: readVerificationField("[data-verify-country]"),
        postalCode: readVerificationField("[data-verify-postal]"),
        documentType: readVerificationField("[data-verify-document-type]"),
        documentNumber: readVerificationField("[data-verify-document-number]"),
        documentExpiryDate: readVerificationField("[data-verify-document-expiry]"),
      };
    }

    function clearProfileNoteTimers() {
      if (noteFadeTimerId) {
        window.clearTimeout(noteFadeTimerId);
        noteFadeTimerId = null;
      }

      if (noteResetTimerId) {
        window.clearTimeout(noteResetTimerId);
        noteResetTimerId = null;
      }
    }

    function setProfileNoteTone(mode) {
      if (!note) {
        return;
      }

      note.classList.remove(
        "border-[rgba(229,140,78,0.9)]",
        "border-emerald-400/90",
        "border-rose-400/90",
        "bg-white/10",
        "bg-emerald-500/15",
        "bg-rose-500/15",
        "text-white/90",
        "text-emerald-100",
        "text-rose-100",
        "profile-note--info",
        "profile-note--success",
        "profile-note--error"
      );

      if (mode === "success") {
        note.classList.add("profile-note--success");
        return;
      }

      if (mode === "error") {
        note.classList.add("profile-note--error");
        return;
      }

      note.classList.add("profile-note--info");
    }

    function showProfileNoteMessage(message, mode, autoHideMs) {
      if (!note) {
        return;
      }

      clearProfileNoteTimers();
      setProfileNoteTone(mode || "info");
      note.textContent = String(message || noteDefaultText || "");
      note.style.transition = "opacity 360ms ease, transform 360ms ease";
      note.style.opacity = "1";
      note.style.transform = "translateY(0)";

      var hideDelay = Number(autoHideMs || 0);
      if (hideDelay <= 0) {
        return;
      }

      noteFadeTimerId = window.setTimeout(function () {
        note.style.opacity = "0";
        note.style.transform = "translateY(-3px)";

        noteResetTimerId = window.setTimeout(function () {
          setProfileNoteTone("info");
          note.textContent = noteDefaultText;
          note.style.opacity = "1";
          note.style.transform = "translateY(0)";
          noteResetTimerId = null;
        }, 380);

        noteFadeTimerId = null;
      }, hideDelay);
    }

    function ensureProfileSaveToast() {
      if (profileToastNode && document.body.contains(profileToastNode)) {
        return profileToastNode;
      }

      profileToastNode = document.createElement("div");
      profileToastNode.setAttribute("data-profile-save-toast", "true");
      profileToastNode.setAttribute("aria-live", "polite");
      profileToastNode.style.position = "fixed";
      profileToastNode.style.top = "18px";
      profileToastNode.style.right = "18px";
      profileToastNode.style.zIndex = "280";
      profileToastNode.style.maxWidth = "min(92vw, 360px)";
      profileToastNode.style.padding = "11px 14px";
      profileToastNode.style.borderRadius = "12px";
      profileToastNode.style.boxShadow = "0 14px 30px rgba(6, 19, 24, 0.28)";
      profileToastNode.style.fontSize = "13px";
      profileToastNode.style.fontWeight = "700";
      profileToastNode.style.opacity = "0";
      profileToastNode.style.transform = "translateY(8px)";
      profileToastNode.style.pointerEvents = "none";
      profileToastNode.style.transition = "opacity 260ms ease, transform 260ms ease";
      document.body.appendChild(profileToastNode);

      return profileToastNode;
    }

    function showProfileSaveToast(message, mode, autoHideMs) {
      var toast = ensureProfileSaveToast();
      var tone = String(mode || "success").toLowerCase();
      var isDarkTheme = document.documentElement && document.documentElement.getAttribute("data-theme") === "dark";

      if (profileToastHideTimerId) {
        window.clearTimeout(profileToastHideTimerId);
        profileToastHideTimerId = null;
      }

      toast.textContent = String(message || "Profile updated");

      if (tone === "error") {
        toast.style.background = "linear-gradient(145deg, rgba(127, 29, 29, 0.95), rgba(153, 27, 27, 0.95))";
        toast.style.border = "1px solid rgba(252, 165, 165, 0.5)";
        toast.style.color = "#fff1f2";
      } else if (tone === "info") {
        toast.style.background = isDarkTheme
          ? "linear-gradient(145deg, rgba(30, 79, 96, 0.96), rgba(24, 63, 79, 0.96))"
          : "linear-gradient(145deg, rgba(38, 94, 115, 0.96), rgba(34, 81, 100, 0.96))";
        toast.style.border = "1px solid rgba(143, 199, 226, 0.45)";
        toast.style.color = "#eef8fc";
      } else {
        toast.style.background = isDarkTheme
          ? "linear-gradient(145deg, rgba(34, 118, 104, 0.96), rgba(24, 96, 86, 0.96))"
          : "linear-gradient(145deg, rgba(44, 118, 110, 0.96), rgba(28, 96, 90, 0.96))";
        toast.style.border = "1px solid rgba(166, 223, 191, 0.55)";
        toast.style.color = "#ecfdf5";
      }

      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";

      profileToastHideTimerId = window.setTimeout(function () {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(8px)";
        profileToastHideTimerId = null;
      }, Math.max(1200, Number(autoHideMs || 3000)));
    }

    function forceHideNativeFileInput(input) {
      if (!input) {
        return;
      }

      input.setAttribute("aria-hidden", "true");
      input.setAttribute("tabindex", "-1");
      input.style.position = "absolute";
      input.style.width = "1px";
      input.style.height = "1px";
      input.style.padding = "0";
      input.style.margin = "-1px";
      input.style.overflow = "hidden";
      input.style.clip = "rect(0, 0, 0, 0)";
      input.style.whiteSpace = "nowrap";
      input.style.border = "0";
      input.style.opacity = "0";
    }

    function setPhotoFileLabel(fileName) {
      if (!photoFileLabel) {
        return;
      }

      photoFileLabel.textContent = String(fileName || "No file selected");
    }

    function setPhotoDropState(isDragOver) {
      if (!photoShell) {
        return;
      }

      var active = Boolean(isDragOver);
      photoShell.classList.toggle("border-[#2c766e]", active);
      photoShell.classList.toggle("bg-[rgba(44,118,110,0.28)]", active);
      photoShell.classList.toggle("border-white/20", !active);
      photoShell.classList.toggle("bg-[linear-gradient(145deg,rgba(44,118,110,0.2),rgba(255,255,255,0.08))]", !active);
    }

    setPhotoFileLabel();
    forceHideNativeFileInput(photoInput);

    function readCurrentProfileEmail() {
      var profile = getProfile();
      var session = getSession();
      return String(profile.email || (session && session.email) || "");
    }

    async function saveProfileData(avatarDataUrl, options) {
      var opts = options || {};
      var current = getProfile();
      var resolvedAvatar = normalizeAvatarValue(
        avatarDataUrl !== undefined ? avatarDataUrl : current.avatarDataUrl
      );
      var nextProfile = {
        phoneNumber: current.phoneNumber,
        gender: current.gender,
        dateOfBirth: current.dateOfBirth,
        addressLine: current.addressLine,
        city: current.city,
        country: current.country,
        postalCode: current.postalCode,
        documentType: current.documentType,
        documentNumber: current.documentNumber,
        documentExpiryDate: current.documentExpiryDate,
        verificationStatus: current.verificationStatus,
        verificationSubmittedAt: current.verificationSubmittedAt,
        verificationReviewedAt: current.verificationReviewedAt,
        verificationNote: current.verificationNote,
        username: (nameInput && nameInput.value.trim()) || current.username || "User",
        avatarDataUrl: resolvedAvatar,
        email: readCurrentProfileEmail(),
      };

      setProfile(nextProfile);
      renderProfileChip();

      var auth = getAuthService();
      var cloudSynced = false;
      if (auth && typeof auth.upsertProfile === "function") {
        try {
          var syncResult = await auth.upsertProfile({
            fullName: nextProfile.username,
            avatarUrl: getCloudAvatarValue(nextProfile.avatarDataUrl),
          });

          cloudSynced = Boolean(syncResult && syncResult.success);

          if (cloudSynced && syncResult.data) {
            var syncedProfile = mapRemoteProfileToLocal(syncResult.data, nextProfile);
            setProfile(syncedProfile);
            renderProfileChip();

            if (typeof auth.cleanupProfileImages === "function") {
              auth.cleanupProfileImages(syncedProfile.avatarDataUrl)
                .catch(function (cleanupError) {
                  console.warn("Profile image cleanup skipped:", cleanupError && cleanupError.message ? cleanupError.message : cleanupError);
                });
            }
          }
        } catch (_err) {
          cloudSynced = false;
        }
      }

      if (!opts.silentFeedback) {
        showProfileNoteMessage("Profile updated", "success", 0);
      }

      return {
        cloudSynced: cloudSynced,
      };
    }

    function previewSelectedImage(file, previousProfile) {
      var reader = new FileReader();
      reader.onload = function (event) {
        var previewDataUrl = String(event && event.target && event.target.result ? event.target.result : "");
        if (!previewDataUrl) {
          return;
        }

        setProfile({
          phoneNumber: previousProfile.phoneNumber,
          gender: previousProfile.gender,
          dateOfBirth: previousProfile.dateOfBirth,
          addressLine: previousProfile.addressLine,
          city: previousProfile.city,
          country: previousProfile.country,
          postalCode: previousProfile.postalCode,
          documentType: previousProfile.documentType,
          documentNumber: previousProfile.documentNumber,
          documentExpiryDate: previousProfile.documentExpiryDate,
          verificationStatus: previousProfile.verificationStatus,
          verificationSubmittedAt: previousProfile.verificationSubmittedAt,
          verificationReviewedAt: previousProfile.verificationReviewedAt,
          verificationNote: previousProfile.verificationNote,
          username: (nameInput && nameInput.value.trim()) || previousProfile.username || "User",
          avatarDataUrl: previewDataUrl,
          email: readCurrentProfileEmail(),
        });
        renderProfileChip();
      };

      reader.onerror = function () {
        // Keep upload flow moving even if preview cannot be generated.
      };

      reader.readAsDataURL(file);
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        Promise.resolve(saveProfileData(undefined, { silentFeedback: true }))
          .then(function (result) {
            closePanel();
            showProfileSaveToast("Profile updated", "success", 3000);
          })
          .catch(function (error) {
            var auth = getAuthService();
            if (auth && typeof auth.toPublicError === "function") {
              showProfileNoteMessage(
                auth.toPublicError(error, "Unable to save profile right now."),
                "error",
                0
              );
              return;
            }

            showProfileNoteMessage(
              String(error && error.message ? error.message : "Unable to save profile right now."),
              "error",
              0
            );
          });
      });
    }

    function handleSelectedPhotoFile(file) {
      if (!file) {
        setPhotoFileLabel();
        return;
      }

      setPhotoFileLabel(file.name);

      var auth = getAuthService();
      if (auth && typeof auth.uploadProfileImage === "function") {
        var previousProfile = getProfile();

        previewSelectedImage(file, previousProfile);

        if (note) {
          showProfileNoteMessage("Uploading and optimizing profile image...", "info", 0);
        }

        auth.uploadProfileImage(file)
          .then(function (avatarUrl) {
            return saveProfileData(avatarUrl);
          })
          .catch(function (error) {
            if (isBucketNotFoundUploadError(error)) {
              var currentPreview = getProfile();
              if (currentPreview && normalizeAvatarValue(currentPreview.avatarDataUrl)) {
                saveProfileData(currentPreview.avatarDataUrl)
                  .then(function () {
                    showProfileNoteMessage(
                      "Storage bucket is missing, so profile image was saved in profile data fallback.",
                      "info",
                      0
                    );
                  })
                  .catch(function () {
                    setProfile(previousProfile);
                    renderProfileChip();
                    showProfileNoteMessage("Profile image upload failed.", "error", 0);
                  });
                return;
              }
            }

            setProfile(previousProfile);
            renderProfileChip();

            if (auth && typeof auth.toPublicError === "function") {
              showProfileNoteMessage(auth.toPublicError(error, "Profile image upload failed."), "error", 0);
            } else {
              showProfileNoteMessage(
                String(error && error.message ? error.message : "Profile image upload failed."),
                "error",
                0
              );
            }
          })
          .finally(function () {
            if (photoInput) {
              photoInput.value = "";
            }
            setPhotoFileLabel();
            setPhotoDropState(false);
          });
        return;
      }

      var fallbackMaxBytes = 1024 * 1024 * 5;
      if (file.size > fallbackMaxBytes) {
        showProfileNoteMessage("Image is too large. Please choose a file under 5 MB.", "error", 0);
        if (photoInput) {
          photoInput.value = "";
        }
        setPhotoFileLabel();
        setPhotoDropState(false);
        return;
      }

      var reader = new FileReader();
      reader.onload = function (event) {
        saveProfileData(String(event.target && event.target.result ? event.target.result : ""));
        if (photoInput) {
          photoInput.value = "";
        }
        setPhotoFileLabel();
        setPhotoDropState(false);
      };
      reader.readAsDataURL(file);
    }

    if (photoInput) {
      photoInput.addEventListener("change", function () {
        var file = photoInput.files && photoInput.files[0];
        handleSelectedPhotoFile(file);
      });
    }

    if (photoShell) {
      ["dragenter", "dragover"].forEach(function (eventName) {
        photoShell.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          setPhotoDropState(true);
        });
      });

      ["dragleave", "dragend"].forEach(function (eventName) {
        photoShell.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          setPhotoDropState(false);
        });
      });

      photoShell.addEventListener("drop", function (event) {
        event.preventDefault();
        event.stopPropagation();
        setPhotoDropState(false);

        var droppedFile = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (!droppedFile) {
          return;
        }

        if (photoInput) {
          try {
            if (typeof DataTransfer === "function") {
              var transfer = new DataTransfer();
              transfer.items.add(droppedFile);
              photoInput.files = transfer.files;
            }
          } catch (_dropError) {
            // Fallback to direct handler if assignment fails.
          }
        }

        handleSelectedPhotoFile(droppedFile);
      });
    }

    if (quickVerifyBtn) {
      quickVerifyBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (!hasAuthenticatedSession()) {
          closePanel();
          return;
        }

        closePanel();
        openVerificationPage();
      });
    }

    if (viewProfileBtn) {
      viewProfileBtn.addEventListener("click", function (event) {
        event.preventDefault();

        if (!hasAuthenticatedSession()) {
          closePanel();
          return;
        }

        closePanel();
        openVerificationPage();
      });
    }

    if (verificationToggleBtn) {
      verificationToggleBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (!hasAuthenticatedSession()) {
          closePanel();
          return;
        }

        closePanel();
        openVerificationPage();
      });
    }

    if (verificationModalCloseBtn) {
      verificationModalCloseBtn.addEventListener("click", function () {
        toggleVerificationForm(false);
      });
    }

    if (verificationModalBackdrop) {
      verificationModalBackdrop.addEventListener("click", function () {
        toggleVerificationForm(false);
      });
    }

    if (verificationModalCard) {
      verificationModalCard.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    }

    if (verificationCancelBtn) {
      verificationCancelBtn.addEventListener("click", function () {
        toggleVerificationForm(false);
      });
    }

    if (verificationForm) {
      verificationForm.addEventListener("submit", function (event) {
        event.preventDefault();

        if (verificationSubmitting) {
          return;
        }

        var auth = getAuthService();
        if (!auth || typeof auth.submitVerification !== "function") {
          setVerificationError("Verification service is unavailable right now.");
          return;
        }

        setVerificationError("");
        setVerificationSubmitting(true);

        var payload = readVerificationFormPayload();

        Promise.resolve(auth.submitVerification(payload))
          .then(function (result) {
            if (!result || !result.success || !result.data) {
              throw (result && result.error) || new Error("Unable to submit verification details right now.");
            }

            var currentProfile = getProfile();
            var syncedProfile = mapRemoteProfileToLocal(result.data, currentProfile);
            setProfile(syncedProfile);
            renderProfileChip();
            toggleVerificationForm(false);
            showProfileNoteMessage("Verification submitted. Status is now pending review.", "success", 0);
            showProfileSaveToast("Verification details submitted successfully", "success", 3200);
          })
          .catch(function (error) {
            if (auth && typeof auth.toPublicError === "function") {
              setVerificationError(
                auth.toPublicError(error, "Unable to submit verification details right now.")
              );
              return;
            }

            setVerificationError(
              String(error && error.message ? error.message : "Unable to submit verification details right now.")
            );
          })
          .finally(function () {
            setVerificationSubmitting(false);
          });
      });
    }

    toggleVerificationForm(false);
    renderProfileChip();

    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        performLogout();
      });
    }
  }

  function runLoginFlow() {
    var form = document.getElementById("loginForm");
    if (!form) {
      return;
    }

    var banner = document.getElementById("loginBanner");
    var forgot = document.getElementById("forgotPassword");
    var forgotAssistModal = document.getElementById("forgotAssistModal");
    var forgotAssistCard = document.getElementById("forgotAssistCard");
    var forgotAssistClose = document.getElementById("forgotAssistClose");
    var forgotAssistPrimary = document.getElementById("forgotAssistPrimary");
    var loginMain = document.getElementById("loginMain");
    var rememberMe = document.getElementById("rememberMe");
    var passwordInput = document.getElementById("password");
    var passwordToggle = document.getElementById("passwordToggle");
    var eyeOpenIcon = document.getElementById("eyeOpenIcon");
    var eyeOffIcon = document.getElementById("eyeOffIcon");
    var google = document.getElementById("googleSignIn");
    var auth = getAuthService();
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitDefaultText = submitBtn
      ? String(submitBtn.textContent || "Sign In to Dashboard").trim()
      : "Sign In to Dashboard";

    function setSubmitState(isLoading, loadingText) {
      if (!submitBtn) {
        return;
      }

      submitBtn.disabled = Boolean(isLoading);
      submitBtn.classList.toggle("opacity-80", Boolean(isLoading));
      submitBtn.classList.toggle("cursor-not-allowed", Boolean(isLoading));
      submitBtn.textContent = isLoading
        ? String(loadingText || "Signing in...")
        : submitDefaultText;
    }

    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get("registered") === "1") {
        var registeredEmail = params.get("email");
        if (registeredEmail) {
          setBanner(banner, "Account created for " + registeredEmail + ". Please verify your email and sign in.", "success");
        } else {
          setBanner(banner, "Account created. Please verify your email and sign in.", "success");
        }
      }
    } catch (_err) {
      // Ignore URL parsing issues.
    }

    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener("click", function () {
        var isHidden = passwordInput.type === "password";
        passwordInput.type = isHidden ? "text" : "password";
        passwordToggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");

        if (eyeOpenIcon && eyeOffIcon) {
          eyeOpenIcon.classList.toggle("hidden", isHidden);
          eyeOffIcon.classList.toggle("hidden", !isHidden);
        }
      });
    }

    var forgotModalHideTimer = null;

    function setForgotModalBackgroundState(isOpen) {
      if (!loginMain) {
        return;
      }

      if (isOpen) {
        loginMain.style.filter = "blur(4px)";
        loginMain.style.transform = "scale(0.992)";
        loginMain.style.pointerEvents = "none";
      } else {
        loginMain.style.removeProperty("filter");
        loginMain.style.removeProperty("transform");
        loginMain.style.removeProperty("pointer-events");
      }
    }

    function openForgotModal() {
      if (!forgotAssistModal || !forgotAssistCard) {
        return;
      }

      if (forgotModalHideTimer) {
        clearTimeout(forgotModalHideTimer);
        forgotModalHideTimer = null;
      }

      forgotAssistModal.classList.remove("hidden");
      forgotAssistModal.classList.add("flex");
      forgotAssistModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("overflow-hidden");
      setForgotModalBackgroundState(true);

      requestAnimationFrame(function () {
        forgotAssistModal.classList.remove("opacity-0", "pointer-events-none");
        forgotAssistModal.classList.add("opacity-100", "pointer-events-auto");
        forgotAssistCard.classList.remove("translate-y-3", "scale-[0.985]");
        forgotAssistCard.classList.add("translate-y-0", "scale-100");
      });

      if (forgot) {
        forgot.setAttribute("aria-expanded", "true");
      }

      if (forgotAssistPrimary) {
        forgotAssistPrimary.focus();
      }
    }

    function closeForgotModal() {
      if (!forgotAssistModal || !forgotAssistCard) {
        return;
      }

      forgotAssistModal.classList.remove("opacity-100", "pointer-events-auto");
      forgotAssistModal.classList.add("opacity-0", "pointer-events-none");
      forgotAssistCard.classList.remove("translate-y-0", "scale-100");
      forgotAssistCard.classList.add("translate-y-3", "scale-[0.985]");
      forgotAssistModal.setAttribute("aria-hidden", "true");
      setForgotModalBackgroundState(false);
      document.body.classList.remove("overflow-hidden");

      if (forgotModalHideTimer) {
        clearTimeout(forgotModalHideTimer);
      }

      forgotModalHideTimer = setTimeout(function () {
        forgotAssistModal.classList.remove("flex");
        forgotAssistModal.classList.add("hidden");
      }, 220);

      if (forgot) {
        forgot.setAttribute("aria-expanded", "false");
        forgot.focus();
      }
    }

    function onForgotModalKeyDown(event) {
      if (event.key === "Escape" && forgotAssistModal && forgotAssistModal.getAttribute("aria-hidden") === "false") {
        event.preventDefault();
        closeForgotModal();
      }
    }

    if (forgot) {
      forgot.addEventListener("click", function (event) {
        event.preventDefault();

        openForgotModal();
        setBanner(banner, "", "error");
      });
    }

    if (forgotAssistClose) {
      forgotAssistClose.addEventListener("click", function () {
        closeForgotModal();
      });
    }

    if (forgotAssistPrimary) {
      forgotAssistPrimary.addEventListener("click", function () {
        closeForgotModal();
      });
    }

    if (forgotAssistModal) {
      forgotAssistModal.addEventListener("click", function (event) {
        if (event.target === forgotAssistModal) {
          closeForgotModal();
        }
      });
    }

    document.addEventListener("keydown", onForgotModalKeyDown);

    if (google) {
      google.addEventListener("click", async function () {
        if (!auth || typeof auth.signInWithGoogle !== "function") {
          setBanner(banner, "Google sign in is currently unavailable.", "error");
          return;
        }

        try {
          setBanner(banner, "Redirecting to Google sign in...", "success");
          await auth.signInWithGoogle("index.html");
        } catch (error) {
          setBanner(banner, auth.toPublicError(error, "Google sign in failed."), "error");
        }
      });
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      setBanner(banner, "", "error");
      setSubmitState(true, "Signing in...");

      var email = String(form.email.value || "").trim();
      var password = String(form.password.value || "");

      if (!isValidEmail(email)) {
        setSubmitState(false);
        setAttempts(attemptsValue() + 1);
        setBanner(banner, "Please enter a valid email address.", "error");
        return;
      }

      if (password.length < 8) {
        setSubmitState(false);
        var badAttempts = attemptsValue() + 1;
        setAttempts(badAttempts);
        var base = "Invalid login attempt. Password must be at least 8 characters.";
        var message = badAttempts >= MAX_ATTEMPTS_WARNING
          ? base + " Multiple failed attempts detected."
          : base;
        setBanner(banner, message, "error");
        return;
      }

      if (!auth || typeof auth.signIn !== "function") {
        setSubmitState(false);
        setBanner(banner, "Authentication service unavailable. Please refresh and try again.", "error");
        return;
      }

      try {
        var result = await auth.signIn({
          email: email,
          password: password,
        });

        var mappedSession = mapSupabaseSession(result.session || { user: result.user });
        if (!mappedSession) {
          throw new Error("Session not available after login.");
        }

        setSession(mappedSession, rememberMe ? rememberMe.checked : true);
        var profileName = getDisplayNameFromUser((result.session && result.session.user) || result.user);
        var existingLocalProfile = getProfile();
        var profileDraft = {
          username: profileName,
          avatarDataUrl: existingLocalProfile.avatarDataUrl || "",
          email: email,
        };

        setProfile(profileDraft);

        resetAttempts();
        setSubmitState(true, "Opening dashboard...");
        window.location.assign("index.html");
      } catch (error) {
        setSubmitState(false);
        var badAttemptsAfterFailure = attemptsValue() + 1;
        setAttempts(badAttemptsAfterFailure);
        setBanner(
          banner,
          auth.toPublicError(error, "Sign in failed. Please try again."),
          "error"
        );
      }
    });
  }

  function protectPage(pageType) {
    var session = getSession();

    if (pageType === "login" && session) {
      window.location.href = "index.html";
      return false;
    }

    return true;
  }

  function init(pageType) {
    if (!protectPage(pageType)) {
      return;
    }

    wireRealtimeProfileRefresh();
    renderNavbarAuth();
    wireProfilePanel();
    wireBookingsModal();
    wireBookingAccessGuards();

    if (pageType === "login") {
      runLoginFlow();
    }

    syncLocalAuthFromSupabase().then(function (session) {
      renderNavbarAuth();

      if (pageType === "login" && session) {
        window.location.href = "index.html";
      }
    });
  }

  window.VehicleAuthUI = {
    init: init,
    requireBookingAccess: requireBookingAccess,
    logout: function () {
      performLogout();
    },
  };
})();
