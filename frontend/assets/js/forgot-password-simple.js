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

  function getHelpfulErrorMessage(error) {
    var message = error.message || "Could not send reset link.";
    
    // Check for common email configuration errors
    if (message.includes("Error sending") || message.includes("SMTP") || message.includes("email")) {
      return "Email service is not configured. Please contact support or try again later.";
    }
    
    if (message.includes("rate limit") || message.includes("too many")) {
      return "Too many requests. Please wait a few minutes and try again.";
    }
    
    if (message.includes("not found") || message.includes("User not found")) {
      return "No account found with that email address.";
    }
    
    return message;
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
      
      // Use absolute URL for redirect
      var redirectUrl = 'http://127.0.0.1:5501/frontend/reset-password.html';
      
      console.log('Sending password reset to:', email);
      console.log('Redirect URL:', redirectUrl);
      
      // Use Supabase's built-in password reset
      var { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        console.error('Password reset error:', error);
        throw error;
      }

      console.log('Password reset email sent successfully');
      
      state.email = email;
      var sentTo = $("frSentTo");
      if (sentTo) sentTo.textContent = email;
      
      showStep(2);
      
    } catch (err) {
      console.error("Password reset error:", err);
      var helpfulMessage = getHelpfulErrorMessage(err);
      setError("frEmailError", helpfulMessage);
      
      // Show additional help for email configuration errors
      if (helpfulMessage.includes("Email service")) {
        setTimeout(function() {
          var errorEl = $("frEmailError");
          if (errorEl) {
            errorEl.innerHTML = helpfulMessage + 
              '<br><br><small>To fix this:<br>' +
              '1. Go to Supabase Dashboard<br>' +
              '2. Authentication → Settings<br>' +
              '3. Enable email confirmations<br>' +
              '4. Configure SMTP settings</small>';
          }
        }, 100);
      }
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