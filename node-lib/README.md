# duration-api

Extract duration from media files and SCORM e-learning packages. Uses ffprobe under the hood.

## Prerequisites

[FFmpeg](https://ffmpeg.org/download.html) must be installed so that `ffprobe` is available on your `PATH`.

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg
```

## Install

```bash
npm install duration-api
```

## Library usage

```ts
import {
  getDurationSeconds,
  analyzeScorm,
  estimatedContentSeconds,
  formatDuration,
} from "duration-api";

// Get duration of a media file (in seconds)
const seconds = await getDurationSeconds("/path/to/video.mp4");
console.log(formatDuration(seconds, "HH:MM:SS")); // "00:03:24"

// Analyze a SCORM package
const analysis = analyzeScorm("/path/to/course.zip", "/tmp/extract");
console.log(analysis.wordCount);          // 2500
console.log(analysis.quizQuestionCount);  // 10
console.log(estimatedContentSeconds(analysis)); // reading time + quiz time in seconds
```

### API

#### `getDurationSeconds(filePath: string): Promise<number>`

Extracts duration in seconds from a media file using ffprobe.

#### `analyzeScorm(zipPath: string, extractDir: string): ScormAnalysis`

Extracts and analyzes a SCORM ZIP package. Returns media files found, manifest duration, word count, and quiz question count.

#### `estimatedContentSeconds(analysis: ScormAnalysis): number`

Calculates estimated seconds for reading text content (200 WPM) plus answering quiz questions (30s each).

#### `formatDuration(totalSeconds: number, format: string): string`

Formats seconds into a time string. Supported formats: `"HH:MM:SS"`, `"MM:SS"`, `"HH:MM"`.

#### `parseIso8601Duration(s: string): number | null`

Parses an ISO 8601 duration string (e.g. `PT1H30M`) into seconds.

#### `countWordsInHtml(html: string): number`

Strips HTML tags, script/style blocks, and counts words.

#### `countQuestionsInJs(js: string): number`

Detects quiz question patterns in JavaScript content.

#### `isSupportedMedia(filePath: string): boolean`

Checks if a file has a supported media extension (mp4, mp3, wav, etc.).

#### `isZipFile(filePath: string): boolean`

Checks if a file has a `.zip` extension.

#### `createServer(): express.Express`

Creates a configured Express app with all API routes. Useful for embedding in an existing server.

```ts
import { createServer } from "duration-api";

const app = createServer();
app.listen(3000);
```

#### `startServer(port: number): void`

Starts a standalone Express server on the given port.

## CLI / HTTP server

The package also ships a CLI that starts an HTTP server matching the API surface:

```bash
npx durationapi serve --port 3000
```

### Endpoints

#### `GET /health`

```json
{ "status": "ok" }
```

#### `POST /duration`

Submit a URL or array of URLs:

```json
{
  "fileUrl": "https://example.com/video.mp4",
  "format": "HH:MM:SS"
}
```

```json
{
  "files": ["https://example.com/a.mp3", "https://example.com/b.mp4"],
  "format": "HH:MM:SS"
}
```

#### `POST /duration/upload`

Multipart form upload. Fields: `files` (one or more), `format` (optional).

### Supported formats

| Format     | Example    |
|------------|------------|
| `HH:MM:SS` | `01:30:45` |
| `MM:SS`    | `90:45`    |
| `HH:MM`    | `01:30`    |

## Supported media types

Video: MP4, AVI, MOV, WEBM, MKV
Audio: MP3, WAV, FLAC, OGG, AAC, WMA, M4A

## SCORM support

Analyzes SCORM 1.1, 1.2, 2004 (2nd/3rd/4th Edition), and cmi5 packages:

- Parses `imsmanifest.xml` for `typicalLearningTime` and duration limits
- Counts words in HTML/HTM files for reading time estimation
- Detects quiz questions in JavaScript files
- Extracts embedded media files and measures their duration

## License

MIT
