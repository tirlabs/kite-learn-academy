const fs = require("fs");
const path = require("path");

// -----------------------------------------------------
// Configuration
// -----------------------------------------------------

const SITE_URL = "https://kitelearn.in";

const CURRICULUM_FILE = path.join(__dirname, "../data/curriculum.json");
const OUTPUT_FILE = path.join(__dirname, "../sitemap.xml");

// -----------------------------------------------------
// Read Curriculum
// -----------------------------------------------------

const curriculum = JSON.parse(
    fs.readFileSync(CURRICULUM_FILE, "utf8")
);

const today = new Date().toISOString().split("T")[0];

// -----------------------------------------------------
// Start XML
// -----------------------------------------------------

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">

   
`;

// -----------------------------------------------------
// Add Lessons
// -----------------------------------------------------


const staticPages = [
    {
        url: "https://kitelearn.in/",
        priority: "1.0",
        changefreq: "weekly"
    },
    {
        url: "https://kitelearn.in/about.html",
        priority: "0.6",
        changefreq: "yearly"
    },
    {
        url: "https://kitelearn.in/privacy.html",
        priority: "0.3",
        changefreq: "yearly"
    },
    {
        url: "https://kitelearn.in/terms.html",
        priority: "0.3",
        changefreq: "yearly"
    }
];

staticPages.forEach(page => {

    xml += `
    <url>
        <loc>${page.url}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`;

});

curriculum.forEach(module => {

    module.lessons.forEach(lesson => {

        xml += `
    <url>
        <loc>${SITE_URL}/?lesson=${lesson.id}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>`;

    });

});

// -----------------------------------------------------
// Close XML
// -----------------------------------------------------

xml += `

</urlset>
`;

// -----------------------------------------------------
// Write File
// -----------------------------------------------------

fs.writeFileSync(OUTPUT_FILE, xml, "utf8");

console.log("✅ Sitemap generated successfully.");
console.log(`📄 ${OUTPUT_FILE}`);