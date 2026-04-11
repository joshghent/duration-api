import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import AdmZip from "adm-zip";
import { AppError } from "./error";
import type { ScormAnalysis } from "./models";

const execFileAsync = promisify(execFile);

const MEDIA_EXTENSIONS = new Set([
  "mp4", "avi", "mov", "webm", "mkv",
  "mp3", "wav", "flac", "ogg", "aac", "wma", "m4a",
]);

const WORDS_PER_MINUTE = 200;
const SECONDS_PER_QUIZ_QUESTION = 30;

export function isSupportedMedia(filePath: string): boolean {
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

export function isZipFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".zip";
}

export async function getDurationSeconds(filePath: string): Promise<number> {
  try {
    const { stdout, stderr } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);

    const seconds = parseFloat(stdout.trim());
    if (isNaN(seconds)) {
      throw AppError.internal(`Failed to parse duration: ${stdout.trim()}`);
    }
    return seconds;
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw AppError.internal(`Failed to run ffprobe: ${message}`);
  }
}

export function analyzeScorm(zipPath: string, extractDir: string): ScormAnalysis {
  const zip = new AdmZip(zipPath);
  const mediaFiles: string[] = [];

  fs.mkdirSync(extractDir, { recursive: true });
  zip.extractAllTo(extractDir, true);

  // Walk extracted files to find media
  for (const filePath of walkDir(extractDir)) {
    if (isSupportedMedia(filePath)) {
      mediaFiles.push(filePath);
    }
  }

  const manifestDurationSeconds = parseManifestDuration(extractDir);
  const wordCount = countWordsInHtmlFiles(extractDir);
  const quizQuestionCount = countQuizQuestions(extractDir);

  return { mediaFiles, manifestDurationSeconds, wordCount, quizQuestionCount };
}

export function estimatedContentSeconds(analysis: ScormAnalysis): number {
  const readingSeconds = (analysis.wordCount / WORDS_PER_MINUTE) * 60;
  const quizSeconds = analysis.quizQuestionCount * SECONDS_PER_QUIZ_QUESTION;
  return readingSeconds + quizSeconds;
}

// --- Manifest parsing ---

function parseManifestDuration(extractDir: string): number | null {
  const manifestPath = path.join(extractDir, "imsmanifest.xml");
  let content: string;
  try {
    content = fs.readFileSync(manifestPath, "utf-8");
  } catch {
    return null;
  }

  // Try typicalLearningTime
  const fromTypical = extractIso8601Duration(content, "typicalLearningTime");
  if (fromTypical !== null) return fromTypical;

  // Try SCORM 2004 adlcp duration limits
  const tags = [
    "adlcp:attemptAbsoluteDurationLimit",
    "attemptAbsoluteDurationLimit",
    "adlcp:activityAbsoluteDurationLimit",
    "activityAbsoluteDurationLimit",
  ];
  for (const tag of tags) {
    const result = extractTagDuration(content, tag);
    if (result !== null) return result;
  }

  return null;
}

function extractIso8601Duration(xml: string, parentTag: string): number | null {
  const openTag = `<${parentTag}`;
  const closeTag = `</${parentTag}>`;
  const start = xml.indexOf(openTag);
  if (start === -1) return null;
  const end = xml.indexOf(closeTag, start);
  if (end === -1) return null;
  const block = xml.slice(start, end);

  const durStart = block.indexOf("<duration>");
  if (durStart === -1) return null;
  const durContentStart = durStart + "<duration>".length;
  const durEnd = block.indexOf("</duration>", durContentStart);
  if (durEnd === -1) return null;
  const durStr = block.slice(durContentStart, durEnd).trim();

  return parseIso8601Duration(durStr);
}

function extractTagDuration(xml: string, tag: string): number | null {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const start = xml.indexOf(openTag);
  if (start === -1) return null;
  const contentStart = start + openTag.length;
  const end = xml.indexOf(closeTag, contentStart);
  if (end === -1) return null;
  const durStr = xml.slice(contentStart, end).trim();
  return parseIso8601Duration(durStr);
}

