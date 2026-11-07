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
    const btnNavProfileTrigger = document.getElementById("nav-profile-trigger");
    const profileModal = document.getElementById("profile-modal-overlay");
    const overlayAuthModalBackdrop = document.getElementById("auth-modal-overlay");
    const btnSidebarReturnHub = document.getElementById("sidebar-return-hub-btn");

    // Global Header Search DOM References
    const searchWrapper = document.getElementById("header-search-wrapper");
    const searchInput = document.getElementById("global-lesson-search-input");
    const searchDropdown = document.getElementById("global-search-dropdown");

    let lessonSearchIndex = [];
    let currentUser = null;

    async function apiRequest(endpoint, options = {}) {
        const response = await fetch(endpoint, {
            credentials: "same-origin",
            ...options,
            headers: {
                ...(options.headers || {}),
                ...(options.body ? { "Content-Type": "application/json" } : {})
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong. Please try again.");
        }

        return data;
    }

    function showAuthError(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.classList.remove("hidden");
        element.classList.add("kl-feedback", "kl-feedback--error");
    }

    function clearAuthError(elementId) {
        const element = document.getElementById(elementId);
        element.textContent = "";
        element.classList.add("hidden");
    }

    // ============================================
    // STUDENT LEARNING PROGRESS
    // ============================================

    let studentProgress = null;

    async function refreshStudentProgress() {
        try {
            studentProgress = await apiRequest("/api/progress");
        } catch (error) {
            studentProgress = null;
            console.warn("Unable to load saved learning progress:", error);
        }

        return studentProgress;
    }

    function findLessonById(lessonId) {
        if (!lessonId) return null;

        for (const module of appCurriculumRegistry) {
            const lesson = module.lessons.find(item => item.id === lessonId);

            if (lesson) {
                return { module, lesson };
            }
        }

        return null;
    }

    function getLessonProgress(lessonId) {
        return studentProgress?.lessons?.find(
            item => item.lesson_id === lessonId
        ) || null;
    }

    async function saveLessonAccess(lessonId) {
        try {
            const result = await apiRequest("/api/progress/lesson", {
                method: "POST",
                body: JSON.stringify({
                    lessonId,
                    action: "access"
                })
            });

            if (!studentProgress) {
                studentProgress = {
                    ok: true,
                    lastAccessedLesson: lessonId,
                    lessons: [],
                    quizAttempts: []
                };
            }

            studentProgress.lastAccessedLesson = lessonId;

            const existing = studentProgress.lessons.find(
                item => item.lesson_id === lessonId
            );

            if (existing) {
                existing.status = result.status;
                existing.last_accessed_at = new Date().toISOString();
            } else {
                studentProgress.lessons.push({
                    lesson_id: lessonId,
                    status: result.status,
                    last_accessed_at: new Date().toISOString(),
                    completed_at: null
                });
            }

        } catch (error) {
            console.warn("Unable to save lesson access:", error);
        }
    }

    function applyThemePreference(theme) {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const shouldBeDark = theme === "dark" || (theme === "system" && prefersDark);
        document.documentElement.classList.toggle("dark", shouldBeDark);
        updateDarkModeUIState(shouldBeDark);
        if (theme === "system") localStorage.removeItem("theme");
        else localStorage.setItem("theme", theme);
    }

    async function saveThemePreference(theme) {
        if (!currentUser) return;
        try {
            const result = await apiRequest("/api/profile", {
                method: "POST",
                body: JSON.stringify({
                    name: currentUser.name,
                    theme,
                    language: currentUser.language || "en"
                })
            });
            currentUser = result.user;
        } catch (error) {
            console.warn("Unable to sync appearance preference:", error);
        }
    }

    function openProfileModal() {
        if (!currentUser || !profileModal) return;
        document.getElementById("profile-name").value = currentUser.name || "";
        document.getElementById("profile-email").value = currentUser.email || "";
        document.getElementById("profile-theme").value = currentUser.theme || "system";
        document.getElementById("profile-language").value = currentUser.language || "en";
        const feedback = document.getElementById("profile-feedback");
        feedback.textContent = "";
        feedback.className = "kl-feedback hidden";
        profileModal.classList.remove("hidden");
    }

    function closeProfileModal() {
        profileModal?.classList.add("hidden");
    }

    async function showAuthenticatedDashboard(user) {
        currentUser = user;

        closeAuthModal();

        canvasMarketing.classList.add("hidden");
        canvasTextbook.classList.add("hidden");
        canvasDashboard.classList.remove("hidden");

        btnNavAuthTrigger.classList.add("hidden");
        btnNavSignoutTrigger.classList.remove("hidden");
        btnNavProfileTrigger.classList.remove("hidden");
        applyThemePreference(user.theme || "system");

        if (window.innerWidth >= 768) {
            searchWrapper.classList.remove("hidden");
        }

        await refreshStudentProgress();

        renderAuthenticatedHub(appCurriculumRegistry);
    }

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
            // Restore authenticated session
            // --------------------------------------------------

            const params = new URLSearchParams(window.location.search);
            const lessonId = params.get("lesson");

            const sessionResponse = await fetch("/api/me", {
                credentials: "same-origin"
            });

            if (sessionResponse.ok) {

                const sessionData = await sessionResponse.json();

                if (sessionData.authenticated && sessionData.user) {

                    await showAuthenticatedDashboard(sessionData.user);

                    // Open requested lesson only after authentication
                    if (lessonId) {

                        for (const module of appCurriculumRegistry) {

                            const lesson = module.lessons.find(l => l.id === lessonId);

                            if (lesson) {
                                enterTextbookEnvironment(
                                    module,
                                    lesson.file,
                                    lesson.id
                                );

                                break;
                            }
                        }
                    }

                }

            } else if (lessonId) {

                // Do not allow unauthenticated direct lesson access
                const url = new URL(window.location);
                url.searchParams.delete("lesson");

                window.history.replaceState({}, "", url);

                openAuthModal("login");
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

    // Learner dashboard metrics are derived from the curriculum and saved server progress.
    function renderLearnerProgressOverview(modules) {
        const host = document.getElementById("learner-progress-overview");
        if (!host) return;

        const allModules = Array.isArray(modules) ? modules : [];
        const allLessons = allModules.flatMap(module => Array.isArray(module.lessons) ? module.lessons : []);
        const lessonRecords = Array.isArray(studentProgress?.lessons) ? studentProgress.lessons : [];
        const quizAttempts = Array.isArray(studentProgress?.quizAttempts) ? studentProgress.quizAttempts : [];
        const completedIds = new Set(lessonRecords
            .filter(record => record?.status === "completed")
            .map(record => record.lesson_id));
        const completedCount = allLessons.filter(lesson => completedIds.has(lesson.id)).length;
        const totalLessons = allLessons.length;
        const attemptCount = quizAttempts.length;
        const correctCount = quizAttempts.filter(attempt => attempt?.is_correct === true || Number(attempt?.is_correct) === 1).length;
        const accuracy = attemptCount ? Math.round((correctCount / attemptCount) * 100) : null;
        const courseProgress = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
        const number = value => new Intl.NumberFormat().format(value);

        host.innerHTML = `
            <article class="learner-stat-card">
                <span class="learner-stat-label">Lessons completed</span>
                <strong class="learner-stat-value">${number(completedCount)}<small> / ${number(totalLessons)}</small></strong>
                <span class="learner-stat-note">Completed lessons</span>
            </article>
            <article class="learner-stat-card">
                <span class="learner-stat-label">Quiz questions attempted</span>
                <strong class="learner-stat-value">${number(attemptCount)}</strong>
                <span class="learner-stat-note">Including repeat attempts</span>
            </article>
            <article class="learner-stat-card">
                <span class="learner-stat-label">Quiz accuracy</span>
                <strong class="learner-stat-value">${accuracy === null ? "—" : accuracy + "%"}</strong>
                <span class="learner-stat-note">${number(correctCount)} correct ${attemptCount ? "out of " + number(attemptCount) : "· no attempts yet"}</span>
            </article>
            <article class="learner-stat-card learner-stat-card-progress">
                <span class="learner-stat-label">Course progress</span>
                <strong class="learner-stat-value">${totalLessons ? courseProgress + "%" : "—"}</strong>
                <span class="learner-stat-note">${number(completedCount)} of ${number(totalLessons)} lessons completed</span>
                <div class="learner-progress-track" role="progressbar" aria-label="Overall course progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${courseProgress}"><span class="learner-progress-fill" style="width:${courseProgress}%"></span></div>
            </article>`;
    }

    // Authenticated Student Module Grid Selection Hub Screen
    function renderAuthenticatedHub(modules) {
        gridAuthDashboardModules.innerHTML = "";
        const styles = ['mod-blue', 'mod-green', 'mod-orange', 'mod-red', 'mod-yellow'];
        const lessonRecords = Array.isArray(studentProgress?.lessons) ? studentProgress.lessons : [];
        const completedIds = new Set(lessonRecords.filter(record => record?.status === "completed").map(record => record.lesson_id));

        renderLearnerProgressOverview(modules);

        modules.forEach((mod, idx) => {
            const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
            const completed = lessons.filter(lesson => completedIds.has(lesson.id)).length;
            const total = lessons.length;
            const percent = total ? Math.round(completed * 100 / total) : 0;
            const card = document.createElement("div");
            card.className = `brilliant-card ${styles[idx % styles.length]} learner-module-card`;
            card.innerHTML = `
                <div>
                    <h3>${mod.moduleName}</h3>
                    <p>${mod.description}</p>
                </div>
                <div class="learner-module-progress">
                    <div class="learner-module-progress-meta"><span>${completed} of ${total} lessons completed</span><strong>${percent}%</strong></div>
                    <div class="learner-progress-track" role="progressbar" aria-label="${mod.moduleName} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span class="learner-progress-fill" style="width:${percent}%"></span></div>
                </div>
                <div class="card-meta-row">
                    <span class="chapter-badge">${total} Lessons →</span>
                </div>
            `;
            card.addEventListener("click", () => enterTextbookEnvironment(mod));
            gridAuthDashboardModules.appendChild(card);
        });

        evaluateSavePointStateToken();
    }

    // Process and Inject context into "Continue Where You Left Off" banner
    // ============================================
    // CONTINUE LEARNING - SERVER-SIDE PROGRESS
    // ============================================

    function evaluateSavePointStateToken() {

        const savedId = studentProgress?.lastAccessedLesson;
        const match = findLessonById(savedId);

        if (match) {

            const progress = getLessonProgress(savedId);

            const statusLabel =
                progress?.status === "completed"
                    ? "COMPLETED"
                    : "CONTINUE LEARNING";

            bannerContinueLearning.innerHTML = `
            <div class="resume-text-left">
                <p>${statusLabel}</p>
                <h3>${match.lesson.title}</h3>
            </div>

            <button
                class="brilliant-btn-primary btn-sm"
                id="action-trigger-resume-btn">
                Open Chapter →
            </button>
        `;

            bannerContinueLearning.classList.remove("hidden");

            document
                .getElementById("action-trigger-resume-btn")
                .addEventListener("click", () => {

                    enterTextbookEnvironment(
                        match.module,
                        match.lesson.file,
                        match.lesson.id
                    );

                });

        } else {

            bannerContinueLearning.classList.add("hidden");
            bannerContinueLearning.innerHTML = "";

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

            // Save the student's last accessed lesson
            await saveLessonAccess(assetId);

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

                    const questionIndex = stateActiveLesson.blocks
                        .filter((item, index) =>
                            item.type === "quiz" && index <= stateActiveLesson.blocks.indexOf(block)
                        ).length - 1;

                    markup += `
        <div class="reader-quiz-container">
            <div class="quiz-question-title">${block.question}</div>
    `;

                    block.choices.forEach((choice, choiceIdx) => {

                        markup += `
            <div
                class="quiz-choice-row"
                data-question-index="${questionIndex}"
                data-answer-index="${choiceIdx}"
                onclick="selectQuizChoice(${questionIndex}, ${choiceIdx}, ${block.correctAnswer}, this)"
                role="radio"
                aria-checked="false"
                tabindex="0">
                ${choice}
            </div>
        `;

                    });

                    markup += `
            <div class="quiz-feedback" id="quiz-feedback-${questionIndex}" aria-live="polite"></div>
        `;
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

            // Save explicit lesson completion


            if (stateActiveLesson.previousLesson) {
                document.getElementById("textbook-prev-trigger").addEventListener(
                    "click",
                    () => handleLessonNavigation(stateActiveLesson.previousLesson)
                );
            }

            if (stateActiveLesson.nextLesson) {
                document.getElementById("textbook-next-trigger").addEventListener(
                    "click",
                    () => handleLessonNavigation(stateActiveLesson.nextLesson)
                );
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

    // ============================================
    // INTELLIGENT LESSON COMPLETION
    // ============================================

    function askLessonCompletion() {

        return new Promise(resolve => {

            const overlay = document.createElement("div");

            overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 10000;
        `;

            const dialog = document.createElement("div");

            dialog.style.cssText = `
            width: 100%;
            max-width: 420px;
            background: white;
            border-radius: 16px;
            padding: 26px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            text-align: left;
        `;

            dialog.setAttribute("role", "dialog");
            dialog.setAttribute("aria-modal", "true");

            const heading = document.createElement("h3");
            heading.textContent = "Ready for the next lesson?";

            const message = document.createElement("p");
            message.textContent =
                "Would you like to mark this lesson as completed before continuing?";

            message.style.cssText = `
            color: #64748b;
            line-height: 1.6;
            margin: 12px 0 22px;
        `;

            const actions = document.createElement("div");

            actions.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

            const completeButton = document.createElement("button");
            completeButton.className = "brilliant-btn-primary full-width-btn";
            completeButton.textContent = "✓ Mark complete and continue";

            const continueButton = document.createElement("button");
            continueButton.className = "brilliant-btn-secondary full-width-btn";
            continueButton.textContent = "Continue without completing";

            function finish(markComplete) {
                overlay.remove();
                resolve(markComplete);
            }

            completeButton.addEventListener("click", () => finish(true));
            continueButton.addEventListener("click", () => finish(false));

            actions.append(completeButton, continueButton);
            dialog.append(heading, message, actions);
            overlay.appendChild(dialog);

            document.body.appendChild(overlay);

            completeButton.focus();

        });
    }


    // Handle Previous / Next navigation
    async function handleLessonNavigation(targetId) {

        if (!stateActiveLesson) {
            shiftLessonPointerIndex(targetId);
            return;
        }

        const currentLessonId = stateActiveLesson.id;

        // Always check the latest saved progress before prompting
        await refreshStudentProgress();

        const currentProgress = getLessonProgress(currentLessonId);

        // Already completed: navigate immediately
        if (currentProgress?.status === "completed") {
            shiftLessonPointerIndex(targetId);
            return;
        }

        const shouldComplete = await askLessonCompletion();

        if (shouldComplete) {

            try {

                await apiRequest("/api/progress/lesson", {
                    method: "POST",
                    body: JSON.stringify({
                        lessonId: currentLessonId,
                        action: "complete"
                    })
                });

                if (!studentProgress) {
                    await refreshStudentProgress();
                }

                if (studentProgress) {

                    let savedLesson = studentProgress.lessons.find(
                        item => item.lesson_id === currentLessonId
                    );

                    if (!savedLesson) {
                        savedLesson = { lesson_id: currentLessonId };
                        studentProgress.lessons.push(savedLesson);
                    }

                    savedLesson.status = "completed";
                    savedLesson.completed_at = new Date().toISOString();
                    renderLearnerProgressOverview(appCurriculumRegistry);
                }

            } catch (error) {

                alert("Unable to save lesson completion. Please try again.");
                console.error("Lesson completion failed:", error);
                return;

            }
        }

        shiftLessonPointerIndex(targetId);
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

    // Radio-style quiz: one active choice per question, with immediate feedback.
    // Learners can change their choice; the previous choice is always cleared.
    const quizSaveTimers = new Map();

    window.selectQuizChoice = function (questionIndex, selectedAnswer, correctAnswer, elementNodeRef) {
        const quizContainer = elementNodeRef.closest(".reader-quiz-container");
        if (!quizContainer) return;

        const choiceRows = quizContainer.querySelectorAll(".quiz-choice-row");
        const feedback = document.getElementById(`quiz-feedback-${questionIndex}`);
        const isCorrect = Number(selectedAnswer) === Number(correctAnswer);

        choiceRows.forEach(row => {
            row.classList.remove("is-selected", "is-correct", "is-incorrect");
            row.setAttribute("aria-checked", "false");
        });

        elementNodeRef.classList.add(isCorrect ? "is-correct" : "is-incorrect");
        elementNodeRef.setAttribute("aria-checked", "true");
        quizContainer.dataset.selectedAnswer = String(selectedAnswer);

        if (feedback) {
            feedback.textContent = isCorrect ? "Correct! Brilliant work." : "Not quite. Try another option.";
            feedback.classList.toggle("is-correct", isCorrect);
            feedback.classList.toggle("is-incorrect", !isCorrect);
        }

        // Save the latest choice after a short pause, so quick changes don't create duplicate attempts.
        const timerKey = `${stateActiveLesson.id}:${questionIndex}`;
        const existingTimer = quizSaveTimers.get(timerKey);
        if (existingTimer) clearTimeout(existingTimer);
        quizSaveTimers.set(timerKey, setTimeout(async () => {
            quizSaveTimers.delete(timerKey);
            const answerToSave = Number(quizContainer.dataset.selectedAnswer);
            try {
                const result = await apiRequest("/api/progress/quiz", {
                    method: "POST",
                    body: JSON.stringify({ lessonId: stateActiveLesson.id, questionIndex, selectedAnswer: answerToSave })
                });
                if (!studentProgress) await refreshStudentProgress();
                if (studentProgress) {
                    studentProgress.quizAttempts.unshift({
                        lesson_id: result.lessonId,
                        question_id: result.questionId,
                        selected_answer: answerToSave,
                        is_correct: result.isCorrect ? 1 : 0,
                        attempted_at: new Date().toISOString()
                    });
                    renderLearnerProgressOverview(appCurriculumRegistry);
                }
            } catch (error) {
                if (feedback) feedback.textContent = "Selection shown, but saving failed. Please select an option again.";
                console.error("Quiz answer save failed:", error);
            }
        }, 600));
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
        btnNavProfileTrigger.addEventListener("click", openProfileModal);
        document.getElementById("profile-modal-close").addEventListener("click", closeProfileModal);
        profileModal.addEventListener("click", event => {
            if (event.target === profileModal) closeProfileModal();
        });
        document.getElementById("profile-theme").addEventListener("change", event => {
            applyThemePreference(event.target.value);
        });
        document.getElementById("profile-form").addEventListener("submit", async event => {
            event.preventDefault();
            const button = document.getElementById("profile-save-btn");
            const feedback = document.getElementById("profile-feedback");
            button.disabled = true;
            button.textContent = "Saving...";
            feedback.className = "kl-feedback hidden";
            try {
                const updated = await apiRequest("/api/profile", {
                    method: "POST",
                    body: JSON.stringify({
                        name: document.getElementById("profile-name").value,
                        theme: document.getElementById("profile-theme").value,
                        language: document.getElementById("profile-language").value
                    })
                });
                currentUser = updated.user;
                applyThemePreference(currentUser.theme || "system");
                feedback.textContent = "Your profile has been saved.";
                feedback.className = "kl-feedback kl-feedback--success";
                const dashboardHeading = document.querySelector(".dashboard-header-block h2");
                if (dashboardHeading) dashboardHeading.textContent = `Welcome, ${currentUser.name}`;
            } catch (error) {
                feedback.textContent = error.message;
                feedback.className = "kl-feedback kl-feedback--error";
            } finally {
                button.disabled = false;
                button.textContent = "Save changes";
            }
        });

        btnNavDashboardBack.addEventListener("click", routeToDashboardHubView);
        btnSidebarReturnHub.addEventListener("click", routeToDashboardHubView);

        brandLogoBtn.addEventListener("click", () => {
            if (!btnNavSignoutTrigger.classList.contains("hidden")) {
                routeToDashboardHubView();
            }
        });

        document.getElementById("form-action-register").addEventListener("submit", async (e) => {
            e.preventDefault();

            clearAuthError("register-error");

            const button = document.getElementById("btn-register-submit");

            const name = document.getElementById("field-register-name").value.trim();
            const email = document.getElementById("field-register-email").value.trim();
            const password = document.getElementById("field-register-password").value;

            button.disabled = true;
            button.textContent = "Creating account...";

            try {
                await apiRequest("/api/register", {
                    method: "POST",
                    body: JSON.stringify({ name, email, password })
                });

                document.getElementById("sent-email-placeholder").textContent = email;

                document.getElementById("modal-pane-register").classList.add("hidden");
                document.getElementById("modal-pane-success").classList.remove("hidden");

                document.getElementById("form-action-register").reset();

            } catch (error) {
                showAuthError("register-error", error.message);

            } finally {
                button.disabled = false;
                button.textContent = "Create Free Account";
            }
        });

        document.getElementById("form-action-login").addEventListener("submit", async (e) => {
            e.preventDefault();

            clearAuthError("login-error");

            const button = document.getElementById("btn-login-submit");

            const email = document.getElementById("field-login-email").value.trim();
            const password = document.getElementById("field-login-password").value;

            button.disabled = true;
            button.textContent = "Signing in...";

            try {
                const data = await apiRequest("/api/login", {
                    method: "POST",
                    body: JSON.stringify({ email, password })
                });

                await showAuthenticatedDashboard(data.user);

                document.getElementById("form-action-login").reset();

            } catch (error) {
                showAuthError("login-error", error.message);

            } finally {
                button.disabled = false;
                button.textContent = "Continue Learning";
            }
        });

        const forgotForm = document.getElementById("form-action-forgot");
        if (forgotForm) {
            forgotForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                clearAuthError("forgot-error");
                const success = document.getElementById("forgot-success");
                success.textContent = "";
                success.classList.add("hidden");
                const button = document.getElementById("btn-forgot-submit");
                const email = document.getElementById("field-forgot-email").value.trim();
                button.disabled = true;
                button.textContent = "Sending...";
                try {
                    const result = await apiRequest("/api/forgot-password", {
                        method: "POST", body: JSON.stringify({ email })
                    });
                    success.textContent = result.message || "If an account exists, reset instructions will be sent.";
                    success.classList.remove("hidden");
                    forgotForm.reset();
                } catch (error) {
                    showAuthError("forgot-error", error.message);
                } finally {
                    button.disabled = false;
                    button.textContent = "Send Reset Link";
                }
            });
        }

        btnNavSignoutTrigger.addEventListener("click", async () => {

            try {
                await apiRequest("/api/logout", {
                    method: "POST"
                });

                speechSynthesis.cancel();
                isReadingAloud = false;

                const url = new URL(window.location);
                url.search = "";
                window.history.replaceState({}, "", url);

                document.title = "KiteLearn | Learn Investing Simply";

                currentUser = null;
                stateActiveLesson = null;
                currentModuleScope = null;

                localStorage.removeItem("kitelearn_current_session");

                canvasDashboard.classList.add("hidden");
                canvasTextbook.classList.add("hidden");

                btnNavSignoutTrigger.classList.add("hidden");
                btnNavProfileTrigger.classList.add("hidden");
                closeProfileModal();
                btnNavDashboardBack.classList.add("hidden");
                mobileMenuTriggerBtn.classList.add("hidden");

                searchWrapper.classList.add("hidden");

                appSidebarSpine.classList.remove("drawer-open");
                mobileSidebarOverlay.classList.add("hidden");

                canvasMarketing.classList.remove("hidden");
                btnNavAuthTrigger.classList.remove("hidden");

            } catch (error) {
                alert("Unable to sign out. Please try again.");
                console.error("Logout failed:", error);
            }
        });
    }

    // UI Modal Management Controllers
    window.openAuthModal = function (pane) {
        overlayAuthModalBackdrop.classList.remove("hidden");
        switchModalPane(pane || "login");
    };
    window.closeAuthModal = function () {
        overlayAuthModalBackdrop.classList.add("hidden");
        ["register", "login", "success", "forgot"].forEach(name => {
            const element = document.getElementById(`modal-pane-${name}`);
            if (element) element.classList.add("hidden");
        });
    };
    window.switchModalPane = function (pane) {
        ["register", "login", "success", "forgot"].forEach(name => {
            const element = document.getElementById(`modal-pane-${name}`);
            if (element) element.classList.toggle("hidden", name !== pane);
        });
        if (pane === "forgot") {
            const loginEmail = document.getElementById("field-login-email");
            const forgotEmail = document.getElementById("field-forgot-email");
            if (loginEmail && forgotEmail && loginEmail.value) forgotEmail.value = loginEmail.value;
        }
    };

    // Certificate renderer: fixed 3:2 artwork with proportional dynamic text overlays.
    function getCertificateDetails() {
        const learnerName = (currentUser && currentUser.name)
            ? currentUser.name.trim()
            : "KiteLearn Learner";
        const completionDate = new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
        return { learnerName, completionDate };
    }

    window.triggerCompletionCertificate = function () {
        const nameSlot = document.getElementById("cert-display-name");
        const dateSlot = document.getElementById("cert-display-date");
        const modalBackdrop = document.getElementById("certificate-modal-backdrop");
        const details = getCertificateDetails();

        if (nameSlot) nameSlot.textContent = details.learnerName;
        if (dateSlot) dateSlot.textContent = details.completionDate;
        if (modalBackdrop) {
            modalBackdrop.classList.remove("hidden");
            document.body.classList.add("certificate-modal-open");
        }
    };

    window.closeCertificateModal = function () {
        const modalBackdrop = document.getElementById("certificate-modal-backdrop");
        if (modalBackdrop) modalBackdrop.classList.add("hidden");
        document.body.classList.remove("certificate-modal-open");
    };

    window.downloadCompletionCertificate = async function () {
        const button = document.getElementById("cert-download-btn");
        const details = getCertificateDetails();
        const image = new Image();
        image.src = "images/certificate-template.png";

        const originalLabel = button ? button.innerHTML : "";
        if (button) {
            button.disabled = true;
            button.textContent = "Preparing certificate…";
        }

        try {
            if (!image.complete) {
                await new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = () => reject(new Error("Certificate artwork could not be loaded."));
                });
            }
            if (!image.naturalWidth || !image.naturalHeight) {
                throw new Error("Certificate artwork is unavailable.");
            }

            const scale = 2;
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth * scale;
            canvas.height = image.naturalHeight * scale;
            const context = canvas.getContext("2d");
            context.scale(scale, scale);
            context.drawImage(image, 0, 0);

            // Coordinates use the original 1536 × 1024 artwork coordinate system.
            const name = details.learnerName;
            let nameSize = 76;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillStyle = "#101d3d";
            context.font = `700 ${nameSize}px Georgia, "Times New Roman", serif`;
            while (context.measureText(name).width > 900 && nameSize > 42) {
                nameSize -= 2;
                context.font = `700 ${nameSize}px Georgia, "Times New Roman", serif`;
            }
            context.fillText(name, 768, 410, 920);

            context.fillStyle = "#102044";
            context.font = '700 30px Arial, Helvetica, sans-serif';
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(details.completionDate, 1135, 820, 390);

            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not create certificate image.")), "image/png");
            });
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `KiteLearn-Certificate-${details.learnerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Learner"}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error("Certificate download failed:", error);
            alert("The certificate could not be downloaded. Please try again.");
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalLabel || "↓ Download certificate";
            }
        }
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
        const savedTheme = localStorage.getItem("theme") || "system";
        applyThemePreference(savedTheme);
    }

    darkModeToggles.forEach(toggleBtn => {
        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => {
                const turningDark = !document.documentElement.classList.contains("dark");
                if (turningDark) {
                    document.documentElement.classList.add("dark");
                    localStorage.setItem("theme", "dark");
                    updateDarkModeUIState(true);
                    if (currentUser) saveThemePreference("dark");
                } else {
                    document.documentElement.classList.remove("dark");
                    localStorage.setItem("theme", "light");
                    updateDarkModeUIState(false);
                    if (currentUser) saveThemePreference("light");
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
