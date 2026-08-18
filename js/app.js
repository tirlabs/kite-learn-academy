document.addEventListener("DOMContentLoaded", () => {
    let appCurriculumRegistry = [];
    let stateActiveLesson = null;
    let currentModuleScope = null;
    let speechUtterance = null;
    let isReadingAloud = false;

    // Primary View Panels Canvas Layer Roots
    const canvasMarketing = document.getElementById("marketing-canvas");
    const canvasDashboard = document.getElementById("dashboard-canvas");
    const canvasTextbook = document.getElementById("textbook-canvas");

    // Dynamic Lists & Target Content Slots Containers
    const gridMarketingPreview = document.getElementById("marketing-preview-grid");
    const gridAuthDashboardModules = document.getElementById("authenticated-modules-grid");
    const treeFilteredLessonsSpine = document.getElementById("sidebar-filtered-lessons-tree");
    const lblSidebarActiveModuleTitle = document.getElementById("sidebar-active-module-title");
    const blockLessonRenderPayload = document.getElementById("active-lesson-payload");
    const bannerContinueLearning = document.getElementById("continue-learning-banner");

    // Navigation & Mobile Drawer Node Target Selectors
    const appSidebarSpine = document.getElementById("application-sidebar-spine");
    const mobileSidebarOverlay = document.getElementById("sidebar-mobile-overlay");
    const mobileMenuTriggerBtn = document.getElementById("mobile-sidebar-toggle");

    // Nav Bar Button Interactive Action Anchors
    const brandLogoBtn = document.getElementById("brand-logo-btn");
    const btnNavDashboardBack = document.getElementById("nav-dashboard-back-btn");
    const btnNavAuthTrigger = document.getElementById("nav-auth-trigger");
    const btnNavSignoutTrigger = document.getElementById("nav-signout-trigger");
    const overlayAuthModalBackdrop = document.getElementById("auth-modal-overlay");
    const btnSidebarReturnHub = document.getElementById("sidebar-return-hub-btn");

    // Global Header Search DOM References
    const searchWrapper = document.getElementById("header-search-wrapper");
    const searchInput = document.getElementById("global-lesson-search-input");
    const searchDropdown = document.getElementById("global-search-dropdown");

    let lessonSearchIndex = [];

    // Boot Application Pipeline Sequence
    async function initializeSystemLifecycle() {
        try {
            const registryStream = await fetch('data/curriculum.json');
            appCurriculumRegistry = await registryStream.json();

            // renderAnonymousPreviewGrid(appCurriculumRegistry);
            // //console.log("Curriculum Object", appCurriculumRegistry);
            // buildSearchIndex(appCurriculumRegistry);
            // setupGlobalEventListeners();
            // setupMobileDrawerLifecycle();

            renderAnonymousPreviewGrid(appCurriculumRegistry);

            buildSearchIndex(appCurriculumRegistry);

            setupGlobalEventListeners();

            setupMobileDrawerLifecycle();

            // --------------------------------------------------
            // Open lesson directly if URL contains ?lesson=
            // --------------------------------------------------

            const params = new URLSearchParams(window.location.search);

            const lessonId = params.get("lesson");

            if (lessonId) {

                for (const module of appCurriculumRegistry) {

                    const lesson = module.lessons.find(l => l.id === lessonId);

                    if (lesson) {

                        // Simulate logged-in experience
                        canvasMarketing.classList.add("hidden");
                        btnNavAuthTrigger.classList.add("hidden");

                        canvasDashboard.classList.remove("hidden");
                        btnNavSignoutTrigger.classList.remove("hidden");

                        if (window.innerWidth >= 768) {
                            searchWrapper.classList.remove("hidden");
                        }

                        renderAuthenticatedHub(appCurriculumRegistry);

                        enterTextbookEnvironment(
                            module,
                            lesson.file,
                            lesson.id
                        );

                        return;
                    }

                }

            }

        } catch (error) {
            console.error("Critical error mapping platform layout configurations streams:", error);
        }
    }

    // Public Anonymous Dashboard View Map
    // function renderAnonymousPreviewGrid(modules) {
    //     gridMarketingPreview.innerHTML = "";
    //     const styles = ['mod-blue', 'mod-green', 'mod-orange', 'mod-red', 'mod-yellow'];

    //     modules.forEach((mod, idx) => {
    //         const card = document.createElement("div");
    //         card.className = `brilliant-card ${styles[idx % styles.length]}`;
    //         card.innerHTML = `
    //             <div>
    //                 <h3>${mod.moduleName}</h3>
    //                 <p>${mod.description}</p>
    //             </div>
    //             <div class="card-meta-row">
    //                 <span class="chapter-badge">${mod.lessons.length} Chapters</span>
    //             </div>
    //         `;
    //         card.addEventListener("click", () => openAuthModal('register'));
    //         gridMarketingPreview.appendChild(card);
    //     });
    // }
    function renderAnonymousPreviewGrid(modules) {
        gridMarketingPreview.innerHTML = "";

        const styles = [
            'mod-blue',
            'mod-green',
            'mod-orange',
            'mod-red',
            'mod-yellow'
        ];

        modules.forEach((mod, idx) => {
            const card = document.createElement("div");

            card.className = `brilliant-card ${styles[idx % styles.length]}`;

            const moduleNumber = String(idx + 1).padStart(2, "0");

            card.innerHTML = `
            <div class="module-card-content">

                <div class="module-card-topline">
                    <span class="module-number">
                        MODULE ${moduleNumber}
                    </span>
                </div>

                <h3>${mod.moduleName}</h3>

                <p>${mod.description}</p>

            </div>

            <div class="card-meta-row">
                <span class="chapter-badge">
                    ${mod.lessons.length} Chapters
                </span>

                <span class="module-card-arrow" aria-hidden="true">
                    →
                </span>
            </div>
        `;

            card.addEventListener("click", () => openAuthModal('register'));

            gridMarketingPreview.appendChild(card);
        });
    }

    // Authenticated Student Module Grid Selection Hub Screen
    function renderAuthenticatedHub(modules) {
        gridAuthDashboardModules.innerHTML = "";
        const styles = ['mod-blue', 'mod-green', 'mod-orange', 'mod-red', 'mod-yellow'];

        modules.forEach((mod, idx) => {
            const card = document.createElement("div");
            card.className = `brilliant-card ${styles[idx % styles.length]}`;
            card.innerHTML = `
                <div>
                    <h3>${mod.moduleName}</h3>
                    <p>${mod.description}</p>
                </div>
                <div class="card-meta-row">
                    <span class="chapter-badge">${mod.lessons.length} Chapters →</span>
                </div>
            `;
            card.addEventListener("click", () => enterTextbookEnvironment(mod));
            gridAuthDashboardModules.appendChild(card);
        });

        evaluateSavePointStateToken();
    }

    // Process and Inject context into "Continue Where You Left Off" banner
    function evaluateSavePointStateToken() {
        const savedFile = localStorage.getItem("academy_bookmark_file");
        const savedId = localStorage.getItem("academy_bookmark_id");
        const savedTitle = localStorage.getItem("academy_bookmark_title");

        if (savedFile && savedId && savedTitle) {
            bannerContinueLearning.innerHTML = `
                <div class="resume-text-left">
                    <p> CONTINUE LEARNING</p>
                    <h3>${savedTitle}</h3>
                </div>
                <button class="brilliant-btn-primary btn-sm" id="action-trigger-resume-btn">Jump to Chapter →</button>
            `;
            bannerContinueLearning.classList.remove("hidden");
            document.getElementById("action-trigger-resume-btn").addEventListener("click", () => {
                let targetedModule = appCurriculumRegistry[0];
                for (const m of appCurriculumRegistry) {
                    if (m.lessons.find(l => l.id === savedId)) { targetedModule = m; break; }
                }
                enterTextbookEnvironment(targetedModule, savedFile, savedId);
            });
        } else {
            bannerContinueLearning.classList.add("hidden");
        }
    }

    // Responsive Mobile Overlay Control Hooks
    function setupMobileDrawerLifecycle() {
        const closeDrawerAction = () => {
            appSidebarSpine.classList.remove("drawer-open");
            mobileSidebarOverlay.classList.add("hidden");
        };

        mobileMenuTriggerBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // <-- Prevents the click from escaping to any parent container
            appSidebarSpine.classList.toggle("drawer-open");
            mobileSidebarOverlay.classList.toggle("hidden");
        });

        mobileSidebarOverlay.addEventListener("click", closeDrawerAction);
    }

    // Initialize Textbook Module View Scope Viewport Framework
    function enterTextbookEnvironment(moduleObject, optCustomFile = null, optCustomId = null) {
        currentModuleScope = moduleObject;
        lblSidebarActiveModuleTitle.textContent = moduleObject.moduleName;
        treeFilteredLessonsSpine.innerHTML = "";

        moduleObject.lessons.forEach(lesson => {
            const li = document.createElement("li");
            li.className = "sidebar-lessons-li";
            li.textContent = lesson.title;
            li.dataset.lessonKeyId = lesson.id;
            li.addEventListener("click", () => {
                speechSynthesis.cancel();
                isReadingAloud = false;
                fetchAndParseTextbookSheet(lesson.file, lesson.id);
                // Explicitly auto-shut off panel drawer upon selection on mobile screens
                appSidebarSpine.classList.remove("drawer-open");
                mobileSidebarOverlay.classList.add("hidden");
            });
            treeFilteredLessonsSpine.appendChild(li);
        });

        canvasDashboard.classList.add("hidden");
        canvasTextbook.classList.remove("hidden");
        btnNavDashboardBack.classList.remove("hidden");
        mobileMenuTriggerBtn.classList.remove("hidden"); // Reveal hamburger icon in reading view

        if (optCustomFile && optCustomId) {
            fetchAndParseTextbookSheet(optCustomFile, optCustomId);
        } else if (moduleObject.lessons.length > 0) {
            fetchAndParseTextbookSheet(moduleObject.lessons[0].file, moduleObject.lessons[0].id);
        }
    }

    // Pull Dynamic Page Nodes Elements Payload Structure JSON
    async function fetchAndParseTextbookSheet(filePath, assetId) {
        try {
            const stream = await fetch(filePath);
            stateActiveLesson = await stream.json();

            // Update browser URL
            const url = new URL(window.location);
            url.searchParams.set("lesson", assetId);
            window.history.pushState({}, "", url);
            document.title = `${stateActiveLesson.title} | KiteLearn`;

            localStorage.setItem("academy_bookmark_file", filePath);
            localStorage.setItem("academy_bookmark_id", assetId);
            localStorage.setItem("academy_bookmark_title", stateActiveLesson.title);

            document.querySelectorAll(".sidebar-lessons-li").forEach(n => n.classList.remove("node-active"));
            const currentMatchElement = document.querySelector(`[data-lesson-key-id="${assetId}"]`);
            if (currentMatchElement) currentMatchElement.classList.add("node-active");

            document.querySelector(".reading-viewport-frame").scrollTop = 0;

            let markup = `
    <span class="lesson-super">${stateActiveLesson.module}</span>

    <h1 class="lesson-title-heading">
        ${stateActiveLesson.title}
    </h1>

    <div class="lesson-meta-bar">

        <span> ${stateActiveLesson.readingTime}</span>

        <span>•</span>

        <span> ${stateActiveLesson.difficulty}</span>

        <button
            id="lesson-read-aloud-btn"
            class="lesson-read-btn">

            🔊 Listen

        </button>

    </div>
`;

            stateActiveLesson.blocks.forEach(block => {
                if (block.type === "p") markup += `<p class="reader-p">${block.value}</p>`;
                else if (block.type === "story") markup += `<div class="reader-story-box">${block.value}</div>`;
                else if (block.type === "tip") markup += `<div class="reader-tip-box">${block.value}</div>`;
                else if (block.type === "example") markup += `<div class="reader-example-box">${block.value}</div>`;
                else if (block.type === "warning") markup += `<div class="reader-warning-box">${block.value}</div>`;
                else if (block.type === "fact") markup += `<div class="reader-fact-box">${block.value}</div>`;
                else if (block.type === "quiz") {
                    markup += `<div class="reader-quiz-container"><div class="quiz-question-title"> ${block.question}</div>`;
                    block.choices.forEach((choice, choiceIdx) => {
                        markup += `<div class="quiz-choice-row" onclick="checkChoiceSelection(${choiceIdx}, ${block.correctAnswer}, this)">${choice}</div>`;
                    });
                    markup += `</div>`;
                }
            });

            markup += `

<div class="lesson-share-card">

    <div class="lesson-share-icon">
        
    </div>

    <div class="lesson-share-content">

        <h3> Help someone else start investing.</h3>

        <p>
            If this lesson helped you understand the stock market a little better,
            consider sharing KiteLearn with a friend or family member who is
            beginning their investing journey.
        </p>

        <button
            id="share-kitelearn-btn"
            class="brilliant-btn-primary btn-sm">

            📤 Share KiteLearn

        </button>

    </div>

</div>

`;

            markup += `
                <div class="reading-pagination-row">
                    ${stateActiveLesson.previousLesson ? `<button class="brilliant-btn-secondary btn-sm" id="textbook-prev-trigger">← Previous</button>` : '<span></span>'}
                    ${stateActiveLesson.nextLesson ? `<button class="brilliant-btn-primary btn-sm" id="textbook-next-trigger">Next Chapter →</button>` : '<span></span>'}
                </div>
            `;
            blockLessonRenderPayload.innerHTML = markup;

            const readBtn = document.getElementById("lesson-read-aloud-btn");

            if (readBtn) {
                readBtn.addEventListener("click", toggleReadAloud);
            }

            const shareBtn = document.getElementById("share-kitelearn-btn");

            if (shareBtn) {
                shareBtn.addEventListener("click", shareKiteLearn);
            }

            if (stateActiveLesson.previousLesson) {
                document.getElementById("textbook-prev-trigger").addEventListener("click", () => shiftLessonPointerIndex(stateActiveLesson.previousLesson));
            }
            if (stateActiveLesson.nextLesson) {
                document.getElementById("textbook-next-trigger").addEventListener("click", () => shiftLessonPointerIndex(stateActiveLesson.nextLesson));
            }

            // Check if this is the absolute final lesson of the final curriculum module block
            const activeModuleIndex = appCurriculumRegistry.findIndex(m => m.moduleId === currentModuleScope.moduleId || m.moduleName === currentModuleScope.moduleName);
            const isLastModule = activeModuleIndex === appCurriculumRegistry.length - 1;

            if (isLastModule && !stateActiveLesson.nextLesson) {
                setTimeout(() => {
                    if (typeof window.triggerCompletionCertificate === "function") {
                        window.triggerCompletionCertificate();
                    }
                }, 1200);
            }

        } catch (error) {
            blockLessonRenderPayload.innerHTML = `<h3>Chapter content structural formatting exception triggered. Try alternative track!</h3>`;
        }
    }

    function shiftLessonPointerIndex(targetId) {
        speechSynthesis.cancel();
        isReadingAloud = false;
        for (const currentModule of appCurriculumRegistry) {
            const matchingLesson = currentModule.lessons.find(l => l.id === targetId);
            if (matchingLesson) {
                if (currentModule.moduleId !== currentModuleScope.moduleId) {
                    enterTextbookEnvironment(currentModule, matchingLesson.file, matchingLesson.id);
                } else {
                    fetchAndParseTextbookSheet(matchingLesson.file, matchingLesson.id);
                }
                break;
            }
        }
    }

    window.checkChoiceSelection = function (clickedIdx, validIdx, elementNodeRef) {
        if (clickedIdx === validIdx) {
            elementNodeRef.style.borderColor = "var(--brilliant-green)";
            elementNodeRef.style.backgroundColor = "var(--fill-tip)";
            alert("Spot on! Brilliant explanation match. ");
        } else {
            elementNodeRef.style.borderColor = "var(--brilliant-red)";
            elementNodeRef.style.backgroundColor = "#fef2f2";
            alert("Not quite! Scan the text blocks again for clues. 🤔");
        }
    };

    function routeToDashboardHubView() {

        const url = new URL(window.location);
        url.search = "";
        window.history.replaceState({}, "", url);

        speechSynthesis.cancel();
        isReadingAloud = false;
        canvasTextbook.classList.add("hidden");
        canvasMarketing.classList.add("hidden");

        // Hide mobile navigation drawer components
        appSidebarSpine.classList.remove("drawer-open");
        mobileSidebarOverlay.classList.add("hidden");
        mobileMenuTriggerBtn.classList.add("hidden");

        canvasDashboard.classList.remove("hidden");
        btnNavDashboardBack.classList.add("hidden");
        renderAuthenticatedHub(appCurriculumRegistry);
    }

    // App Event Route Mapping Listeners
    function setupGlobalEventListeners() {
        btnNavDashboardBack.addEventListener("click", routeToDashboardHubView);
        btnSidebarReturnHub.addEventListener("click", routeToDashboardHubView);

        brandLogoBtn.addEventListener("click", () => {
            if (!btnNavSignoutTrigger.classList.contains("hidden")) {
                routeToDashboardHubView();
            }
        });

        document.getElementById("form-action-register").addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("field-register-email").value;
            // Backup fallback save for session display mapping
            localStorage.setItem("kitelearn_current_session", email);
            document.getElementById("sent-email-placeholder").textContent = email;
            document.getElementById("modal-pane-register").classList.add("hidden");
            document.getElementById("modal-pane-success").classList.remove("hidden");
        });

        document.getElementById("form-action-login").addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("field-login-email")?.value || "student@kitelearn.io";
            localStorage.setItem("kitelearn_current_session", email);
            closeAuthModal();

            canvasMarketing.classList.add("hidden");
            btnNavAuthTrigger.classList.add("hidden");

            canvasDashboard.classList.remove("hidden");
            btnNavSignoutTrigger.classList.remove("hidden");

            if (window.innerWidth >= 768) {
                searchWrapper.classList.remove("hidden");
            }

            renderAuthenticatedHub(appCurriculumRegistry);
        });

        btnNavSignoutTrigger.addEventListener("click", () => {
            speechSynthesis.cancel();
            isReadingAloud = false;

            const url = new URL(window.location);
            url.search = "";
            window.history.replaceState({}, "", url);
            document.title = "KiteLearn | Learn Investing Simply";
            stateActiveLesson = null;
            currentModuleScope = null;

            localStorage.removeItem("kitelearn_current_session");
            canvasDashboard.classList.add("hidden");
            canvasTextbook.classList.add("hidden");
            btnNavSignoutTrigger.classList.add("hidden");
            btnNavDashboardBack.classList.add("hidden");
            mobileMenuTriggerBtn.classList.add("hidden");

            searchWrapper.classList.add("hidden");

            canvasMarketing.classList.remove("hidden");
            btnNavAuthTrigger.classList.remove("hidden");
        });
    }

    // UI Modal Management Controllers 
    window.openAuthModal = function (pane) { overlayAuthModalBackdrop.classList.remove("hidden"); switchModalPane(pane); };
    window.closeAuthModal = function () {
        overlayAuthModalBackdrop.classList.add("hidden");
        document.getElementById("modal-pane-register").classList.remove("hidden");
        document.getElementById("modal-pane-success").classList.add("hidden");
        document.getElementById("modal-pane-login").classList.add("hidden");
    };
    window.switchModalPane = function (pane) {
        if (pane === 'register') {
            document.getElementById("modal-pane-register").classList.remove("hidden");
            document.getElementById("modal-pane-login").classList.add("hidden");
            document.getElementById("modal-pane-success").classList.add("hidden");
        } else {
            document.getElementById("modal-pane-register").classList.add("hidden");
            document.getElementById("modal-pane-success").classList.add("hidden");
            document.getElementById("modal-pane-login").classList.remove("hidden");
        }
    };

    // Digital Certificate Window Logic Trigger Control Modules
    window.triggerCompletionCertificate = function () {
        const dateSlot = document.getElementById("cert-display-date");
        const modalBackdrop = document.getElementById("certificate-modal-backdrop");

        if (dateSlot) {
            const options = { year: 'numeric', month: 'long' };
            dateSlot.textContent = new Date().toLocaleDateString('en-US', options);
        }
        if (modalBackdrop) modalBackdrop.classList.remove("hidden");
    };

    window.closeCertificateModal = function () {
        const modalBackdrop = document.getElementById("certificate-modal-backdrop");
        if (modalBackdrop) modalBackdrop.classList.add("hidden");
    };

    // Dispatches background tracking analytics to Cloudflare functions framework silently
    async function captureVisitorAnalytics() {
        try {
            await fetch("_worker.js", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
        } catch (e) {
            console.warn("Analytics pipeline offline.");
        }
    }

    // =========================================================================
    // GLOBAL DARK MODE CONTROLLER ENGINE
    // =========================================================================
    const darkModeToggles = document.querySelectorAll(".platform-dark-mode-toggle");

    function updateDarkModeUIState(isDark) {

    darkModeToggles.forEach(btn => {

        if (!btn) return;

        btn.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );

        btn.setAttribute(
            "title",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );

        btn.classList.toggle("is-dark", isDark);
    });
}

    function initializeDarkModeTheme() {
        const savedTheme = localStorage.getItem("theme");
        const prefersDarkSetting = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDarkSetting);

        if (shouldBeDark) {
            document.documentElement.classList.add("dark");
            updateDarkModeUIState(true);
        } else {
            document.documentElement.classList.remove("dark");
            updateDarkModeUIState(false);
        }
    }

    darkModeToggles.forEach(toggleBtn => {
        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => {
                const turningDark = !document.documentElement.classList.contains("dark");
                if (turningDark) {
                    document.documentElement.classList.add("dark");
                    localStorage.setItem("theme", "dark");
                    updateDarkModeUIState(true);
                } else {
                    document.documentElement.classList.remove("dark");
                    localStorage.setItem("theme", "light");
                    updateDarkModeUIState(false);
                }
            });
        }
    });

    function buildSearchIndex(curriculum) {

        lessonSearchIndex = [];

        curriculum.forEach(module => {

            module.lessons.forEach(lesson => {

                lessonSearchIndex.push({

                    id: lesson.id,
                    title: lesson.title,
                    module: module.moduleName,
                    file: lesson.file

                });

            });

        });

        //console.log("Search Index Built:", lessonSearchIndex.length);
        //console.log(lessonSearchIndex);

    }

    function clearSearchResults() {

        searchDropdown.innerHTML = "";
        searchDropdown.classList.add("hidden");

    }

    function renderSearchResults(results) {

        searchDropdown.innerHTML = "";

        if (results.length === 0) {

            searchDropdown.classList.add("hidden");
            return;

        }

        results.forEach(result => {

            const item = document.createElement("div");

            item.className = "search-result-item";

            item.innerHTML = `
        <strong>${result.title}</strong>
        <div class="search-module-name">${result.module}</div>
    `;

            item.addEventListener("click", () => {

                openLessonFromSearch(result);

            });

            searchDropdown.appendChild(item);

        });

        searchDropdown.classList.remove("hidden");

    }

    function openLessonFromSearch(result) {

        // Find which module owns this lesson
        const module = appCurriculumRegistry.find(m =>
            m.lessons.some(l => l.id === result.id)
        );

        if (!module) return;

        // Close search UI
        searchInput.value = "";
        clearSearchResults();

        // Reuse existing navigation
        enterTextbookEnvironment(
            module,
            result.file,
            result.id
        );

    }

    function toggleReadAloud() {

        const button = document.getElementById("lesson-read-aloud-btn");

        if (!button) return;

        // Stop if already reading
        if (isReadingAloud) {

            speechSynthesis.cancel();

            isReadingAloud = false;

            button.innerHTML = "🔊 Listen";

            return;
        }

        let lessonText = `${stateActiveLesson.title}.\n\n`;

        stateActiveLesson.blocks.forEach(block => {

            if (block.type === "p") {
                const cleanText = block.value.replace(/<[^>]*>/g, "");
                lessonText += cleanText + "\n\n";
            }

            if (block.type === "story") {
                const cleanText = block.value.replace(/<[^>]*>/g, "");
                lessonText += cleanText + "\n\n";
            }

            if (block.type === "tip") {
                const cleanText = block.value.replace(/<[^>]*>/g, "");
                lessonText += cleanText + "\n\n";
            }

            if (block.type === "example") {
                const cleanText = block.value.replace(/<[^>]*>/g, "");
                lessonText += cleanText + "\n\n";
            }

            if (block.type === "warning") {
                const cleanText = block.value.replace(/<[^>]*>/g, "");
                lessonText += cleanText + "\n\n";
            }

            if (block.type === "fact") {
                const cleanText = block.value.replace(/<[^>]*>/g, "");
                lessonText += cleanText + "\n\n";
            }

        });

        speechUtterance = new SpeechSynthesisUtterance(lessonText);

        speechUtterance.rate = 1;
        speechUtterance.pitch = 1;
        speechUtterance.volume = 1;

        speechUtterance.onstart = () => {

            isReadingAloud = true;

            button.innerHTML = "⏹ Stop";

        };

        speechUtterance.onend = () => {

            isReadingAloud = false;

            button.innerHTML = "🔊 Listen";

        };

        speechUtterance.onerror = () => {

            isReadingAloud = false;

            button.innerHTML = "🔊 Listen";

        };

        speechSynthesis.speak(speechUtterance);

    }

    function shareKiteLearn() {

        const shareText =
            `I've been using KiteLearn to learn the stock market.

If you're a beginner and want to understand investing one concept at a time, you might find it useful too.

https://kitelearn.in`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText);
        }

        const btn = document.getElementById("share-kitelearn-btn");

        if (!btn) return;

        const originalText = btn.innerHTML;

        btn.innerHTML = "✅ Copied!";

        setTimeout(() => {

            btn.innerHTML = originalText;

        }, 2000);

    }

    // Fire theme setup immediately
    initializeDarkModeTheme();

    // Fire log calculation instantly during platform layout generation lifecycle
    captureVisitorAnalytics();

    initializeSystemLifecycle();

    searchInput.addEventListener("input", () => {

        const query = searchInput.value.trim().toLowerCase();

        if (query.length === 0) {

            clearSearchResults();
            return;

        }

        const results = lessonSearchIndex.filter(lesson =>

            lesson.title.toLowerCase().includes(query)

        ).slice(0, 8);

        renderSearchResults(results);

    });

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js");
    }
});
