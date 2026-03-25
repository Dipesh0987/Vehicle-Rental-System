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

  function setAttempts(value) {
    localStorage.setItem(STORAGE_ATTEMPTS, String(value));
  }

  function getAttempts() {
    var value = Number(localStorage.getItem(STORAGE_ATTEMPTS) || "0");
    return Number.isFinite(value) ? value : 0;
  }

  function resetAttempts() {
    setAttempts(0);
  }

  function getDisplayNameFromEmail(email) {
    var left = String(email || "user").split("@")[0] || "User";
    return left.replace(/[._-]+/g, " ").replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }

  function setBanner(el, message, isError) {
    if (!el) {
      return;
    }

    if (!message) {
      el.className = "mt-4 hidden rounded-xl px-3 py-2 text-[13px]";
      el.textContent = "";
      return;
    }

    el.className = "mt-4 rounded-xl px-3 py-2 text-[13px]";
    if (isError) {
      el.classList.add("bg-[#fde9e9]", "text-[#a43434]", "border", "border-[#e9b8b8]");
    } else {
      el.classList.add("bg-[#e8f5ec]", "text-[#23633f]", "border", "border-[#b5ddc4]");
    }
    el.textContent = message;
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
      forgot.addEventListener("click", function () {
        setBanner(banner, "Forgot password selected. Reset flow will be connected to backend later.", false);
      });
    }

    if (google) {
      google.addEventListener("click", function () {
        setSession({
          email: "google.user@example.com",
          provider: "google",
          loggedInAt: Date.now(),
        });
        setProfile({
          username: "Google User",
          avatarDataUrl: "",
        });
        resetAttempts();
        window.location.href = "dashboard.html";
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setBanner(banner, "", true);

      var email = String(form.email.value || "").trim();
      var password = String(form.password.value || "");

      if (!isValidEmail(email)) {
        setAttempts(getAttempts() + 1);
        setBanner(banner, "Invalid login attempt. Please enter a valid email address.", true);
        return;
      }

      if (password.length < 6) {
        var attempts = getAttempts() + 1;
        setAttempts(attempts);
        var warning = attempts >= MAX_ATTEMPTS_WARNING ? " Multiple invalid attempts detected." : "";
        setBanner(banner, "Invalid login attempt. Password must be at least 6 characters." + warning, true);
        return;
      }

      setSession({
        email: email,
        provider: "password",
        loggedInAt: Date.now(),
      });
      setProfile({
        username: getDisplayNameFromEmail(email),
        avatarDataUrl: "",
      });
      resetAttempts();
      window.location.href = "dashboard.html";
    });
  }

  function protectPage(pageType) {
    var session = getSession();
    if (pageType === "login" && session) {
      window.location.href = "dashboard.html";
      return false;
    }

    if (pageType === "dashboard" && !session) {
      window.location.href = "login.html";
      return false;
    }

    return true;
  }

  function renderDashboardSlot() {
    var slot = document.getElementById("dashboardProfileSlot");
    if (!slot) {
      return;
    }

    var session = getSession();
    if (!session) {
      slot.textContent = "Not signed in";
      return;
    }

    var profile = getProfile();
    slot.textContent = "Signed in as " + (profile.username || "User");
  }

  function init(pageType) {
    if (!protectPage(pageType)) {
      return;
    }

    if (pageType === "login") {
      runLoginFlow();
    }

    if (pageType === "dashboard") {
      renderDashboardSlot();
    }
  }

  window.VehicleAuthUI = {
    init: init,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    getProfile: getProfile,
    setProfile: setProfile,
  };
})();
