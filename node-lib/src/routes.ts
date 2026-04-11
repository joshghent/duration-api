import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Request, Response } from "express";
import {
  analyzeScorm,
  estimatedContentSeconds,
  formatDuration,
  getDurationSeconds,
  isSupportedMedia,
  isZipFile,
} from "./duration";
import { AppError } from "./error";
import type {
  DurationRequest,
  FileDurationInfo,
  MultiDurationResponse,
  ScormAnalysis,
  ScormAnalysisResponse,
  SingleDurationResponse,
} from "./models";

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  res.json({ status: "ok" });
}

export async function durationJsonHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as DurationRequest;
    const format = body.format ?? "HH:MM:SS";
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "duration-"));

    try {
      if (body.fileUrl) {
        const filePath = await downloadFile(body.fileUrl, tmpDir);
        const result = await processSingleFile(filePath, format);
        res.json(result);
        return;
      }

      if (body.files) {
        if (body.files.length === 0) {
          throw AppError.badRequest("No files provided");
        }

        const filePaths: [string, string][] = [];
        for (const url of body.files) {
          const fp = await downloadFile(url, tmpDir);
          filePaths.push([filenameFromUrl(url), fp]);
        }

        const result = await processMultipleFiles(filePaths, format);
        res.json(result);
        return;
      }

      throw AppError.badRequest("Provide either 'fileUrl' or 'files' in the request body");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (err) {
    sendError(res, err);
  }
}

export async function durationUploadHandler(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const format = (req.body?.format as string) ?? "HH:MM:SS";

    if (!files || files.length === 0) {
      throw AppError.badRequest("No files uploaded");
    }

    const filePaths: [string, string][] = files.map((f) => [
      f.originalname,
      f.path,
    ]);

    if (filePaths.length === 1) {
      const [, filePath] = filePaths[0];
      const result = await processSingleFile(filePath, format);
      res.json(result);
      return;
    }

    const result = await processMultipleFiles(filePaths, format);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
}

// --- Processing logic ---

function buildScormAnalysisResponse(
  analysis: ScormAnalysis,
  format: string
): ScormAnalysisResponse {
  const readingSeconds = (analysis.wordCount / 200) * 60;
  const quizSeconds = analysis.quizQuestionCount * 30;

  return {
    manifestDuration:
      analysis.manifestDurationSeconds !== null
        ? formatDuration(analysis.manifestDurationSeconds, format)
        : undefined,
    wordCount: analysis.wordCount,
    quizQuestionCount: analysis.quizQuestionCount,
    estimatedReadingTime: formatDuration(readingSeconds, format),
    estimatedQuizTime: formatDuration(quizSeconds, format),
  };
}

async function processSingleFile(
  filePath: string,
  format: string
): Promise<SingleDurationResponse | MultiDurationResponse> {
  if (isZipFile(filePath)) {
    const extractDir = path.join(path.dirname(filePath), "scorm_extract");
    fs.mkdirSync(extractDir, { recursive: true });
    const analysis = analyzeScorm(filePath, extractDir);
    const scormResp = buildScormAnalysisResponse(analysis, format);
    const contentSeconds = estimatedContentSeconds(analysis);

    if (analysis.mediaFiles.length === 0) {
      const durationSeconds = analysis.manifestDurationSeconds ?? contentSeconds;
      return {
        duration: formatDuration(durationSeconds, format),
        estimatedDuration: contentSeconds > 0
          ? formatDuration(contentSeconds, format)
          : undefined,
        scormAnalysis: scormResp,
      };
    }

    if (analysis.mediaFiles.length === 1) {
      const seconds = await getDurationSeconds(analysis.mediaFiles[0]);
      const totalEstimated = seconds + contentSeconds;
      return {
        duration: formatDuration(seconds, format),
        estimatedDuration: formatDuration(totalEstimated, format),
        scormAnalysis: scormResp,
      };
    }

    // Multiple media inside SCORM
    let totalSeconds = 0;
    const fileResults: FileDurationInfo[] = [];
    const warnings: string[] = [];

    for (const mf of analysis.mediaFiles) {
      const name = path.basename(mf);
      try {
        const secs = await getDurationSeconds(mf);
        totalSeconds += secs;
        fileResults.push({ file: name, duration: formatDuration(secs, format) });
      } catch (e) {
        const warn = `${name}: ${e instanceof Error ? e.message : String(e)}`;
        warnings.push(warn);
        fileResults.push({ file: name, warning: warn });
      }
    }

    const totalEstimated = totalSeconds + contentSeconds;
    return {
      duration: formatDuration(totalSeconds, format),
      estimatedDuration: formatDuration(totalEstimated, format),
      files: fileResults,
      warnings,
      scormAnalysis: scormResp,
    };
  }

  if (!isSupportedMedia(filePath)) {
    throw AppError.unsupportedFileType(
      `Unsupported file type: ${path.extname(filePath)}`
    );
  }

  const seconds = await getDurationSeconds(filePath);
  return {
    duration: formatDuration(seconds, format),
  };
}

