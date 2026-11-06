
/* KiteLearn — Authentication controller for public secondary pages */
(() => {
    "use strict";

    const $ = id => document.getElementById(id);
    const overlay = $("auth-modal-overlay");

    async function apiRequest(path, body) {
        const response = await fetch(path, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
            throw new Error(data.error || "Unable to complete your request.");
        }
        return data;
    }

    function showError(id, message) {
        const el = $(id);
        if (el) {
            el.textContent = message;
            el.classList.remove("hidden");
        }
    }

    function clearError(id) {
        const el = $(id);
        if (el) {
            el.textContent = "";
            el.classList.add("hidden");
        }
    }

    window.openAuthModal = pane => {
        if (!overlay) return;
        overlay.classList.remove("hidden");
        window.switchModalPane(pane || "login");
    };

    window.closeAuthModal = () => {
        overlay?.classList.add("hidden");
        ["register", "login", "forgot", "success"].forEach(name =>
            $("modal-pane-" + name)?.classList.add("hidden")
        );
    };

    window.switchModalPane = pane => {
        ["register", "login", "forgot", "success"].forEach(name =>
            $("modal-pane-" + name)?.classList.toggle("hidden", name !== pane)
        );

        if (pane === "forgot") {
            const email = $("field-login-email")?.value.trim();
            if (email && $("field-forgot-email")) {
                $("field-forgot-email").value = email;
            }
        }
    };

    $("form-action-login")?.addEventListener("submit", async event => {
        event.preventDefault();
        clearError("login-error");

        const button = $("btn-login-submit");
        const email = $("field-login-email").value.trim();
        const password = $("field-login-password").value;

        button.disabled = true;
        button.textContent = "Signing in...";

        try {
            await apiRequest("/api/login", { email, password });
            window.location.assign("/");
        } catch (error) {
            showError("login-error", error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Continue Learning";
        }
    });

    $("form-action-register")?.addEventListener("submit", async event => {
        event.preventDefault();
        clearError("register-error");

        const button = $("btn-register-submit");
        const name = $("field-register-name").value.trim();
        const email = $("field-register-email").value.trim();
        const password = $("field-register-password").value;

        button.disabled = true;
        button.textContent = "Creating account...";

        try {
            const result = await apiRequest("/api/register", { name, email, password });
            $("sent-email-placeholder").textContent = email;
            const note = $("registration-success-note");
            if (note) note.textContent = result.message || "If registration was successful, verification instructions will be sent.";
            $("form-action-register").reset();
            window.switchModalPane("success");
        } catch (error) {
            showError("register-error", error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Create Free Account";
        }
    });

    $("form-action-forgot")?.addEventListener("submit", async event => {
        event.preventDefault();
        clearError("forgot-error");

        const success = $("forgot-success");
        success?.classList.add("hidden");

        const button = $("btn-forgot-submit");
        const email = $("field-forgot-email").value.trim();

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const result = await apiRequest("/api/forgot-password", { email });
            if (success) {
                success.textContent = result.message ||
                    "If an account exists, reset instructions will be sent.";
                success.classList.remove("hidden");
            }
            $("form-action-forgot").reset();
        } catch (error) {
            showError("forgot-error", error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Send Reset Link";
        }
    });

    $("nav-dashboard-back-btn")?.addEventListener("click", () => {
        window.location.assign("/");
    });

    $("nav-signout-trigger")?.addEventListener("click", async () => {
        try {
            await apiRequest("/api/logout", {});
            window.location.assign("/");
        } catch (error) {
            alert(error.message || "Unable to sign out.");
        }
    });

    $("resend-verification-trigger")?.addEventListener("click", async event => {
        const button = event.currentTarget;
        const email = $("sent-email-placeholder")?.textContent?.trim();
        if (!email) return;
        button.disabled = true;
        try {
            const result = await apiRequest("/api/resend-verification", { email });
            const note = $("registration-success-note");
            if (note) note.textContent = result.message || "If an unverified account exists, a verification email will be sent.";
        } catch (error) {
            const note = $("registration-success-note");
            if (note) note.textContent = error.message;
        } finally { button.disabled = false; }
    });

    // Reflect the current session in the public-page navigation.
    fetch("/api/me", { credentials: "same-origin" })
        .then(response => {
            if (!response.ok) throw new Error("Not signed in");
            return response.json();
        })
        .then(data => {
            if (!data.authenticated || !data.user) return;
            $("nav-auth-trigger")?.classList.add("hidden");
            $("nav-signout-trigger")?.classList.remove("hidden");
            $("nav-dashboard-back-btn")?.classList.remove("hidden");
        })
        .catch(() => {
            $("nav-auth-trigger")?.classList.remove("hidden");
            $("nav-signout-trigger")?.classList.add("hidden");
            $("nav-dashboard-back-btn")?.classList.add("hidden");
        });
})();
