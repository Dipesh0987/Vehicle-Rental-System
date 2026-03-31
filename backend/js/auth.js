(function () {
  "use strict";

  var STORAGE_SESSION = "vrs_auth_session";
  var STORAGE_PROFILE = "vrs_profile";
  var STORAGE_PROFILE_PREFIX = "vrs_profile::";
  var STORAGE_ATTEMPTS = "vrs_login_attempts";
  var PROFILE_UPDATED_EVENT = "vrs:profile-updated";
  var BROKEN_AVATAR_SYNC_CACHE = {};
  var MAX_ATTEMPTS_WARNING = 3;
  var STATIC_BOOKINGS = [
    {
      id: "bk-24003",
      reference: "VRS-2026-24003",
      vehicle: "Toyota Camry Hybrid",
      category: "Sedan",
      pickupDate: "2026-03-28",
      pickupTime: "10:00",
      dropoffDate: "2026-03-31",
      dropoffTime: "09:30",
      pickupLocation: "Downtown Vehicle Hub",
      dropoffLocation: "Airport Return Bay",
      driverName: "Alex Morgan",
      paymentMethod: "Visa ending 4421",
      addOns: ["Child Seat", "Basic Insurance"],
      status: "Upcoming",
      amount: "$186.00",
      baseAmount: "$150.00",
      serviceFee: "$18.00",
      tax: "$18.00",
      discount: "-$0.00",
      lastUpdated: "2026-03-26",
    },
    {
      id: "bk-24002",
      reference: "VRS-2026-24002",
      vehicle: "Honda CR-V Touring",
      category: "SUV",
      pickupDate: "2026-03-12",
      pickupTime: "09:30",
      dropoffDate: "2026-03-15",
      dropoffTime: "11:15",
      pickupLocation: "City Center Parking",
      dropoffLocation: "City Center Parking",
      driverName: "Alex Morgan",
      paymentMethod: "Visa ending 4421",
      addOns: ["Premium Insurance"],
      status: "Completed",
      amount: "$264.00",
      baseAmount: "$220.00",
      serviceFee: "$22.00",
      tax: "$26.00",
      discount: "-$4.00",
      lastUpdated: "2026-03-16",
    },
    {
      id: "bk-24001",
      reference: "VRS-2026-24001",
      vehicle: "Ford Mustang GT",
      category: "Sport",
      pickupDate: "2026-02-20",
      pickupTime: "13:00",
      dropoffDate: "2026-02-22",
      dropoffTime: "12:45",
      pickupLocation: "North Business District",
      dropoffLocation: "North Business District",
      driverName: "Alex Morgan",
      paymentMethod: "Mastercard ending 1197",
      addOns: ["Roadside Assistance", "Additional Driver"],
      status: "Completed",
      amount: "$310.00",
      baseAmount: "$260.00",
      serviceFee: "$24.00",
      tax: "$30.00",
      discount: "-$4.00",
      lastUpdated: "2026-02-23",
    },
  ];

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function getSession() {
    var sessionRaw = sessionStorage.getItem(STORAGE_SESSION) || localStorage.getItem(STORAGE_SESSION);
    return safeParse(sessionRaw, null);
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

  function toLocalProfileShape(profile) {
    var input = profile || {};

    return {
      username: String(input.username || "Guest User"),
      avatarDataUrl: normalizeAvatarValue(input.avatarDataUrl),
      email: String(input.email || ""),
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

  function getStaticBookingHistory() {
    return STATIC_BOOKINGS.slice();
  }

  function bookingStatusPillClass(status) {
    return String(status).toLowerCase() === "upcoming"
      ? "rounded-full border border-[#f5c7a5] bg-[rgba(229,140,78,0.18)] px-2 py-0.5 text-[10px] font-semibold text-[#ffd7ba]"
      : "rounded-full border border-[#95d6ae] bg-[rgba(86,170,117,0.18)] px-2 py-0.5 text-[10px] font-semibold text-[#d2f0dd]";
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
    title.className = "text-[20px] font-bold leading-tight text-white";
    title.textContent = booking.vehicle;
    var sub = document.createElement("p");
    sub.className = "mt-1 text-[12px] text-white/72";
    sub.textContent = booking.reference + " • " + booking.category;
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    var status = document.createElement("span");
    status.className = bookingStatusPillClass(booking.status);
    status.textContent = booking.status;

    top.appendChild(titleWrap);
    top.appendChild(status);

    var timeline = document.createElement("div");
    timeline.className = "mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-white/15 bg-white/5 p-3 text-[12px] text-white/85 sm:grid-cols-2";
    timeline.innerHTML =
      "<p><span class=\"block text-white/65\">Pick-up</span>" + booking.pickupDate + " at " + booking.pickupTime + "</p>" +
      "<p><span class=\"block text-white/65\">Drop-off</span>" + booking.dropoffDate + " at " + booking.dropoffTime + "</p>" +
      "<p><span class=\"block text-white/65\">From</span>" + booking.pickupLocation + "</p>" +
      "<p><span class=\"block text-white/65\">To</span>" + booking.dropoffLocation + "</p>";

    var money = document.createElement("div");
    money.className = "mt-3 rounded-2xl border border-[#f2c8aa]/35 bg-[rgba(229,140,78,0.08)] p-3 text-[12px]";
    money.innerHTML =
      "<div class=\"mb-2 flex items-center justify-between\"><span class=\"text-white/72\">Total Paid</span><strong class=\"text-[16px] text-[#ffd8bd]\">" + booking.amount + "</strong></div>" +
      "<div class=\"space-y-1 text-white/78\">" +
      "<p class=\"flex justify-between\"><span>Base Amount</span><span>" + booking.baseAmount + "</span></p>" +
      "<p class=\"flex justify-between\"><span>Service Fee</span><span>" + booking.serviceFee + "</span></p>" +
      "<p class=\"flex justify-between\"><span>Tax</span><span>" + booking.tax + "</span></p>" +
      "<p class=\"flex justify-between\"><span>Discount</span><span>" + booking.discount + "</span></p>" +
      "</div>";

    var extra = document.createElement("div");
    extra.className = "mt-3 grid grid-cols-1 gap-2 text-[12px] text-white/82 sm:grid-cols-2";
    extra.innerHTML =
      "<p class=\"rounded-xl border border-white/10 bg-white/5 px-3 py-2\"><span class=\"block text-white/65\">Driver</span>" + booking.driverName + "</p>" +
      "<p class=\"rounded-xl border border-white/10 bg-white/5 px-3 py-2\"><span class=\"block text-white/65\">Payment Method</span>" + booking.paymentMethod + "</p>" +
      "<p class=\"rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:col-span-2\"><span class=\"block text-white/65\">Add-ons</span>" + booking.addOns.join(", ") + "</p>" +
      "<p class=\"rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:col-span-2\"><span class=\"block text-white/65\">Last Updated</span>" + booking.lastUpdated + "</p>";

    detail.appendChild(top);
    detail.appendChild(timeline);
    detail.appendChild(money);
    detail.appendChild(extra);
  }

  function renderBookingsWorkspace(modalRoot) {
    var list = modalRoot.querySelector("[data-bookings-modal-list]");
    var detail = modalRoot.querySelector("[data-bookings-modal-detail]");
    var total = modalRoot.querySelector("[data-bookings-total]");
    var upcoming = modalRoot.querySelector("[data-bookings-upcoming]");
    var completed = modalRoot.querySelector("[data-bookings-completed]");
    var bookings = getStaticBookingHistory();

    if (!list || !detail) {
      return;
    }

    list.innerHTML = "";
    if (total) {
      total.textContent = String(bookings.length);
    }
    if (upcoming) {
      upcoming.textContent = String(bookings.filter(function (booking) {
        return String(booking.status).toLowerCase() === "upcoming";
      }).length);
    }
    if (completed) {
      completed.textContent = String(bookings.filter(function (booking) {
        return String(booking.status).toLowerCase() === "completed";
      }).length);
    }

    if (!bookings.length) {
      detail.innerHTML = "<p class=\"rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-[13px] text-white/75\">No bookings yet. Once you reserve a vehicle, details will appear here.</p>";
      return;
    }

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
          ? "w-full rounded-2xl border border-[#f3c9ab] bg-[rgba(229,140,78,0.12)] px-3 py-3 text-left transition"
          : "w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left transition hover:bg-white/10";
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
      title.className = "text-[13px] font-semibold text-white";
      title.textContent = booking.vehicle;

      var status = document.createElement("span");
      status.className = bookingStatusPillClass(booking.status);
      status.textContent = booking.status;

      var meta = document.createElement("p");
      meta.className = "mt-1 text-[11px] text-white/74";
      meta.textContent = booking.pickupDate + " to " + booking.dropoffDate + " • " + booking.amount;

      top.appendChild(title);
      top.appendChild(status);
      row.appendChild(top);
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
    overlay.className = "pointer-events-none fixed inset-0 z-[250] flex items-center justify-center bg-[rgba(5,18,20,0.58)] opacity-0 transition duration-200";

    var card = document.createElement("section");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.className = "mx-4 w-full max-w-[1060px] rounded-3xl border border-white/20 bg-[linear-gradient(160deg,rgba(23,56,60,0.98),rgba(16,38,42,0.98))] p-5 text-white shadow-[0_28px_70px_rgba(0,0,0,0.42)] sm:p-6";

    var top = document.createElement("div");
    top.className = "flex items-start justify-between gap-3";

    var titleWrap = document.createElement("div");
    var heading = document.createElement("h2");
    heading.className = "text-[22px] font-bold tracking-[-0.01em]";
    heading.textContent = "Your Bookings";
    var subtitle = document.createElement("p");
    subtitle.className = "mt-1 text-[13px] text-white/75";
    subtitle.textContent = "Recent and upcoming reservations in one place.";
    titleWrap.appendChild(heading);
    titleWrap.appendChild(subtitle);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("data-bookings-modal-close", "true");
    closeBtn.className = "rounded-full border border-white/25 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:-translate-y-[1px] hover:bg-white/10";
    closeBtn.textContent = "Close";

    top.appendChild(titleWrap);
    top.appendChild(closeBtn);

    var summary = document.createElement("div");
    summary.className = "mt-4 grid grid-cols-3 gap-2 text-[12px] font-semibold text-white/88";
    summary.innerHTML =
      "<p class=\"rounded-xl border border-white/15 bg-white/5 px-3 py-2\">Total <span data-bookings-total class=\"ml-1 text-white\">0</span></p>" +
      "<p class=\"rounded-xl border border-[#f2c9ac]/35 bg-[rgba(229,140,78,0.1)] px-3 py-2\">Upcoming <span data-bookings-upcoming class=\"ml-1 text-[#ffd8bd]\">0</span></p>" +
      "<p class=\"rounded-xl border border-[#9ad8b2]/30 bg-[rgba(86,170,117,0.1)] px-3 py-2\">Completed <span data-bookings-completed class=\"ml-1 text-[#d2f0dd]\">0</span></p>";

    var workspace = document.createElement("div");
    workspace.className = "mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[0.95fr,1.35fr]";

    var list = document.createElement("div");
    list.setAttribute("data-bookings-modal-list", "true");
    list.className = "max-h-[58vh] space-y-2 overflow-y-auto pr-1";

    var detail = document.createElement("div");
    detail.setAttribute("data-bookings-modal-detail", "true");
    detail.className = "max-h-[58vh] overflow-y-auto rounded-2xl border border-white/15 bg-white/6 p-4";

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
    renderBookingsWorkspace(overlay);

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

  function wireProfilePanel() {
    var trigger = document.querySelector("[data-profile-trigger]");
    var panel = document.querySelector("[data-profile-panel]");
    var panelCloseBtn = panel ? panel.querySelector("[data-profile-panel-close]") : null;

    if (!trigger || !panel) {
      return;
    }

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
      if (!session) {
        return false;
      }

      return Boolean(String(session.email || "").trim());
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
        document.body.classList.remove("overflow-hidden");
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
    }

    function closePanel() {
      if (!isPanelOpen && !panel.classList.contains("opacity-100")) {
        return;
      }

      isPanelOpen = false;
      panel.classList.remove("opacity-100", "translate-y-0", "scale-100", "pointer-events-auto");
      panel.classList.add("opacity-0", "-translate-y-2", "scale-95", "pointer-events-none");
      trigger.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
      scheduleHidePanel(isMobileViewport() ? 300 : 220);

      if (isMobileViewport()) {
        applyMobilePanelStyles(false);
        hideMobileBackdrop();
        document.body.classList.remove("overflow-hidden");

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
          document.body.classList.remove("overflow-hidden");
          clearMobilePanelStyles();
          restorePanelPlacement();
        }
        return;
      }

      hideMobileBackdrop();
      document.body.classList.remove("overflow-hidden");
      clearMobilePanelStyles();
      restorePanelPlacement();
    });

    var saveBtn = document.getElementById("saveProfile");
    var nameInput = document.getElementById("profileName");
    var photoInput = document.getElementById("profilePhoto");
    var photoFileLabel = document.getElementById("profileFileLabel");
    var photoShell = panel ? panel.querySelector(".profile-photo-shell") : null;
    var note = document.getElementById("profileNote");

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
      photoShell.classList.toggle("bg-[rgba(44,118,110,0.12)]", active);
      photoShell.classList.toggle("border-[rgba(23,57,60,0.16)]", !active);
      photoShell.classList.toggle("bg-white/70", !active);
    }

    setPhotoFileLabel();

    function readCurrentProfileEmail() {
      var profile = getProfile();
      var session = getSession();
      return String(profile.email || (session && session.email) || "");
    }

    async function saveProfileData(avatarDataUrl) {
      var current = getProfile();
      var resolvedAvatar = normalizeAvatarValue(
        avatarDataUrl !== undefined ? avatarDataUrl : current.avatarDataUrl
      );
      var nextProfile = {
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

      if (note) {
        note.textContent = cloudSynced
          ? "Profile updated and synced to Supabase."
          : "Profile updated locally.";
      }
    }

    function previewSelectedImage(file, previousProfile) {
      var reader = new FileReader();
      reader.onload = function (event) {
        var previewDataUrl = String(event && event.target && event.target.result ? event.target.result : "");
        if (!previewDataUrl) {
          return;
        }

        setProfile({
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
        Promise.resolve(saveProfileData())
          .finally(function () {
            closePanel();
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
          note.textContent = "Uploading and optimizing profile image...";
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
                    if (note) {
                      note.textContent = "Storage bucket is missing, so profile image was saved in profile data fallback.";
                    }
                  })
                  .catch(function () {
                    setProfile(previousProfile);
                    renderProfileChip();
                    if (note) {
                      note.textContent = "Profile image upload failed.";
                    }
                  });
                return;
              }
            }

            setProfile(previousProfile);
            renderProfileChip();

            if (!note) {
              return;
            }

            if (auth && typeof auth.toPublicError === "function") {
              note.textContent = auth.toPublicError(error, "Profile image upload failed.");
            } else {
              note.textContent = String(
                error && error.message ? error.message : "Profile image upload failed."
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
        if (note) {
          note.textContent = "Image is too large. Please choose a file under 5 MB.";
        }
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
    logout: function () {
      performLogout();
    },
  };
})();
