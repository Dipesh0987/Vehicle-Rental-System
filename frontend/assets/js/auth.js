(function () {
  "use strict";

  var STORAGE_SESSION = "vrs_auth_session";
  var STORAGE_PROFILE = "vrs_profile";

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

  function init(_pageType) {
    // Full UI behavior is wired in follow-up commits.
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
