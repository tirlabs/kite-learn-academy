const SESSION_COOKIE = "__Host-kitelearn_session";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 600_000;
const PASSWORD_HASH_VERSION = "pbkdf2-sha256";

const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      let response;

      if (pathname.startsWith("/api/")) {
        response = await handleApiRequest(request, env);
      } else if (
        pathname === "/_worker.js" &&
        request.method === "POST"
      ) {
        logVisitor(request);
        response = new Response(null, { status: 204 });
      } else if (isProtectedLessonPath(pathname)) {
        const user = await authenticateRequest(request, env);

        if (!user) {
          response = jsonResponse(
            { error: "Authentication required." },
            401
          );
        } else if (!user.email_verified) {
          response = jsonResponse(
            { error: "Email verification required." },
            403
          );
        } else {
          response = await env.ASSETS.fetch(request);
          return applyHeaders(response, true);
        }
      } else {
        logVisitor(request);
        response = await env.ASSETS.fetch(request);
      }

      return applyHeaders(response, pathname.startsWith("/api/admin/"));
    } catch (error) {
      console.error("KiteLearn Worker error:", error);

      return applyHeaders(
        jsonResponse(
          { error: "An unexpected server error occurred." },
          500
        )
      );
    }
  }
};


// ============================================================
// API ROUTING
// ============================================================

async function handleApiRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "KiteLearn API",
      version: "1.0.0"
    });
  }

  if (url.pathname === "/api/register" && request.method === "POST") {
    return registerStudent(request, env);
  }

  if (url.pathname === "/api/verify-email" && request.method === "POST") {
    return verifyStudentEmail(request, env);
  }

  if (url.pathname === "/api/resend-verification" && request.method === "POST") {
    return resendVerificationEmail(request, env);
  }

  if (url.pathname === "/api/forgot-password" && request.method === "POST") {
    return requestPasswordReset(request, env);
  }

  if (url.pathname === "/api/reset-password" && request.method === "POST") {
    return resetStudentPassword(request, env);
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    return loginStudent(request, env);
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    return getCurrentUser(request, env);
  }

  if (url.pathname === "/api/profile" && request.method === "POST") {
    return updateStudentProfile(request, env);
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    return logoutStudent(request, env);
  }

  if (url.pathname === "/api/progress" && request.method === "GET") {
    return getStudentProgress(request, env);
  }

  if (url.pathname === "/api/progress/lesson" && request.method === "POST") {
    return updateLessonProgress(request, env);
  }

  // Admin APIs: every request is independently authenticated and authorized.
  if (url.pathname === "/api/admin/overview" && request.method === "GET") {
    return getAdminOverview(request, env);
  }
  if (url.pathname === "/api/admin/users" && request.method === "GET") {
    return getAdminUsers(request, env);
  }
  if (url.pathname === "/api/admin/user" && request.method === "GET") {
    return getAdminUserDetail(request, env);
  }

  if (url.pathname === "/api/progress/quiz" && request.method === "POST") {
    return saveQuizAttempt(request, env);
  }

  return jsonResponse({ error: "API endpoint not found." }, 404);
}


// ============================================================
// PASSWORD SECURITY
// ============================================================

async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256"
    },
    key,
    256
  );

  return [
    PASSWORD_HASH_VERSION,
    PASSWORD_ITERATIONS,
    encodeBase64Url(salt),
    encodeBase64Url(new Uint8Array(derivedBits))
  ].join("$");
}


async function verifyPassword(password, storedHash) {
  try {
    const parts = storedHash.split("$");

    if (parts.length !== 4) return false;

    const [algorithm, iterationsText, saltText, hashText] = parts;

    if (algorithm !== PASSWORD_HASH_VERSION) return false;

    const iterations = Number(iterationsText);

    if (
      !Number.isSafeInteger(iterations) ||
      iterations < 100_000 ||
      iterations > 1_000_000
    ) {
      return false;
    }

    const salt = decodeBase64Url(saltText);
    const expectedHash = decodeBase64Url(hashText);

    if (salt.length !== 16 || expectedHash.length !== 32) {
      return false;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      key,
      256
    );

    return constantTimeEqual(
      new Uint8Array(derivedBits),
      expectedHash
    );
  } catch {
    return false;
  }
}


// ============================================================
// SECURE TOKEN UTILITIES
// ============================================================

function generateSecureToken() {
  return encodeBase64Url(
    crypto.getRandomValues(new Uint8Array(32))
  );
}


async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(token)
  );

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}


function encodeBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function decodeBase64Url(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const binary = atob(
    base64 + "=".repeat((4 - base64.length % 4) % 4)
  );

  return Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );
}


function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a[i] ^ b[i];
  }

  return difference === 0;
}

// ============================================================
// SESSION COOKIE UTILITIES
// ============================================================

function isSecureRequest(request) {
  return new URL(request.url).protocol === "https:";
}

function getSessionCookieName(request) {
  return isSecureRequest(request)
    ? "__Host-kitelearn_session"
    : "kitelearn_session";
}

function getSessionToken(request) {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) return null;

  const cookieName = getSessionCookieName(request);

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");

    if (separator === -1) continue;

    const name = cookie.slice(0, separator).trim();

    if (name === cookieName) {
      return cookie.slice(separator + 1).trim() || null;
    }
  }

  return null;
}