async function processMultipleFiles(
  files: [string, string][],
  format: string
): Promise<MultiDurationResponse> {
  let totalSeconds = 0;
  let totalContentSeconds = 0;
  const fileResults: FileDurationInfo[] = [];
  const warnings: string[] = [];
  let hasScorm = false;

  for (const [name, filePath] of files) {
    if (isZipFile(filePath)) {
      hasScorm = true;
      const stem = path.basename(filePath, path.extname(filePath));
      const extractDir = path.join(path.dirname(filePath), `scorm_${stem}`);
      fs.mkdirSync(extractDir, { recursive: true });

      try {
        const analysis = analyzeScorm(filePath, extractDir);
        totalContentSeconds += estimatedContentSeconds(analysis);

        for (const mf of analysis.mediaFiles) {
          const mfName = path.basename(mf);
          try {
            const secs = await getDurationSeconds(mf);
            totalSeconds += secs;
            fileResults.push({
              file: `${name}/${mfName}`,
              duration: formatDuration(secs, format),
            });
          } catch (e) {
            const warn = `${name}/${mfName}: ${e instanceof Error ? e.message : String(e)}`;
            warnings.push(warn);
            fileResults.push({ file: `${name}/${mfName}`, warning: warn });
          }
        }

        if (analysis.mediaFiles.length === 0) {
          const est = estimatedContentSeconds(analysis);
          if (est > 0) {
            totalSeconds += est;
          }
          fileResults.push({
            file: name,
            duration: est > 0 ? formatDuration(est, format) : undefined,
            warning:
              est === 0
                ? (() => {
                    const w = `${name}: No media or content found in SCORM package`;
                    warnings.push(w);
                    return w;
                  })()
                : undefined,
          });
        }
      } catch (e) {
        const warn = `${name}: Failed to extract SCORM: ${e instanceof Error ? e.message : String(e)}`;
        warnings.push(warn);
        fileResults.push({ file: name, warning: warn });
      }
      continue;
    }

    if (!isSupportedMedia(filePath)) {
      const warn = `${name}: Unsupported file type`;
      warnings.push(warn);
      fileResults.push({ file: name, warning: warn });
      continue;
    }

    try {
      const secs = await getDurationSeconds(filePath);
      totalSeconds += secs;
      fileResults.push({
        file: name,
        duration: formatDuration(secs, format),
      });
    } catch (e) {
      const warn = `${name}: ${e instanceof Error ? e.message : String(e)}`;
      warnings.push(warn);
      fileResults.push({ file: name, warning: warn });
    }
  }

  return {
    duration: formatDuration(totalSeconds, format),
    estimatedDuration: hasScorm
      ? formatDuration(totalSeconds + totalContentSeconds, format)
      : undefined,
    files: fileResults,
    warnings,
  };
}

// --- Helpers ---

async function downloadFile(url: string, dir: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw AppError.badRequest(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const filename = filenameFromUrl(url);
  const filePath = path.join(dir, filename);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function filenameFromUrl(url: string): string {
  const lastSegment = url.split("/").pop() ?? "download";
  const withoutQuery = lastSegment.split("?")[0];
  return withoutQuery || "download";
}

function sendError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
  } else {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}
