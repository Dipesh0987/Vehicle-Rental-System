(function () {
  "use strict";

  var DEFAULT_ADMIN_USERNAME = "admin";
  var DEFAULT_ADMIN_EMAIL = "admin.bootstrap@vehicle-rental.local";
  var LEGACY_ADMIN_EMAIL = "admin@vehicle-rental.local";
  var DEFAULT_ADMIN_PASSWORD = "admin123";
  var LOGIN_PAGE = "login.html";
  var DASHBOARD_PAGE = "index.html";

  function getAdminBasePath() {
    var path = String(window.location.pathname || "");
    if (!path) {
      return "/admin/";
    }

    var parts = path.split("/");
    for (var i = parts.length - 1; i >= 0; i -= 1) {
      if (String(parts[i] || "").toLowerCase() === "admin") {
        return parts.slice(0, i + 1).join("/") + "/";
      }
    }

    if (path.charAt(path.length - 1) === "/") {
      return path;
    }

    var slash = path.lastIndexOf("/");
    if (slash >= 0) {
      return path.slice(0, slash + 1);
    }

    return "/";
  }

  function buildAdminUrl(path) {
    var safePath = sanitizeNextPath(path || DASHBOARD_PAGE);
    var base = window.location.origin + getAdminBasePath();
    return new URL(safePath, base).toString();
  }

  function trim(value) {
    return String(value || "").trim();
  }

  function toLower(value) {
    return trim(value).toLowerCase();
  }

  function getSessionEmail(session) {
    return toLower(session && session.user ? session.user.email : "");
  }

  function isBootstrapAdminSession(session) {
    var email = getSessionEmail(session);
    return email === DEFAULT_ADMIN_EMAIL || email === LEGACY_ADMIN_EMAIL;
  }

  function getErrorMessage(error) {
    return String(error && error.message ? error.message : "").toLowerCase();
  }

  function isMissingAdminUsersTableError(error) {
    var message = getErrorMessage(error);
    return (
      message.indexOf("public.admin_users") >= 0 ||
      (message.indexOf("admin_users") >= 0 && message.indexOf("schema cache") >= 0) ||
      (message.indexOf("relation") >= 0 && message.indexOf("admin_users") >= 0 && message.indexOf("does not exist") >= 0)
    );
  }

  function isInvalidCredentialsError(error) {
    return getErrorMessage(error).indexOf("invalid login credentials") >= 0;
  }

  function isUnexpectedSchemaError(error) {
    var message = getErrorMessage(error);
    var code = toLower(error && (error.code || error.error_code));
    return (
      code === "unexpected_failure" ||
      (message.indexOf("database error") >= 0 && message.indexOf("schema") >= 0)
    );
  }

  function isAlreadyRegisteredError(error) {
    var message = getErrorMessage(error);
    return message.indexOf("already registered") >= 0 || message.indexOf("already been registered") >= 0;
  }

  function isEmailNotConfirmedError(error) {
    return getErrorMessage(error).indexOf("email not confirmed") >= 0;
  }

  function isNetworkError(error) {
    var message = getErrorMessage(error);
    return message.indexOf("failed to fetch") >= 0 || message.indexOf("network") >= 0;
  }

  function toPublicError(error, fallbackMessage) {
    if (!error) {
      return fallbackMessage || "Unable to complete admin authentication right now.";
    }

    if (isInvalidCredentialsError(error)) {
      return "Invalid admin username or password.";
    }

    if (isUnexpectedSchemaError(error)) {
      return "Legacy admin account is corrupted in Supabase Auth. Use username admin with password admin123 and retry; the app will bootstrap a fresh admin auth account automatically.";
    }

    if (isEmailNotConfirmedError(error)) {
      return "Admin email is not confirmed. Run migration 007_admin_super_admin_bootstrap.sql to bootstrap a confirmed super-admin account.";
    }

    if (isMissingAdminUsersTableError(error)) {
      return "Admin access table is missing. Run migrations 004_vehicle_catalog.sql and 007_admin_super_admin_bootstrap.sql.";
    }

    if (isNetworkError(error)) {
      return "Network issue detected while reaching Supabase. Please retry in a moment.";
    }

    var message = getErrorMessage(error);
    if (message.indexOf("not authorized") >= 0 || message.indexOf("not authorised") >= 0) {
      return "Your account is signed in but is not authorized for the admin panel.";
    }

    return fallbackMessage || String(error.message || "Unable to complete admin authentication right now.");
  }

  function sanitizeNextPath(nextPath) {
    var candidate = trim(nextPath || "");

    if (!candidate) {
      return DASHBOARD_PAGE;
    }

    if (candidate.indexOf("://") >= 0 || candidate.indexOf("\\") >= 0 || candidate.indexOf("..") >= 0) {
      return DASHBOARD_PAGE;
    }

    if (candidate.charAt(0) === "/") {
      candidate = candidate.slice(1);
    }

    if (!candidate || candidate.toLowerCase().indexOf("login.html") === 0) {
      return DASHBOARD_PAGE;
    }

    return candidate;
  }

  function getCurrentPagePath() {
    var path = String(window.location.pathname || "");
    var leaf = path.split("/").filter(Boolean).pop() || DASHBOARD_PAGE;
    var search = String(window.location.search || "");
    return sanitizeNextPath(leaf + search);
  }

  function buildLoginUrl(nextPath) {
    var safeNext = sanitizeNextPath(nextPath || getCurrentPagePath());
    var base = window.location.origin + getAdminBasePath();
    var loginUrl = new URL(LOGIN_PAGE, base);
    loginUrl.searchParams.set("next", safeNext);
    return loginUrl.toString();
  }

  function getAuthService() {
    return window.VehicleAuthService || null;
  }

  async function getClient() {
    var auth = getAuthService();
    if (auth && typeof auth.getClient === "function") {
      return auth.getClient();
    }

    if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
      return window.SupabaseRuntime.client;
    }

    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      throw new Error("Supabase client runtime is unavailable.");
    }

    return window.SupabaseClient.init();
  }

  async function getSession() {
    var auth = getAuthService();
    if (auth && typeof auth.getSession === "function") {
      return auth.getSession();
    }

    var client = await getClient();
    var result = await client.auth.getSession();
    if (result.error) {
      throw result.error;
    }

    return result.data && result.data.session ? result.data.session : null;
  }

  async function checkAdminAccess() {
    var session = await getSession();

    if (!session || !session.user) {
      return {
        allowed: false,
        reason: "NO_SESSION",
        session: null,
        admin: null,
      };
    }

    if (isBootstrapAdminSession(session)) {
      return {
        allowed: true,
        reason: "OK",
        session: session,
        admin: {
          user_id: session.user.id,
          role: "super_admin",
          is_active: true,
          created_at: null,
          source: "bootstrap",
        },
      };
    }

    return {
      allowed: false,
      reason: "NOT_ADMIN",
      session: session,
      admin: null,
    };
  }

  function redirectToLogin(nextPath) {
    window.location.replace(buildLoginUrl(nextPath));
  }

  async function requireAdminAccess(options) {
    var config = options || {};

    try {
      var access = await checkAdminAccess();

      if (!access.allowed && config.redirectIfUnauthorized) {
        redirectToLogin(config.nextPath || getCurrentPagePath());
      }

      return access;
    } catch (error) {
      if (config.redirectIfUnauthorized) {
        redirectToLogin(config.nextPath || getCurrentPagePath());
      }

      return {
        allowed: false,
        reason: "ERROR",
        error: error,
        session: null,
        admin: null,
      };
    }
  }

  async function signInWithUsername(payload) {
    var username = toLower(payload && payload.username);
    var password = String((payload && payload.password) || "");

    if (!username || !password) {
      throw new Error("Username and password are required.");
    }

    if (username !== DEFAULT_ADMIN_USERNAME) {
      throw new Error("Invalid admin username or password.");
    }

    var auth = getAuthService();
    if (!auth || typeof auth.signIn !== "function") {
      throw new Error("Auth service is unavailable on this page.");
    }

    async function signInByEmail(email) {
      return auth.signIn({
        email: email,
        password: password,
      });
    }

    async function bootstrapAdminIfNeeded() {
      if (password !== DEFAULT_ADMIN_PASSWORD) {
        return false;
      }

      var client = await getClient();
      var signUpResult = await client.auth.signUp({
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD,
        options: {
          data: {
            full_name: "Platform Super Admin",
            display_name: "Admin",
            username: DEFAULT_ADMIN_USERNAME,
          },
        },
      });

      if (signUpResult.error && !isAlreadyRegisteredError(signUpResult.error)) {
        throw signUpResult.error;
      }

      return true;
    }

    var signInError = null;

    try {
      await signInByEmail(DEFAULT_ADMIN_EMAIL);
    } catch (error) {
      signInError = error;
    }

    if (signInError) {
      var canBootstrap = isInvalidCredentialsError(signInError) || isUnexpectedSchemaError(signInError);

      if (canBootstrap) {
        await bootstrapAdminIfNeeded();

        try {
          await signInByEmail(DEFAULT_ADMIN_EMAIL);
          signInError = null;
        } catch (retryError) {
          signInError = retryError;
        }
      }
    }

    if (signInError && password === DEFAULT_ADMIN_PASSWORD) {
      try {
        await signInByEmail(LEGACY_ADMIN_EMAIL);
        signInError = null;
      } catch (legacyError) {
        signInError = legacyError;
      }
    }

    if (signInError) {
      throw signInError;
    }

    var access = await checkAdminAccess();
    if (!access.allowed) {
      try {
        await auth.signOut();
      } catch (_signOutError) {
        // Best effort cleanup.
      }

      if (access.reason === "NOT_ADMIN") {
        throw new Error("Signed-in account is not authorized as admin.");
      }

      throw new Error("Admin access verification failed.");
    }

    return access;
  }

  async function signOut() {
    var auth = getAuthService();
    if (auth && typeof auth.signOut === "function") {
      return auth.signOut();
    }

    var client = await getClient();
    var result = await client.auth.signOut();
    if (result.error) {
      throw result.error;
    }
  }

  function getDisplayNameFromSession(session) {
    if (!session || !session.user) {
      return "Admin";
    }

    var metadata = session.user.user_metadata || {};
    var fullName = trim(metadata.full_name || metadata.display_name);
    if (fullName) {
      return fullName;
    }

    var email = trim(session.user.email || "");
    if (!email) {
      return "Admin";
    }

    var left = email.split("@")[0] || "Admin";
    return left.replace(/[._-]+/g, " ").replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  }

  function getInitials(name) {
    var cleaned = trim(name);
    if (!cleaned) {
      return "AD";
    }

    var parts = cleaned.split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return "AD";
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  async function getAdminIdentity() {
    var access = await checkAdminAccess();
    if (!access.allowed) {
      return null;
    }

    var displayName = getDisplayNameFromSession(access.session);

    return {
      displayName: displayName,
      email: String(access.session.user.email || ""),
      role: access.admin && access.admin.role === "super_admin" ? "Super Admin" : "Admin",
      initials: getInitials(displayName),
      userId: String(access.session.user.id || ""),
    };
  }

  window.AdminAuthService = {
    defaultUsername: DEFAULT_ADMIN_USERNAME,
    defaultEmail: DEFAULT_ADMIN_EMAIL,
    dashboardPage: DASHBOARD_PAGE,
    loginPage: LOGIN_PAGE,
    buildAdminUrl: buildAdminUrl,
    toPublicError: toPublicError,
    sanitizeNextPath: sanitizeNextPath,
    buildLoginUrl: buildLoginUrl,
    getClient: getClient,
    getSession: getSession,
    checkAdminAccess: checkAdminAccess,
    requireAdminAccess: requireAdminAccess,
    signInWithUsername: signInWithUsername,
    signOut: signOut,
    getAdminIdentity: getAdminIdentity,
  };
})();