function createSessionCookie(token, request) {
  const cookie = [
    `${getSessionCookieName(request)}=${token}`,
    "Path=/",
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (isSecureRequest(request)) {
    cookie.push("Secure");
  }

  return cookie.join("; ");
}

function clearSessionCookie(request) {
  const cookie = [
    `${getSessionCookieName(request)}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (isSecureRequest(request)) {
    cookie.push("Secure");
  }

  return cookie.join("; ");
}

// ============================================================
// SESSION AUTHENTICATION
// ============================================================

async function authenticateRequest(request, env) {
  const token = getSessionToken(request);

  if (!token || !env.DB) return null;

  const tokenHash = await hashToken(token);

  const result = await env.DB.prepare(`
        SELECT
            s.id AS session_id,
            s.user_id,
            u.email_verified,
            u.status,
            u.role
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        LIMIT 1
    `).bind(tokenHash).first();

  if (!result || result.status !== "active") {
    return null;
  }

  return {
    session_id: result.session_id,
    user_id: result.user_id,
    email_verified: result.email_verified === 1,
    role: result.role
  };
}

// ============================================================
// PERSISTENT AUTH RATE LIMITING (D1)
// ============================================================
async function enforceAuthRateLimit(request, env, action, identity, limit, windowSeconds) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const normalizedIdentity = String(identity || "unknown").toLowerCase();
  const now = new Date().toISOString();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  async function consume(keyMaterial, keyLimit) {
    const key = await hashToken(keyMaterial);
    const row = await env.DB.prepare(`
      INSERT INTO auth_rate_limits (rate_key, window_started_at, attempts, updated_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(rate_key) DO UPDATE SET
        attempts = CASE WHEN auth_rate_limits.window_started_at <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END,
        window_started_at = CASE WHEN auth_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END,
        updated_at = excluded.updated_at
      RETURNING attempts
    `).bind(key, now, now, windowStart, windowStart).first();
    return (row?.attempts || 0) <= keyLimit;
  }

  // Independent counters prevent rotating email addresses from bypassing IP limits
  // and prevent a single account from being attacked across many IP addresses.
  const [ipAllowed, identityAllowed] = await Promise.all([
    consume(`${action}|ip|${ip}`, limit * 5),
    consume(`${action}|identity|${normalizedIdentity}`, limit)
  ]);
  return ipAllowed && identityAllowed;
}

// ============================================================
// LOGIN
// ============================================================

async function loginStudent(request, env) {
  if (!env.DB) {
    return jsonResponse({ error: "Login service unavailable." }, 503);
  }

  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";

  const password = typeof body.password === "string"
    ? body.password
    : "";

  if (
    !email ||
    email.length > 254 ||
    !password ||
    password.length > 128
  ) {
    return jsonResponse({ error: "Invalid email or password." }, 400);
  }

  if (!(await enforceAuthRateLimit(request, env, "login", email, 10, 900))) {
    return jsonResponse({ error: "Too many sign-in attempts. Please wait 15 minutes and try again." }, 429);
  }

  try {
    const user = await env.DB.prepare(`
            SELECT u.id, u.name, u.email, u.password_hash,
                   u.email_verified, u.status, u.role,
                   COALESCE(p.theme, 'system') AS theme,
                   COALESCE(p.language, 'en') AS language
            FROM users u
            LEFT JOIN user_preferences p ON p.user_id = u.id
            WHERE u.email_normalized = ?
            LIMIT 1
        `).bind(email).first();

    if (!user || user.status !== "active") {
      return jsonResponse({ error: "Invalid email or password." }, 401);
    }

    const passwordValid = await verifyPassword(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return jsonResponse({ error: "Invalid email or password." }, 401);
    }

    if (user.email_verified !== 1) {
      return jsonResponse({
        error: "Please verify your email address before signing in.",
        code: "EMAIL_NOT_VERIFIED"
      }, 403);
    }

    const sessionToken = generateSecureToken();
    const sessionId = crypto.randomUUID();
    const tokenHash = await hashToken(sessionToken);

    const expiresAt = new Date(
      Date.now() + SESSION_DURATION_SECONDS * 1000
    ).toISOString();

    await env.DB.prepare(`
            INSERT INTO sessions (
                id, user_id, token_hash, expires_at
            )
            VALUES (?, ?, ?, ?)
        `).bind(
      sessionId,
      user.id,
      tokenHash,
      expiresAt
    ).run();

    return jsonResponse({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        theme: user.theme || "system",
        language: user.language || "en"
      }
    }, 200, {
      "Set-Cookie": createSessionCookie(sessionToken, request)
    });

  } catch (error) {
    console.error("Login error:", error);

    return jsonResponse(
      { error: "Unable to sign in. Please try again." },
      500
    );
  }
}


// ============================================================
// CURRENT USER
// ============================================================

async function getCurrentUser(request, env) {
  try {
    const user = await authenticateRequest(request, env);

    if (!user) {
      return jsonResponse({ ok: true, authenticated: false }, 401);
    }

    if (!user.email_verified) {
      return jsonResponse({ ok: true, authenticated: false }, 403);
    }

    const profile = await env.DB.prepare(`
            SELECT
              u.id, u.name, u.email, u.role,
              COALESCE(p.theme, 'system') AS theme,
              COALESCE(p.language, 'en') AS language
            FROM users u
            LEFT JOIN user_preferences p ON p.user_id = u.id
            WHERE u.id = ?
              AND u.status = 'active'
              AND u.email_verified = 1
            LIMIT 1
        `).bind(user.user_id).first();

    if (!profile) {
      return jsonResponse({ ok: true, authenticated: false }, 401);
    }

    await env.DB.prepare(`
            UPDATE sessions
            SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
        `).bind(user.session_id).run();

    return jsonResponse({
      ok: true,
      authenticated: true,
      user: profile
    });

  } catch (error) {
    console.error("Current user error:", error);

    return jsonResponse(
      { error: "Unable to retrieve your session." },
      500
    );
  }
}


// ============================================================
// STUDENT PROFILE AND PREFERENCES
// ============================================================
async function updateStudentProfile(request, env) {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }

  try {
    const auth = await requireVerifiedStudent(request, env);
    if (auth.error) return auth.error;

    const body = await readJsonBody(request);
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const theme = body.theme;
    const language = body.language;

    if (name.length < 2 || name.length > 80) {
      return jsonResponse({ error: "Name must be between 2 and 80 characters." }, 400);
    }
    if (!["light", "dark", "system"].includes(theme)) {
      return jsonResponse({ error: "Choose a valid appearance preference." }, 400);
    }
    if (!["en", "te", "kn", "hi"].includes(language)) {
      return jsonResponse({ error: "Choose a valid language preference." }, 400);
    }

    const userId = auth.user.user_id;
    const now = new Date().toISOString();

    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET name = ?, updated_at = ? WHERE id = ? AND status = 'active'`).bind(name, now, userId),
      env.DB.prepare(`
        INSERT INTO user_preferences (user_id, theme, language, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          theme = excluded.theme,
          language = excluded.language,
          updated_at = excluded.updated_at
      `).bind(userId, theme, language, now)
    ]);

    const profile = await env.DB.prepare(`
      SELECT u.id, u.name, u.email, u.role,
             COALESCE(p.theme, 'system') AS theme,
             COALESCE(p.language, 'en') AS language
      FROM users u
      LEFT JOIN user_preferences p ON p.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `).bind(userId).first();

    return jsonResponse({ ok: true, user: profile });
  } catch (error) {
    console.error("Update profile error:", error);
    return jsonResponse({ error: "Unable to save your profile. Please try again." }, 500);
  }
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutStudent(request, env) {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Invalid request origin." }, 403);
  }

  try {
    const token = getSessionToken(request);

    if (token && env.DB) {
      const tokenHash = await hashToken(token);

      await env.DB.prepare(`
                DELETE FROM sessions
                WHERE token_hash = ?
            `).bind(tokenHash).run();
    }

    return jsonResponse(
      { ok: true, message: "You have been signed out." },
      200,
      { "Set-Cookie": clearSessionCookie(request) }
    );

  } catch (error) {
    console.error("Logout error:", error);

    return jsonResponse(
      { error: "Unable to sign out. Please try again." },
      500
    );
  }
}


