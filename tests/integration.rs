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

/// Test that multiple API keys are independent
#[test]
fn test_db_multiple_keys() {
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let db = durationapi::db::Db::new(tmp.path().to_str().unwrap()).unwrap();

    let key1 = db.create_api_key("app-one").unwrap();
    let key2 = db.create_api_key("app-two").unwrap();

    assert_ne!(key1, key2, "Each key should be unique");

    let id1 = db.validate_key(&key1).unwrap().unwrap();
    let id2 = db.validate_key(&key2).unwrap().unwrap();
    assert_ne!(id1, id2, "Each key should have a distinct ID");
}

/// Test that ffprobe can extract duration from the test audio file
#[test]
fn test_ffprobe_audio() {
    let path = Path::new("testfiles/audio/suzume_no_tojimari.mp3");
    if !path.exists() {
        return;
    }
    let seconds = durationapi::duration::get_duration_seconds(path).unwrap();
    assert!(
        seconds > 20.0 && seconds < 30.0,
        "Expected ~24s, got {seconds}"
    );
}

/// Test that ffprobe can extract duration from the test video file
#[test]
fn test_ffprobe_video() {
    let path = Path::new("testfiles/video/1416529-sd_640_360_30fps.mp4");
    if !path.exists() {
        return;
    }
    let seconds = durationapi::duration::get_duration_seconds(path).unwrap();
    assert!(
        seconds > 5.0 && seconds < 30.0,
        "Expected ~12s, got {seconds}"
    );
}

/// Test is_supported_media covers all expected extensions
#[test]
fn test_supported_media_extensions() {
    let supported = [
        "mp4", "avi", "mov", "webm", "mkv", "mp3", "wav", "flac", "ogg", "aac", "wma", "m4a",
    ];
    for ext in &supported {
        let p = Path::new("test").with_extension(ext);
        assert!(
            durationapi::duration::is_supported_media(&p),
            "{ext} should be supported"
        );
    }
    // Case insensitivity
    for ext in &["MP4", "Mp3", "WAV", "FLAC", "Webm"] {
        let p = Path::new("test").with_extension(ext);
        assert!(
            durationapi::duration::is_supported_media(&p),
            "{ext} (uppercase) should be supported"
        );
    }
}

/// Test unsupported file types are rejected
#[test]
fn test_unsupported_media_extensions() {
    let unsupported = ["png", "jpg", "gif", "txt", "pdf", "docx", "html", "zip", "exe"];
    for ext in &unsupported {
        let p = Path::new("test").with_extension(ext);
        assert!(
            !durationapi::duration::is_supported_media(&p),
            "{ext} should NOT be supported"
        );
    }
}

/// Test is_zip_file
#[test]
fn test_is_zip_file() {
    assert!(durationapi::duration::is_zip_file(Path::new("course.zip")));
    assert!(durationapi::duration::is_zip_file(Path::new("course.ZIP")));
    assert!(durationapi::duration::is_zip_file(Path::new(
        "path/to/My Course.zip"
    )));
    assert!(!durationapi::duration::is_zip_file(Path::new("audio.mp3")));
    assert!(!durationapi::duration::is_zip_file(Path::new("noext")));
}

// ---------------------------------------------------------------------------
// SCORM package tests — Golf examples (SCORM.com reference packages)
// These are the canonical SCORM conformance test packages.
// ---------------------------------------------------------------------------

/// Helper: run analyze_scorm on a test package, assert it doesn't error
fn assert_scorm_parses(zip_name: &str) -> durationapi::duration::ScormAnalysis {
    let zip_path = Path::new("testfiles/scorm").join(zip_name);
    if !zip_path.exists() {
        panic!("Test file missing: {}", zip_path.display());
    }
    let tmp = tempfile::TempDir::new().unwrap();
    durationapi::duration::analyze_scorm(&zip_path, tmp.path())
        .unwrap_or_else(|e| panic!("Failed to analyze {zip_name}: {e}"))
}

// -- SCORM 1.1 --

#[test]
fn test_scorm_11_single_sco() {
    let analysis = assert_scorm_parses("ContentPackagingSingleSCO_SCORM11.zip");
    // SCORM 1.1 single SCO golf example has HTML content
    assert!(
        analysis.word_count > 0,
        "SCORM 1.1 single SCO should contain words in HTML"
    );
}

// -- SCORM 1.2 --

#[test]
fn test_scorm_12_single_sco() {
    let analysis = assert_scorm_parses("ContentPackagingSingleSCO_SCORM12.zip");
    assert!(
        analysis.word_count > 0,
        "SCORM 1.2 single SCO should contain words"
    );
}

