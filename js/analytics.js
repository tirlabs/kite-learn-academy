/* KiteLearn analytics integrations.
 * GA4 is already configured in index.html. Optional Clarity, Google Ads and Meta
 * integrations remain disabled until real account IDs are supplied.
 */
(function () {
    "use strict";

    const CONFIG = {
        ga4MeasurementId: "G-664MNZY7MG",
        clarityProjectId: "",       // Add the real Microsoft Clarity project ID.
        googleAdsConversionId: "",  // Example format: AW-123456789
        googleAdsSignUpLabel: "",   // Conversion label from Google Ads.
        metaPixelId: ""             // Add the real Meta Pixel ID.
    };

    const safeStore = {
        get(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } },
        set(key, value) { try { window.localStorage.setItem(key, value); } catch (_) {} },
        getSession(key) { try { return window.sessionStorage.getItem(key); } catch (_) { return null; } },
        setSession(key, value) { try { window.sessionStorage.setItem(key, value); } catch (_) {} }
    };

    function sendGoogleAdsSignUp() {
        if (!CONFIG.googleAdsConversionId || !CONFIG.googleAdsSignUpLabel || typeof window.gtag !== "function") return;
        window.gtag("event", "conversion", {
            send_to: `${CONFIG.googleAdsConversionId}/${CONFIG.googleAdsSignUpLabel}`
        });
    }

    function sendMetaEvent(name, params) {
        if (typeof window.fbq === "function") window.fbq("track", name, params || {});
    }

    function track(name, params) {
        const data = params || {};
        if (typeof window.gtag === "function") window.gtag("event", name, data);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: `kitelearn_${name}`, ...data });

        if (name === "sign_up") {
            sendGoogleAdsSignUp();
            sendMetaEvent("CompleteRegistration", { content_name: "KiteLearn account" });
        } else if (name === "lesson_start") {
            sendMetaEvent("ViewContent", { content_name: "KiteLearn lesson" });
        } else if (name === "lesson_complete") {
            sendMetaEvent("CompleteTutorial", { content_name: "KiteLearn lesson" });
        }
    }

    window.KiteLearnAnalytics = {
        track,
        trackReturnVisit() {
            const now = Date.now();
            const lastVisit = Number(safeStore.get("kl_last_visit") || 0);
            const isReturning = lastVisit > 0 && (now - lastVisit) > 30 * 60 * 1000;
            safeStore.set("kl_last_visit", String(now));
            if (isReturning && !safeStore.getSession("kl_return_visit_sent")) {
                safeStore.setSession("kl_return_visit_sent", "1");
                track("return_visit");
            }
        },
        config: CONFIG
    };

    // Microsoft Clarity: activated only after the real project ID is configured.
    if (CONFIG.clarityProjectId) {
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", CONFIG.clarityProjectId);
    }

    // Meta Pixel: activated only after the real Pixel ID is configured.
    if (CONFIG.metaPixelId) {
        !function (f, b, e, v, n, t, s) {
            if (f.fbq) return; n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
            n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
            s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
        }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
        window.fbq("init", CONFIG.metaPixelId);
        window.fbq("track", "PageView");
    }

    window.KiteLearnAnalytics.trackReturnVisit();
})();