// ============================================================
// LESSON CONTENT PROTECTION
// ============================================================

// ============================================================
// STUDENT LEARNING PROGRESS
// ============================================================

async function requireVerifiedStudent(request, env) {
  const user = await authenticateRequest(request, env);

  if (!user) {
    return {
      error: jsonResponse(
        { error: "Authentication required." },
        401
      )
    };
  }

  if (!user.email_verified) {
    return {
      error: jsonResponse(
        { error: "Email verification required." },
        403
      )
    };
  }

  return { user };
}


// Resolve a lesson ID to its trusted static JSON asset.
async function loadLessonForProgress(lessonId, request, env) {
  const match = /^l([1-9]\d?|100)$/.exec(lessonId || "");

  if (!match) return null;

  const lessonNumber = Number(match[1]);
  const path = `/data/lessons/lesson_${lessonNumber}.json`;

  const assetResponse = await env.ASSETS.fetch(
    new Request(new URL(path, request.url))
  );

  if (!assetResponse.ok) return null;

  const lesson = await assetResponse.json();

  if (lesson.id !== lessonId) return null;

  return lesson;
}


// GET /api/progress
async function getStudentProgress(request, env) {
  try {
    const auth = await requireVerifiedStudent(request, env);
    if (auth.error) return auth.error;

    const userId = auth.user.user_id;

    const lessonResult = await env.DB.prepare(`
      SELECT
        lesson_id,
        status,
        last_accessed_at,
        completed_at,
        updated_at
      FROM lesson_progress
      WHERE user_id = ?
      ORDER BY last_accessed_at DESC
    `).bind(userId).all();

    const quizResult = await env.DB.prepare(`
      SELECT
        id,
        lesson_id,
        question_id,
        selected_answer,
        is_correct,
        attempted_at
      FROM quiz_attempts
      WHERE user_id = ?
      ORDER BY attempted_at DESC
    `).bind(userId).all();

    const lessons = lessonResult.results || [];
    const quizAttempts = quizResult.results || [];

    return jsonResponse({
      ok: true,
      lastAccessedLesson: lessons.length
        ? lessons[0].lesson_id
        : null,
      lessons,
      quizAttempts
    });

  } catch (error) {
    console.error("Get progress error:", error);

    return jsonResponse(
      { error: "Unable to retrieve learning progress." },
      500
    );
  }
}


