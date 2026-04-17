// Legacy compatibility alias.
// Some setups reference supabase.configlocal.js (without the second dot).
// Keep this file so older links continue working.
(function () {
  "use strict";

  var fallbackConfig = {
    url: "https://qvlixrxinjyhfasbjjtr.supabase.co",
    anonKey: "sb_publishable_A1YrGw_RGw9XCtJNNOPnvQ_vDMhbPr1",
    profileImageBucket: "profile-images",
    projectLabel: "legacy-local",
  };

  window.SUPABASE_LOCAL_CONFIG = Object.assign({}, fallbackConfig, window.SUPABASE_LOCAL_CONFIG || {});
  window.SUPABASE_CONFIG = Object.assign({}, fallbackConfig, window.SUPABASE_CONFIG || {});
})();
