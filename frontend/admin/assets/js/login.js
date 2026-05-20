function setAdminBanner(element, message, mode) {
  if (!element) {
    return;
  }

  var successClasses = [
    "border",
    "border-[rgba(74,159,108,0.42)]",
    "bg-[rgba(74,159,108,0.16)]",
    "text-[#275f3f]",
    "px-3",
    "py-2",
    "text-sm",
    "rounded-xl",
  ];

  var errorClasses = [
    "border",
    "border-[rgba(190,59,59,0.42)]",
    "bg-[rgba(190,59,59,0.12)]",
    "text-[#8e2e2e]",
    "px-3",
    "py-2",
    "text-sm",
    "rounded-xl",
  ];

  element.classList.remove.apply(element.classList, successClasses);
  element.classList.remove.apply(element.classList, errorClasses);

  if (!message) {
    element.textContent = "";
    element.classList.add("hidden");
    return;
  }

  element.classList.remove("hidden");
  element.textContent = message;

  if (mode === "success") {
    element.classList.add.apply(element.classList, successClasses);
    return;
  }

  element.classList.add.apply(element.classList, errorClasses);
}

function wirePasswordToggle() {
  var passwordInput = document.getElementById("adminPassword");
  var toggle = document.getElementById("adminPasswordToggle");
  var eyeOpen = document.getElementById("adminEyeOpenIcon");
  var eyeOff = document.getElementById("adminEyeOffIcon");

  if (!passwordInput || !toggle) {
    return;
  }

  toggle.addEventListener("click", function () {
    var isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    toggle.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");

    if (eyeOpen && eyeOff) {
      eyeOpen.classList.toggle("hidden", isHidden);
      eyeOff.classList.toggle("hidden", !isHidden);
    }
  });
}


function setSubmitState(button, label, isLoading) {
  if (!button) {
    return;
  }

  button.disabled = Boolean(isLoading);
  button.classList.toggle("opacity-70", Boolean(isLoading));
  button.classList.toggle("cursor-not-allowed", Boolean(isLoading));

  var labelEl = document.getElementById("adminLoginSubmitLabel");
  if (!labelEl) {
    button.textContent = isLoading ? "Signing In..." : label;
    return;
  }

  labelEl.textContent = isLoading ? "Signing In..." : label;
}

function wireAdminLogin() {
  var form = document.getElementById("adminLoginForm");
  if (!form) {
    return;
  }

  var usernameInput = document.getElementById("adminUsername");
  var passwordInput = document.getElementById("adminPassword");
  var rememberInput = document.getElementById("adminRememberMe");
  var banner = document.getElementById("adminLoginBanner");
  var submitBtn = document.getElementById("adminLoginSubmit");

  wirePasswordToggle();

  var defaultLabel = "Sign In to Admin";

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!window.AdminAuth || typeof window.AdminAuth.signIn !== "function") {
      setAdminBanner(banner, "Admin auth runtime is unavailable. Refresh and try again.", "error");
      return;
    }

    setAdminBanner(banner, "", "error");
    setSubmitState(submitBtn, defaultLabel, true);

    try {
      await window.AdminAuth.signIn({
        username: usernameInput ? usernameInput.value : "",
        password: passwordInput ? passwordInput.value : "",
        rememberMe: Boolean(rememberInput && rememberInput.checked),
      });

      setAdminBanner(banner, "Admin login successful. Redirecting...", "success");
      setSubmitState(submitBtn, defaultLabel, false);
      window.location.assign("index.html");
    } catch (error) {
      var message = String(error && error.message ? error.message : "Unable to sign in.");
      setAdminBanner(banner, message, "error");
      setSubmitState(submitBtn, defaultLabel, false);
    }
  });
}

wireAdminLogin();
