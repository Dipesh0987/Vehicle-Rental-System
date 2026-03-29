(function () {
  "use strict";

  var STORAGE_SESSION = "vrs_auth_session";
  var STORAGE_PROFILE = "vrs_profile";
  var STORAGE_ATTEMPTS = "vrs_login_attempts";
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

  function getProfile() {
    var fallback = {
      username: "Guest User",
      avatarDataUrl: "",
    };

    return Object.assign(fallback, safeParse(localStorage.getItem(STORAGE_PROFILE), {}));
  }

  function setProfile(profile) {
    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
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
    }

    renderProfileChip();
  }

  function renderProfileChip() {
    var profile = getProfile();
    var nameEl = document.querySelector("[data-profile-name]");
    var avatarEl = document.querySelector("[data-profile-avatar]");

    if (nameEl) {
      nameEl.textContent = profile.username || "User";
    }

    if (avatarEl) {
      avatarEl.innerHTML = "";
      if (profile.avatarDataUrl) {
        var img = document.createElement("img");
        img.src = profile.avatarDataUrl;
        img.alt = "Profile image";
        img.className = "h-full w-full object-cover";
        avatarEl.appendChild(img);
      } else {
        avatarEl.textContent = getInitials(profile.username);
      }
    }

    var panelName = document.getElementById("profileName");
    if (panelName && !panelName.value) {
      panelName.value = profile.username || "User";
    }
  }

  function wireProfilePanel() {
    var trigger = document.querySelector("[data-profile-trigger]");
    var panel = document.querySelector("[data-profile-panel]");

    if (!trigger || !panel) {
      return;
    }

    function openPanel() {
      panel.classList.remove("opacity-0", "-translate-y-2", "scale-95", "pointer-events-none");
      panel.classList.add("opacity-100", "translate-y-0", "scale-100", "pointer-events-auto");
    }

    function closePanel() {
      panel.classList.remove("opacity-100", "translate-y-0", "scale-100", "pointer-events-auto");
      panel.classList.add("opacity-0", "-translate-y-2", "scale-95", "pointer-events-none");
    }

    trigger.addEventListener("click", function () {
      if (panel.classList.contains("opacity-100")) {
        closePanel();
      } else {
        openPanel();
      }
    });

    document.addEventListener("click", function (event) {
      if (!panel.contains(event.target) && !trigger.contains(event.target)) {
        closePanel();
      }
    });

    var saveBtn = document.getElementById("saveProfile");
    var nameInput = document.getElementById("profileName");
    var photoInput = document.getElementById("profilePhoto");
    var note = document.getElementById("profileNote");

    function saveProfileData(avatarDataUrl) {
      var current = getProfile();
      var nextProfile = {
        username: (nameInput && nameInput.value.trim()) || current.username || "User",
        avatarDataUrl: avatarDataUrl !== undefined ? avatarDataUrl : current.avatarDataUrl,
      };

      setProfile(nextProfile);
      renderProfileChip();
      if (note) {
        note.textContent = "Profile updated.";
      }
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        saveProfileData();
        closePanel();
      });
    }

    if (photoInput) {
      photoInput.addEventListener("change", function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) {
          return;
        }

        var reader = new FileReader();
        reader.onload = function (event) {
          saveProfileData(String(event.target && event.target.result ? event.target.result : ""));
        };
        reader.readAsDataURL(file);
      });
    }

    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        clearSession();
        window.location.href = "index.html";
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
    var forgotPanel = document.getElementById("forgotPanel");
    var resetEmail = document.getElementById("resetEmail");
    var sendReset = document.getElementById("sendResetLink");
    var cancelReset = document.getElementById("cancelReset");
    var rememberMe = document.getElementById("rememberMe");
    var passwordInput = document.getElementById("password");
    var passwordToggle = document.getElementById("passwordToggle");
    var eyeOpenIcon = document.getElementById("eyeOpenIcon");
    var eyeOffIcon = document.getElementById("eyeOffIcon");
    var google = document.getElementById("googleSignIn");

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

    function openForgotPanel() {
      if (!forgotPanel) {
        return;
      }

      forgotPanel.classList.remove("mt-[-0.25rem]", "max-h-0", "opacity-0", "-translate-y-2", "pointer-events-none");
      forgotPanel.classList.add("mt-0", "max-h-52", "opacity-100", "translate-y-0", "pointer-events-auto");
      forgotPanel.setAttribute("aria-hidden", "false");
      if (forgot) {
        forgot.setAttribute("aria-expanded", "true");
      }
    }

    function closeForgotPanel() {
      if (!forgotPanel) {
        return;
      }

      forgotPanel.classList.remove("mt-0", "max-h-52", "opacity-100", "translate-y-0", "pointer-events-auto");
      forgotPanel.classList.add("mt-[-0.25rem]", "max-h-0", "opacity-0", "-translate-y-2", "pointer-events-none");
      forgotPanel.setAttribute("aria-hidden", "true");
      if (forgot) {
        forgot.setAttribute("aria-expanded", "false");
      }
    }

    if (forgot) {
      forgot.addEventListener("click", function (event) {
        event.preventDefault();

        if (!forgotPanel) {
          return;
        }

        var isOpen = forgotPanel.classList.contains("max-h-52");
        if (!isOpen) {
          openForgotPanel();

          if (resetEmail) {
            var currentEmail = String(form.email.value || "").trim();
            if (currentEmail) {
              resetEmail.value = currentEmail;
            }
            resetEmail.focus();
          }
        } else {
          closeForgotPanel();
        }

        setBanner(banner, "", "error");
      });
    }

    if (sendReset) {
      sendReset.addEventListener("click", function () {
        var email = String(resetEmail && resetEmail.value ? resetEmail.value : form.email.value || "").trim();

        if (!isValidEmail(email)) {
          setBanner(banner, "Enter a valid email before sending a reset link.", "error");
          return;
        }

        if (form.email && !form.email.value) {
          form.email.value = email;
        }

        setBanner(banner, "Reset link sent to " + email + ". Please check your inbox.", "success");
        closeForgotPanel();
      });
    }

    if (cancelReset) {
      cancelReset.addEventListener("click", function () {
        closeForgotPanel();
      });
    }

    if (google) {
      google.addEventListener("click", function () {
        var googleUser = {
          email: "google.user@example.com",
          provider: "google",
          loggedInAt: Date.now(),
        };

        setSession(googleUser, rememberMe ? rememberMe.checked : true);
        setProfile({
          username: "Google User",
          avatarDataUrl: "",
        });
        resetAttempts();
        window.location.href = "index.html";
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setBanner(banner, "", "error");

      var email = String(form.email.value || "").trim();
      var password = String(form.password.value || "");

      if (!isValidEmail(email)) {
        setAttempts(attemptsValue() + 1);
        setBanner(banner, "Please enter a valid email address.", "error");
        return;
      }

      if (password.length < 6) {
        var badAttempts = attemptsValue() + 1;
        setAttempts(badAttempts);
        var base = "Invalid login attempt. Password must be at least 6 characters.";
        var message = badAttempts >= MAX_ATTEMPTS_WARNING
          ? base + " Multiple failed attempts detected."
          : base;
        setBanner(banner, message, "error");
        return;
      }

      var session = {
        email: email,
        provider: "password",
        loggedInAt: Date.now(),
      };

      setSession(session, rememberMe ? rememberMe.checked : true);
      setProfile({
        username: getDisplayNameFromEmail(email),
        avatarDataUrl: getProfile().avatarDataUrl || "",
      });
      resetAttempts();
      window.location.href = "index.html";
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

    renderNavbarAuth();
    wireProfilePanel();
    wireBookingsModal();

    if (pageType === "login") {
      runLoginFlow();
    }
  }

  window.VehicleAuthUI = {
    init: init,
    logout: function () {
      clearSession();
      window.location.href = "index.html";
    },
  };
})();