// POST /api/progress/lesson
// action: "access" or "complete"
async function updateLessonProgress(request, env) {
  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { error: "Invalid request origin." },
      403
    );
  }

  try {
    const auth = await requireVerifiedStudent(request, env);
    if (auth.error) return auth.error;

    const body = await readJsonBody(request);

    const lessonId = body.lessonId;
    const action = body.action;

    if (
      typeof lessonId !== "string" ||
      !["access", "complete"].includes(action)
    ) {
      return jsonResponse(
        { error: "Invalid lesson progress request." },
        400
      );
    }

    const lesson = await loadLessonForProgress(
      lessonId,
      request,
      env
    );

    if (!lesson) {
      return jsonResponse(
        { error: "Lesson not found." },
        404
      );
    }

    const now = new Date().toISOString();
    const completedAt = action === "complete" ? now : null;

    await env.DB.prepare(`
      INSERT INTO lesson_progress (
        user_id,
        lesson_id,
        status,
        last_accessed_at,
        completed_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)

      ON CONFLICT(user_id, lesson_id)
      DO UPDATE SET
        status = CASE
          WHEN excluded.status = 'completed' THEN 'completed'
          ELSE lesson_progress.status
        END,
        last_accessed_at = excluded.last_accessed_at,
        completed_at = CASE
          WHEN excluded.status = 'completed'
            THEN COALESCE(
              lesson_progress.completed_at,
              excluded.completed_at
            )
          ELSE lesson_progress.completed_at
        END,
        updated_at = excluded.updated_at
    `).bind(
      auth.user.user_id,
      lessonId,
      action === "complete" ? "completed" : "in_progress",
      now,
      completedAt,
      now
    ).run();

    const persisted = await env.DB.prepare(`
      SELECT status, completed_at, last_accessed_at
      FROM lesson_progress WHERE user_id = ? AND lesson_id = ?
    `).bind(auth.user.user_id, lessonId).first();

    return jsonResponse({
      ok: true,
      lessonId,
      status: persisted?.status || "in_progress",
      completedAt: persisted?.completed_at || null,
      lastAccessedAt: persisted?.last_accessed_at || now
    });

  } catch (error) {
    console.error("Update lesson progress error:", error);

    return jsonResponse(
      { error: "Unable to save lesson progress." },
      500
    );
  }
}


// POST /api/progress/quiz
async function saveQuizAttempt(request, env) {
  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { error: "Invalid request origin." },
      403
    );
  }

  try {
    const auth = await requireVerifiedStudent(request, env);
    if (auth.error) return auth.error;

    const body = await readJsonBody(request);

    const lessonId = body.lessonId;
    const questionIndex = body.questionIndex;
    const selectedAnswer = body.selectedAnswer;

    if (
      typeof lessonId !== "string" ||
      !Number.isSafeInteger(questionIndex) ||
      questionIndex < 0 ||
      !Number.isSafeInteger(selectedAnswer) ||
      selectedAnswer < 0
    ) {
      return jsonResponse(
        { error: "Invalid quiz submission." },
        400
      );
    }

    const lesson = await loadLessonForProgress(
      lessonId,
      request,
      env
    );

    if (!lesson) {
      return jsonResponse(
        { error: "Lesson not found." },
        404
      );
    }

    const quizBlocks = lesson.blocks.filter(
      block => block.type === "quiz"
    );

    if (questionIndex >= quizBlocks.length) {
      return jsonResponse(
        { error: "Quiz question not found." },
        404
      );
    }

    const question = quizBlocks[questionIndex];

    if (
      !Array.isArray(question.choices) ||
      !Number.isInteger(question.correctAnswer) ||
      question.correctAnswer < 0 ||
      question.correctAnswer >= question.choices.length ||
      selectedAnswer >= question.choices.length
    ) {
      return jsonResponse(
        { error: "Invalid answer selection." },
        400
      );
    }

    const isCorrect = selectedAnswer === question.correctAnswer;
    const attemptId = crypto.randomUUID();
    const now = new Date().toISOString();
    const userId = auth.user.user_id;

    // Save the attempt and update lesson access together.
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO quiz_attempts (
          id,
          user_id,
          lesson_id,
          question_id,
          selected_answer,
          is_correct,
          attempted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        attemptId,
        userId,
        lessonId,
        `q${questionIndex + 1}`,
        selectedAnswer,
        isCorrect ? 1 : 0,
        now
      ),

      env.DB.prepare(`
        INSERT INTO lesson_progress (
          user_id,
          lesson_id,
          status,
          last_accessed_at,
          updated_at
        )
        VALUES (?, ?, 'in_progress', ?, ?)

        ON CONFLICT(user_id, lesson_id)
        DO UPDATE SET
          last_accessed_at = excluded.last_accessed_at,
          updated_at = excluded.updated_at
      `).bind(userId, lessonId, now, now)
    ]);

    return jsonResponse({
      ok: true,
      attemptId,
      lessonId,
      questionId: `q${questionIndex + 1}`,
      isCorrect,
      correctAnswer: question.correctAnswer
    });

  } catch (error) {
    console.error("Save quiz attempt error:", error);

    return jsonResponse(
      { error: "Unable to save quiz attempt." },
      500
    );
  }
}


// ============================================================
// ADMIN ANALYTICS (read-only)
// ============================================================

async function requireAdmin(request, env) {
  const user = await authenticateRequest(request, env);
  if (!user || !user.email_verified || user.role !== "admin") {
    return { error: jsonResponse({ error: "Administrator access required." }, 403) };
  }
  return { user };
}

async function getAdminOverview(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const url = new URL(request.url);
    const range = [7, 30, 90].includes(Number(url.searchParams.get("days")))
      ? Number(url.searchParams.get("days")) : 30;
    const since = new Date(Date.now() - range * 86400000).toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_in_range
        FROM users WHERE status = 'active'`).bind(since),
      env.DB.prepare(`SELECT COUNT(DISTINCT user_id) AS active
        FROM lesson_progress WHERE last_accessed_at >= ?`).bind(since),
      env.DB.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
        FROM lesson_progress`),
      env.DB.prepare(`SELECT COUNT(*) AS total, SUM(is_correct) AS correct,
        COUNT(DISTINCT user_id) AS learners FROM quiz_attempts`),
      env.DB.prepare(`SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
        FROM users WHERE created_at >= ? AND status = 'active'
        GROUP BY substr(created_at, 1, 10) ORDER BY day`).bind(since),
      env.DB.prepare(`SELECT lesson_id, COUNT(*) AS learners,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completions
        FROM lesson_progress GROUP BY lesson_id ORDER BY learners DESC LIMIT 8`),
      env.DB.prepare(`SELECT COALESCE(p.language, 'en') AS language, COUNT(*) AS users
        FROM users u LEFT JOIN user_preferences p ON p.user_id = u.id
        WHERE u.status = 'active' GROUP BY COALESCE(p.language, 'en') ORDER BY users DESC`)
    ]);
    const first = r => r?.results?.[0] || {};
    const u = first(results[0]), p = first(results[2]), q = first(results[3]);
    return jsonResponse({
      ok: true, range,
      metrics: {
        totalUsers: Number(u.total || 0), verifiedUsers: Number(u.verified || 0),
        newUsers: Number(u.new_in_range || 0), activeLearners: Number(first(results[1]).active || 0),
        lessonRecords: Number(p.total || 0), lessonsCompleted: Number(p.completed || 0),
        quizAttempts: Number(q.total || 0), correctAnswers: Number(q.correct || 0),
        quizAccuracy: Number(q.total ? Math.round((q.correct || 0) * 100 / q.total) : 0),
        quizLearners: Number(q.learners || 0)
      },
      signups: results[4]?.results || [], popularLessons: results[5]?.results || [],
      languages: results[6]?.results || []
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return jsonResponse({ error: "Unable to load admin analytics." }, 500);
  }
}

