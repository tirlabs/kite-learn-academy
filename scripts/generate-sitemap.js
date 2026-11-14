const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://kitelearn.in";
const CURRICULUM_FILE = path.join(ROOT, "data/curriculum.json");
const OUTPUT_FILE = path.join(ROOT, "sitemap.xml");
const LEARN_DIR = path.join(ROOT, "learn");

function slugify(value) {
  return value.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function xmlEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const curriculum = JSON.parse(fs.readFileSync(CURRICULUM_FILE, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE_URL}/`, priority: "1.0" },
  { loc: `${SITE_URL}/learn/`, priority: "0.9" },
  { loc: `${SITE_URL}/about.html`, priority: "0.6" },
  { loc: `${SITE_URL}/privacy.html`, priority: "0.3" },
  { loc: `${SITE_URL}/terms.html`, priority: "0.3" }
];

const seen = new Set(urls.map(item => item.loc));
for (const module of curriculum) {
  for (const lesson of module.lessons || []) {
    const slug = slugify(lesson.title);
    const loc = `${SITE_URL}/learn/${slug}/`;
    if (!slug || seen.has(loc)) throw new Error(`Invalid or duplicate sitemap URL: ${loc}`);
    const pageFile = path.join(LEARN_DIR, slug, "index.html");
    if (!fs.existsSync(pageFile)) throw new Error(`Missing generated public page: ${pageFile}`);
    seen.add(loc);
    urls.push({ loc, priority: "0.8" });
  }
}

const body = urls.map(item => `  <url>
    <loc>${xmlEscape(item.loc)}</loc>
    <lastmod>${today}</lastmod>
    <priority>${item.priority}</priority>
  </url>`).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
fs.writeFileSync(OUTPUT_FILE, xml, "utf8");
console.log(`Sitemap generated: ${urls.length} canonical URLs`);
console.log(OUTPUT_FILE);
