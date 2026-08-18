const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const CURRICULUM_FILE = path.join(PROJECT_ROOT, "data", "curriculum.json");
const LESSONS_DIR = path.join(PROJECT_ROOT, "data", "lessons");

const SUPPORTED_BLOCK_TYPES = new Set([
    "p",
    "story",
    "tip",
    "example",
    "warning",
    "fact",
    "quiz"
]);

const SUPPORTED_DIFFICULTIES = new Set([
    "Level: Beginner",
    "Level: Intermediate",
    "Level: Advanced",
    "Level: All Levels",
    "Level: Graduate"
]);

const REQUIRED_LESSON_FIELDS = [
    "id",
    "title",
    "module",
    "order",
    "readingTime",
    "difficulty",
    "blocks",
    "previousLesson",
    "nextLesson"
];

const errors = [];
const warnings = [];
const stats = {
    totalModules: 0,
    totalLessons: 0,
    totalQuizzes: 0,
    totalExamples: 0,
    totalWarnings: 0,
    totalFacts: 0,
    totalTips: 0,
    totalStories: 0,
    totalReadingTime: 0,
    lessonsWithReadingTime: 0
};

function addError(message) {
    errors.push(message);
}

function addWarning(message) {
    warnings.push(message);
}

function readJsonFile(filePath, label) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        addError(`${label}: invalid JSON (${error.message})`);
        return null;
    }
}

