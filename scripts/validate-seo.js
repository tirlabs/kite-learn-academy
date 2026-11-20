#!/usr/bin/env node
/**
 * KiteLearn local SEO sanity check.
 * Run from the project root: node scripts/validate-seo.js
 * Checks sitemap URLs against local files, canonical consistency, metadata,
 * JSON-LD syntax, and local internal links. It cannot test live HTTP responses
 * or Google Search Console indexing.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const errors = [];
const warnings = [];
const read = (file) => fs.readFileSync(file, "utf8");
const sitemapPath = path.join(ROOT, "sitemap.xml");

function pageFileFromUrl(url) {
  const pathname = new URL(url).pathname;
  if (pathname === "/") return path.join(ROOT, "index.html");
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  if (pathname.endsWith("/")) return path.join(ROOT, relative, "index.html");
  return path.join(ROOT, relative);
}
function attr(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta\\s+[^>]*name=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"));
  if (match) return match[1];
  const reversed = html.match(new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*name=["']${escaped}["'][^>]*>`, "i"));
  return reversed ? reversed[1] : null;
}
function canonical(html) {
  const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  return match ? match[1] : null;
}
function localTarget(href) {
  const pathname = decodeURIComponent(new URL(href, "https://kitelearn.in").pathname);
  if (pathname === "/") return path.join(ROOT, "index.html");
  const relative = pathname.replace(/^\/+/, "");
  if (pathname.endsWith("/")) return path.join(ROOT, relative, "index.html");
  const exact = path.join(ROOT, relative);
  return path.extname(relative) ? exact : path.join(exact, "index.html");
}

if (!fs.existsSync(sitemapPath)) {
  console.error("ERROR: sitemap.xml not found.");
  process.exit(1);
}
const sitemap = read(sitemapPath);
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
if (!sitemap.trim().startsWith("<?xml") || !sitemap.includes("<urlset")) errors.push("Sitemap XML declaration or urlset root is missing.");
if (new Set(urls).size !== urls.length) errors.push("Sitemap contains duplicate URLs.");

let checked = 0;
for (const url of urls) {
  let file;
  try { file = pageFileFromUrl(url); } catch { errors.push(`Invalid sitemap URL: ${url}`); continue; }
  if (!fs.existsSync(file)) { errors.push(`Sitemap URL has no local file: ${url}`); continue; }
  const html = read(file);
  checked++;
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  const description = attr(html, "description");
  const canon = canonical(html);
  if (!title) errors.push(`${path.relative(ROOT, file)}: missing title.`);
  if (!description) errors.push(`${path.relative(ROOT, file)}: missing meta description.`);
  if (!canon) errors.push(`${path.relative(ROOT, file)}: missing canonical.`);
  else if (canon.replace(/\/+$/, "") !== url.replace(/\/+$/, "")) errors.push(`${path.relative(ROOT, file)}: canonical does not match sitemap URL (${canon}).`);
  if (/noindex/i.test(attr(html, "robots") || "")) errors.push(`${path.relative(ROOT, file)}: sitemap page is marked noindex.`);
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!jsonLd.length) warnings.push(`${path.relative(ROOT, file)}: no JSON-LD structured data.`);
  for (const block of jsonLd) {
    try { JSON.parse(block[1]); }
    catch { errors.push(`${path.relative(ROOT, file)}: invalid JSON-LD.`); }
  }
  for (const match of html.matchAll(/\bhref=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:|#)/i.test(href)) continue;
    let target;
    try { target = localTarget(href); } catch { continue; }
    if (!fs.existsSync(target)) errors.push(`${path.relative(ROOT, file)}: broken local link ${href}.`);
  }
}

console.log("KiteLearn SEO Validation");
console.log("========================");
console.log(`Sitemap URLs: ${urls.length}`);
console.log(`Local pages checked: ${checked}`);
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);
if (errors.length) {
  console.error("\nErrors:");
  errors.forEach((item) => console.error(`- ${item}`));
}
if (warnings.length) {
  console.log("\nWarnings:");
  warnings.forEach((item) => console.log(`- ${item}`));
}
if (errors.length) process.exit(1);
console.log("\nSEO validation: PASSED");
console.log("Note: live HTTP status, rendering, Core Web Vitals and Google indexing require external verification.");
