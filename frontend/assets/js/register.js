(function () {
    "use strict";

    var form = document.getElementById("registerForm");
    var messageEl = document.getElementById("message");
    var RATE_LIMIT_COOLDOWN_KEY = "vrs_signup_cooldown_until";
    var DEFAULT_RATE_LIMIT_SECONDS = 60;
    var cooldownTimer = null;

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

    function isRateLimitError(error) {
        var status = Number(error && (error.status || error.statusCode));
        var message = String(error && error.message ? error.message : "").toLowerCase();
        return (
            status === 429 ||
            message.indexOf("too many requests") >= 0 ||
            message.indexOf("rate limit") >= 0
        );
    }

    function parseRateLimitSeconds(error) {
        var fromError = Number(error && error.waitSeconds);
        if (Number.isFinite(fromError) && fromError > 0) {
            return Math.round(fromError);
        }

        var message = String(error && error.message ? error.message : "");
        var match = message.match(/after\s+(\d+)\s*(second|seconds|minute|minutes)/i);
        if (match) {
            var amount = Number(match[1]);
            if (Number.isFinite(amount) && amount > 0) {
                var unit = String(match[2] || "").toLowerCase();
                if (unit.indexOf("minute") >= 0) {
                    return amount * 60;
                }
                return amount;
            }
        }

        return DEFAULT_RATE_LIMIT_SECONDS;
    }

    function getCooldownRemainingSeconds() {
        var until = Number(localStorage.getItem(RATE_LIMIT_COOLDOWN_KEY) || "0");
        if (!Number.isFinite(until) || until <= 0) {
            return 0;
        }

        var remainingMs = until - Date.now();
        if (remainingMs <= 0) {
            localStorage.removeItem(RATE_LIMIT_COOLDOWN_KEY);
            return 0;
        }

        return Math.ceil(remainingMs / 1000);
    }

    function setSubmitDefaultState(button) {
        if (!button) {
            return;
        }

        button.disabled = false;
        button.textContent = "Create Account";
        button.classList.remove("opacity-80", "cursor-not-allowed");
    }

    function startCooldown(button, seconds) {
        if (!button) {
            return;
        }

        var safeSeconds = Number.isFinite(seconds) && seconds > 0
            ? Math.ceil(seconds)
            : DEFAULT_RATE_LIMIT_SECONDS;

        var until = Date.now() + safeSeconds * 1000;
        localStorage.setItem(RATE_LIMIT_COOLDOWN_KEY, String(until));

        if (cooldownTimer) {
            window.clearInterval(cooldownTimer);
            cooldownTimer = null;
        }

        function renderCooldown() {
            var remaining = getCooldownRemainingSeconds();
            if (remaining <= 0) {
                if (cooldownTimer) {
                    window.clearInterval(cooldownTimer);
                    cooldownTimer = null;
                }
                setSubmitDefaultState(button);
                return;
            }

            button.disabled = true;
            button.textContent = "Try again in " + remaining + "s";
            button.classList.add("opacity-80", "cursor-not-allowed");
        }

        renderCooldown();
        cooldownTimer = window.setInterval(renderCooldown, 1000);
    }

    async function handleSubmit(event) {
        event.preventDefault();

        var submitBtn = form.querySelector('button[type="submit"]');
        var preExistingCooldown = getCooldownRemainingSeconds();
        if (preExistingCooldown > 0) {
            setMessage(
                "error",
                "Too many attempts. Please wait " + preExistingCooldown + " seconds and try again."
            );
            startCooldown(submitBtn, preExistingCooldown);
            return;
        }

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

        var hasCooldownError = false;
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

            if (isRateLimitError(error)) {
                hasCooldownError = true;
                startCooldown(submitBtn, parseRateLimitSeconds(error));
            }
        } finally {
            if (submitBtn && !hasCooldownError) {
                setSubmitDefaultState(submitBtn);
            }
        }
    }

    form.addEventListener("submit", handleSubmit);

    var initialSubmitBtn = form.querySelector('button[type="submit"]');
    var initialCooldown = getCooldownRemainingSeconds();
    if (initialCooldown > 0) {
        startCooldown(initialSubmitBtn, initialCooldown);
    }
})();