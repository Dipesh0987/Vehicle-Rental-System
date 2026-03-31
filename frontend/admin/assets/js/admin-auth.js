(function () {
  "use strict";

  var STORAGE_KEY = "vrs_admin_session";
  var SESSION_TTL_MS = 1000 * 60 * 60 * 12;
  var ADMIN_USERNAME = "admin";
  var ADMIN_PASSWORD = "admin123";

  function parseSafe(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function normalizeSession(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    var username = String(value.username || "").trim().toLowerCase();
    var issuedAt = Number(value.issuedAt || 0);
    var expiresAt = Number(value.expiresAt || 0);

    if (!username || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
      return null;
    }

    return {
      username: username,
      role: String(value.role || "admin"),
      issuedAt: issuedAt,
      expiresAt: expiresAt,
    };
  }

  function readStoredSession() {
    var fromSession = parseSafe(window.sessionStorage.getItem(STORAGE_KEY));
    var fromLocal = parseSafe(window.localStorage.getItem(STORAGE_KEY));
    return normalizeSession(fromSession) || normalizeSession(fromLocal);
  }

  function getSession() {
    var session = readStoredSession();
    if (!session) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }

    if (session.username !== ADMIN_USERNAME) {
      clearSession();
      return null;
    }

    return session;
  }

  function isAuthenticated() {
    return Boolean(getSession());
  }

  function persistSession(session, rememberMe) {
    var raw = JSON.stringify(session);

    if (rememberMe) {
      window.localStorage.setItem(STORAGE_KEY, raw);
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(STORAGE_KEY, raw);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function clearSession() {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  }

  function getPathInfo() {
    var pathname = String(window.location.pathname || "").toLowerCase();
    var fileName = pathname.split("/").pop();

    return {
      pathname: pathname,
      fileName: fileName,
      isAdminPath: pathname.indexOf("/admin") >= 0,
    };
  }

  function isLoginPage() {
    var info = getPathInfo();

    if (!info.isAdminPath) {
      return false;
    }

    return info.fileName === "login.html";
  }

  function isDashboardPage() {
    var info = getPathInfo();

    if (!info.isAdminPath) {
      return false;
    }

    return info.fileName === "index.html" || info.fileName === "admin" || info.fileName === "";
  }

  function redirectToDashboard() {
    window.location.replace("index.html");
  }

  function redirectToLogin() {
    window.location.replace("login.html");
  }

  async function signIn(payload) {
    var username = String(payload && payload.username ? payload.username : "").trim().toLowerCase();
    var password = String(payload && payload.password ? payload.password : "");
    var rememberMe = payload && payload.rememberMe !== false;

    if (!username || !password) {
      throw new Error("Please enter admin username and password.");
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      throw new Error("Invalid admin username or password.");
    }

    var issuedAt = Date.now();
    var nextSession = {
      username: ADMIN_USERNAME,
      role: "admin",
      issuedAt: issuedAt,
      expiresAt: issuedAt + SESSION_TTL_MS,
    };

    persistSession(nextSession, rememberMe);
    return nextSession;
  }

  function signOut() {
    clearSession();
    redirectToLogin();
  }

  function guardCurrentPage() {
    var authed = isAuthenticated();

    if (isLoginPage() && authed) {
      redirectToDashboard();
      return false;
    }

    if (isDashboardPage() && !authed) {
      redirectToLogin();
      return false;
    }

    return true;
  }

  window.AdminAuth = {
    getSession: getSession,
    isAuthenticated: isAuthenticated,
    signIn: signIn,
    signOut: signOut,
    clearSession: clearSession,
    guardCurrentPage: guardCurrentPage,
    credentials: {
      username: ADMIN_USERNAME,
    },
  };

  guardCurrentPage();
})();
