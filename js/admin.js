(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { user: null, page: 1, total: 0, query: "", users: [], overview: null, lessonTitles: new Map() };
  const fmt = value => Number(value || 0).toLocaleString("en-IN");
  const dateFmt = value => value ? new Date(value).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
  const dateTime = value => value ? new Date(value).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "No activity";
  async function api(url, options = {}) {
    const response = await fetch(url, { credentials:"same-origin", ...options, headers: { "Content-Type":"application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }
  async function loadLessonTitles() {
    try {
      const response = await fetch("/data/curriculum.json", { credentials: "same-origin", cache: "no-cache" });
      if (!response.ok) return;
      const modules = await response.json();
      for (const module of modules) for (const lesson of (module.lessons || [])) {
        state.lessonTitles.set(String(lesson.id).toLowerCase(), lesson.title);
      }
    } catch (error) { console.warn("Could not load curriculum titles", error); }
  }
  function lessonTitle(id) {
    const key = String(id ?? "").trim().toLowerCase();
    if (state.lessonTitles.has(key)) return state.lessonTitles.get(key);
    // Older progress records may use an uppercase/lowercase lookalike prefix.
    const numeric = key.match(/[0-9]+$/)?.[0];
    if (numeric && state.lessonTitles.has(`l${numeric}`)) return state.lessonTitles.get(`l${numeric}`);
    return `Lesson ${String(id ?? "").toUpperCase()}`;
  }
  function showApp(user) {
    state.user = user;
    $("admin-name").textContent = user.name || "Administrator";
    $("login-view").classList.add("hidden");
    $("admin-app").classList.remove("hidden");
    loadLessonTitles().finally(loadOverview);
  }
  async function checkSession() {
    try {
      const data = await api("/api/me");
      if (data.authenticated && data.user?.role === "admin") showApp(data.user);
      else $("login-view").classList.remove("hidden");
    } catch { $("login-view").classList.remove("hidden"); }
  }
  $("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const feedback = $("login-error");
    feedback.textContent = "";
    button.disabled = true; button.textContent = "Signing in…";
    try {
      await api("/api/login", { method:"POST", body:JSON.stringify({ email:$("login-email").value.trim(), password:$("login-password").value }) });
      const data = await api("/api/me");
      if (!data.authenticated || data.user?.role !== "admin") {
        await api("/api/logout", { method:"POST", body:"{}" });
        throw new Error("This account does not have administrator access.");
      }
      showApp(data.user);
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; button.textContent = "Sign in"; }
  });
  $("logout-btn").addEventListener("click", async () => {
    try { await api("/api/logout", { method:"POST", body:"{}" }); } finally { location.reload(); }
  });
  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
    const view = button.dataset.view;
    $("overview-view").classList.toggle("hidden", view !== "overview");
    $("users-view").classList.toggle("hidden", view !== "users");
    $("page-title").textContent = view === "overview" ? "Overview" : "Users";
    if (view === "users") loadUsers();
  }));
  $("date-range").addEventListener("change", loadOverview);
  $("refresh-btn").addEventListener("click", () => {
    const active = $("users-view").classList.contains("hidden");
    active ? loadOverview() : loadUsers();
  });
  function renderSignups(rows, days) {
    const map = new Map(rows.map(row => [row.day, Number(row.count)]));
    const points = [];
    for (let n = days - 1; n >= 0; n--) {
      const d = new Date(); d.setDate(d.getDate() - n);
      const key = d.toISOString().slice(0,10);
      points.push({ key, count: map.get(key) || 0, label: d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}) });
    }
    const max = Math.max(1, ...points.map(p => p.count));
    $("signup-chart").innerHTML = points.map((p,i) => `<div class="bar-col ${i === points.length-1 ? "today" : ""}" title="${p.label}: ${p.count} signups"><div class="bar" style="height:${Math.max(2,p.count/max*100)}%"></div><span class="bar-label">${(days <= 7 || i % Math.ceil(days/7) === 0 || i === points.length-1) ? p.label : ""}</span></div>`).join("");
  }
  function renderOverview(data) {
    const m = data.metrics;
    $("m-total").textContent = fmt(m.totalUsers);
    $("m-verified").textContent = `${fmt(m.verifiedUsers)} verified`;
    $("m-new").textContent = fmt(m.newUsers);
    $("range-label").textContent = `In last ${data.range} days`;
    $("m-active").textContent = fmt(m.activeLearners);
    $("m-completed").textContent = fmt(m.lessonsCompleted);
    $("m-records").textContent = `${fmt(m.lessonRecords)} tracked lesson records`;
    $("m-quizzes").textContent = fmt(m.quizAttempts);
    $("m-accuracy").textContent = `${m.quizAccuracy}% correct answers`;
    renderSignups(data.signups, data.range);
    const total = data.languages.reduce((sum,x) => sum + Number(x.users), 0) || 1;
    const names = {en:"English",te:"Telugu",kn:"Kannada",hi:"Hindi"};
    $("language-list").innerHTML = data.languages.length ? data.languages.map(x => `<div class="language-row"><b>${names[x.language] || x.language}</b><div class="language-track"><div class="language-fill" style="width:${Number(x.users)/total*100}%"></div></div><span class="language-value">${fmt(x.users)}</span></div>`).join("") : '<div class="empty-state">No preference data yet.</div>';
    $("popular-lessons").innerHTML = data.popularLessons.length ? data.popularLessons.map(x => `<tr><td><b>${escapeHtml(x.lesson_id)}</b></td><td>${fmt(x.learners)}</td><td>${fmt(x.completions)}</td></tr>`).join("") : '<tr><td colspan="3" class="empty-state">No learning activity yet.</td></tr>';
    $("updated-at").textContent = `Updated ${new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`;
  }
  async function loadOverview() {
    try {
      const data = await api(`/api/admin/overview?days=${$("date-range").value}`);
      state.overview = data; renderOverview(data);
    } catch (error) { $("signup-chart").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  async function loadUsers() {
    $("users-table").innerHTML = '<tr><td colspan="6" class="empty-state">Loading users…</td></tr>';
    try {
      const data = await api(`/api/admin/users?page=${state.page}&q=${encodeURIComponent(state.query)}&joinedDays=${encodeURIComponent($("joined-filter").value)}&activeDays=${encodeURIComponent($("activity-filter").value)}`);
      state.users = data.users; state.total = data.total;
      $("user-count").textContent = `${fmt(data.total)} accounts`;
      $("page-label").textContent = `Page ${data.page} · ${data.pageSize} per page`;
      $("prev-page").disabled = state.page <= 1;
      $("next-page").disabled = state.page * data.pageSize >= data.total;
      $("users-table").innerHTML = data.users.length ? data.users.map(u => `<tr>
        <td><div class="user-name" data-id="${escapeHtml(u.id)}">${escapeHtml(u.name)}</div><div class="user-email">${escapeHtml(u.email)}</div></td>
        <td>${dateFmt(u.created_at)}</td><td><span class="status-pill ${u.email_verified ? "good":"pending"}">${u.email_verified ? "Verified":"Pending"}</span></td>
        <td>${fmt(u.lessons_completed)}</td><td>${fmt(u.quiz_attempts)}</td><td>${dateTime(u.last_activity)}</td></tr>`).join("") : '<tr><td colspan="6" class="empty-state">No users found.</td></tr>';
      document.querySelectorAll(".user-name").forEach(el => el.addEventListener("click", () => openUser(el.dataset.id)));
    } catch (error) { $("users-table").innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(error.message)}</td></tr>`; }
  }
  let searchTimer;
  $("user-search").addEventListener("input", event => {
    clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = event.target.value.trim(); state.page = 1; loadUsers(); }, 300);
  });
  ["joined-filter", "activity-filter"].forEach(id => $(id).addEventListener("change", () => { state.page = 1; loadUsers(); }));
  $("prev-page").addEventListener("click", () => { if (state.page > 1) { state.page--; loadUsers(); } });
  $("next-page").addEventListener("click", () => { if (state.page * 25 < state.total) { state.page++; loadUsers(); } });
  $("export-btn").addEventListener("click", () => {
    const cols = ["name","email","created_at","email_verified","lessons_completed","quiz_attempts","last_activity"];
    const lines = [cols.join(","), ...state.users.map(row => cols.map(key => `"${String(row[key] ?? "").replace(/"/g,'""')}"`).join(","))];
    const blob = new Blob(["\uFEFF"+lines.join("\r\n")], {type:"text/csv;charset=utf-8"});
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `kitelearn-users-page-${state.page}.csv`; link.click(); URL.revokeObjectURL(link.href);
  });
  async function openUser(id) {
    try {
      const data = await api(`/api/admin/user?id=${encodeURIComponent(id)}`);
      $("modal-name").textContent = data.user.name;
      $("modal-email").textContent = data.user.email;
      const completed = data.lessons.filter(x => x.status === "completed").length;
      const started = data.lessons.length;
      const quizTotal = Number(data.quizSummary?.total ?? data.quizzes.length);
      const quizCorrect = Number(data.quizSummary?.correct ?? data.quizzes.filter(x => Number(x.is_correct) === 1 || x.is_correct === true).length);
      const completionRate = started ? Math.round(completed * 100 / started) : 0;
      const accuracy = quizTotal ? Math.round(quizCorrect * 100 / quizTotal) : 0;
      const lastActivity = data.lessons.reduce((latest, item) => !latest || (item.last_accessed_at && item.last_accessed_at > latest) ? item.last_accessed_at : latest, null);
      $("modal-meta").innerHTML = `<span>${data.user.email_verified ? "Email verified":"Email pending"}</span><span>Joined ${dateFmt(data.user.created_at)}</span><span>Language: ${escapeHtml(data.user.language.toUpperCase())}</span><span>Last active: ${dateTime(lastActivity)}</span>`;
      $("modal-summary").innerHTML = `
        <article><small>Lessons started</small><strong>${fmt(started)}</strong></article>
        <article><small>Lessons completed</small><strong>${fmt(completed)}</strong></article>
        <article><small>Completion rate</small><strong>${completionRate}%</strong></article>
        <article><small>Quiz accuracy</small><strong>${quizTotal ? accuracy + "%" : "—"}</strong><em>${fmt(quizCorrect)} / ${fmt(quizTotal)} correct · all attempts</em></article>`;
      $("modal-lesson-count").textContent = `${fmt(started)} records`;
      $("modal-quiz-count").textContent = `${fmt(quizTotal)} attempts`;
      $("modal-lessons").innerHTML = data.lessons.length ? data.lessons.map(x=>`<div class="activity-item"><b>${escapeHtml(lessonTitle(x.lesson_id))}</b><small><span class="activity-status ${x.status === "completed" ? "complete" : "progress"}">${escapeHtml(x.status.replaceAll("_", " "))}</span> · ${dateTime(x.last_accessed_at)}</small></div>`).join("") : '<div class="empty-state">No lesson activity.</div>';
      $("modal-quizzes").innerHTML = data.quizzes.length ? data.quizzes.slice(0,30).map(x=>`<div class="activity-item"><b>${escapeHtml(lessonTitle(x.lesson_id))} · ${escapeHtml(x.question_id)}</b><small><span class="activity-status ${x.is_correct ? "complete":"incorrect"}">${x.is_correct ? "Correct":"Incorrect"}</span> · ${dateTime(x.attempted_at)}</small></div>`).join("") : '<div class="empty-state">No quiz attempts.</div>';
      $("user-modal").classList.remove("hidden");
    } catch(error) { alert(error.message); }
  }
  $("modal-close").addEventListener("click", () => $("user-modal").classList.add("hidden"));
  document.addEventListener("keydown", event => { if (event.key === "Escape") $("user-modal").classList.add("hidden"); });
  $("user-modal").addEventListener("click", event => { if(event.target === $("user-modal")) $("user-modal").classList.add("hidden"); });
  checkSession();
})();