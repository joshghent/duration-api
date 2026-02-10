use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DurationRequest {
    pub file_url: Option<String>,
    pub files: Option<Vec<String>>,
    pub format: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SingleDurationResponse {
    pub duration: String,
    #[serde(rename = "estimatedDuration", skip_serializing_if = "Option::is_none")]
    pub estimated_duration: Option<String>,
    #[serde(rename = "scormAnalysis", skip_serializing_if = "Option::is_none")]
    pub scorm_analysis: Option<ScormAnalysisResponse>,
}

#[derive(Debug, Serialize)]
pub struct FileDurationInfo {
    pub file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MultiDurationResponse {
    pub duration: String,
    #[serde(rename = "estimatedDuration", skip_serializing_if = "Option::is_none")]
    pub estimated_duration: Option<String>,
    pub files: Vec<FileDurationInfo>,
    pub warnings: Vec<String>,
    #[serde(rename = "scormAnalysis", skip_serializing_if = "Option::is_none")]
    pub scorm_analysis: Option<ScormAnalysisResponse>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScormAnalysisResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest_duration: Option<String>,
    pub word_count: u64,
    pub quiz_question_count: u64,
    pub estimated_reading_time: String,
    pub estimated_quiz_time: String,
}
