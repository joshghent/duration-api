use axum::extract::{Multipart, State};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::io::AsyncWriteExt;

use crate::duration::{
    analyze_scorm, format_duration, get_duration_seconds, is_supported_media, is_zip_file,
    ScormAnalysis,
};
use crate::error::AppError;
use crate::models::*;

pub struct AppState {
    pub db: Arc<crate::db::Db>,
    pub http_client: reqwest::Client,
}

pub async fn health() -> impl IntoResponse {
    Json(json!({"status": "ok"}))
}

pub async fn duration_json(
    State(state): State<Arc<AppState>>,
    Json(body): Json<DurationRequest>,
) -> Result<impl IntoResponse, AppError> {
    let format = body.format.as_deref().unwrap_or("HH:MM:SS");
    let tmp_dir = TempDir::new()?;

    if let Some(file_url) = &body.file_url {
        let file_path = download_file(&state.http_client, file_url, tmp_dir.path()).await?;
        let result = process_single_file(&file_path, format)?;
        return Ok(Json(result).into_response());
    }

    if let Some(files) = &body.files {
        if files.is_empty() {
            return Err(AppError::BadRequest("No files provided".into()));
        }

        let mut file_paths = Vec::new();
        for url in files {
            let path = download_file(&state.http_client, url, tmp_dir.path()).await?;
            file_paths.push((filename_from_url(url), path));
        }

        let result = process_multiple_files(&file_paths, format)?;
        return Ok(Json(json!(result)).into_response());
    }

    Err(AppError::BadRequest(
        "Provide either 'fileUrl' or 'files' in the request body".into(),
    ))
}

pub async fn duration_multipart(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    let _ = &state;
    let tmp_dir = TempDir::new()?;
    let mut format = "HH:MM:SS".to_string();
    let mut file_paths: Vec<(String, PathBuf)> = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {e}")))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "format" {
            let text = field
                .text()
                .await
                .map_err(|e| AppError::BadRequest(format!("Failed to read format field: {e}")))?;
            format = text;
            continue;
        }

        let filename = field.file_name().unwrap_or("upload").to_string();
        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(format!("Failed to read file: {e}")))?;

        let file_path = tmp_dir.path().join(&filename);
        let mut f = tokio::fs::File::create(&file_path).await?;
        f.write_all(&data).await?;

        file_paths.push((filename, file_path));
    }

    if file_paths.is_empty() {
        return Err(AppError::BadRequest("No files uploaded".into()));
    }

    if file_paths.len() == 1 {
        let (_, ref path) = file_paths[0];
        let result = process_single_file(path, &format)?;
        return Ok(Json(result).into_response());
    }

    let result = process_multiple_files(&file_paths, &format)?;
    Ok(Json(json!(result)).into_response())
}

fn build_scorm_analysis_response(analysis: &ScormAnalysis, format: &str) -> ScormAnalysisResponse {
    let reading_seconds = (analysis.word_count as f64 / 200.0) * 60.0;
    let quiz_seconds = analysis.quiz_question_count as f64 * 30.0;

    ScormAnalysisResponse {
        manifest_duration: analysis
            .manifest_duration_seconds
            .map(|s| format_duration(s, format)),
        word_count: analysis.word_count,
        quiz_question_count: analysis.quiz_question_count,
        estimated_reading_time: format_duration(reading_seconds, format),
        estimated_quiz_time: format_duration(quiz_seconds, format),
    }
}

fn process_single_file(file_path: &Path, format: &str) -> Result<serde_json::Value, AppError> {
    if is_zip_file(file_path) {
        let extract_dir = file_path.parent().unwrap().join("scorm_extract");
        std::fs::create_dir_all(&extract_dir)?;
        let analysis = analyze_scorm(file_path, &extract_dir)?;
        let scorm_resp = build_scorm_analysis_response(&analysis, format);
        let content_seconds = analysis.estimated_content_seconds();

        if analysis.media_files.is_empty() {
            // No media — use manifest duration or content estimate as the duration
            let duration_seconds = analysis
                .manifest_duration_seconds
                .unwrap_or(content_seconds);
            let estimated = if content_seconds > 0.0 {
                Some(format_duration(content_seconds, format))
            } else {
                None
            };

            return Ok(json!(SingleDurationResponse {
                duration: format_duration(duration_seconds, format),
                estimated_duration: estimated,
                scorm_analysis: Some(scorm_resp),
            }));
        }

        if analysis.media_files.len() == 1 {
            let seconds = get_duration_seconds(&analysis.media_files[0])?;
            let total_estimated = seconds + content_seconds;
            return Ok(json!(SingleDurationResponse {
                duration: format_duration(seconds, format),
                estimated_duration: Some(format_duration(total_estimated, format)),
                scorm_analysis: Some(scorm_resp),
            }));
        }

        // Multiple media inside SCORM
        let mut total_seconds = 0.0;
        let mut file_results = Vec::new();
        let mut warnings = Vec::new();

        for mf in &analysis.media_files {
            let name = mf
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            match get_duration_seconds(mf) {
                Ok(secs) => {
                    total_seconds += secs;
                    file_results.push(FileDurationInfo {
                        file: name,
                        duration: Some(format_duration(secs, format)),
                        warning: None,
                    });
                }
                Err(e) => {
                    let warn = format!("{name}: {e}");
                    warnings.push(warn.clone());
                    file_results.push(FileDurationInfo {
                        file: name,
                        duration: None,
                        warning: Some(warn),
                    });
                }
            }
        }

        let total_estimated = total_seconds + content_seconds;
        return Ok(json!(MultiDurationResponse {
            duration: format_duration(total_seconds, format),
            estimated_duration: Some(format_duration(total_estimated, format)),
            files: file_results,
            warnings,
            scorm_analysis: Some(scorm_resp),
        }));
    }

    if !is_supported_media(file_path) {
        return Err(AppError::UnsupportedFileType(format!(
            "Unsupported file type: {}",
            file_path.extension().unwrap_or_default().to_string_lossy()
        )));
    }

    let seconds = get_duration_seconds(file_path)?;
    Ok(json!(SingleDurationResponse {
        duration: format_duration(seconds, format),
        estimated_duration: None,
        scorm_analysis: None,
    }))
}

