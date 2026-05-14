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

    async function handleConfirmationEmailFailure(auth, email, password, fullName) {
        // If sign-in works, signup likely created the user even though the email dispatch failed.
        try {
            await auth.signIn({
                email: email,
                password: password,
            });

            await auth.upsertProfile(fullName);
            await auth.signOut();

            return {
                recovered: true,
                message:
                    "Account was created. Email verification could not be sent, but you can sign in now. Redirecting to sign in...",
            };
        } catch (recoveryError) {
            if (
                typeof auth.isEmailNotConfirmedError === "function" &&
                auth.isEmailNotConfirmedError(recoveryError)
            ) {
                return {
                    recovered: false,
                    message:
                        "Account may be pending, but confirmation email delivery failed. In Supabase Authentication > Providers > Email, temporarily disable Confirm email and retry signup once; then enable it again after SMTP is fixed.",
                };
            }

            return {
                recovered: false,
                message: null,
            };
        }
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
            var signUpResult = await auth.signUp({
                email: email,
                password: password,
                fullName: fullName,
                redirectPath: "index.html",
            });

            // Check if signup actually created a session (not a duplicate email fake-success)
            var session = null;
            if (typeof auth.getSession === "function") {
                try { session = await auth.getSession(); } catch (_e) {}
            }

            if (!session) {
                // No session = likely duplicate email (Supabase returns fake success to prevent enumeration)
                // Try signing in with the provided credentials
                try {
                    await auth.signIn({ email: email, password: password });
                    session = await auth.getSession();
                } catch (signInErr) {
                    setMessage("error", "An account with this email may already exist. Please sign in or use a different email.");
                    return;
                }
            }

            // Profile sync
            try {
                await auth.upsertProfile(fullName);
            } catch (_profileErr) {
                // Profile sync failure shouldn't block login
            }

            setMessage(
                "success",
                "Account created successfully! Redirecting to dashboard..."
            );

            window.setTimeout(function () {
                window.location.href = "index.html";
            }, 1200);
        } catch (error) {
            var isConfirmationFailure =
                typeof auth.isConfirmationEmailDeliveryError === "function" &&
                auth.isConfirmationEmailDeliveryError(error);

            if (isConfirmationFailure) {
                // Email delivery failed but account may have been created - try signing in
                try {
                    await auth.signIn({ email: email, password: password });
                    try { await auth.upsertProfile(fullName); } catch (_pe) {}
                    setMessage("success", "Account created! Redirecting to dashboard...");
                    window.setTimeout(function () {
                        window.location.href = "index.html";
                    }, 1200);
                    return;
                } catch (_signInErr) {
                    setMessage("error", "Account created but email verification failed. Please try signing in on the login page.");
                    window.setTimeout(function () {
                        window.location.href = "login.html?registered=1&email=" + encodeURIComponent(email);
                    }, 2500);
                    return;
                }
            }

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

    var googleBtn = document.getElementById("googleSignUp");
    if (googleBtn) {
        googleBtn.addEventListener("click", async function () {
            var auth = window.VehicleAuthService;
            if (!auth || typeof auth.signInWithGoogle !== "function") {
                setMessage("error", "Google sign up is currently unavailable.");
                return;
            }

            try {
                googleBtn.disabled = true;
                googleBtn.classList.add("opacity-80", "cursor-not-allowed");
                setMessage("success", "Redirecting to Google sign up...");
                await auth.signInWithGoogle("index.html");
            } catch (error) {
                var humanMessage =
                    typeof auth.toPublicError === "function"
                        ? auth.toPublicError(error, "Google sign up failed.")
                        : "Google sign up failed. Please try again.";
                setMessage("error", humanMessage);
                googleBtn.disabled = false;
                googleBtn.classList.remove("opacity-80", "cursor-not-allowed");
            }
        });
    }
})();