const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const CURRICULUM_FILE = path.join(PROJECT_ROOT, "data", "curriculum.json");

const LOW_READING_TIME_MINUTES = 5;
const HIGH_READING_TIME_MINUTES = 10;

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getReadingTimeMinutes(readingTime) {
    const match = /(\d+(?:\.\d+)?)/.exec(String(readingTime || ""));
    return match ? Number(match[1]) : 0;
}

function createStats() {
    return {
        lessons: 0,
        readingTime: 0,
        quizzes: 0,
        stories: 0,
        examples: 0,
        tips: 0,
        warnings: 0,
        facts: 0,
        difficulties: {}
    };
}

function addDifficulty(stats, difficulty) {
    const label = difficulty || "Unspecified";
    stats.difficulties[label] = (stats.difficulties[label] || 0) + 1;
}

function addBlockStats(stats, block) {
    if (block.type === "quiz") stats.quizzes += 1;
    if (block.type === "story") stats.stories += 1;
    if (block.type === "example") stats.examples += 1;
    if (block.type === "tip") stats.tips += 1;
    if (block.type === "warning") stats.warnings += 1;
    if (block.type === "fact") stats.facts += 1;
}

function mergeStats(target, source) {
    target.lessons += source.lessons;
    target.readingTime += source.readingTime;
    target.quizzes += source.quizzes;
    target.stories += source.stories;
    target.examples += source.examples;
    target.tips += source.tips;
    target.warnings += source.warnings;
    target.facts += source.facts;

    Object.entries(source.difficulties).forEach(([difficulty, count]) => {
        target.difficulties[difficulty] = (target.difficulties[difficulty] || 0) + count;
    });
}

function formatMinutes(minutes) {
    return `${minutes.toFixed(1)} mins`;
}

function formatDifficultyDistribution(difficulties) {
    const entries = Object.entries(difficulties);
    if (entries.length === 0) return "None";

    return entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([difficulty, count]) => `${difficulty}: ${count}`)
        .join(", ");
}

function printModuleReport(moduleReport, index) {
    const stats = moduleReport.stats;
    const averageReadingTime = stats.lessons === 0 ? 0 : stats.readingTime / stats.lessons;

    console.log(`\n${index + 1}. ${moduleReport.moduleName}`);
    console.log(`   Lessons: ${stats.lessons}`);
    console.log(`   Total reading time: ${formatMinutes(stats.readingTime)}`);
    console.log(`   Average reading time: ${formatMinutes(averageReadingTime)}`);
    console.log(`   Quizzes: ${stats.quizzes}`);
    console.log(`   Stories: ${stats.stories}`);
    console.log(`   Examples: ${stats.examples}`);
    console.log(`   Tips: ${stats.tips}`);
    console.log(`   Warnings: ${stats.warnings}`);
    console.log(`   Facts: ${stats.facts}`);
    console.log(`   Difficulty distribution: ${formatDifficultyDistribution(stats.difficulties)}`);
}

function buildReport() {
    const curriculum = readJsonFile(CURRICULUM_FILE);
    const overall = createStats();
    const moduleReports = [];
    const lessonReadingTimes = [];

    curriculum.forEach(module => {
        const moduleStats = createStats();

        module.lessons.forEach(lessonRef => {
            const lessonFile = path.join(PROJECT_ROOT, lessonRef.file);
            const lesson = readJsonFile(lessonFile);
            const readingTime = getReadingTimeMinutes(lesson.readingTime);

            moduleStats.lessons += 1;
            moduleStats.readingTime += readingTime;
            addDifficulty(moduleStats, lesson.difficulty);

            lesson.blocks.forEach(block => addBlockStats(moduleStats, block));

            lessonReadingTimes.push({
                id: lesson.id,
                title: lesson.title,
                moduleName: module.moduleName.trim(),
                readingTime
            });
        });

        mergeStats(overall, moduleStats);

        moduleReports.push({
            moduleId: module.moduleId,
            moduleName: module.moduleName.trim(),
            stats: moduleStats
        });
    });

    return {
        totalModules: curriculum.length,
        overall,
        moduleReports,
        lessonReadingTimes
    };
}

function findHighlights(moduleReports, lessonReadingTimes) {
    const byLessonCount = moduleReports.slice().sort((a, b) => a.stats.lessons - b.stats.lessons);
    const byReadingTime = moduleReports.slice().sort((a, b) => a.stats.readingTime - b.stats.readingTime);

    return {
        shortestModule: byLessonCount[0],
        longestModule: byLessonCount[byLessonCount.length - 1],
        lowestReadingTimeModule: byReadingTime[0],
        highestReadingTimeModule: byReadingTime[byReadingTime.length - 1],
        lowReadingTimeLessons: lessonReadingTimes.filter(lesson => lesson.readingTime < LOW_READING_TIME_MINUTES),
        highReadingTimeLessons: lessonReadingTimes.filter(lesson => lesson.readingTime > HIGH_READING_TIME_MINUTES)
    };
}

function printLessonList(title, lessons) {
    console.log(`\n${title} (${lessons.length})`);

    if (lessons.length === 0) {
        console.log("  None");
        return;
    }

    lessons.forEach(lesson => {
        console.log(`  - ${lesson.id} ${lesson.title} | ${lesson.moduleName} | ${formatMinutes(lesson.readingTime)}`);
    });
}

const report = buildReport();
const highlights = findHighlights(report.moduleReports, report.lessonReadingTimes);
const averageReadingTime = report.overall.lessons === 0 ? 0 : report.overall.readingTime / report.overall.lessons;

console.log("KiteLearn Curriculum Consistency Report");
console.log("=======================================");
console.log(`Generated at: ${new Date().toISOString()}`);

console.log("\nOverall Summary");
console.log(`  Total modules: ${report.totalModules}`);
console.log(`  Total lessons: ${report.overall.lessons}`);
console.log(`  Total reading time: ${formatMinutes(report.overall.readingTime)}`);
console.log(`  Average reading time: ${formatMinutes(averageReadingTime)}`);
console.log(`  Total quizzes: ${report.overall.quizzes}`);
console.log(`  Total examples: ${report.overall.examples}`);
console.log(`  Total stories: ${report.overall.stories}`);
console.log(`  Total tips: ${report.overall.tips}`);
console.log(`  Total warnings: ${report.overall.warnings}`);
console.log(`  Total facts: ${report.overall.facts}`);
console.log(`  Difficulty distribution: ${formatDifficultyDistribution(report.overall.difficulties)}`);

console.log("\nModule Breakdown");
report.moduleReports.forEach(printModuleReport);

console.log("\nHighlights");
console.log(`  Shortest module: ${highlights.shortestModule.moduleName} (${highlights.shortestModule.stats.lessons} lessons)`);
console.log(`  Longest module: ${highlights.longestModule.moduleName} (${highlights.longestModule.stats.lessons} lessons)`);
console.log(`  Highest reading time: ${highlights.highestReadingTimeModule.moduleName} (${formatMinutes(highlights.highestReadingTimeModule.stats.readingTime)})`);
console.log(`  Lowest reading time: ${highlights.lowestReadingTimeModule.moduleName} (${formatMinutes(highlights.lowestReadingTimeModule.stats.readingTime)})`);

printLessonList(`Lessons with unusually low reading time (< ${LOW_READING_TIME_MINUTES} mins)`, highlights.lowReadingTimeLessons);
printLessonList(`Lessons with unusually high reading time (> ${HIGH_READING_TIME_MINUTES} mins)`, highlights.highReadingTimeLessons);
