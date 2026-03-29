(function () {
  "use strict";

  function setStatus(mode, message) {
    var statusElements = document.querySelectorAll("[data-db-status]");
    statusElements.forEach(function (el) {
      el.textContent = message;
      el.dataset.state = mode;
    });
  }

  async function runHealthCheck(client) {
    var result = await client.auth.getSession();
    return result && !result.error;
  }

  async function initDatabaseConnection() {
    if (!window.SupabaseClient || typeof window.SupabaseClient.init !== "function") {
      setStatus("error", "Supabase bootstrap is missing.");
      return;
    }

    if (!window.SupabaseClient.isConfigured()) {
      setStatus("error", "Supabase config is missing.");
      return;
    }

    setStatus("loading", "Connecting to Supabase...");

    try {
      var client = await window.SupabaseClient.init();
      var ok = await runHealthCheck(client);

      if (ok) {
        setStatus("connected", "Database connected (Supabase ready).");
      } else {
        setStatus("error", "Database check failed. Verify credentials.");
      }
    } catch (err) {
      setStatus("error", "Database connection failed.");
      console.error("Supabase init error:", err);
    }
  }

  window.DatabaseBootstrap = {
    init: initDatabaseConnection,
  };
})();
