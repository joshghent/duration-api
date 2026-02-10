use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::AppError;

const MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "avi", "mov", "webm", "mkv", "mp3", "wav", "flac", "ogg", "aac", "wma", "m4a",
];

const WORDS_PER_MINUTE: f64 = 200.0;
const SECONDS_PER_QUIZ_QUESTION: f64 = 30.0;

pub fn is_supported_media(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MEDIA_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn is_zip_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase() == "zip")
        .unwrap_or(false)
}

pub fn get_duration_seconds(file_path: &Path) -> Result<f64, AppError> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(file_path)
        .output()
        .map_err(|e| AppError::InternalError(format!("Failed to run ffprobe: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::InternalError(format!("ffprobe failed: {stderr}")));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let seconds: f64 = stdout
        .trim()
        .parse()
        .map_err(|e| AppError::InternalError(format!("Failed to parse duration: {e}")))?;

    Ok(seconds)
}

/// Result of analyzing a SCORM package
pub struct ScormAnalysis {
    pub media_files: Vec<PathBuf>,
    pub manifest_duration_seconds: Option<f64>,
    pub word_count: u64,
    pub quiz_question_count: u64,
}

impl ScormAnalysis {
    /// Estimated seconds for reading text content + answering quiz questions
    pub fn estimated_content_seconds(&self) -> f64 {
        let reading_seconds = (self.word_count as f64 / WORDS_PER_MINUTE) * 60.0;
        let quiz_seconds = self.quiz_question_count as f64 * SECONDS_PER_QUIZ_QUESTION;
        reading_seconds + quiz_seconds
    }
}

/// Extract and analyze a SCORM zip: media files, manifest duration, word counts, quiz questions.
pub fn analyze_scorm(zip_path: &Path, extract_dir: &Path) -> Result<ScormAnalysis, AppError> {
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    let mut media_files = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let out_path = extract_dir.join(enclosed_name);

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut outfile = std::fs::File::create(&out_path)?;
            std::io::copy(&mut entry, &mut outfile)?;

            if is_supported_media(&out_path) {
                media_files.push(out_path);
            }
        }
    }

    let manifest_duration_seconds = parse_manifest_duration(extract_dir);
    let word_count = count_words_in_html_files(extract_dir);
    let quiz_question_count = count_quiz_questions(extract_dir);

    Ok(ScormAnalysis {
        media_files,
        manifest_duration_seconds,
        word_count,
        quiz_question_count,
    })
}

/// Parse imsmanifest.xml for duration metadata.
/// Looks for SCORM 2004 duration fields like attemptAbsoluteDurationLimit
/// and the `typicalLearningTime` element in LOM metadata.
fn parse_manifest_duration(extract_dir: &Path) -> Option<f64> {
    let manifest_path = extract_dir.join("imsmanifest.xml");
    let content = std::fs::read_to_string(&manifest_path).ok()?;

    // Try typicalLearningTime (ISO 8601 duration in LOM metadata)
    // e.g. <typicalLearningTime><duration>PT1H30M</duration></typicalLearningTime>
    if let Some(seconds) = extract_iso8601_duration(&content, "typicalLearningTime") {
        return Some(seconds);
    }

    // Try SCORM 2004 adlcp duration limits
    for tag in &[
        "adlcp:attemptAbsoluteDurationLimit",
        "attemptAbsoluteDurationLimit",
        "adlcp:activityAbsoluteDurationLimit",
        "activityAbsoluteDurationLimit",
    ] {
        if let Some(seconds) = extract_tag_duration(&content, tag) {
            return Some(seconds);
        }
    }

    None
}

/// Extract ISO 8601 duration from within a parent element.
/// Handles formats like PT1H30M, PT45M, PT1H30M15S, P0Y0M0DT1H30M0S
fn extract_iso8601_duration(xml: &str, parent_tag: &str) -> Option<f64> {
    let open = format!("<{parent_tag}");
    let close = format!("</{parent_tag}>");
    let start = xml.find(&open)?;
    let end = xml[start..].find(&close)? + start;
    let block = &xml[start..end];

    // Look for <duration>...</duration> inside
    let dur_start = block.find("<duration>")? + "<duration>".len();
    let dur_end = block[dur_start..].find("</duration>")? + dur_start;
    let dur_str = block[dur_start..dur_end].trim();

    parse_iso8601_duration(dur_str)
}

/// Extract duration from a self-contained element like <adlcp:attemptAbsoluteDurationLimit>PT1H</...>
fn extract_tag_duration(xml: &str, tag: &str) -> Option<f64> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    let dur_str = xml[start..end].trim();
    parse_iso8601_duration(dur_str)
}