async function getAdminUsers(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const page = Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1));
    const joinedRaw = Number(url.searchParams.get("joinedDays")) || 0;
    const joinedDays = [7, 30, 90].includes(joinedRaw) ? joinedRaw : 0;
    const activeRaw = url.searchParams.get("activeDays") || "0";
    const activeDays = ["7", "30", "90", "inactive"].includes(activeRaw) ? activeRaw : "0";
    const joinedSince = joinedDays ? new Date(Date.now() - joinedDays * 86400000).toISOString() : "";
    const activeSince = ["7", "30", "90"].includes(activeDays) ? new Date(Date.now() - Number(activeDays) * 86400000).toISOString() : "";
    const limit = 25, offset = (page - 1) * limit;
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const filters = `(? = '' OR u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')
      AND (? = '' OR u.created_at >= ?)
      AND (? = '0' OR (? = 'inactive' AND NOT EXISTS (SELECT 1 FROM lesson_progress lp WHERE lp.user_id = u.id) AND NOT EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.user_id = u.id))
        OR (? != 'inactive' AND (EXISTS (SELECT 1 FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.last_accessed_at >= ?) OR EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.user_id = u.id AND qa.attempted_at >= ?))))`;
    const filterBinds = [search, pattern, pattern, joinedSince, joinedSince, activeDays, activeDays, activeDays, activeSince, activeSince];
    const [count, rows] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS total FROM users u WHERE ${filters}`).bind(...filterBinds).first(),
      env.DB.prepare(`SELECT u.id, u.name, u.email, u.role, u.email_verified,
          u.status, u.created_at,
          MAX(
            COALESCE((SELECT MAX(lp.last_accessed_at) FROM lesson_progress lp WHERE lp.user_id = u.id), ''),
            COALESCE((SELECT MAX(qa.attempted_at) FROM quiz_attempts qa WHERE qa.user_id = u.id), '')
          ) AS last_activity,
          (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.user_id = u.id AND lp.status = 'completed') AS lessons_completed,
          (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.user_id = u.id) AS quiz_attempts
        FROM users u WHERE ${filters}
        ORDER BY u.created_at DESC LIMIT ? OFFSET ?`)
        .bind(...filterBinds, limit, offset).all()
    ]);
    return jsonResponse({ ok: true, page, pageSize: limit, total: Number(count?.total || 0), users: rows.results || [] });
  } catch (error) {
    console.error("Admin users error:", error);
    return jsonResponse({ error: "Unable to load users." }, 500);
  }
}

async function getAdminUserDetail(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.error;
  try {
    const url = new URL(request.url), id = (url.searchParams.get("id") || "").trim();
    if (!id || id.length > 100) return jsonResponse({ error: "A valid user ID is required." }, 400);
    const user = await env.DB.prepare(`SELECT id, name, email, role, email_verified,
      status, created_at, updated_at FROM users WHERE id = ? LIMIT 1`).bind(id).first();
    if (!user) return jsonResponse({ error: "User not found." }, 404);
    const [lessons, quizzes, prefs, quizSummary] = await Promise.all([
      env.DB.prepare(`SELECT lesson_id, status, last_accessed_at, completed_at
        FROM lesson_progress WHERE user_id = ? ORDER BY last_accessed_at DESC`).bind(id).all(),
      env.DB.prepare(`SELECT lesson_id, question_id, is_correct, attempted_at
        FROM quiz_attempts WHERE user_id = ? ORDER BY attempted_at DESC LIMIT 200`).bind(id).all(),
      env.DB.prepare(`SELECT theme, language FROM user_preferences WHERE user_id = ?`).bind(id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS total, SUM(is_correct) AS correct
        FROM quiz_attempts WHERE user_id = ?`).bind(id).first()
    ]);
    return jsonResponse({
      ok: true, user: { ...user, language: prefs?.language || "en", theme: prefs?.theme || "system" },
      lessons: lessons.results || [], quizzes: quizzes.results || [],
      quizSummary: { total: Number(quizSummary?.total || 0), correct: Number(quizSummary?.correct || 0) }
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return jsonResponse({ error: "Unable to load user details." }, 500);
  }
}

function isProtectedLessonPath(pathname) {
  return /^\/data\/lessons\/lesson_(?:[1-9]|[1-9]\d|100)\.json$/.test(
    pathname
  );
}


// ============================================================
// SECURITY HEADERS
// ============================================================

function applyHeaders(response, privateContent = false) {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  if (privateContent) {
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("Pragma", "no-cache");
    headers.set("Vary", "Cookie");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}



async function readJsonBody(request, maxBytes = 16 * 1024) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > maxBytes) throw new Error("Request body too large.");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("Request body too large.");
  return JSON.parse(raw);
}

