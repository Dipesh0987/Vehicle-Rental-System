(function () {
  "use strict";

  /**
   * Simple Forgot Password using Supabase Built-in Auth
   * No Edge Function required - uses Supabase's native resetPasswordForEmail()
   * Emails are sent automatically by Supabase Auth
   */

  var state = {
    email: "",
    busy: false,
  };

  function $(id) { return document.getElementById(id); }

  function show(id) { var el = $(id); if (el) el.classList.remove("hidden"); }
  function hide(id) { var el = $(id); if (el) el.classList.add("hidden"); }

  function setError(id, msg) {
    var el = $(id);
    if (!el) return;
    if (msg) { el.textContent = msg; show(id); }
    else { el.textContent = ""; hide(id); }
  }

  function setInfo(id, msg) {
    var el = $(id);
    if (!el) return;
    if (msg) { el.textContent = msg; show(id); }
    else { el.textContent = ""; hide(id); }
  }

  function resetTransientMessages() {
    setError("frEmailError", "");
    setInfo("frSuccessMessage", "");
  }

  function showStep(step) {
    hide("frStep1");
    hide("frStep2");
    show("frStep" + step);
  }

  function openModal() {
    var modal = $("forgotAssistModal");
    if (!modal) return;
    showStep(1);
    resetTransientMessages();
    state.email = "";
    var emailInput = $("frEmail");
    if (emailInput) emailInput.value = "";
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    requestAnimationFrame(function () {
      modal.classList.remove("opacity-0", "pointer-events-none");
      modal.setAttribute("aria-hidden", "false");
      var card = $("forgotAssistCard");
      if (card) {
        card.classList.remove("translate-y-3", "scale-[0.985]");
      }
      var input = $("frEmail");
      if (input) input.focus();
    });
  }

  function closeModal() {
    var modal = $("forgotAssistModal");
    if (!modal) return;
    modal.classList.add("opacity-0", "pointer-events-none");
    modal.setAttribute("aria-hidden", "true");
    var card = $("forgotAssistCard");
    if (card) {
      card.classList.add("translate-y-3", "scale-[0.985]");
    }
    setTimeout(function () {
      modal.classList.remove("flex");
      modal.classList.add("hidden");
    }, 200);
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (state.busy) return;
    setError("frEmailError", "");
    
    var emailInput = $("frEmail");
    var email = String(emailInput ? emailInput.value : "").trim().toLowerCase();
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("frEmailError", "Please enter a valid email address.");
      return;
    }

    state.busy = true;
    if (typeof setBusy === 'function') setBusy("frEmailBtn", true, "Sending reset link");

    try {
      var client = await window.SupabaseClient.init();
      
      // Use Supabase's built-in password reset
      var { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/frontend/reset-password.html'
      });

      if (error) {
        throw error;
      }

      state.email = email;
      var sentTo = $("frSentTo");
      if (sentTo) sentTo.textContent = email;
      
      showStep(2);
      
    } catch (err) {
      console.error("Password reset error:", err);
      setError("frEmailError", err.message || "Could not send reset link. Please try again.");
    } finally {
      state.busy = false;
      if (typeof setBusy === 'function') setBusy("frEmailBtn", false, "Send reset link");
    }
  }

  function init() {
    var forgotBtn = $("forgotPassword");
    if (forgotBtn) {
      forgotBtn.addEventListener("click", openModal);
    }

    var closeBtn = $("forgotAssistClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    var modal = $("forgotAssistModal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
      });
    }

    var emailForm = $("frEmailForm");
    if (emailForm) {
      emailForm.addEventListener("submit", handleEmailSubmit);
    }

    var doneBtn = $("frDoneBtn");
    if (doneBtn) {
      doneBtn.addEventListener("click", closeModal);
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var m = $("forgotAssistModal");
        if (m && !m.classList.contains("hidden")) closeModal();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
