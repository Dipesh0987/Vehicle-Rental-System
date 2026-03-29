(function () {
  "use strict";

  function hasConfig() {
    return (
      window.SUPABASE_CONFIG &&
      typeof window.SUPABASE_CONFIG.url === "string" &&
      typeof window.SUPABASE_CONFIG.anonKey === "string" &&
      window.SUPABASE_CONFIG.url.trim() !== "" &&
      window.SUPABASE_CONFIG.anonKey.trim() !== ""
    );
  }

  function getRuntimeBaseUrl() {
    if (document.currentScript && document.currentScript.src) {
      return new URL(".", document.currentScript.src).toString();
    }

    var scripts = document.querySelectorAll("script[src]");
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var src = String(scripts[i].src || "");
      if (src.indexOf("/assets/js/supabase.client.js") >= 0) {
        return new URL(".", src).toString();
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
      await loadScript(getLocalSupabaseUrl(), "local");
      if (window.supabase && typeof window.supabase.createClient === "function") {
        return;
      }
    } catch (localError) {
      console.warn("Local Supabase runtime unavailable, trying CDN fallback.", localError.message);
    }

    await loadScript(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
      "cdn"
    );

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase runtime failed to initialize.");
    }
  }

  async function initClient() {
    if (!hasConfig()) {
      throw new Error("Missing SUPABASE_CONFIG values");
    }

    await loadSupabaseRuntime();

    var config = window.SUPABASE_CONFIG;
    var client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    window.SupabaseRuntime = {
      client: client,
      config: config,
    };

    return client;
  }

  window.SupabaseClient = {
    init: initClient,
    isConfigured: hasConfig,
  };
})();
