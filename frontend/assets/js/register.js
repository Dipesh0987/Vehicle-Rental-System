(function () {
    "use strict";

    var form = document.getElementById("registerForm");
    var messageEl = document.getElementById("message");

    if (!form || !messageEl) {
        return;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
    }

    function setMessage(mode, text) {
        var errorClasses = [
            "border",
            "border-[rgba(190,59,59,0.4)]",
            "bg-[rgba(190,59,59,0.12)]",
            "text-[#be3b3b]",
        ];
        var successClasses = [
            "border",
            "border-[rgba(74,159,108,0.42)]",
            "bg-[rgba(74,159,108,0.16)]",
            "text-[#275f3f]",
        ];

        messageEl.classList.remove("hidden");
        messageEl.classList.remove.apply(messageEl.classList, errorClasses);
        messageEl.classList.remove.apply(messageEl.classList, successClasses);
        messageEl.textContent = text;

        if (mode === "success") {
            messageEl.classList.add.apply(messageEl.classList, successClasses);
            return;
        }

        messageEl.classList.add.apply(messageEl.classList, errorClasses);
    }

    function getFieldValue(id) {
        var el = document.getElementById(id);
        return el ? String(el.value || "").trim() : "";
    }

    function getPasswordValue(id) {
        var el = document.getElementById(id);
        return el ? String(el.value || "") : "";
    }

    function setSubmitDefaultState(button) {
        if (!button) {
            return;
        }

        button.disabled = false;
        button.textContent = "Create Account";
        button.classList.remove("opacity-80", "cursor-not-allowed");
    }

    async function handleSubmit(event) {
        event.preventDefault();

        var submitBtn = form.querySelector('button[type="submit"]');

        var auth = window.VehicleAuthService;
        if (!auth) {
            setMessage("error", "Auth runtime not available. Please refresh the page.");
            return;
        }

        var fullName = getFieldValue("name");
        var email = getFieldValue("email");
        var password = getPasswordValue("password");
        var confirmPassword = getPasswordValue("confirmPassword");

        if (!fullName) {
            setMessage("error", "Please enter your full name.");
            return;
        }

        if (!isValidEmail(email)) {
            setMessage("error", "Please enter a valid email address.");
            return;
        }

        var passwordPolicy = auth.validatePassword(password);
        if (!passwordPolicy.valid) {
            setMessage("error", passwordPolicy.message);
            return;
        }

        if (password !== confirmPassword) {
            setMessage("error", "Passwords do not match.");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Creating account...";
            submitBtn.classList.add("opacity-80", "cursor-not-allowed");
        }

        try {
            await auth.signUp({
                email: email,
                password: password,
                fullName: fullName,
                redirectPath: "login.html",
            });

            await auth.upsertProfile(fullName);

            setMessage(
                "success",
                "Registration successful. We sent a verification link to your email. Redirecting to sign in..."
            );

            window.setTimeout(function () {
                window.location.href =
                    "login.html?registered=1&email=" + encodeURIComponent(email);
            }, 1600);
        } catch (error) {
            var humanMessage = auth.toPublicError(
                error,
                "Registration failed. Please try again."
            );
            setMessage("error", humanMessage);
        } finally {
            if (submitBtn) {
                setSubmitDefaultState(submitBtn);
            }
        }
    }

    form.addEventListener("submit", handleSubmit);
})();