// ============================================================
// RESPONSE UTILITIES
// ============================================================

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}


// ============================================================
// VISITOR ANALYTICS
// ============================================================

function logVisitor(request) {
  const url = new URL(request.url);

  if (url.pathname.includes(".") && !url.pathname.endsWith(".html")) {
    return;
  }

  const ip = request.headers.get("cf-connecting-ip") || "Unknown IP";
  const userAgent = request.headers.get("user-agent") || "Unknown Device";
  const city = request.cf?.city || "Unknown City";
  const country = request.cf?.country || "Unknown Country";

  console.log(
    `[NEW VISITOR] IP: ${ip} | Location: ${city}, ${country} | Path: ${url.pathname} | Device: ${userAgent}`
  );
}


// ============================================================
// REGISTRATION
// ============================================================

async function registerStudent(request, env) {
  if (!env.DB || !env.RESEND_API_KEY || !env.APP_BASE_URL) {
    return jsonResponse(
      { error: "Registration service is not configured." },
      503
    );
  }

  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { error: "Invalid request origin." },
      403
    );
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(
      { error: "Invalid request body." },
      400
    );
  }

  const name = typeof body.name === "string"
    ? body.name.trim()
    : "";

  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";

  const password = typeof body.password === "string"
    ? body.password
    : "";

  if (name.length < 2 || name.length > 80) {
    return jsonResponse(
      { error: "Enter a valid name." },
      400
    );
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return jsonResponse(
      { error: "Enter a valid email address." },
      400
    );
  }

  if (password.length < 8 || password.length > 128) {
    return jsonResponse(
      { error: "Password must be between 8 and 128 characters." },
      400
    );
  }

  if (!(await enforceAuthRateLimit(request, env, "register", email, 5, 3600))) {
    return jsonResponse({ error: "Too many registration attempts. Please try again later." }, 429);
  }

  const userId = crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const verificationToken = generateSecureToken();

  const passwordHash = await hashPassword(password);
  const verificationTokenHash = await hashToken(verificationToken);

  const expiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    await env.DB.batch([
      env.DB.prepare(`
                INSERT INTO users (
                    id, name, email, email_normalized, password_hash
                )
                VALUES (?, ?, ?, ?, ?)
            `).bind(userId, name, email, email, passwordHash),

      env.DB.prepare(`
                INSERT INTO auth_tokens (
                    id, user_id, token_hash, purpose, expires_at
                )
                VALUES (?, ?, ?, 'email_verification', ?)
            `).bind(
        tokenId,
        userId,
        verificationTokenHash,
        expiresAt
      ),

      env.DB.prepare(`
                INSERT INTO user_preferences (user_id)
                VALUES (?)
            `).bind(userId)
    ]);
  } catch (error) {
    console.error("Registration database error:", error);

    // Avoid disclosing whether the email already exists.
    return jsonResponse({
      ok: true,
      message: "We couldn't complete registration right now. If you already have an account, try signing in or request a verification link."
    });
  }

  let verificationUrl;

  try {
    const appUrl = new URL(env.APP_BASE_URL);

    if (appUrl.protocol !== "https:" && appUrl.hostname !== "localhost") {
      throw new Error("APP_BASE_URL must use HTTPS.");
    }

    verificationUrl = new URL("/verify-email.html", appUrl);
    verificationUrl.searchParams.set("token", verificationToken);
  } catch (error) {
    console.error("Invalid APP_BASE_URL:", error);

    return jsonResponse(
      { error: "Registration service is not configured correctly." },
      503
    );
  }

  const emailResult = await sendVerificationEmail(
    env.RESEND_API_KEY,
    email,
    name,
    verificationUrl.toString()
  );

  if (!emailResult.ok) {
    console.error(
      "Verification email delivery failed:",
      emailResult.status
    );

    // Keep the unverified account and token.
    // A resend-verification endpoint will allow recovery.
    return jsonResponse(
      {
        error: "Your account was created, but we couldn't send the verification email. Please request a new verification email."
      },
      502
    );
  }

  return jsonResponse({
    ok: true,
    message: "Account created. Please check your email to verify your account."
  }, 201);
}


// ============================================================
// REQUEST ORIGIN VALIDATION
// ============================================================

function isSameOriginRequest(request) {
  const origin = request.headers.get("Origin");

  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

// ============================================================
// RESEND EMAIL INTEGRATION
// ============================================================

async function sendVerificationEmail(
  apiKey,
  email,
  name,
  verificationUrl
) {
  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "KiteLearn <accounts@mail.kitelearn.in>",
          to: [email],
          subject: "Verify your KiteLearn account",
          html: `
                        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14213D">
                            <h2>Welcome to KiteLearn, ${escapeHtml(name)}!</h2>
                            <p>You're one step away from starting your stock market learning journey.</p>
                            <p>Please verify your email address:</p>
                            <p style="margin:28px 0">
                                <a href="${verificationUrl}"
                                   style="background:#2563EB;color:#fff;padding:13px 22px;text-decoration:none;border-radius:7px;display:inline-block">
                                   Verify Email Address
                                </a>
                            </p>
                            <p>This link expires in 24 hours and can only be used once.</p>
                            <p>If you didn't create this account, you can ignore this email.</p>
                            <hr>
                            <p style="font-size:12px;color:#666">KiteLearn - A Personal Tutor for the Stock Market</p>
                        </div>
                    `
        })
      }
    );

    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error("Resend API request failed:", error);
    return { ok: false, status: 0 };
  }
}


function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}


// ============================================================
// EMAIL VERIFICATION
// ============================================================


