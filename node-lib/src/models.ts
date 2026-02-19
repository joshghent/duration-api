export interface DurationRequest {
  fileUrl?: string;
  files?: string[];
  format?: DurationFormat;
}

export type DurationFormat = "HH:MM:SS" | "MM:SS" | "HH:MM";

export interface SingleDurationResponse {
  duration: string;
  estimatedDuration?: string;
  scormAnalysis?: ScormAnalysisResponse;
}

export interface FileDurationInfo {
  file: string;
  duration?: string;
  warning?: string;
}

export interface MultiDurationResponse {
  duration: string;
  estimatedDuration?: string;
  files: FileDurationInfo[];
  warnings: string[];
  scormAnalysis?: ScormAnalysisResponse;
}

export interface ScormAnalysisResponse {
  manifestDuration?: string;
  wordCount: number;
  quizQuestionCount: number;
  estimatedReadingTime: string;
  estimatedQuizTime: string;
}

export interface ScormAnalysis {
  mediaFiles: string[];
  manifestDurationSeconds: number | null;
  wordCount: number;
  quizQuestionCount: number;
}
