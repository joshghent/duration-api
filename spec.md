# Durations API

## The core problem that this micro api is trying to solve
Getting durations for video, audio and scorm packages (which have media content embedded into them), and returning a clean duration calculation quickly.

## Example call

POST /duration (unsure on the route names)
{
  "fileUrl": "http://mypublicfile.com/audio.mp3"
  "format": "MM:SS" - custom format default "HH:MM:SS"
}

Response
{
  "duration": "01:24"
}

POST /duration
{
  "fileUrl": "http://mypublicfile.com/scorm.zip" - would need to unzip this and then get the content
}

POST /duration
Post body file upload with the files themselves


POST /duration
{
  "files": [
     "http://mypublicfile.com/first.mp3",
     "http://mypublicfile.com/second.mp4"
  ]
}

{
  "duration": "00:54:12"
  "files": ["00:43:00", "00:11:12"]
}

Multiple files return total and seperate duration. May want to improve the response structure to be more consistent and follow the jsonapi standard.

## Requirements
* Use rust for performance
* Spin up easily with docker
* don't store durations or files in a DB
* simple API key + credit track system (increment) for all successful calls
* use sqlite3 for the DB
* health endpoint
* test audio, video and scorm are provided in the repo under "testfiles"
* support different content types - mp4, avi, mov, webm for video, mp3, wav, flac for audio etc. it should support various version of scorm too such as 1.2, cmi5 etc.
* it should handle files that it can't deal with gracefully - especially if there are many files. for example 3 audio files and then one random image. it should still work but just null the image duration and provide a warning back to the user somehow.