async function resendVerificationEmail(request, env) {
    const genericResponse = () => jsonResponse({
        ok: true,
        message: "If an unverified account exists for this email, a verification email will be sent."
    });

    if (!env.DB || !env.RESEND_API_KEY || !env.APP_BASE_URL) {
        return jsonResponse(
            { error: "Verification service is not configured." },
            503
        );
    }

    if (!isSameOriginRequest(request)) {
        return jsonResponse(
            { error: "Invalid request origin." },
            403
        );
    }

    let body;

    try {
        body = await readJsonBody(request);
    } catch {
        return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const email = typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (
        !email ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        return jsonResponse({ error: "Enter a valid email address." }, 400);
    }

    if (!(await enforceAuthRateLimit(request, env, "resend-verification", email, 3, 3600))) {
        return genericResponse();
    }

    let appUrl;

    try {
        appUrl = new URL(env.APP_BASE_URL);

        if (
            appUrl.protocol !== "https:" &&
            appUrl.hostname !== "localhost"
        ) {
            throw new Error("APP_BASE_URL must use HTTPS.");
        }
    } catch (error) {
        console.error("Invalid APP_BASE_URL:", error);
        return jsonResponse(
            { error: "Verification service is not configured correctly." },
            503
        );
    }

    try {
        const user = await env.DB.prepare(`
            SELECT id, name, email
            FROM users
            WHERE email_normalized = ?
              AND email_verified = 0
              AND status = 'active'
            LIMIT 1
        `).bind(email).first();

        // Same response for unknown, verified and inactive accounts.
        if (!user) {
            return genericResponse();
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const oneHourAgo = new Date(
            now.getTime() - 60 * 60 * 1000
        ).toISOString();

        // Maximum three verification tokens per account per hour.
        const recentCount = await env.DB.prepare(`
            SELECT COUNT(*) AS total
            FROM auth_tokens
            WHERE user_id = ?
              AND purpose = 'email_verification'
              AND created_at >= ?
        `).bind(user.id, oneHourAgo).first();

        if ((recentCount?.total || 0) >= 3) {
            return genericResponse();
        }

        const token = generateSecureToken();
        const tokenHash = await hashToken(token);
        const tokenId = crypto.randomUUID();

        const expiresAt = new Date(
            now.getTime() + 24 * 60 * 60 * 1000
        ).toISOString();

        // Invalidate old links and create the new token atomically.
        await env.DB.batch([
            env.DB.prepare(`
                UPDATE auth_tokens
                SET used_at = ?
                WHERE user_id = ?
                  AND purpose = 'email_verification'
                  AND used_at IS NULL
            `).bind(nowIso, user.id),

            env.DB.prepare(`
                INSERT INTO auth_tokens (
                    id, user_id, token_hash, purpose, expires_at
                )
                VALUES (?, ?, ?, 'email_verification', ?)
            `).bind(tokenId, user.id, tokenHash, expiresAt)
        ]);

        const verificationUrl = new URL(
            "/verify-email.html",
            appUrl
        );

        verificationUrl.searchParams.set("token", token);

        const emailResult = await sendVerificationEmail(
            env.RESEND_API_KEY,
            user.email,
            user.name,
            verificationUrl.toString()
        );

        if (!emailResult.ok) {
            console.error(
                "Resend verification delivery failed:",
                emailResult.status
            );
        }

        // Do not reveal whether an account exists or email delivery succeeded.
        return genericResponse();

    } catch (error) {
        console.error("Resend verification error:", error);

        return jsonResponse(
            { error: "Unable to process your request. Please try again." },
            500
        );
    }
}

async function verifyStudentEmail(request, env) {
  if (!env.DB) {
    return jsonResponse(
      { error: "Verification service is unavailable." },
      503
    );
  }

  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      { error: "Invalid request origin." },
      403
    );
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(
      { error: "Invalid request body." },
      400
    );
  }

  const token = typeof body.token === "string"
    ? body.token
    : "";

  if (
    token.length < 20 ||
    token.length > 200 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return jsonResponse(
      { error: "Invalid or expired verification link." },
      400
    );
  }

  try {
    const tokenHash = await hashToken(token);
    const now = new Date().toISOString();

    // All verification changes execute in one D1 transaction.
    const results = await env.DB.batch([

      // 1. Verify the account using a valid, unused token.
      env.DB.prepare(`
                UPDATE users
                SET email_verified = 1,
                    updated_at = ?
                WHERE id = (
                    SELECT user_id
                    FROM auth_tokens
                    WHERE token_hash = ?
                      AND purpose = 'email_verification'
                      AND used_at IS NULL
                      AND expires_at > ?
                )
                AND email_verified = 0
                AND status = 'active'
            `).bind(now, tokenHash, now),

      // 2. Consume that exact token only after account verification.
      env.DB.prepare(`
                UPDATE auth_tokens
                SET used_at = ?
                WHERE token_hash = ?
                  AND purpose = 'email_verification'
                  AND used_at IS NULL
                  AND expires_at > ?
                  AND EXISTS (
                      SELECT 1
                      FROM users
                      WHERE users.id = auth_tokens.user_id
                        AND users.email_verified = 1
                        AND users.updated_at = ?
                        AND users.status = 'active'
                  )
            `).bind(now, tokenHash, now, now),

      // 3. Invalidate any other outstanding verification links.
      env.DB.prepare(`
                UPDATE auth_tokens
                SET used_at = ?
                WHERE purpose = 'email_verification'
                  AND used_at IS NULL
                  AND user_id = (
                      SELECT user_id
                      FROM auth_tokens
                      WHERE token_hash = ?
                        AND purpose = 'email_verification'
                        AND used_at = ?
                  )
            `).bind(now, tokenHash, now)
    ]);

    const accountVerified =
      results[0]?.meta?.changes === 1;

    const tokenConsumed =
      results[1]?.meta?.changes === 1;

    if (!accountVerified || !tokenConsumed) {
      return jsonResponse(
        {
          error: "This verification link is invalid, expired or already used."
        },
        400
      );
    }

    return jsonResponse({
      ok: true,
      message: "Your email has been verified. You can now sign in."
    });

  } catch (error) {
    console.error("Email verification error:", error);

    return jsonResponse(
      { error: "Unable to verify your email. Please try again." },
      500
    );
  }
}

