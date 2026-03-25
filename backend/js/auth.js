(function () {
  "use strict";

  var STORAGE_SESSION = "vrs_auth_session";
  var STORAGE_PROFILE = "vrs_profile";
  var STORAGE_ATTEMPTS = "vrs_login_attempts";
  var MAX_ATTEMPTS_WARNING = 3;

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
