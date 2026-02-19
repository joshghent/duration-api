import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import {
  formatDuration,
  parseIso8601Duration,
  countWordsInHtml,
  countQuestionsInJs,
  isSupportedMedia,
  isZipFile,
  analyzeScorm,
  estimatedContentSeconds,
  getDurationSeconds,
} from "../src/duration";

// Path to test files (relative to repo root)
const TESTFILES = path.resolve(__dirname, "../../testfiles");

// ---------------------------------------------------------------------------
// Format duration tests
// ---------------------------------------------------------------------------

describe("formatDuration", () => {
  it("formats HH:MM:SS correctly", () => {
    expect(formatDuration(3661, "HH:MM:SS")).toBe("01:01:01");
    expect(formatDuration(0, "HH:MM:SS")).toBe("00:00:00");
    expect(formatDuration(59, "HH:MM:SS")).toBe("00:00:59");
    expect(formatDuration(3600, "HH:MM:SS")).toBe("01:00:00");
  });

  it("formats MM:SS correctly", () => {
    expect(formatDuration(125, "MM:SS")).toBe("02:05");
    expect(formatDuration(3661, "MM:SS")).toBe("61:01");
    expect(formatDuration(0, "MM:SS")).toBe("00:00");
  });

  it("formats HH:MM correctly", () => {
    expect(formatDuration(3661, "HH:MM")).toBe("01:01");
    expect(formatDuration(7200, "HH:MM")).toBe("02:00");
  });

  it("defaults to HH:MM:SS for unknown format", () => {
    expect(formatDuration(3661, "unknown")).toBe("01:01:01");
  });

  it("handles large values", () => {
    expect(formatDuration(86400, "HH:MM:SS")).toBe("24:00:00");
    expect(formatDuration(90061, "HH:MM:SS")).toBe("25:01:01");
  });

  it("rounds correctly", () => {
    expect(formatDuration(0.4, "HH:MM:SS")).toBe("00:00:00");
    expect(formatDuration(0.5, "HH:MM:SS")).toBe("00:00:01");
  });
});

// ---------------------------------------------------------------------------
// ISO 8601 duration parsing
// ---------------------------------------------------------------------------

