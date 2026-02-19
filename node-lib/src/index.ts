// Core library exports
export {
  getDurationSeconds,
  analyzeScorm,
  estimatedContentSeconds,
  formatDuration,
  parseIso8601Duration,
  countWordsInHtml,
  countQuestionsInJs,
  isSupportedMedia,
  isZipFile,
} from "./duration";

export { AppError } from "./error";

export type {
  DurationRequest,
  DurationFormat,
  SingleDurationResponse,
  MultiDurationResponse,
  FileDurationInfo,
  ScormAnalysisResponse,
  ScormAnalysis,
} from "./models";

export { createServer, startServer } from "./server";
