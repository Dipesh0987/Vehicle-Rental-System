(function () {
  "use strict";

  var localConfig = {
    url: "https://qvlixrxinjyhfasbjjtr.supabase.co",
    anonKey: "sb_publishable_A1YrGw_RGw9XCtJNNOPnvQ_vDMhbPr1",
    profileImageBucket: "profile-images",
    projectLabel: "local",
  };

  // Compatibility fallback when an admin page references assets/js/supabase.config.local.js.
  window.SUPABASE_LOCAL_CONFIG = Object.assign({}, window.SUPABASE_LOCAL_CONFIG || {}, localConfig);
  window.SUPABASE_CONFIG = Object.assign({}, localConfig, window.SUPABASE_CONFIG || {});
})();