describe("parseIso8601Duration", () => {
  it("parses common SCORM durations", () => {
    expect(parseIso8601Duration("PT1H30M")).toBe(5400);
    expect(parseIso8601Duration("PT45M")).toBe(2700);
    expect(parseIso8601Duration("PT1H30M15S")).toBe(5415);
    expect(parseIso8601Duration("PT2H")).toBe(7200);
    expect(parseIso8601Duration("PT30S")).toBe(30);
    expect(parseIso8601Duration("PT0H0M30S")).toBe(30);
  });

  it("parses full date+time format", () => {
    expect(parseIso8601Duration("P0Y0M0DT1H30M0S")).toBe(5400);
    expect(parseIso8601Duration("P0Y0M0DT0H45M0S")).toBe(2700);
  });

  it("parses fractional values", () => {
    expect(parseIso8601Duration("PT1.5H")).toBe(5400);
    expect(parseIso8601Duration("PT1.5S")).toBe(1.5);
    expect(parseIso8601Duration("PT0.5M")).toBe(30);
  });

  it("parses durations with days", () => {
    expect(parseIso8601Duration("P1D")).toBe(86400);
    expect(parseIso8601Duration("P2DT4H")).toBe(2 * 86400 + 4 * 3600);
    expect(parseIso8601Duration("P1DT2H")).toBe(93600);
  });

  it("returns null for invalid input", () => {
    expect(parseIso8601Duration("")).toBeNull();
    expect(parseIso8601Duration("invalid")).toBeNull();
    expect(parseIso8601Duration("not a duration")).toBeNull();
  });

  it("returns null for zero duration", () => {
    expect(parseIso8601Duration("PT0S")).toBeNull();
    expect(parseIso8601Duration("PT0H0M0S")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Media extension checks
// ---------------------------------------------------------------------------

describe("isSupportedMedia", () => {
  it("recognizes all supported extensions", () => {
    const supported = [
      "mp4", "avi", "mov", "webm", "mkv",
      "mp3", "wav", "flac", "ogg", "aac", "wma", "m4a",
    ];
    for (const ext of supported) {
      expect(isSupportedMedia(`test.${ext}`)).toBe(true);
    }
  });

  it("is case insensitive", () => {
    for (const ext of ["MP4", "Mp3", "WAV", "FLAC", "Webm"]) {
      expect(isSupportedMedia(`test.${ext}`)).toBe(true);
    }
  });

  it("rejects unsupported extensions", () => {
    const unsupported = ["png", "jpg", "gif", "txt", "pdf", "docx", "html", "zip", "exe"];
    for (const ext of unsupported) {
      expect(isSupportedMedia(`test.${ext}`)).toBe(false);
    }
  });

  it("handles files without extensions", () => {
    expect(isSupportedMedia("noext")).toBe(false);
    expect(isSupportedMedia(".")).toBe(false);
    expect(isSupportedMedia("")).toBe(false);
  });

  it("only checks last extension", () => {
    expect(isSupportedMedia("file.backup.mp4")).toBe(true);
    expect(isSupportedMedia("file.mp4.bak")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ZIP file detection
// ---------------------------------------------------------------------------

describe("isZipFile", () => {
  it("detects zip files", () => {
    expect(isZipFile("course.zip")).toBe(true);
    expect(isZipFile("course.ZIP")).toBe(true);
    expect(isZipFile("path/to/My Course.zip")).toBe(true);
  });

  it("rejects non-zip files", () => {
    expect(isZipFile("audio.mp3")).toBe(false);
    expect(isZipFile("noext")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HTML word counting
// ---------------------------------------------------------------------------

describe("countWordsInHtml", () => {
  it("counts words in simple HTML", () => {
    expect(countWordsInHtml("<p>Hello world this is a test</p>")).toBe(6);
    expect(countWordsInHtml("<div><span>Two words</span></div>")).toBe(2);
  });

  it("strips script blocks", () => {
    expect(countWordsInHtml('<script>var x = 1;</script><p>Hello</p>')).toBe(1);
  });

  it("strips style blocks", () => {
    expect(countWordsInHtml("<style>.foo{color:red}</style><p>Word</p>")).toBe(1);
  });

  it("returns 0 for empty content", () => {
    expect(countWordsInHtml("")).toBe(0);
    expect(countWordsInHtml("<html><body></body></html>")).toBe(0);
    expect(countWordsInHtml("<script>lots of code here</script>")).toBe(0);
  });

  it("handles nested HTML with mixed content", () => {
    const html = `
    <html>
    <head><title>Test</title></head>
    <body>
        <div class="content">
            <h1>Introduction to Golf</h1>
            <p>This is a paragraph about golf. It has several sentences
            that describe the game and its rules.</p>
            <ul>
                <li>First point about golf</li>
                <li>Second point about golf</li>
            </ul>
        </div>
        <script>var x = "this should not be counted"; function foo() { return 1; }</script>
        <style>.hidden { display: none; }</style>
    </body>
    </html>`;
    const count = countWordsInHtml(html);
    expect(count).toBeGreaterThan(15);
    expect(count).toBeLessThan(40);
  });
});

// ---------------------------------------------------------------------------
// Quiz question detection
// ---------------------------------------------------------------------------

describe("countQuestionsInJs", () => {
  it("detects AddQuestion + new Question patterns", () => {
    const js = `
      test.AddQuestion(new Question("q1", "What is par?", QUESTION_TYPE_CHOICE, ["3","4","5"], "4", "obj"));
      test.AddQuestion(new Question("q2", "What is a birdie?", QUESTION_TYPE_CHOICE, ["a","b","c"], "a", "obj"));
      test.AddQuestion(new Question("q3", "What club for driving?", QUESTION_TYPE_CHOICE, ["d","e","f"], "d", "obj"));
    `;
    // 3x AddQuestion + 3x new Question = 6
    expect(countQuestionsInJs(js)).toBe(6);
  });

  it("detects question object literals", () => {
    const js = `
      var quiz = [
          { question: "What is the capital of France?", answers: ["Paris", "London"] },
          { question: "What is 2 + 2?", answers: ["3", "4"] },
          { "question": "Is the sky blue?", "answers": ["yes", "no"] },
          { 'question': 'Name a color', 'answers': ['red', 'blue'] }
      ];
    `;
    expect(countQuestionsInJs(js)).toBe(4);
  });

  it("returns 0 for normal JS with no questions", () => {
    expect(countQuestionsInJs("var x = 1; function foo() { return 42; }")).toBe(0);
  });

  it("does not produce false positives", () => {
    const js = `
      // This is a comment about questions
      var questionable = true;
      function getQuestion() { return null; }
      console.log("No actual questions here");
      var data = { name: "test", value: 42 };
    `;
    expect(countQuestionsInJs(js)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SCORM package tests
// ---------------------------------------------------------------------------

function assertScormParses(zipName: string) {
  const zipPath = path.join(TESTFILES, "scorm", zipName);
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Test file missing: ${zipPath}`);
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-test-"));
  try {
    return analyzeScorm(zipPath, tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("SCORM package parsing", () => {
  // SCORM 1.1
  it("parses SCORM 1.1 single SCO", () => {
    const analysis = assertScormParses("ContentPackagingSingleSCO_SCORM11.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  // SCORM 1.2
  it("parses SCORM 1.2 single SCO", () => {
    const analysis = assertScormParses("ContentPackagingSingleSCO_SCORM12.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 1.2 one file per SCO", () => {
    const analysis = assertScormParses("ContentPackagingOneFilePerSCO_SCORM12.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 1.2 runtime basic calls", () => {
    const analysis = assertScormParses("RuntimeBasicCalls_SCORM12.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 1.2 runtime minimum calls", () => {
    const analysis = assertScormParses("RuntimeMinimumCalls_SCORM12.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  // SCORM 2004 2nd Edition
  it("parses SCORM 2004 2nd Edition single SCO", () => {
    const analysis = assertScormParses("ContentPackagingSingleSCO_SCORM20042ndEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  // SCORM 2004 3rd Edition
  it("parses SCORM 2004 3rd Edition single SCO with quiz", () => {
    const analysis = assertScormParses("ContentPackagingSingleSCO_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
    expect(analysis.quizQuestionCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition one file per SCO", () => {
    const analysis = assertScormParses("ContentPackagingOneFilePerSCO_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition metadata", () => {
    const analysis = assertScormParses("ContentPackagingMetadata_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition runtime basic", () => {
    const analysis = assertScormParses("RuntimeBasicCalls_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition runtime minimum", () => {
    const analysis = assertScormParses("RuntimeMinimumCalls_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition runtime advanced", () => {
    const analysis = assertScormParses("RunTimeAdvancedCalls_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition sequencing forced sequential", () => {
    const analysis = assertScormParses("SequencingForcedSequential_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition sequencing post test rollup", () => {
    const analysis = assertScormParses("SequencingPostTestRollup_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition sequencing pre or post test", () => {
    const analysis = assertScormParses("SequencingPreOrPostTestRollup_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition sequencing random test", () => {
    const analysis = assertScormParses("SequencingRandomTest_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  it("parses SCORM 2004 3rd Edition sequencing simple remediation", () => {
    const analysis = assertScormParses("SequencingSimpleRemediation_SCORM20043rdEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  // SCORM 2004 4th Edition
  it("parses SCORM 2004 4th Edition sequencing post test rollup", () => {
    const analysis = assertScormParses("SequencingPostTestRollup4thEd_SCORM20044thEdition.zip");
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  // Employee health course (with media)
  it("parses employee health course with media", () => {
    const analysis = assertScormParses("employee-health-and-wellness-sample-course-scorm12-0B2a3WZM.zip");
    expect(analysis.mediaFiles.length).toBeGreaterThan(0);
    expect(analysis.wordCount).toBeGreaterThan(0);
  });

  // cmi5 packages
  it("parses cmi5 mastery score framed", () => {
    assertScormParses("masteryscore_framed.zip");
  });

  it("parses cmi5 mastery score responsive", () => {
    assertScormParses("masteryscore_responsive.zip");
  });

  it("parses cmi5 single AU basic framed", () => {
    assertScormParses("single_au_basic_framed.zip");
  });

  it("parses cmi5 single AU basic responsive", () => {
    assertScormParses("single_au_basic_responsive.zip");
  });
});

// ---------------------------------------------------------------------------
// SCORM content estimation
// ---------------------------------------------------------------------------

describe("SCORM content estimation", () => {
  it("calculates content estimation correctly", () => {
    const zipPath = path.join(TESTFILES, "scorm", "ContentPackagingSingleSCO_SCORM20043rdEdition.zip");
    if (!fs.existsSync(zipPath)) return;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-test-"));
    try {
      const analysis = analyzeScorm(zipPath, tmpDir);
      expect(analysis.wordCount).toBeGreaterThan(0);
      expect(analysis.quizQuestionCount).toBeGreaterThan(0);

      const est = estimatedContentSeconds(analysis);
      expect(est).toBeGreaterThan(0);

      const readingTime = (analysis.wordCount / 200) * 60;
      const quizTime = analysis.quizQuestionCount * 30;
      expect(Math.abs(est - (readingTime + quizTime))).toBeLessThan(0.01);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("handles packages with no quiz questions", () => {
    const zipPath = path.join(TESTFILES, "scorm", "ContentPackagingSingleSCO_SCORM11.zip");
    if (!fs.existsSync(zipPath)) return;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-test-"));
    try {
      const analysis = analyzeScorm(zipPath, tmpDir);
      const est = estimatedContentSeconds(analysis);
      const readingTime = (analysis.wordCount / 200) * 60;
      const quizTime = analysis.quizQuestionCount * 30;
      expect(est).toBe(readingTime + quizTime);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-version word count consistency
// ---------------------------------------------------------------------------

describe("SCORM cross-version consistency", () => {
  it("word counts are consistent across SCORM versions", () => {
    const packages = [
      "ContentPackagingSingleSCO_SCORM11.zip",
      "ContentPackagingSingleSCO_SCORM12.zip",
      "ContentPackagingSingleSCO_SCORM20042ndEdition.zip",
      "ContentPackagingSingleSCO_SCORM20043rdEdition.zip",
    ];

    const wordCounts: [string, number][] = [];
    for (const pkg of packages) {
      const zipPath = path.join(TESTFILES, "scorm", pkg);
      if (!fs.existsSync(zipPath)) continue;

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scorm-test-"));
      try {
        const analysis = analyzeScorm(zipPath, tmpDir);
        wordCounts.push([pkg, analysis.wordCount]);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }

    if (wordCounts.length < 2) return;

    for (const [pkg, wc] of wordCounts) {
      expect(wc).toBeGreaterThan(50);
    }

    const counts = wordCounts.map(([, wc]) => wc);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    expect(max).toBeLessThanOrEqual(min * 3);
  });
});

// ---------------------------------------------------------------------------
// FFprobe integration tests (require ffprobe on PATH)
// ---------------------------------------------------------------------------

describe("ffprobe integration", () => {
  it("extracts audio duration", async () => {
    const filePath = path.join(TESTFILES, "audio", "suzume_no_tojimari.mp3");
    if (!fs.existsSync(filePath)) return;

    try {
      const seconds = await getDurationSeconds(filePath);
      expect(seconds).toBeGreaterThan(20);
      expect(seconds).toBeLessThan(30);
    } catch {
      // ffprobe not installed — skip
    }
  });

  it("extracts video duration", async () => {
    const filePath = path.join(TESTFILES, "video", "1416529-sd_640_360_30fps.mp4");
    if (!fs.existsSync(filePath)) return;

    try {
      const seconds = await getDurationSeconds(filePath);
      expect(seconds).toBeGreaterThan(5);
      expect(seconds).toBeLessThan(30);
    } catch {
      // ffprobe not installed — skip
    }
  });
});
