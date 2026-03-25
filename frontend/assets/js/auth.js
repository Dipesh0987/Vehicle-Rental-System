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
    return safeParse(localStorage.getItem(STORAGE_SESSION), null);
  }

  function setSession(session) {
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_SESSION);
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

    if (!message) {
      el.textContent = "";
      el.classList.add("hidden");
      el.classList.remove("error-banner", "success-banner");
      return;
    }

    el.textContent = message;
    el.classList.remove("hidden", "error-banner", "success-banner");
    el.classList.add(mode === "success" ? "success-banner" : "error-banner");
  }

  function renderNavbarAuth() {
    var session = getSession();
    var guest = document.querySelector("[data-auth-guest]");
    var user = document.querySelector("[data-auth-user]");

    if (session) {
      if (guest) {
        guest.classList.add("hidden");
      }
      if (user) {
        user.classList.remove("hidden");
      }
    } else {
      if (guest) {
        guest.classList.remove("hidden");
      }
      if (user) {
        user.classList.add("hidden");
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

    trigger.addEventListener("click", function () {
      panel.classList.toggle("open");
    });

    document.addEventListener("click", function (event) {
      if (!panel.contains(event.target) && !trigger.contains(event.target)) {
        panel.classList.remove("open");
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
    var google = document.getElementById("googleSignIn");

    if (forgot) {
      forgot.addEventListener("click", function (event) {
        event.preventDefault();
        setBanner(
          banner,
          "Forgot password clicked. Backend reset flow will be connected later.",
          "success"
        );
      });
    }

    if (google) {
      google.addEventListener("click", function () {
        var googleUser = {
          email: "google.user@example.com",
          provider: "google",
          loggedInAt: Date.now(),
        };

        setSession(googleUser);
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

      setSession(session);
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