/// Parse ISO 8601 duration string (e.g. PT1H30M15S, P0Y0M0DT1H30M0S) into seconds.
pub fn parse_iso8601_duration(s: &str) -> Option<f64> {
    let s = s.trim();
    if !s.starts_with('P') {
        return None;
    }

    let s = &s[1..]; // strip P
    let (date_part, time_part) = if let Some(t_pos) = s.find('T') {
        (&s[..t_pos], &s[t_pos + 1..])
    } else {
        (s, "")
    };

    let mut total_seconds = 0.0;

    // Parse date part (Y, M, D) - rarely used but handle it
    let mut num_buf = String::new();
    for ch in date_part.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            num_buf.push(ch);
        } else {
            let val: f64 = num_buf.parse().unwrap_or(0.0);
            num_buf.clear();
            match ch {
                'Y' => total_seconds += val * 365.25 * 86400.0,
                'M' => total_seconds += val * 30.44 * 86400.0,
                'D' => total_seconds += val * 86400.0,
                _ => {}
            }
        }
    }

    // Parse time part (H, M, S)
    num_buf.clear();
    for ch in time_part.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            num_buf.push(ch);
        } else {
            let val: f64 = num_buf.parse().unwrap_or(0.0);
            num_buf.clear();
            match ch {
                'H' => total_seconds += val * 3600.0,
                'M' => total_seconds += val * 60.0,
                'S' => total_seconds += val,
                _ => {}
            }
        }
    }

    if total_seconds > 0.0 {
        Some(total_seconds)
    } else {
        None
    }
}

/// Count words in all HTML files under a directory.
fn count_words_in_html_files(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = walk_dir(dir) {
        for path in entries {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext == "html" || ext == "htm" {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    total += count_words_in_html(&content);
                }
            }
        }
    }
    total
}

/// Strip HTML tags and count words in the remaining text.
pub fn count_words_in_html(html: &str) -> u64 {
    // Remove script and style blocks first, then strip tags
    let lower = html.to_lowercase();
    let mut clean = String::with_capacity(html.len());

    let mut pos = 0;
    while pos < html.len() {
        // Check for script/style blocks to skip
        let lower_remaining = &lower[pos..];
        if lower_remaining.starts_with("<script") {
            if let Some(end) = lower[pos..].find("</script>") {
                pos += end + 9;
                continue;
            }
        }
        if lower_remaining.starts_with("<style") {
            if let Some(end) = lower[pos..].find("</style>") {
                pos += end + 8;
                continue;
            }
        }

        // Safe to index: we only look for ASCII '<' and '>' characters
        let b = html.as_bytes()[pos];
        if b == b'<' {
            // Skip to end of tag
            if let Some(tag_end) = html[pos..].find('>') {
                pos += tag_end + 1;
                clean.push(' ');
            } else {
                pos += 1;
            }
        } else {
            // Copy character properly (handles multi-byte UTF-8)
            let ch = html[pos..].chars().next().unwrap();
            clean.push(ch);
            pos += ch.len_utf8();
        }
    }

    clean
        .split_whitespace()
        .filter(|w| w.len() > 1 || w.chars().all(|c| c.is_alphabetic()))
        .count() as u64
}

/// Count quiz questions in JavaScript files.
/// Looks for patterns like `AddQuestion(`, `new Question(`, or question arrays.
fn count_quiz_questions(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = walk_dir(dir) {
        for path in entries {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext == "js" {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    total += count_questions_in_js(&content);
                }
            }
        }
    }
    total
}

/// Count question patterns in JavaScript content.
pub fn count_questions_in_js(js: &str) -> u64 {
    let mut count = 0u64;

    // Pattern: AddQuestion( or .addQuestion(
    let js_lower = js.to_lowercase();
    count += js_lower.matches("addquestion(").count() as u64;
    count += js_lower.matches("new question(").count() as u64;

    // Pattern: question objects in arrays like { question: "...", or "question": "..."
    // Common in modern SCORM authoring tools
    for line in js.lines() {
        let trimmed = line.trim().to_lowercase();
        // Strip leading { or , for object entries
        let stripped =
            trimmed.trim_start_matches(|c: char| c == '{' || c == ',' || c.is_whitespace());
        if (stripped.starts_with("\"question\"")
            || stripped.starts_with("'question'")
            || stripped.starts_with("question:"))
            && stripped.contains(':')
        {
            count += 1;
        }
    }

    count
}

/// Recursively walk a directory and return all file paths.
fn walk_dir(dir: &Path) -> Result<Vec<PathBuf>, std::io::Error> {
    let mut files = Vec::new();
    if !dir.is_dir() {
        return Ok(files);
    }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            files.extend(walk_dir(&path)?);
        } else {
            files.push(path);
        }
    }
    Ok(files)
}