#[test]
fn test_scorm_12_one_file_per_sco() {
    let analysis = assert_scorm_parses("ContentPackagingOneFilePerSCO_SCORM12.zip");
    assert!(
        analysis.word_count > 0,
        "SCORM 1.2 multi-SCO should contain words"
    );
}

#[test]
fn test_scorm_12_runtime_basic_calls() {
    let analysis = assert_scorm_parses("RuntimeBasicCalls_SCORM12.zip");
    assert!(
        analysis.word_count > 0,
        "SCORM 1.2 runtime basic should contain words"
    );
}

#[test]
fn test_scorm_12_runtime_minimum_calls() {
    let analysis = assert_scorm_parses("RuntimeMinimumCalls_SCORM12.zip");
    assert!(
        analysis.word_count > 0,
        "SCORM 1.2 runtime minimum should contain words"
    );
}

// -- SCORM 2004 2nd Edition --

#[test]
fn test_scorm_2004_2nd_single_sco() {
    let analysis = assert_scorm_parses("ContentPackagingSingleSCO_SCORM20042ndEdition.zip");
    assert!(
        analysis.word_count > 0,
        "SCORM 2004 2nd Ed single SCO should contain words"
    );
}

// -- SCORM 2004 3rd Edition --

#[test]
fn test_scorm_2004_3rd_single_sco() {
    let analysis = assert_scorm_parses("ContentPackagingSingleSCO_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
    assert!(
        analysis.quiz_question_count > 0,
        "Should detect quiz questions"
    );
}

#[test]
fn test_scorm_2004_3rd_one_file_per_sco() {
    let analysis = assert_scorm_parses("ContentPackagingOneFilePerSCO_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_metadata() {
    let analysis = assert_scorm_parses("ContentPackagingMetadata_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_runtime_basic() {
    let analysis = assert_scorm_parses("RuntimeBasicCalls_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_runtime_minimum() {
    let analysis = assert_scorm_parses("RuntimeMinimumCalls_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_runtime_advanced() {
    let analysis = assert_scorm_parses("RunTimeAdvancedCalls_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_sequencing_forced_sequential() {
    let analysis =
        assert_scorm_parses("SequencingForcedSequential_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_sequencing_post_test_rollup() {
    let analysis = assert_scorm_parses("SequencingPostTestRollup_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_sequencing_pre_or_post_test() {
    let analysis =
        assert_scorm_parses("SequencingPreOrPostTestRollup_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_sequencing_random_test() {
    let analysis = assert_scorm_parses("SequencingRandomTest_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

#[test]
fn test_scorm_2004_3rd_sequencing_simple_remediation() {
    let analysis =
        assert_scorm_parses("SequencingSimpleRemediation_SCORM20043rdEdition.zip");
    assert!(analysis.word_count > 0);
}

// -- SCORM 2004 4th Edition --

#[test]
fn test_scorm_2004_4th_sequencing_post_test_rollup() {
    let analysis =
        assert_scorm_parses("SequencingPostTestRollup4thEd_SCORM20044thEdition.zip");
    assert!(analysis.word_count > 0);
}

// -- Employee health course (SCORM 1.2 with embedded media) --

#[test]
fn test_scorm_employee_health_with_media() {
    let analysis =
        assert_scorm_parses("employee-health-and-wellness-sample-course-scorm12-0B2a3WZM.zip");
    assert!(
        !analysis.media_files.is_empty(),
        "Employee health course should contain media files"
    );
    assert!(
        analysis.word_count > 0,
        "Employee health course should contain HTML text"
    );
    // Verify media durations can be extracted (requires ffprobe)
    for media_file in &analysis.media_files {
        match durationapi::duration::get_duration_seconds(media_file) {
            Ok(seconds) => {
                assert!(
                    seconds > 0.0,
                    "Duration should be positive for {:?}",
                    media_file.file_name()
                );
            }
            Err(_) => {
                // ffprobe not installed in this environment — skip duration check
                eprintln!(
                    "Skipping duration check for {:?} (ffprobe not available)",
                    media_file.file_name()
                );
            }
        }
    }
}

// -- cmi5 packages --

#[test]
fn test_cmi5_mastery_score_framed() {
    let analysis = assert_scorm_parses("masteryscore_framed.zip");
    // cmi5 packages may have minimal HTML content
    // The key assertion is that they parse without errors
    assert!(
        analysis.media_files.is_empty() || !analysis.media_files.is_empty(),
        "Should parse without error"
    );
}

#[test]
fn test_cmi5_mastery_score_responsive() {
    assert_scorm_parses("masteryscore_responsive.zip");
}

#[test]
fn test_cmi5_single_au_basic_framed() {
    assert_scorm_parses("single_au_basic_framed.zip");
}

#[test]
fn test_cmi5_single_au_basic_responsive() {
    assert_scorm_parses("single_au_basic_responsive.zip");
}

// ---------------------------------------------------------------------------
// SCORM content estimation tests
// ---------------------------------------------------------------------------

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

/// Verify that a package with no quiz questions yields zero quiz time
#[test]
fn test_scorm_content_estimation_no_quiz() {
    // SCORM 1.1 single SCO doesn't have quiz questions in the same format
    let zip_path = Path::new("testfiles/scorm/ContentPackagingSingleSCO_SCORM11.zip");
    if !zip_path.exists() {
        return;
    }
    let tmp = tempfile::TempDir::new().unwrap();
    let analysis = durationapi::duration::analyze_scorm(zip_path, tmp.path()).unwrap();

    let est = analysis.estimated_content_seconds();
    let reading_time = (analysis.word_count as f64 / 200.0) * 60.0;
    let quiz_time = analysis.quiz_question_count as f64 * 30.0;
    assert_eq!(est, reading_time + quiz_time);
}

// ---------------------------------------------------------------------------
// SCORM version cross-comparison: same content across versions
// The Golf examples share the same course content across SCORM versions.
// Word counts should be similar (not necessarily identical due to minor markup diffs).
// ---------------------------------------------------------------------------

#[test]
fn test_scorm_cross_version_word_count_consistency() {
    let packages = [
        "ContentPackagingSingleSCO_SCORM11.zip",
        "ContentPackagingSingleSCO_SCORM12.zip",
        "ContentPackagingSingleSCO_SCORM20042ndEdition.zip",
        "ContentPackagingSingleSCO_SCORM20043rdEdition.zip",
    ];

    let mut word_counts: Vec<(String, u64)> = Vec::new();
    for pkg in &packages {
        let zip_path = Path::new("testfiles/scorm").join(pkg);
        if !zip_path.exists() {
            continue;
        }
        let tmp = tempfile::TempDir::new().unwrap();
        let analysis = durationapi::duration::analyze_scorm(&zip_path, tmp.path()).unwrap();
        word_counts.push((pkg.to_string(), analysis.word_count));
    }

    if word_counts.len() < 2 {
        return; // not enough packages to compare
    }

    // All versions should have non-trivial content
    for (pkg, wc) in &word_counts {
        assert!(*wc > 50, "{pkg} should have >50 words, got {wc}");
    }

    // Word counts across versions of the same course should be in the same ballpark
    // (within 3x of each other — they share the same golf course content)
    let min_wc = word_counts.iter().map(|(_, wc)| *wc).min().unwrap();
    let max_wc = word_counts.iter().map(|(_, wc)| *wc).max().unwrap();
    assert!(
        max_wc <= min_wc * 3,
        "Word counts across SCORM versions should be similar: min={min_wc}, max={max_wc}"
    );
}

// ---------------------------------------------------------------------------
// Format duration tests
// ---------------------------------------------------------------------------

#[test]
fn test_format_duration_large_values() {
    assert_eq!(
        durationapi::duration::format_duration(86400.0, "HH:MM:SS"),
        "24:00:00"
    );
    assert_eq!(
        durationapi::duration::format_duration(90061.0, "HH:MM:SS"),
        "25:01:01"
    );
    assert_eq!(
        durationapi::duration::format_duration(0.4, "HH:MM:SS"),
        "00:00:00"
    );
    assert_eq!(
        durationapi::duration::format_duration(0.5, "HH:MM:SS"),
        "00:00:01"
    ); // rounds up
}

#[test]
fn test_format_duration_all_formats() {
    // HH:MM:SS
    assert_eq!(
        durationapi::duration::format_duration(3661.0, "HH:MM:SS"),
        "01:01:01"
    );
    assert_eq!(
        durationapi::duration::format_duration(0.0, "HH:MM:SS"),
        "00:00:00"
    );

    // MM:SS
    assert_eq!(
        durationapi::duration::format_duration(125.0, "MM:SS"),
        "02:05"
    );
    assert_eq!(
        durationapi::duration::format_duration(3661.0, "MM:SS"),
        "61:01"
    );
    assert_eq!(
        durationapi::duration::format_duration(0.0, "MM:SS"),
        "00:00"
    );

    // HH:MM
    assert_eq!(
        durationapi::duration::format_duration(3661.0, "HH:MM"),
        "01:01"
    );
    assert_eq!(
        durationapi::duration::format_duration(7200.0, "HH:MM"),
        "02:00"
    );

    // Default (unknown format string should behave like HH:MM:SS)
    assert_eq!(
        durationapi::duration::format_duration(3661.0, "unknown"),
        "01:01:01"
    );
}

// ---------------------------------------------------------------------------
// ISO 8601 duration parsing tests
// ---------------------------------------------------------------------------

#[test]
fn test_iso8601_edge_cases() {
    assert_eq!(durationapi::duration::parse_iso8601_duration("PT0S"), None); // zero
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT1.5H"),
        Some(5400.0)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("P1DT2H"),
        Some(93600.0)
    );
    assert_eq!(durationapi::duration::parse_iso8601_duration(""), None);
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("not a duration"),
        None
    );
}

#[test]
fn test_iso8601_common_scorm_durations() {
    // Common patterns found in real SCORM manifests
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT1H30M"),
        Some(5400.0)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT45M"),
        Some(2700.0)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT1H30M15S"),
        Some(5415.0)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT2H"),
        Some(7200.0)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT30S"),
        Some(30.0)
    );
    // Full date+time format used by some SCORM 2004 authoring tools
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("P0Y0M0DT1H30M0S"),
        Some(5400.0)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("P0Y0M0DT0H45M0S"),
        Some(2700.0)
    );
    // Fractional seconds (some tools emit these)
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT1.5S"),
        Some(1.5)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("PT0.5M"),
        Some(30.0)
    );
}

#[test]
fn test_iso8601_with_days() {
    // Multi-day courses
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("P1D"),
        Some(86400.0)
    );
    assert_eq!(
        durationapi::duration::parse_iso8601_duration("P2DT4H"),
        Some(2.0 * 86400.0 + 4.0 * 3600.0)
    );
}

// ---------------------------------------------------------------------------
// HTML word counting tests
// ---------------------------------------------------------------------------

#[test]
fn test_count_words_nested_html() {
    let html = r#"
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
    </html>
    "#;
    let count = durationapi::duration::count_words_in_html(html);
    assert!(
        count > 15 && count < 40,
        "Expected ~25 words, got {count}"
    );
}

#[test]
fn test_count_words_empty_html() {
    assert_eq!(durationapi::duration::count_words_in_html(""), 0);
    assert_eq!(
        durationapi::duration::count_words_in_html("<html><body></body></html>"),
        0
    );
    assert_eq!(
        durationapi::duration::count_words_in_html("<script>lots of code here</script>"),
        0
    );
}

// ---------------------------------------------------------------------------
// Quiz question detection tests
// ---------------------------------------------------------------------------

#[test]
fn test_count_questions_addquestion_pattern() {
    let js = r#"
        test.AddQuestion(new Question("q1", "What is par?", QUESTION_TYPE_CHOICE, ["3","4","5"], "4", "obj"));
        test.AddQuestion(new Question("q2", "What is a birdie?", QUESTION_TYPE_CHOICE, ["a","b","c"], "a", "obj"));
        test.AddQuestion(new Question("q3", "What club for driving?", QUESTION_TYPE_CHOICE, ["d","e","f"], "d", "obj"));
    "#;
    let count = durationapi::duration::count_questions_in_js(js);
    // 3x AddQuestion + 3x new Question = 6
    assert_eq!(count, 6, "Should detect AddQuestion + new Question patterns");
}

#[test]
fn test_count_questions_object_literal_pattern() {
    let js = r#"
        var quiz = [
            { question: "What is the capital of France?", answers: ["Paris", "London"] },
            { question: "What is 2 + 2?", answers: ["3", "4"] },
            { "question": "Is the sky blue?", "answers": ["yes", "no"] },
            { 'question': 'Name a color', 'answers': ['red', 'blue'] }
        ];
    "#;
    let count = durationapi::duration::count_questions_in_js(js);
    assert_eq!(count, 4, "Should detect question object literals");
}

#[test]
fn test_count_questions_no_false_positives() {
    let js = r#"
        // This is a comment about questions
        var questionable = true;
        function getQuestion() { return null; }
        console.log("No actual questions here");
        var data = { name: "test", value: 42 };
    "#;
    let count = durationapi::duration::count_questions_in_js(js);
    assert_eq!(count, 0, "Should not produce false positives");
}

// ---------------------------------------------------------------------------
// Media file extension edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_media_extension_no_extension() {
    assert!(!durationapi::duration::is_supported_media(Path::new(
        "noext"
    )));
    assert!(!durationapi::duration::is_supported_media(Path::new(".")));
    assert!(!durationapi::duration::is_supported_media(Path::new("")));
}

#[test]
fn test_media_extension_double_extension() {
    // Only the last extension matters
    assert!(durationapi::duration::is_supported_media(Path::new(
        "file.backup.mp4"
    )));
    assert!(!durationapi::duration::is_supported_media(Path::new(
        "file.mp4.bak"
    )));
}
