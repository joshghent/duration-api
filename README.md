# Duration API

A high-performance microservice built in Rust that extracts duration information from video files, audio files, and SCORM e-learning packages. Designed for LMS platforms and e-learning tools that need fast, accurate content duration calculations.

## Features

- **Media duration extraction** — MP4, AVI, MOV, WEBM, MKV, MP3, WAV, FLAC, OGG, AAC, WMA, M4A
- **SCORM package analysis** — SCORM 1.1, 1.2, 2004 (2nd/3rd/4th Edition), and cmi5
- **Content time estimation** — Reading time from HTML word counts (200 wpm) + quiz time (30s per question)
- **Manifest parsing** — Extracts `typicalLearningTime` and SCORM 2004 duration limits from `imsmanifest.xml`
- **Multiple file processing** — Submit batches of files and get individual + total durations
- **File upload support** — Both URL-based and multipart upload endpoints
- **Configurable output format** — `HH:MM:SS`, `MM:SS`, or `HH:MM`

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) 1.86+ (for building from source)
- [FFmpeg](https://ffmpeg.org/download.html) (ffprobe must be on `PATH`)
- [Docker](https://docs.docker.com/get-docker/) (optional, for containerized deployment)

### Build from source

```bash
git clone https://github.com/joshghent/duration-api.git
cd duration-api
cargo build --release
```

The binary will be at `target/release/durationapi`.

### Run the server

```bash
# Start on default port 3000
./target/release/durationapi serve

# Custom port
./target/release/durationapi serve --port 8080
```

## Docker

A Docker image is published to GHCR on every merge to `main`:

```bash
docker run -d --name durationapi -p 3000:3000 ghcr.io/joshghent/duration-api:latest
```

Or build it yourself:

```bash
docker build -t durationapi .
docker run -d --name durationapi -p 3000:3000 durationapi
```

It's a standard Docker image — run it however you like.

## API Reference

### Health check

```
GET /health
```

```json
{ "status": "ok" }
```

### Extract duration from URL

```
POST /duration
Content-Type: application/json
```

**Single file:**

```json
{
  "fileUrl": "https://example.com/video.mp4",
  "format": "HH:MM:SS"
}
```

Response:

```json
{
  "duration": "00:03:24"
}
```

**Multiple files:**

```json
{
  "files": [
    "https://example.com/intro.mp3",
    "https://example.com/lecture.mp4"
  ],
  "format": "HH:MM:SS"
}
```

Response:

```json
{
  "duration": "00:54:12",
  "files": [
    { "file": "intro.mp3", "duration": "00:43:00" },
    { "file": "lecture.mp4", "duration": "00:11:12" }
  ],
  "warnings": []
}
```

**SCORM package:**

```json
{
  "fileUrl": "https://example.com/course.zip"
}
```

Response:

```json
{
  "duration": "00:45:30",
  "estimatedDuration": "00:52:15",
  "scormAnalysis": {
    "manifestDuration": "00:30:00",
    "wordCount": 2500,
    "quizQuestionCount": 10,
    "estimatedReadingTime": "00:12:30",
    "estimatedQuizTime": "00:05:00"
  }
}
```

### Upload files directly

```
POST /duration/upload
Content-Type: multipart/form-data
```

Fields:
- `files` — One or more file uploads
- `format` — (optional) `HH:MM:SS`, `MM:SS`, or `HH:MM`

Response format is the same as the JSON endpoint.

### Format options

| Format      | Example    | Description                     |
|-------------|------------|---------------------------------|
| `HH:MM:SS`  | `01:30:45` | Hours, minutes, seconds (default) |
| `MM:SS`     | `90:45`    | Total minutes and seconds       |
| `HH:MM`     | `01:30`    | Hours and minutes (no seconds)  |

### Error responses

| Status | Meaning                        |
|--------|--------------------------------|
| 400    | Bad request / unsupported file |
| 500    | Internal server error          |

Errors return JSON:

```json
{ "error": "Description of the problem" }
```

When processing multiple files, unsupported files don't cause the request to fail — they appear in the `warnings` array with a `null` duration.

## SCORM Analysis

When a `.zip` file is submitted, the API treats it as a SCORM package:

1. **Extracts the archive** and scans for media files (video/audio)
2. **Parses `imsmanifest.xml`** for `typicalLearningTime` or SCORM 2004 duration limits
3. **Counts words** in all HTML/HTM files (used to estimate reading time at 200 words per minute)
4. **Detects quiz questions** in JavaScript files (patterns like `AddQuestion(`, `new Question(`, question object literals)
5. **Returns both actual media duration and an estimated total duration** that includes reading time and quiz time

Supported SCORM versions:
- SCORM 1.1
- SCORM 1.2
- SCORM 2004 2nd Edition
- SCORM 2004 3rd Edition
- SCORM 2004 4th Edition
- cmi5

## Development

### Run tests

```bash
# Install ffmpeg (required for media duration tests)
# macOS: brew install ffmpeg
# Ubuntu: sudo apt-get install ffmpeg

cargo test
```

### Lint and format

```bash
cargo fmt
cargo clippy -- -D warnings
```

### Project structure

```
src/
├── main.rs       # CLI and server setup
├── lib.rs        # Module exports
├── routes.rs     # HTTP endpoint handlers
├── duration.rs   # Core duration extraction and SCORM analysis
├── models.rs     # Request/response types
└── error.rs      # Error types and HTTP conversions
testfiles/        # Test media and SCORM packages
```

## License

MIT
