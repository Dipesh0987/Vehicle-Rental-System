(function () {
  "use strict";

  var clientInitPromise = null;

  function trim(value) {
    return String(value || "").trim();
  }

  function isPlaceholderValue(value) {
    var normalized = trim(value).toLowerCase();
    if (!normalized) {
      return true;
    }

    return (
      normalized.indexOf("your_project_id") >= 0 ||
      normalized.indexOf("your_supabase_anon_key") >= 0 ||
      normalized.indexOf("replace_with") >= 0
    );
  }

  function isUsableConfigValue(value) {
    return trim(value) !== "" && !isPlaceholderValue(value);
  }

  function resolveConfig() {
    var runtimeConfig = window.SUPABASE_CONFIG || {};
    var localConfig = window.SUPABASE_LOCAL_CONFIG || {};
    var runtimeUrl = trim(runtimeConfig.url);
    var runtimeAnonKey = trim(runtimeConfig.anonKey);
    var localUrl = trim(localConfig.url);
    var localAnonKey = trim(localConfig.anonKey);
    var useLocalCredentials = isUsableConfigValue(localUrl) && isUsableConfigValue(localAnonKey);

    var resolved = {
      url: useLocalCredentials ? localUrl : runtimeUrl,
      anonKey: useLocalCredentials ? localAnonKey : runtimeAnonKey,
      profileImageBucket: trim(localConfig.profileImageBucket || runtimeConfig.profileImageBucket),
      projectLabel: trim(localConfig.projectLabel || runtimeConfig.projectLabel),
    };

    if (!isUsableConfigValue(resolved.url) && isUsableConfigValue(localUrl)) {
      resolved.url = localUrl;
    }

    if (!isUsableConfigValue(resolved.anonKey) && isUsableConfigValue(localAnonKey)) {
      resolved.anonKey = localAnonKey;
    }

    return resolved;
  }

  function hasConfig() {
    var config = resolveConfig();
    return isUsableConfigValue(config.url) && isUsableConfigValue(config.anonKey);
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

  function resolveAuthStorageKey(pathname) {
    return hasAdminPathSegment(pathname)
      ? "vrs-supabase-auth-admin"
      : "vrs-supabase-auth-public";
  }

  function getRuntimeBaseUrl() {
    if (document.currentScript && document.currentScript.src) {
      return new URL(".", document.currentScript.src).toString();
    }

    var scripts = document.querySelectorAll("script[src]");
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var src = String(scripts[i].src || "");
      if (/supabase\.client\.js(?:[?#].*)?$/i.test(src)) {
        return new URL(".", src).toString();
      }
    }

    var pathname = String(window.location && window.location.pathname ? window.location.pathname : "").toLowerCase();
    var baseHref = String(window.location && window.location.href ? window.location.href : "");

    if (baseHref) {
      if (pathname.indexOf("/frontend/admin/") >= 0) {
        return new URL("../assets/js/", baseHref).toString();
      }

      if (pathname.indexOf("/frontend/") >= 0) {
        return new URL("assets/js/", baseHref).toString();
      }
    }

    return "";
  }

  function getLocalSupabaseUrl() {
    var base = getRuntimeBaseUrl();
    if (!base) {
      return "assets/js/vendor/supabase.min.js";
    }

    return new URL("vendor/supabase.min.js", base).toString();
  }

  function getLocalSupabaseConfigUrl() {
    var base = getRuntimeBaseUrl();
    if (!base) {
      return "assets/js/supabase.config.local.js";
    }

    return new URL("supabase.config.local.js", base).toString();
  }

  function getLegacyLocalSupabaseConfigUrl() {
    var base = getRuntimeBaseUrl();
    if (!base) {
      return "assets/js/supabase.configlocal.js";
    }

    return new URL("supabase.configlocal.js", base).toString();
  }

  function loadLocalConfigIfAvailable() {
    return new Promise(function (resolve) {
      if (window.SUPABASE_LOCAL_CONFIG || hasConfig()) {
        resolve();
        return;
      }

      var existing = document.querySelector('script[data-supabase-config-runtime="local"]');
      if (existing) {
        existing.addEventListener("load", function () {
          resolve();
        }, { once: true });
        existing.addEventListener("error", function () {
          resolve();
        }, { once: true });
        return;
      }

      var script = document.createElement("script");
      script.src = getLocalSupabaseConfigUrl();
      script.async = true;
      script.dataset.supabaseConfigRuntime = "local";
      script.addEventListener("load", function () {
        resolve();
      }, { once: true });
      script.addEventListener("error", function () {
        var legacyScript = document.createElement("script");
        legacyScript.src = getLegacyLocalSupabaseConfigUrl();
        legacyScript.async = true;
        legacyScript.dataset.supabaseConfigRuntime = "local-legacy";
        legacyScript.addEventListener("load", function () {
          resolve();
        }, { once: true });
        legacyScript.addEventListener("error", function () {
          resolve();
        }, { once: true });
        document.head.appendChild(legacyScript);
      }, { once: true });

      document.head.appendChild(script);
    });
  }

  function loadScript(url, tag) {
    return new Promise(function (resolve, reject) {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        resolve();
        return;
      }

      var existing = document.querySelector('script[data-supabase-runtime="' + tag + '"]');
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      var script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.supabaseRuntime = tag;
      script.addEventListener("load", function () {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", function () {
        reject(new Error("Failed to load Supabase JS runtime: " + tag));
      }, { once: true });

      document.head.appendChild(script);
    });
  }

  async function loadSupabaseRuntime() {
    try {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
        "cdn"
      );
    } catch (_cdnError) {
      // CDN blocked or unavailable — continue to local vendor fallback
    }

    if (window.supabase && typeof window.supabase.createClient === "function") {
      return;
    }

    try {
      await loadScript(getLocalSupabaseUrl(), "local");
      if (window.supabase && typeof window.supabase.createClient === "function") {
        return;
      }
    } catch (localError) {
      // local fallback also failed
    }

    throw new Error("Supabase runtime failed to initialize. Ensure vendor/supabase.min.js is present.");
  }

  async function initClient() {
    if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
      return window.SupabaseRuntime.client;
    }

    if (clientInitPromise) {
      return clientInitPromise;
    }

    clientInitPromise = (async function () {
      await loadLocalConfigIfAvailable();

      var config = resolveConfig();
      if (!isUsableConfigValue(config.url) || !isUsableConfigValue(config.anonKey)) {
        throw new Error("Missing Supabase URL/anon key. Configure frontend/assets/js/supabase.config.js for shared credentials, or set frontend/assets/js/supabase.config.local.js for local override.");
      }

      await loadSupabaseRuntime();

      if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
        return window.SupabaseRuntime.client;
      }

      window.SUPABASE_CONFIG = Object.assign({}, window.SUPABASE_CONFIG || {}, config);

      var authStorageKey = resolveAuthStorageKey(window.location && window.location.pathname);

      var client = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: authStorageKey,
        },
      });

      window.SupabaseRuntime = {
        client: client,
        config: config,
      };

      return client;
    })();

    try {
      return await clientInitPromise;
    } catch (error) {
      clientInitPromise = null;
      throw error;
    }
  }

  window.SupabaseClient = {
    init: initClient,
    isConfigured: hasConfig,
  };
})();
