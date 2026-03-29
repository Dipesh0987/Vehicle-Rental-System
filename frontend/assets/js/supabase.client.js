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

  function loadSupabaseCdn() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        resolve();
        return;
      }

      var existing = document.querySelector('script[data-supabase-cdn="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.dataset.supabaseCdn = "true";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", function () {
        reject(new Error("Failed to load Supabase JS CDN"));
      }, { once: true });

      document.head.appendChild(script);
    });
  }

  async function initClient() {
    if (!hasConfig()) {
      throw new Error("Missing SUPABASE_CONFIG values");
    }

    await loadSupabaseCdn();

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