pub fn format_duration(total_seconds: f64, format: &str) -> String {
    let total_secs = total_seconds.round() as u64;
    let hours = total_secs / 3600;
    let minutes = (total_secs % 3600) / 60;
    let seconds = total_secs % 60;

    match format {
        "MM:SS" => format!("{:02}:{:02}", (hours * 60) + minutes, seconds),
        "HH:MM" => format!("{:02}:{:02}", hours, minutes),
        // Default: HH:MM:SS
        _ => format!("{:02}:{:02}:{:02}", hours, minutes, seconds),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_duration_hhmmss() {
        assert_eq!(format_duration(3661.0, "HH:MM:SS"), "01:01:01");
        assert_eq!(format_duration(0.0, "HH:MM:SS"), "00:00:00");
        assert_eq!(format_duration(59.0, "HH:MM:SS"), "00:00:59");
        assert_eq!(format_duration(3600.0, "HH:MM:SS"), "01:00:00");
    }

    #[test]
    fn test_format_duration_mmss() {
        assert_eq!(format_duration(125.0, "MM:SS"), "02:05");
        assert_eq!(format_duration(3661.0, "MM:SS"), "61:01");
    }

    #[test]
    fn test_format_duration_hhmm() {
        assert_eq!(format_duration(3661.0, "HH:MM"), "01:01");
    }

    #[test]
    fn test_is_supported_media() {
        assert!(is_supported_media(Path::new("test.mp3")));
        assert!(is_supported_media(Path::new("test.MP4")));
        assert!(!is_supported_media(Path::new("test.png")));
        assert!(!is_supported_media(Path::new("test.txt")));
    }

    #[test]
    fn test_parse_iso8601_duration() {
        assert_eq!(parse_iso8601_duration("PT1H30M"), Some(5400.0));
        assert_eq!(parse_iso8601_duration("PT45M"), Some(2700.0));
        assert_eq!(parse_iso8601_duration("PT1H30M15S"), Some(5415.0));
        assert_eq!(parse_iso8601_duration("PT0H0M30S"), Some(30.0));
        assert_eq!(parse_iso8601_duration("PT2H"), Some(7200.0));
        assert_eq!(parse_iso8601_duration("P0Y0M0DT1H30M0S"), Some(5400.0));
        assert_eq!(parse_iso8601_duration("invalid"), None);
        assert_eq!(parse_iso8601_duration("PT0H0M0S"), None); // zero duration
    }

    #[test]
    fn test_count_words_in_html() {
        assert_eq!(count_words_in_html("<p>Hello world this is a test</p>"), 6);
        assert_eq!(
            count_words_in_html("<script>var x = 1;</script><p>Hello</p>"),
            1
        );
        assert_eq!(
            count_words_in_html("<style>.foo{color:red}</style><p>Word</p>"),
            1
        );
        assert_eq!(count_words_in_html(""), 0);
        assert_eq!(count_words_in_html("<div><span>Two words</span></div>"), 2);
    }

    #[test]
    fn test_count_questions_in_js() {
        let js = r#"
            test.AddQuestion(new Question("q1", "What is 1+1?", QUESTION_TYPE_CHOICE, ["1","2","3"], "2", "obj"));
            test.AddQuestion(new Question("q2", "What is 2+2?", QUESTION_TYPE_CHOICE, ["3","4","5"], "4", "obj"));
        "#;
        // 2x AddQuestion + 2x new Question = 4
        assert_eq!(count_questions_in_js(js), 4);

        let js2 = r#"
            var questions = [
                { question: "What is Rust?", answers: ["A","B"] },
                { question: "What is Axum?", answers: ["C","D"] }
            ];
        "#;
        assert_eq!(count_questions_in_js(js2), 2);
    }

    #[test]
    fn test_count_questions_zero_for_normal_js() {
        let js = "var x = 1; function foo() { return 42; }";
        assert_eq!(count_questions_in_js(js), 0);
    }

    #[test]
    fn test_is_zip_file() {
        assert!(is_zip_file(Path::new("course.zip")));
        assert!(is_zip_file(Path::new("course.ZIP")));
        assert!(!is_zip_file(Path::new("audio.mp3")));
    }

    #[test]
    fn test_analyze_scorm_with_test_file() {
        let zip_path =
            Path::new("testfiles/scorm/ContentPackagingSingleSCO_SCORM20043rdEdition.zip");
        if !zip_path.exists() {
            return; // skip if test files not available
        }
        let tmp = tempfile::TempDir::new().unwrap();
        let result = analyze_scorm(zip_path, tmp.path()).unwrap();

        // This package has HTML content and quiz questions but no media
        assert!(result.media_files.is_empty());
        assert!(result.word_count > 0, "Should find words in HTML files");
        assert!(
            result.quiz_question_count > 0,
            "Should find quiz questions in JS files"
        );
    }

    #[test]
    fn test_analyze_scorm_with_media() {
        let zip_path = Path::new(
            "testfiles/scorm/employee-health-and-wellness-sample-course-scorm12-0B2a3WZM.zip",
        );
        if !zip_path.exists() {
            return;
        }
        let tmp = tempfile::TempDir::new().unwrap();
        let result = analyze_scorm(zip_path, tmp.path()).unwrap();

        assert!(!result.media_files.is_empty(), "Should find media files");
    }
}