export function parseIso8601Duration(s: string): number | null {
  s = s.trim();
  if (!s.startsWith("P")) return null;

  s = s.slice(1); // strip P
  let datePart: string;
  let timePart: string;
  const tPos = s.indexOf("T");
  if (tPos !== -1) {
    datePart = s.slice(0, tPos);
    timePart = s.slice(tPos + 1);
  } else {
    datePart = s;
    timePart = "";
  }

  let totalSeconds = 0;

  // Parse date part (Y, M, D)
  let numBuf = "";
  for (const ch of datePart) {
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      numBuf += ch;
    } else {
      const val = parseFloat(numBuf) || 0;
      numBuf = "";
      switch (ch) {
        case "Y": totalSeconds += val * 365.25 * 86400; break;
        case "M": totalSeconds += val * 30.44 * 86400; break;
        case "D": totalSeconds += val * 86400; break;
      }
    }
  }

  // Parse time part (H, M, S)
  numBuf = "";
  for (const ch of timePart) {
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      numBuf += ch;
    } else {
      const val = parseFloat(numBuf) || 0;
      numBuf = "";
      switch (ch) {
        case "H": totalSeconds += val * 3600; break;
        case "M": totalSeconds += val * 60; break;
        case "S": totalSeconds += val; break;
      }
    }
  }

  return totalSeconds > 0 ? totalSeconds : null;
}

// --- HTML word counting ---

function countWordsInHtmlFiles(dir: string): number {
  let total = 0;
  for (const filePath of walkDir(dir)) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".html" || ext === ".htm") {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        total += countWordsInHtml(content);
      } catch {
        // skip unreadable files
      }
    }
  }
  return total;
}

export function countWordsInHtml(html: string): number {
  const lower = html.toLowerCase();
  let clean = "";
  let pos = 0;

  while (pos < html.length) {
    const lowerRemaining = lower.slice(pos);

    // Skip <script> blocks
    if (lowerRemaining.startsWith("<script")) {
      const end = lower.indexOf("</script>", pos);
      if (end !== -1) {
        pos = end + 9;
        continue;
      }
    }

    // Skip <style> blocks
    if (lowerRemaining.startsWith("<style")) {
      const end = lower.indexOf("</style>", pos);
      if (end !== -1) {
        pos = end + 8;
        continue;
      }
    }

    if (html[pos] === "<") {
      const tagEnd = html.indexOf(">", pos);
      if (tagEnd !== -1) {
        pos = tagEnd + 1;
        clean += " ";
      } else {
        pos++;
      }
    } else {
      clean += html[pos];
      pos++;
    }
  }

  return clean
    .split(/\s+/)
    .filter((w) => w.length > 1 || (w.length === 1 && /^[a-zA-Z]$/.test(w)))
    .length;
}

// --- Quiz question counting ---

function countQuizQuestions(dir: string): number {
  let total = 0;
  for (const filePath of walkDir(dir)) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".js") {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        total += countQuestionsInJs(content);
      } catch {
        // skip unreadable files
      }
    }
  }
  return total;
}

export function countQuestionsInJs(js: string): number {
  let count = 0;
  const jsLower = js.toLowerCase();

  // Pattern: AddQuestion( or .addQuestion(
  count += (jsLower.match(/addquestion\(/g) || []).length;
  // Pattern: new Question(
  count += (jsLower.match(/new question\(/g) || []).length;

  // Pattern: question objects in arrays
  for (const line of js.split("\n")) {
    const trimmed = line.trim().toLowerCase();
    const stripped = trimmed.replace(/^[{,\s]+/, "");
    if (
      (stripped.startsWith('"question"') ||
        stripped.startsWith("'question'") ||
        stripped.startsWith("question:")) &&
      stripped.includes(":")
    ) {
      count++;
    }
  }

  return count;
}

// --- Duration formatting ---

export function formatDuration(totalSeconds: number, format: string): string {
  const totalSecs = Math.round(totalSeconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  switch (format) {
    case "MM:SS": {
      const totalMinutes = hours * 60 + minutes;
      return `${pad(totalMinutes)}:${pad(seconds)}`;
    }
    case "HH:MM":
      return `${pad(hours)}:${pad(minutes)}`;
    default:
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
}

// --- File system helpers ---

function walkDir(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return files;

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}
