(function () {
  "use strict";

  var localOverride = window.SUPABASE_LOCAL_CONFIG || {};

  window.SUPABASE_CONFIG = {
    url: String(localOverride.url || "https://YOUR_PROJECT_ID.supabase.co"),
    anonKey: String(localOverride.anonKey || "YOUR_SUPABASE_ANON_KEY"),
    projectLabel: String(localOverride.projectLabel || "dev"),
  };
})();