function normalizeProjectPath(filePath) {
    return path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getLessonNumberFromFile(fileName) {
    const match = /^lesson_(\d+)\.json$/.exec(fileName);
    return match ? Number(match[1]) : null;
}

function getLessonNumberFromId(id) {
    const match = /^l(\d+)$/.exec(id || "");
    return match ? Number(match[1]) : null;
}

function getReadingTimeMinutes(readingTime) {
    const match = /(\d+(?:\.\d+)?)/.exec(String(readingTime || ""));
    return match ? Number(match[1]) : 0;
}

function validateCurriculumShape(curriculum) {
    if (!Array.isArray(curriculum)) {
        addError("data/curriculum.json: root value must be an array of modules");
        return;
    }

    curriculum.forEach((module, moduleIndex) => {
        const moduleLabel = `data/curriculum.json module ${moduleIndex + 1}`;

        if (!isPlainObject(module)) {
            addError(`${moduleLabel}: module must be an object`);
            return;
        }

        ["moduleId", "moduleName", "description", "lessons"].forEach(field => {
            if (!(field in module)) {
                addError(`${moduleLabel}: missing required field "${field}"`);
            }
        });

        if (!Array.isArray(module.lessons)) {
            addError(`${moduleLabel}: "lessons" must be an array`);
            return;
        }

        module.lessons.forEach((lessonRef, lessonIndex) => {
            const refLabel = `${moduleLabel} lesson ${lessonIndex + 1}`;

            if (!isPlainObject(lessonRef)) {
                addError(`${refLabel}: lesson reference must be an object`);
                return;
            }

            ["id", "title", "file"].forEach(field => {
                if (!(field in lessonRef) || lessonRef[field] === "") {
                    addError(`${refLabel}: missing required field "${field}"`);
                }
            });
        });
    });
}

function validateLessonShape(lesson, fileName) {
    REQUIRED_LESSON_FIELDS.forEach(field => {
        if (!(field in lesson)) {
            addError(`${fileName}: missing required field "${field}"`);
        }
    });

    if (!Array.isArray(lesson.blocks)) {
        addError(`${fileName}: "blocks" must be an array`);
        return;
    }

    if (lesson.blocks.length === 0) {
        addWarning(`${fileName}: lesson has no content blocks`);
    }

    if (lesson.blocks.length < 5) {
        addWarning(`${fileName}: lesson has unusually low content (${lesson.blocks.length} blocks)`);
    }

    const readingTimeMinutes = getReadingTimeMinutes(lesson.readingTime);
    if (!lesson.readingTime || readingTimeMinutes <= 0) {
        addError(`${fileName}: readingTime must exist and be greater than zero`);
    } else {
        stats.totalReadingTime += readingTimeMinutes;
        stats.lessonsWithReadingTime += 1;
    }

    if (!SUPPORTED_DIFFICULTIES.has(lesson.difficulty)) {
        addError(`${fileName}: unsupported difficulty "${lesson.difficulty}"`);
    }

    let quizCount = 0;
    let exampleCount = 0;
    let tipWarningFactCount = 0;

    lesson.blocks.forEach((block, blockIndex) => {
        const blockLabel = `${fileName} block ${blockIndex + 1}`;

        if (!isPlainObject(block)) {
            addError(`${blockLabel}: block must be an object`);
            return;
        }

        if (!block.type) {
            addError(`${blockLabel}: missing block type`);
            return;
        }

        if (!SUPPORTED_BLOCK_TYPES.has(block.type)) {
            addError(`${blockLabel}: unsupported block type "${block.type}"`);
        }

        if (block.type === "quiz") {
            quizCount += 1;
            stats.totalQuizzes += 1;
            validateQuizBlock(block, blockLabel);
        } else if (!("value" in block) || String(block.value).trim() === "") {
            addWarning(`${blockLabel}: "${block.type}" block has an empty value`);
        }

        if (block.type === "example") {
            exampleCount += 1;
            stats.totalExamples += 1;
        }

        if (block.type === "warning") {
            tipWarningFactCount += 1;
            stats.totalWarnings += 1;
        }

        if (block.type === "fact") {
            tipWarningFactCount += 1;
            stats.totalFacts += 1;
        }

        if (block.type === "tip") {
            tipWarningFactCount += 1;
            stats.totalTips += 1;
        }

        if (block.type === "story") {
            stats.totalStories += 1;
        }
    });

    if (quizCount === 0) {
        addError(`${fileName}: lesson must contain at least one quiz`);
    }

    if (exampleCount === 0) {
        addWarning(`${fileName}: lesson has no example blocks`);
    }

    if (tipWarningFactCount === 0) {
        addWarning(`${fileName}: lesson has no tip, warning, or fact blocks`);
    }
}

function validateQuizBlock(block, blockLabel) {
    if (!block.question || String(block.question).trim() === "") {
        addError(`${blockLabel}: quiz question is missing`);
    }

    if (!Array.isArray(block.choices) || block.choices.length < 2) {
        addError(`${blockLabel}: quiz must have at least two choices/options`);
        return;
    }

    block.choices.forEach((choice, choiceIndex) => {
        if (String(choice).trim() === "") {
            addError(`${blockLabel}: quiz choice ${choiceIndex + 1} is empty`);
        }
    });

    if (!Number.isInteger(block.correctAnswer)) {
        addError(`${blockLabel}: correctAnswer must be an integer index`);
        return;
    }

    if (block.correctAnswer < 0 || block.correctAnswer >= block.choices.length) {
        addError(`${blockLabel}: correctAnswer index ${block.correctAnswer} is outside available choices`);
    }
}

function validate() {
    if (!fs.existsSync(CURRICULUM_FILE)) {
        addError("data/curriculum.json: file does not exist");
        return;
    }

    if (!fs.existsSync(LESSONS_DIR)) {
        addError("data/lessons: directory does not exist");
        return;
    }

    const curriculum = readJsonFile(CURRICULUM_FILE, "data/curriculum.json");
    if (!curriculum) return;

    validateCurriculumShape(curriculum);
    if (!Array.isArray(curriculum)) return;

    const lessonFiles = fs.readdirSync(LESSONS_DIR)
        .filter(fileName => fileName.endsWith(".json"))
        .sort((a, b) => {
            const aNumber = getLessonNumberFromFile(a) || 0;
            const bNumber = getLessonNumberFromFile(b) || 0;
            return aNumber - bNumber || a.localeCompare(b);
        });

    const lessonsByFile = new Map();
    const lessonsById = new Map();
    const curriculumRefsById = new Map();
    const curriculumFileRefs = new Map();
    const lessonNumbersByFile = new Map();
    const lessonNumbersById = new Map();
    const lessonTitles = new Map();

    lessonFiles.forEach(fileName => {
        const fullPath = path.join(LESSONS_DIR, fileName);
        const relativePath = normalizeProjectPath(fullPath);
        const lesson = readJsonFile(fullPath, relativePath);

        if (!lesson) return;

        lessonsByFile.set(relativePath, lesson);
        stats.totalLessons += 1;
        validateLessonShape(lesson, relativePath);

        const fileLessonNumber = getLessonNumberFromFile(fileName);
        if (fileLessonNumber !== null) {
            if (!lessonNumbersByFile.has(fileLessonNumber)) lessonNumbersByFile.set(fileLessonNumber, []);
            lessonNumbersByFile.get(fileLessonNumber).push(relativePath);
        } else {
            addWarning(`${relativePath}: lesson file does not follow lesson_N.json naming`);
        }

        if (lesson.id) {
            if (!lessonsById.has(lesson.id)) lessonsById.set(lesson.id, []);
            lessonsById.get(lesson.id).push({ file: relativePath, lesson });

            const idLessonNumber = getLessonNumberFromId(lesson.id);
            if (idLessonNumber !== null) {
                if (!lessonNumbersById.has(idLessonNumber)) lessonNumbersById.set(idLessonNumber, []);
                lessonNumbersById.get(idLessonNumber).push(`${lesson.id} in ${relativePath}`);
            } else {
                addWarning(`${relativePath}: lesson id "${lesson.id}" does not follow lN format`);
            }
        }

        if (lesson.title) {
            const normalizedTitle = String(lesson.title).trim().toLowerCase();
            if (!lessonTitles.has(normalizedTitle)) lessonTitles.set(normalizedTitle, []);
            lessonTitles.get(normalizedTitle).push(`${lesson.title} in ${relativePath}`);
        }
    });

    stats.totalModules = curriculum.length;

    curriculum.forEach(module => {
        if (!Array.isArray(module.lessons)) return;

        module.lessons.forEach(lessonRef => {
            if (!lessonRef || !lessonRef.id) return;

            if (!curriculumRefsById.has(lessonRef.id)) curriculumRefsById.set(lessonRef.id, []);
            curriculumRefsById.get(lessonRef.id).push({ module, lessonRef });

            if (lessonRef.file) {
                const normalizedFile = lessonRef.file.replace(/\\/g, "/");
                if (!curriculumFileRefs.has(normalizedFile)) curriculumFileRefs.set(normalizedFile, []);
                curriculumFileRefs.get(normalizedFile).push(lessonRef.id);

                if (!normalizedFile.startsWith("data/lessons/")) {
                    addError(`curriculum lesson ${lessonRef.id}: file must be inside data/lessons (${lessonRef.file})`);
                }

                if (!lessonsByFile.has(normalizedFile)) {
                    addError(`curriculum lesson ${lessonRef.id}: referenced file does not exist (${lessonRef.file})`);
                }
            }

            const matchingLessons = lessonsById.get(lessonRef.id) || [];
            if (matchingLessons.length === 0) {
                addError(`curriculum lesson ${lessonRef.id}: referenced lesson id does not exist in any lesson file`);
                return;
            }

            matchingLessons.forEach(({ file, lesson }) => {
                if (lessonRef.title && lesson.title && lessonRef.title !== lesson.title) {
                    addWarning(`${file}: title differs from curriculum.json for ${lessonRef.id} (curriculum: "${lessonRef.title}", lesson: "${lesson.title}")`);
                }

                if (lessonRef.file && lessonRef.file.replace(/\\/g, "/") !== file) {
                    addError(`${file}: lesson id ${lessonRef.id} is referenced with mismatched file path "${lessonRef.file}"`);
                }
            });
        });
    });

    lessonsById.forEach((entries, id) => {
        if (entries.length > 1) {
            addError(`duplicate lesson id "${id}" appears in ${entries.map(entry => entry.file).join(", ")}`);
        }
    });

    curriculumRefsById.forEach((entries, id) => {
        if (entries.length > 1) {
            addError(`duplicate curriculum lesson id "${id}" appears ${entries.length} times`);
        }
    });

    lessonNumbersByFile.forEach((files, lessonNumber) => {
        if (files.length > 1) {
            addError(`duplicate lesson file number ${lessonNumber} appears in ${files.join(", ")}`);
        }
    });

    lessonNumbersById.forEach((ids, lessonNumber) => {
        if (ids.length > 1) {
            addError(`duplicate lesson id number ${lessonNumber} appears in ${ids.join(", ")}`);
        }
    });

    lessonTitles.forEach((entries, normalizedTitle) => {
        if (entries.length > 1) {
            addWarning(`duplicate lesson title "${entries[0].split(" in ")[0]}" appears in ${entries.map(entry => entry.replace(/^.* in /, "")).join(", ")}`);
        }
    });

    const fileNumbers = Array.from(lessonNumbersByFile.keys()).sort((a, b) => a - b);
    if (fileNumbers.length > 0) {
        for (let expected = fileNumbers[0]; expected <= fileNumbers[fileNumbers.length - 1]; expected += 1) {
            if (!lessonNumbersByFile.has(expected)) {
                addError(`missing lesson file number ${expected}`);
            }
        }
    }

    const idNumbers = Array.from(lessonNumbersById.keys()).sort((a, b) => a - b);
    if (idNumbers.length > 0) {
        for (let expected = idNumbers[0]; expected <= idNumbers[idNumbers.length - 1]; expected += 1) {
            if (!lessonNumbersById.has(expected)) {
                addError(`missing lesson id number ${expected}`);
            }
        }
    }

    lessonsById.forEach((entries, id) => {
        entries.forEach(({ file, lesson }) => {
            ["previousLesson", "nextLesson"].forEach(field => {
                const targetId = lesson[field];
                if (targetId !== null && targetId !== undefined && targetId !== "" && !lessonsById.has(targetId)) {
                    addError(`${file}: ${field} references missing lesson id "${targetId}"`);
                }
            });

            if (!curriculumRefsById.has(id)) {
                addError(`${file}: orphan lesson id "${id}" is not referenced in curriculum.json`);
            }
        });
    });

    curriculumFileRefs.forEach((ids, file) => {
        if (ids.length > 1) {
            addError(`duplicate curriculum file reference "${file}" is used by lesson ids ${ids.join(", ")}`);
        }
    });
}

function printList(title, items) {
    console.log(`\n${title} (${items.length})`);
    if (items.length === 0) {
        console.log("  None");
        return;
    }

    items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item}`);
    });
}

validate();

console.log("KiteLearn Content Validation Report");
console.log("====================================");
console.log(`Checked at: ${new Date().toISOString()}`);
console.log(`Supported block types: ${Array.from(SUPPORTED_BLOCK_TYPES).join(", ")}`);
console.log(`Supported difficulties: ${Array.from(SUPPORTED_DIFFICULTIES).join(", ")}`);

printList("Errors", errors);
printList("Warnings", warnings);

console.log("\nSummary");
console.log(`  Total modules: ${stats.totalModules}`);
console.log(`  Total lessons: ${stats.totalLessons}`);
console.log(`  Total quizzes: ${stats.totalQuizzes}`);
console.log(`  Total examples: ${stats.totalExamples}`);
console.log(`  Total warnings: ${stats.totalWarnings}`);
console.log(`  Total facts: ${stats.totalFacts}`);
console.log(`  Total tips: ${stats.totalTips}`);
console.log(`  Total stories: ${stats.totalStories}`);
console.log(`  Average reading time: ${stats.lessonsWithReadingTime === 0 ? "0.0" : (stats.totalReadingTime / stats.lessonsWithReadingTime).toFixed(1)} mins`);
console.log(`  Errors: ${errors.length}`);
console.log(`  Warnings: ${warnings.length}`);
console.log(`  Validation: ${errors.length === 0 ? "PASSED" : "FAILED"}`);

if (errors.length > 0) {
    process.exitCode = 1;
}