// ============================================================
// PASSWORD RECOVERY
// ============================================================
async function sendPasswordResetEmail(apiKey, email, name, resetUrl) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "KiteLearn <accounts@mail.kitelearn.in>",
        to: [email],
        subject: "Reset your KiteLearn password",
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14213D"><h2>Password reset</h2><p>Hello ${escapeHtml(name)},</p><p>We received a request to reset your KiteLearn password.</p><p style="margin:28px 0"><a href="${resetUrl}" style="background:#2563EB;color:#fff;padding:13px 22px;text-decoration:none;border-radius:7px;display:inline-block">Reset Password</a></p><p>This link expires in one hour and can only be used once. If you did not request this, ignore this email.</p><hr><p style="font-size:12px;color:#666">KiteLearn - A Personal Tutor for the Stock Market</p></div>`
      })
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error("Password reset email failed:", error);
    return { ok: false, status: 0 };
  }
}

async function requestPasswordReset(request, env) {
  const generic = () => jsonResponse({ ok: true, message: "If an account exists for this email, password reset instructions will be sent." });
  if (!env.DB || !env.RESEND_API_KEY || !env.APP_BASE_URL) return jsonResponse({ error: "Password recovery is unavailable." }, 503);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  let body;
  try { body = await readJsonBody(request); } catch { return jsonResponse({ error: "Invalid request body." }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: "Enter a valid email address." }, 400);
  if (!(await enforceAuthRateLimit(request, env, "forgot-password", email, 3, 3600))) return generic();
  try {
    const user = await env.DB.prepare(`SELECT id, name, email FROM users WHERE email_normalized = ? AND status = 'active' AND email_verified = 1 LIMIT 1`).bind(email).first();
    if (!user) return generic();
    const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM auth_tokens WHERE user_id = ? AND purpose = 'password_reset' AND created_at >= ?`).bind(user.id, new Date(Date.now()-3600000).toISOString()).first();
    if ((recent?.total || 0) >= 3) return generic();
    const token = generateSecureToken();
    const tokenHash = await hashToken(token);
    const now = new Date().toISOString();
    const expires = new Date(Date.now()+3600000).toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL`).bind(now, user.id),
      env.DB.prepare(`INSERT INTO auth_tokens (id,user_id,token_hash,purpose,expires_at) VALUES (?,?,?,'password_reset',?)`).bind(crypto.randomUUID(), user.id, tokenHash, expires)
    ]);
    const base = new URL(env.APP_BASE_URL);
    if (base.protocol !== "https:" && base.hostname !== "localhost") throw new Error("APP_BASE_URL must use HTTPS.");
    const resetUrl = new URL("/reset-password.html", base);
    resetUrl.searchParams.set("token", token);
    const sent = await sendPasswordResetEmail(env.RESEND_API_KEY, user.email, user.name, resetUrl.toString());
    if (!sent.ok) console.error("Password reset email delivery failed:", sent.status);
    return generic();
  } catch (error) {
    console.error("Forgot password error:", error);
    return jsonResponse({ error: "Unable to process your request. Please try again." }, 500);
  }
}

async function resetStudentPassword(request, env) {
  if (!env.DB) return jsonResponse({ error: "Password recovery is unavailable." }, 503);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Invalid request origin." }, 403);
  let body;
  try { body = await readJsonBody(request); } catch { return jsonResponse({ error: "Invalid request body." }, 400); }
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return jsonResponse({ error: "This reset link is invalid or expired." }, 400);
  if (password.length < 8 || password.length > 128) return jsonResponse({ error: "Password must be between 8 and 128 characters." }, 400);
  if (!(await enforceAuthRateLimit(request, env, "reset-password", token.slice(0, 12), 8, 3600))) return jsonResponse({ error: "Too many attempts. Please try again later." }, 429);
  try {
    const tokenHash = await hashToken(token);
    const tokenRow = await env.DB.prepare(`SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > ? LIMIT 1`).bind(tokenHash, new Date().toISOString()).first();
    if (!tokenRow) return jsonResponse({ error: "This reset link is invalid, expired or already used." }, 400);
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const results = await env.DB.batch([
      env.DB.prepare(`UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > ?`).bind(now, tokenHash, now),
      env.DB.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND status = 'active' AND EXISTS (SELECT 1 FROM auth_tokens WHERE token_hash = ? AND used_at = ? AND user_id = users.id)`).bind(passwordHash, now, tokenRow.user_id, tokenHash, now),
      env.DB.prepare(`DELETE FROM sessions WHERE user_id = ? AND EXISTS (SELECT 1 FROM auth_tokens WHERE token_hash = ? AND used_at = ? AND user_id = ?)`).bind(tokenRow.user_id, tokenHash, now, tokenRow.user_id),
      env.DB.prepare(`UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL`).bind(now, tokenRow.user_id)
    ]);
    if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1) return jsonResponse({ error: "This reset link is invalid, expired or already used." }, 400);
    return jsonResponse({ ok: true, message: "Your password has been reset. Please sign in with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    return jsonResponse({ error: "Unable to reset your password. Please try again." }, 500);
  }
}
