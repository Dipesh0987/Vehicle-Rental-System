(function () {
  "use strict";

  var STORAGE_KEY = "vrs_admin_session";
  var SESSION_TTL_MS = 1000 * 60 * 60 * 12;
  var ADMIN_USERNAME = "admin";
  var DEFAULT_ADMIN_EMAILS = [
    "admin.bootstrap@vehicle-rental.local",
    "admin@vehicle-rental.local",
  ];

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
  }

  function normalizeEmailList(source) {
    var values = [];

    if (Array.isArray(source)) {
      values = source;
    } else if (typeof source === "string") {
      values = source.split(",");
    }

    var unique = [];
    for (var i = 0; i < values.length; i += 1) {
      var email = normalizeLower(values[i]);
      if (!email || email.indexOf("@") < 0 || unique.indexOf(email) >= 0) {
        continue;
      }

      unique.push(email);
    }

    return unique;
  }

  function getConfiguredAdminEmails() {
    var localConfig = window.SUPABASE_LOCAL_CONFIG || {};
    var runtimeConfig = window.SUPABASE_CONFIG || {};

    var configured = normalizeEmailList(
      localConfig.adminEmails || runtimeConfig.adminEmails || []
    );

    if (configured.length) {
      return configured;
    }

    return DEFAULT_ADMIN_EMAILS.slice();
  }

  function isAllowedAdminEmail(value) {
    var email = normalizeLower(value);
    if (!email) {
      return false;
    }

    return getConfiguredAdminEmails().indexOf(email) >= 0;
  }

  function resolveAdminEmailCandidates(usernameInput) {
    var username = normalizeLower(usernameInput);
    var allowedEmails = getConfiguredAdminEmails();

    if (!username) {
      return [];
    }

    if (username.indexOf("@") >= 0) {
      if (!isAllowedAdminEmail(username)) {
        throw new Error("This account is not authorized for admin access.");
      }

      return [username];
    }

    if (username !== ADMIN_USERNAME) {
      throw new Error("Use the admin username or an authorized admin email.");
    }

    return allowedEmails;
  }

  function getAuthService() {
    if (window.VehicleAuthService && typeof window.VehicleAuthService === "object") {
      return window.VehicleAuthService;
    }

    return null;
  }

  function mapSignInError(error) {
    var auth = getAuthService();
    var fallback = "Invalid admin credentials.";

    if (auth && typeof auth.toPublicError === "function") {
      var mapped = normalizeText(auth.toPublicError(error, fallback));
      if (mapped) {
        return new Error(mapped);
      }
    }

    var message = normalizeLower(error && error.message ? error.message : "");
    if (message.indexOf("invalid login credentials") >= 0) {
      return new Error(fallback);
    }

    if (message.indexOf("email not confirmed") >= 0) {
      return new Error("Admin account email is not confirmed.");
    }

    return new Error(fallback);
  }

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

    var username = normalizeLower(value.username);
    var email = normalizeLower(value.email);
    var userId = normalizeText(value.userId);
    var issuedAt = Number(value.issuedAt || 0);
    var expiresAt = Number(value.expiresAt || 0);

    if (!username || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
      return null;
    }

    return {
      username: username,
      email: email,
      userId: userId,
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

    if (session.email && !isAllowedAdminEmail(session.email)) {
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
    var auth = getAuthService();
    if (!auth || typeof auth.signIn !== "function") {
      throw new Error("Admin auth service is unavailable. Check Supabase scripts and configuration.");
    }

    var usernameInput = normalizeText(payload && payload.username ? payload.username : "");
    var password = String(payload && payload.password ? payload.password : "");
    var rememberMe = payload && payload.rememberMe !== false;

    if (!usernameInput || !password) {
      throw new Error("Please enter admin username and password.");
    }

    var emailCandidates = resolveAdminEmailCandidates(usernameInput);
    if (!emailCandidates.length) {
      throw new Error("No admin email mapping found. Configure adminEmails in supabase.config.local.js.");
    }

    var authData = null;
    var signedInEmail = "";
    var lastError = null;

    for (var i = 0; i < emailCandidates.length; i += 1) {
      var email = emailCandidates[i];

      try {
        authData = await auth.signIn({
          email: email,
          password: password,
        });
        signedInEmail = email;
        break;
      } catch (error) {
        lastError = error;

        var message = normalizeLower(error && error.message ? error.message : "");
        if (message.indexOf("not authorized for admin access") >= 0) {
          throw error;
        }
      }
    }

    if (!authData) {
      throw mapSignInError(lastError);
    }

    var user = authData && authData.user ? authData.user : (authData && authData.session && authData.session.user ? authData.session.user : null);
    var authenticatedEmail = normalizeLower(user && user.email ? user.email : signedInEmail);

    if (!isAllowedAdminEmail(authenticatedEmail)) {
      if (typeof auth.signOut === "function") {
        try {
          await auth.signOut();
        } catch (_signOutError) {
          // Best effort sign-out.
        }
      }

      throw new Error("This account is not authorized for admin access.");
    }

    var issuedAt = Date.now();
    var nextSession = {
      username: ADMIN_USERNAME,
      email: authenticatedEmail,
      userId: normalizeText(user && user.id ? user.id : ""),
      role: "admin",
      issuedAt: issuedAt,
      expiresAt: issuedAt + SESSION_TTL_MS,
    };

    persistSession(nextSession, rememberMe);
    return nextSession;
  }

  function signOut() {
    var auth = getAuthService();

    clearSession();

    if (!auth || typeof auth.signOut !== "function") {
      redirectToLogin();
      return;
    }

    auth.signOut()
      .catch(function () {
        // Ignore sign-out transport failures and still clear local admin state.
      })
      .finally(redirectToLogin);
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
      adminEmails: getConfiguredAdminEmails(),
    },
  };

  guardCurrentPage();
})();