fn process_multiple_files(
    files: &[(String, PathBuf)],
    format: &str,
) -> Result<MultiDurationResponse, AppError> {
    let mut total_seconds = 0.0;
    let mut total_content_seconds = 0.0;
    let mut file_results = Vec::new();
    let mut warnings = Vec::new();
    let mut has_scorm = false;

    for (name, path) in files {
        if is_zip_file(path) {
            has_scorm = true;
            let extract_dir = path.parent().unwrap().join(format!(
                "scorm_{}",
                path.file_stem().unwrap_or_default().to_string_lossy()
            ));
            std::fs::create_dir_all(&extract_dir)?;
            match analyze_scorm(path, &extract_dir) {
                Ok(analysis) => {
                    total_content_seconds += analysis.estimated_content_seconds();
                    for mf in &analysis.media_files {
                        let mf_name = mf
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        match get_duration_seconds(mf) {
                            Ok(secs) => {
                                total_seconds += secs;
                                file_results.push(FileDurationInfo {
                                    file: format!("{name}/{mf_name}"),
                                    duration: Some(format_duration(secs, format)),
                                    warning: None,
                                });
                            }
                            Err(e) => {
                                let warn = format!("{name}/{mf_name}: {e}");
                                warnings.push(warn.clone());
                                file_results.push(FileDurationInfo {
                                    file: format!("{name}/{mf_name}"),
                                    duration: None,
                                    warning: Some(warn),
                                });
                            }
                        }
                    }
                    if analysis.media_files.is_empty() {
                        // Use content estimate as duration for this SCORM
                        let est = analysis.estimated_content_seconds();
                        if est > 0.0 {
                            total_seconds += est;
                        }
                        file_results.push(FileDurationInfo {
                            file: name.clone(),
                            duration: if est > 0.0 {
                                Some(format_duration(est, format))
                            } else {
                                None
                            },
                            warning: if est == 0.0 {
                                let w =
                                    format!("{name}: No media or content found in SCORM package");
                                warnings.push(w.clone());
                                Some(w)
                            } else {
                                None
                            },
                        });
                    }
                }
                Err(e) => {
                    let warn = format!("{name}: Failed to extract SCORM: {e}");
                    warnings.push(warn.clone());
                    file_results.push(FileDurationInfo {
                        file: name.clone(),
                        duration: None,
                        warning: Some(warn),
                    });
                }
            }
            continue;
        }

        if !is_supported_media(path) {
            let warn = format!("{name}: Unsupported file type");
            warnings.push(warn.clone());
            file_results.push(FileDurationInfo {
                file: name.clone(),
                duration: None,
                warning: Some(warn),
            });
            continue;
        }

        match get_duration_seconds(path) {
            Ok(secs) => {
                total_seconds += secs;
                file_results.push(FileDurationInfo {
                    file: name.clone(),
                    duration: Some(format_duration(secs, format)),
                    warning: None,
                });
            }
            Err(e) => {
                let warn = format!("{name}: {e}");
                warnings.push(warn.clone());
                file_results.push(FileDurationInfo {
                    file: name.clone(),
                    duration: None,
                    warning: Some(warn),
                });
            }
        }
    }

    let estimated_duration = if has_scorm {
        Some(format_duration(
            total_seconds + total_content_seconds,
            format,
        ))
    } else {
        None
    };

    Ok(MultiDurationResponse {
        duration: format_duration(total_seconds, format),
        estimated_duration,
        files: file_results,
        warnings,
        scorm_analysis: None,
    })
}

async fn download_file(
    client: &reqwest::Client,
    url: &str,
    dir: &Path,
) -> Result<PathBuf, AppError> {
    let response = client
        .get(url)
        .send()
        .await?
        .error_for_status()
        .map_err(|e| AppError::BadRequest(format!("Failed to download {url}: {e}")))?;

    let filename = url_filename(url);
    let file_path = dir.join(&filename);

    let bytes = response.bytes().await?;
    let mut f = tokio::fs::File::create(&file_path).await?;
    f.write_all(&bytes).await?;

    Ok(file_path)
}

fn url_filename(url: &str) -> String {
    url.rsplit('/')
        .next()
        .and_then(|s| s.split('?').next())
        .filter(|s| !s.is_empty())
        .unwrap_or("download")
        .to_string()
}

fn filename_from_url(url: &str) -> String {
    url_filename(url)
}
