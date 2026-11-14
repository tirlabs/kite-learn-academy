const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://kitelearn.in";
const CURRICULUM_FILE = path.join(ROOT, "data/curriculum.json");
const LESSONS_DIR = path.join(ROOT, "data/lessons");
const OUTPUT_DIR = path.join(ROOT, "learn");

function slugify(value) {
  return value.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function stripMarkup(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function previewParagraphs(lesson) {
  const allowed = new Set(["p", "story", "example", "tip", "fact", "warning"]);
  const paragraphs = [];
  let words = 0;

  for (const block of lesson.blocks || []) {
    if (!allowed.has(block.type) || typeof block.value !== "string") continue;
    const text = stripMarkup(block.value);
    if (text.length < 35) continue;
    const nextWords = text.split(/\s+/).length;
    if (words >= 145) break;
    paragraphs.push(text);
    words += nextWords;
    if (paragraphs.length >= 3 || words >= 145) break;
  }

  return paragraphs;
}

function renderLessonPage(module, lesson, content, previous, next) {
  const title = `${lesson.title} | KiteLearn`;
  const description = `A beginner-friendly introduction to ${lesson.title.toLowerCase()}. Explore this lesson preview from KiteLearn's structured stock market and investing curriculum.`;
  const canonical = `${SITE_URL}/learn/${lesson.slug}/`;
  const paragraphs = content.map(text => `<p>${escapeHtml(text)}</p>`).join("\n");
  const moduleName = module.moduleName.replace(/^\s*Module\s*\d+\s*-\s*/i, "").trim();

  const related = `
    <nav class="kl-related" aria-label="Lesson navigation">
      ${previous ? `<a href="/learn/${previous.slug}/">← Previous: ${escapeHtml(previous.title)}</a>` : "<span></span>"}
      ${next ? `<a href="/learn/${next.slug}/">Next: ${escapeHtml(next.title)} →</a>` : ""}
    </nav>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/css/public-pages.css">
  <meta name="theme-color" content="#2563eb">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="KiteLearn">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}/images/cover.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "name": lesson.title,
    "description": description,
    "learningResourceType": "Lesson preview",
    "educationalLevel": lesson.difficulty || "Beginner",
    "inLanguage": "en",
    "isAccessibleForFree": true,
    "url": canonical,
    "provider": { "@type": "Organization", "name": "KiteLearn", "url": SITE_URL }
  }).replace(/</g, "\\u003c")}</script>
</head>
<body>
  <header class="kl-public-header">
    <div class="kl-public-header-inner">
      <a href="/" aria-label="KiteLearn home"><img class="kl-public-logo" src="/kitelearn-logo-final.png" alt="KiteLearn — A Personal Tutor for the Stock Market"></a>
      <nav class="kl-public-nav" aria-label="Main navigation">
        <a href="/learn/">Learn</a><a href="/about.html">About</a>
      </nav>
    </div>
  </header>
  <main class="kl-public-main">
    <div class="kl-breadcrumb"><a href="/">Home</a> / <a href="/learn/">Learn</a> / ${escapeHtml(lesson.title)}</div>
    <div class="kl-eyebrow">${escapeHtml(moduleName)}</div>
    <h1 class="kl-title">${escapeHtml(lesson.title)}</h1>
    <div class="kl-meta"><span>${escapeHtml(lesson.readingTime || "Short lesson")}</span><span>${escapeHtml(lesson.difficulty || "Beginner")}</span></div>
    <article class="kl-panel">
      <h2>Understand the idea</h2>
      <div class="kl-content">${paragraphs}</div>
      <section class="kl-callout" aria-labelledby="continue-title">
        <h2 id="continue-title">Continue learning with KiteLearn</h2>
        <p>This is a preview of the lesson. Sign in to access the complete learning experience, examples, activities and knowledge checks.</p>
        <a class="kl-button" href="/?lesson=${encodeURIComponent(lesson.id)}">Sign in to continue</a>
      </section>
    </article>
    ${related}
  </main>
  <footer class="kl-footer">KiteLearn · Simple language. Strong concepts. Practical understanding.<br><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/about.html">About</a></footer>
</body>
</html>`;
}

function renderLearnIndex(modules) {
  const groups = modules.map(module => {
    const links = module.lessons.map(lesson =>
      `<li><a href="/learn/${lesson.slug}/">${escapeHtml(lesson.title)}</a></li>`
    ).join("\n");
    return `<section class="kl-module"><h2>${escapeHtml(module.moduleName.trim())}</h2><p>${escapeHtml(module.description || "")}</p><ul>${links}</ul></section>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Learn Stock Market & Investing | KiteLearn</title>
<meta name="description" content="Explore KiteLearn's structured beginner-friendly lessons on money, investing and the stock market. Build understanding one concept at a time.">
<meta name="robots" content="index,follow"><link rel="canonical" href="${SITE_URL}/learn/">
<link rel="stylesheet" href="/css/public-pages.css"><meta name="theme-color" content="#2563eb">
</head><body><header class="kl-public-header"><div class="kl-public-header-inner"><a href="/"><img class="kl-public-logo" src="/kitelearn-logo-final.png" alt="KiteLearn"></a><nav class="kl-public-nav"><a href="/">Home</a><a href="/about.html">About</a></nav></div></header>
<main class="kl-public-main"><div class="kl-eyebrow">KITELEARN LEARNING LIBRARY</div><h1 class="kl-title">Learn the stock market, one concept at a time</h1>
<p>Explore beginner-friendly lessons designed to make money, investing and the stock market easier to understand.</p>${groups}</main>
<footer class="kl-footer">KiteLearn · Simple language. Strong concepts. Practical understanding.</footer>
<style>.kl-module{background:#fff;border:1px solid var(--kl-line);border-radius:16px;padding:22px;margin:18px 0}.kl-module h2{margin:0}.kl-module ul{columns:2;padding-left:20px}.kl-module li{margin:7px 0}@media(max-width:600px){.kl-module ul{columns:1}}</style>
</body></html>`;
}

const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_FILE, "utf8"));
if (!Array.isArray(curriculum)) throw new Error("Curriculum must be an array.");

const all = [];
const seenSlugs = new Set();

for (const module of curriculum) {
  for (const item of module.lessons || []) {
    const lessonPath = path.join(ROOT, item.file);
    const lesson = JSON.parse(fs.readFileSync(lessonPath, "utf8"));
    if (lesson.id !== item.id || lesson.title !== item.title) {
      throw new Error(`Curriculum/lesson mismatch for ${item.id}`);
    }
    const slug = slugify(lesson.title);
    if (!slug || seenSlugs.has(slug)) throw new Error(`Missing or duplicate lesson slug: ${slug}`);
    seenSlugs.add(slug);
    const paragraphs = previewParagraphs(lesson);
    if (!paragraphs.length) throw new Error(`No public preview content for ${lesson.id}`);
    all.push({ module, lesson, slug, paragraphs });
  }
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, "index.html"), renderLearnIndex(
  curriculum.map(module => ({
    ...module,
    lessons: module.lessons.map(item => {
      const entry = all.find(candidate => candidate.lesson.id === item.id);
      return { ...item, slug: entry.slug };
    })
  }))
), "utf8");

for (let i = 0; i < all.length; i++) {
  const entry = all[i];
  const previous = i > 0 ? all[i - 1] : null;
  const next = i < all.length - 1 ? all[i + 1] : null;
  const directory = path.join(OUTPUT_DIR, entry.slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "index.html"),
    renderLessonPage(entry.module, { ...entry.lesson, slug: entry.slug }, entry.paragraphs, previous && { ...previous.lesson, slug: previous.slug }, next && { ...next.lesson, slug: next.slug }),
    "utf8"
  );
}

console.log(`Generated ${all.length} public lesson pages and /learn/ index.`);
