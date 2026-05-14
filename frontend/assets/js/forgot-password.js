(function () {
  "use strict";

  var FUNCTION_NAME = "password-reset-code";

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

  function setBusy(btnId, busy, defaultText) {
    var btn = $(btnId);
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? "Please wait…" : defaultText;
  }

  function showStep(step) {
    hide("frStep1");
    hide("frStep2");
    hide("frStep3");
    show("frStep" + step);
  }

  function openModal() {
    var modal = $("forgotAssistModal");
    if (!modal) return;
    showStep(1);
    setError("frEmailError", "");
    setError("frOtpError", "");
    var emailInput = $("frEmail");
    if (emailInput) emailInput.value = "";
    var codeInput = $("frCode");
    if (codeInput) codeInput.value = "";
    var pwInput = $("frNewPassword");
    if (pwInput) pwInput.value = "";
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

  async function invokePasswordReset(payload) {
    var client = await window.SupabaseClient.init();
    var response = await client.functions.invoke(FUNCTION_NAME, { body: payload });
    if (response.error) {
      var data = response.data || {};
      throw new Error(data.message || response.error.message || "Request failed.");
    }
    var data = response.data || {};
    if (data.success === false) {
      throw new Error(data.message || "Request failed.");
    }
    return data;
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
    setBusy("frEmailBtn", true, "Send reset code");
    try {
      await invokePasswordReset({ action: "request", email: email });
      state.email = email;
      var sentTo = $("frSentTo");
      if (sentTo) sentTo.textContent = email;
      showStep(2);
      var codeInput = $("frCode");
      if (codeInput) codeInput.focus();
    } catch (err) {
      setError("frEmailError", err.message || "Could not send reset code. Please try again.");
    } finally {
      state.busy = false;
      setBusy("frEmailBtn", false, "Send reset code");
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    if (state.busy) return;
    setError("frOtpError", "");
    var codeInput = $("frCode");
    var pwInput = $("frNewPassword");
    var code = String(codeInput ? codeInput.value : "").trim();
    var newPassword = String(pwInput ? pwInput.value : "");
    if (!/^\d{6}$/.test(code)) {
      setError("frOtpError", "Enter the 6-digit code from your email.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError("frOtpError", "Password must be at least 8 characters.");
      return;
    }
    state.busy = true;
    setBusy("frOtpBtn", true, "Reset password");
    try {
      await invokePasswordReset({ action: "confirm", email: state.email, code: code, newPassword: newPassword });
      showStep(3);
    } catch (err) {
      setError("frOtpError", err.message || "Incorrect or expired code. Please try again.");
    } finally {
      state.busy = false;
      setBusy("frOtpBtn", false, "Reset password");
    }
  }

  async function handleResend() {
    if (state.busy || !state.email) return;
    setError("frOtpError", "");
    state.busy = true;
    var resendBtn = $("frResendBtn");
    if (resendBtn) { resendBtn.disabled = true; resendBtn.textContent = "Sending…"; }
    try {
      await invokePasswordReset({ action: "request", email: state.email });
      setError("frOtpError", "");
      var codeInput = $("frCode");
      if (codeInput) { codeInput.value = ""; codeInput.focus(); }
      var info = document.createElement("p");
      info.className = "text-[13px] text-emerald-700 text-center";
      info.textContent = "A new code has been sent to " + state.email + ".";
      var form = $("frOtpForm");
      if (form) form.prepend(info);
      setTimeout(function () { if (info.parentNode) info.parentNode.removeChild(info); }, 4000);
    } catch (err) {
      setError("frOtpError", err.message || "Could not resend code.");
    } finally {
      state.busy = false;
      if (resendBtn) { resendBtn.disabled = false; resendBtn.textContent = "Resend code"; }
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

    var otpForm = $("frOtpForm");
    if (otpForm) {
      otpForm.addEventListener("submit", handleOtpSubmit);
    }

    var backBtn = $("frBackBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () { showStep(1); setError("frOtpError", ""); });
    }

    var resendBtn = $("frResendBtn");
    if (resendBtn) {
      resendBtn.addEventListener("click", handleResend);
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
