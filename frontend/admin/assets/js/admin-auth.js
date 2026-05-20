(function () {
  "use strict";

  var STORAGE_KEY = "vrs_admin_session";
  var SESSION_TTL_MS = 1000 * 60 * 60 * 12;
  var ADMIN_USERNAME = "admin";
  var DEFAULT_ADMIN_EMAILS = [
    "admin@vehicle-rental.local",
  ];

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
  }

  function titleCaseWords(value) {
    var parts = String(value || "")
      .split(" ")
      .filter(function (item) {
        return Boolean(item);
      });

    return parts
      .map(function (item) {
        return item.charAt(0).toUpperCase() + item.slice(1).toLowerCase();
      })
      .join(" ");
  }

  function isReservedDisplayName(value) {
    var normalized = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (!normalized) {
      return false;
    }

    return normalized.indexOf("super admin") >= 0 || normalized.indexOf("platform admin") >= 0;
  }

  function formatDisplayName(value) {
    var raw = normalizeText(value);
    if (!raw) {
      return "Admin";
    }

    var source = raw.indexOf("@") >= 0 ? raw.split("@")[0] : raw;
    var cleaned = source.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return "Admin";
    }

    if (isReservedDisplayName(cleaned)) {
      return "Admin";
    }

    return titleCaseWords(cleaned);
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
      // Accept any email — admin check happens via DB after Supabase auth succeeds
      return [username];
    }

    if (username !== ADMIN_USERNAME) {
      throw new Error("Use your admin email address or the 'admin' username alias.");
    }

    return allowedEmails;
  }

  async function checkDatabaseAdminRole() {
    try {
      if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
        return false;
      }
      var client = await window.SupabaseClient.init();
      var result = await client.rpc("is_admin_user");
      return result.data === true && !result.error;
    } catch (_e) {
      return false;
    }
  }

  function getAuthService() {
    if (window.VehicleAuthService && typeof window.VehicleAuthService === "object") {
      return window.VehicleAuthService;
    }

    return null;
  }

  function splitPathSegments(pathname) {
    return String(pathname || "")
      .toLowerCase()
      .split("?")[0]
      .split("#")[0]
      .split("/");
  }

  function hasAdminPathSegment(pathname) {
    return splitPathSegments(pathname).indexOf("admin") >= 0;
  }

  function resolveAdminBasePathFromPathname(pathname) {
    var parts = splitPathSegments(pathname);
    var adminIndex = -1;

    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i] === "admin") {
        adminIndex = i;
      }
    }

    if (adminIndex < 0) {
      return "/admin/";
    }

    var basePath = parts.slice(0, adminIndex + 1).join("/");
    if (!basePath || basePath.charAt(0) !== "/") {
      basePath = "/" + basePath;
    }

    return basePath.charAt(basePath.length - 1) === "/" ? basePath : basePath + "/";
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
    var loginIdentifier = normalizeText(value.loginIdentifier);
    var displayName = normalizeText(value.displayName);
    var issuedAt = Number(value.issuedAt || 0);
    var expiresAt = Number(value.expiresAt || 0);

    if (!username || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
      return null;
    }

    return {
      username: username,
      email: email,
      userId: userId,
      loginIdentifier: loginIdentifier,
      displayName: displayName,
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

  function getDisplayName() {
    var session = getSession();
    if (!session) {
      return "Admin";
    }

    return formatDisplayName(
      session.displayName || session.loginIdentifier || session.username || "Admin"
    );
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
      isAdminPath: hasAdminPathSegment(pathname),
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

  function resolveAdminBasePath() {
    var info = getPathInfo();
    return resolveAdminBasePathFromPathname(info.pathname);
  }

  function buildAdminUrl(fileName) {
    var cleanFile = normalizeText(fileName || "").replace(/^\/+/, "") || "index.html";
    return resolveAdminBasePath() + cleanFile;
  }

  function redirectToDashboard() {
    window.location.replace(buildAdminUrl("index.html"));
  }

  function redirectToLogin() {
    window.location.replace(buildAdminUrl("login.html"));
  }

  async function signIn(payload) {
    var auth = getAuthService();
    if (!auth || typeof auth.signIn !== "function") {
      throw new Error("Admin auth service is unavailable. Check Supabase scripts and configuration.");
    }

    var usernameInput = normalizeText(payload && payload.username ? payload.username : "");
    var password = String(payload && payload.password ? payload.password : "");
    var rememberMe = Boolean(payload && payload.rememberMe === true);

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
    var userMetadata = user && user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
    var metadataName = normalizeText(
      userMetadata.full_name || userMetadata.fullName || userMetadata.name
    );
    var displayName = metadataName ? formatDisplayName(metadataName) : "";
    if (!displayName || displayName === "Admin") {
      if (usernameInput.indexOf("@") >= 0) {
        displayName = "Admin";
      } else {
        displayName = formatDisplayName(usernameInput || ADMIN_USERNAME);
      }
    }

    if (!isAllowedAdminEmail(authenticatedEmail)) {
      // Check app_metadata.role from the JWT (set in Supabase Dashboard -> Auth -> Users)
      var appMeta = user && user.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : {};
      var hasAdminAppRole = normalizeLower(appMeta.role || "") === "admin" || normalizeLower(appMeta.role || "") === "super_admin";

      if (!hasAdminAppRole) {
        // Final fallback: verify via database RPC
        var dbAdmin = await checkDatabaseAdminRole();
        if (!dbAdmin) {
          if (typeof auth.signOut === "function") {
            try {
              await auth.signOut();
            } catch (_signOutError) {
              // Best effort sign-out.
            }
          }
          throw new Error("Access denied. This account is not authorised to access the admin panel. Please contact your system administrator.");
        }
      }
    }

    var issuedAt = Date.now();
    var nextSession = {
      username: ADMIN_USERNAME,
      email: authenticatedEmail,
      userId: normalizeText(user && user.id ? user.id : ""),
      loginIdentifier: usernameInput,
      displayName: displayName,
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

  async function verifyRuntimeAdminSession() {
    var localSession = getSession();
    if (!localSession) {
      return false;
    }

    var auth = getAuthService();
    if (!auth || typeof auth.getSession !== "function") {
      clearSession();
      return false;
    }

    try {
      var runtimeSession = await auth.getSession();
      var runtimeUser = runtimeSession && runtimeSession.user ? runtimeSession.user : null;
      var runtimeEmail = normalizeLower(runtimeUser && runtimeUser.email ? runtimeUser.email : "");
      var runtimeUserId = normalizeText(runtimeUser && runtimeUser.id ? runtimeUser.id : "");

      if (!runtimeUser || !runtimeEmail) {
        clearSession();
        return false;
      }

      if (!isAllowedAdminEmail(runtimeEmail)) {
        // Check app_metadata.role from live session
        var appMeta = runtimeUser.app_metadata && typeof runtimeUser.app_metadata === "object" ? runtimeUser.app_metadata : {};
        var hasAdminAppRole = normalizeLower(appMeta.role || "") === "admin" || normalizeLower(appMeta.role || "") === "super_admin";

        if (!hasAdminAppRole) {
          var dbAdmin = await checkDatabaseAdminRole();
          if (!dbAdmin) {
            clearSession();
            return false;
          }
        }
      }

      if (localSession.email && localSession.email !== runtimeEmail) {
        clearSession();
        return false;
      }

      if (localSession.userId && runtimeUserId && localSession.userId !== runtimeUserId) {
        clearSession();
        return false;
      }

      return true;
    } catch (_error) {
      clearSession();
      return false;
    }
  }

  function guardCurrentPage() {
    var isLogin = isLoginPage();
    var isDashboard = isDashboardPage();
    var authed = isAuthenticated();

    if (!isLogin && !isDashboard) {
      return true;
    }

    if (isDashboard && !authed) {
      redirectToLogin();
      return false;
    }

    if (isDashboard) {
      var auth = getAuthService();
      if (!auth || typeof auth.getSession !== "function") {
        clearSession();
        redirectToLogin();
        return false;
      }
    }

    verifyRuntimeAdminSession()
      .then(function (valid) {
        if (isDashboard && !valid) {
          redirectToLogin();
          return;
        }

        if (isLogin && valid) {
          redirectToDashboard();
          return;
        }

        if (isLogin && !valid) {
          clearSession();
        }
      })
      .catch(function () {
        if (isDashboard) {
          redirectToLogin();
          return;
        }

        if (isLogin) {
          clearSession();
        }
      });

    return true;
  }

  window.AdminAuth = {
    getSession: getSession,
    getDisplayName: getDisplayName,
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
