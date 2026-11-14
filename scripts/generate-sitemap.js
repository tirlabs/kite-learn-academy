const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://kitelearn.in";
const CURRICULUM_FILE = path.join(ROOT, "data/curriculum.json");
const OUTPUT_FILE = path.join(ROOT, "sitemap.xml");
const LEARN_DIR = path.join(ROOT, "learn");
const CALCULATORS_DIR = path.join(ROOT, "calculators");

function slugify(value) {
  return value.toLowerCase().normalize("NFKD")
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
  { loc: `${SITE_URL}/calculators/`, priority: "0.9" },
  { loc: `${SITE_URL}/about.html`, priority: "0.6" },
  { loc: `${SITE_URL}/privacy.html`, priority: "0.3" },
  { loc: `${SITE_URL}/terms.html`, priority: "0.3" }
];

const seen = new Set(urls.map(item => item.loc));
function addPage(loc, file, priority) {
  if (seen.has(loc)) throw new Error(`Duplicate sitemap URL: ${loc}`);
  if (!fs.existsSync(file)) throw new Error(`Missing public page: ${file}`);
  seen.add(loc);
  urls.push({ loc, priority });
}

for (const module of curriculum) {
  for (const lesson of module.lessons || []) {
    const slug = slugify(lesson.title);
    if (!slug) throw new Error(`Invalid lesson slug for: ${lesson.title}`);
    addPage(`${SITE_URL}/learn/${slug}/`, path.join(LEARN_DIR, slug, "index.html"), "0.8");
  }
}

const calculatorSlugs = ["sip", "lumpsum", "cagr", "compound-interest", "xirr", "swp", "inflation", "fd", "rd", "ppf", "retirement", "emi", "brokerage", "stock-average", "dividend", "stock-returns", "risk-reward", "position-sizing"];
for (const slug of calculatorSlugs) {
  const pageSlug = `${slug}-calculator`;
  addPage(`${SITE_URL}/calculators/${pageSlug}/`, path.join(CALCULATORS_DIR, pageSlug, "index.html"), "0.8");
}

const body = urls.map(item => `  <url>\n    <loc>${xmlEscape(item.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${item.priority}</priority>\n  </url>`).join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
fs.writeFileSync(OUTPUT_FILE, xml, "utf8");
console.log(`Sitemap generated: ${urls.length} canonical URLs`);
console.log(OUTPUT_FILE);
