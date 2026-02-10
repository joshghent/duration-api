use std::path::Path;

/// Test that the DB can be created, keys generated, and validated
#[test]
fn test_db_lifecycle() {
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let db = durationapi::db::Db::new(tmp.path().to_str().unwrap()).unwrap();

    let key = db.create_api_key("test-app").unwrap();
    assert!(!key.is_empty());

    let key_id = db.validate_key(&key).unwrap();
    assert!(key_id.is_some());

    let invalid = db.validate_key("not-a-real-key").unwrap();
    assert!(invalid.is_none());

    db.record_usage(key_id.unwrap()).unwrap();
}

/// Test that ffprobe can extract duration from the test audio file
#[test]
fn test_ffprobe_audio() {
    let path = Path::new("testfiles/audio/suzume_no_tojimari.mp3");
    if !path.exists() {
        return;
    }
    let seconds = durationapi::duration::get_duration_seconds(path).unwrap();
    assert!(seconds > 20.0 && seconds < 30.0, "Expected ~24s, got {seconds}");
}

/// Test that ffprobe can extract duration from the test video file
#[test]
fn test_ffprobe_video() {
    let path = Path::new("testfiles/video/1416529-sd_640_360_30fps.mp4");
    if !path.exists() {
        return;
    }
    let seconds = durationapi::duration::get_duration_seconds(path).unwrap();
    assert!(seconds > 5.0 && seconds < 30.0, "Expected ~12s, got {seconds}");
}

/// Test SCORM analysis on a package with quiz questions
#[test]
fn test_scorm_analysis_content_estimation() {
    let zip_path = Path::new("testfiles/scorm/ContentPackagingSingleSCO_SCORM20043rdEdition.zip");
    if !zip_path.exists() {
        return;
    }
    let tmp = tempfile::TempDir::new().unwrap();
    let analysis = durationapi::duration::analyze_scorm(zip_path, tmp.path()).unwrap();

    assert!(analysis.word_count > 0);
    assert!(analysis.quiz_question_count > 0);

    let est = analysis.estimated_content_seconds();
    assert!(est > 0.0, "Content estimate should be positive");

    // Reading ~words at 200wpm + quiz questions at 30s each
    let reading_time = (analysis.word_count as f64 / 200.0) * 60.0;
    let quiz_time = analysis.quiz_question_count as f64 * 30.0;
    assert!((est - (reading_time + quiz_time)).abs() < 0.01);
}

/// Test SCORM with embedded media (employee health course)
#[test]
fn test_scorm_analysis_with_media() {
    let zip_path = Path::new("testfiles/scorm/employee-health-and-wellness-sample-course-scorm12-0B2a3WZM.zip");
    if !zip_path.exists() {
        return;
    }
    let tmp = tempfile::TempDir::new().unwrap();
    let analysis = durationapi::duration::analyze_scorm(zip_path, tmp.path()).unwrap();

    assert!(!analysis.media_files.is_empty(), "Should find media files");
    // The employee health course has HTML content too
    assert!(analysis.word_count > 0, "Should find words in HTML");
}

/// Test format_duration edge cases
#[test]
fn test_format_duration_large_values() {
    assert_eq!(durationapi::duration::format_duration(86400.0, "HH:MM:SS"), "24:00:00");
    assert_eq!(durationapi::duration::format_duration(90061.0, "HH:MM:SS"), "25:01:01");
    assert_eq!(durationapi::duration::format_duration(0.4, "HH:MM:SS"), "00:00:00");
    assert_eq!(durationapi::duration::format_duration(0.5, "HH:MM:SS"), "00:00:01"); // rounds up
}

/// Test ISO 8601 duration edge cases
#[test]
fn test_iso8601_edge_cases() {
    assert_eq!(durationapi::duration::parse_iso8601_duration("PT0S"), None); // zero
    assert_eq!(durationapi::duration::parse_iso8601_duration("PT1.5H"), Some(5400.0));
    assert_eq!(durationapi::duration::parse_iso8601_duration("P1DT2H"), Some(93600.0));
    assert_eq!(durationapi::duration::parse_iso8601_duration(""), None);
    assert_eq!(durationapi::duration::parse_iso8601_duration("not a duration"), None);
}
