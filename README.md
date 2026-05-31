# Speech-to-Text Converter

A MERN web project that lets users upload or record audio, transcribe it through a Speech-to-Text API, and store the transcription details in MongoDB.

## Day 1: Project Understanding & Initial Setup

### MERN Stack

- **MongoDB** stores uploaded audio metadata and generated transcription text.
- **Express.js** exposes backend API routes for uploads, transcription, and saved history.
- **React** powers the browser UI for upload, recording, and reading results.
- **Node.js** runs the server and connects Express, MongoDB, Multer, and the transcription provider.

### How Speech-to-Text Works

Speech-to-Text systems accept an audio file or stream, analyze the waveform, detect spoken words, and return text. Hosted providers usually require an API key and billing. This project now uses local Whisper so transcription can run on the development machine without paid API quota.

### Provider Choice

This project uses **local Whisper** for Speech-to-Text. Whisper runs on the machine through Python, so there is no paid API quota after the local setup is installed.

### Setup

```bash
npm install
npm install --prefix converter
```

Run both the backend and frontend during development:

```bash
npm run dev
```

Run only the React frontend:

```bash
npm run client
```

Run only the Express backend:

```bash
npm run server:dev
```

### Environment Variables

Create a `.env` file in the project root:

```bash
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/speech_to_text_converter
WHISPER_MODEL=base
WHISPER_LANGUAGE=
WHISPER_PROMPT=
WHISPER_PYTHON_PATH=python
```

The server loads the real `.env` file at runtime. Keep this file local because it contains private keys.

## Project Days

- **Day 1:** MERN overview, API selection, Vite React setup, Tailwind setup, Git setup.
- **Day 2:** Express server, dependencies, Multer audio upload route.
- **Day 3:** MongoDB connection, Mongoose schema for audio uploads and transcriptions.
- **Day 4:** Local Whisper Speech-to-Text integration.
- **Day 5:** React UI for audio upload, browser recording, and transcription display.
- **Day 6:** Frontend-to-backend connection, loading states, and transcript rendering.

## Day 2: Backend Setup

The backend runs on Express and exposes:

- `GET /api/health` for a simple server check.
- `POST /api/transcriptions` for uploading one audio file with the form field name `audio`.

Multer stores uploaded audio in `server/uploads`. The upload folder is ignored by Git except for a `.gitkeep` placeholder.

## Day 3: Database Setup

MongoDB is connected with Mongoose in `server/config/db.js`. The `Transcription` model stores:

- Original audio filename and stored filename.
- MIME type, file size, and local storage path.
- Source type: uploaded file or browser recording.
- Provider name, status, transcript text, and error details.
- Automatic `createdAt` and `updatedAt` timestamps.

If `MONGODB_URI` is missing or MongoDB is not running, the backend can still process transcription requests and returns `saved: false` after a successful provider response.

## Day 4: Speech-to-Text Integration

Local Whisper Speech-to-Text is implemented in `server/services/speechToText.js` and `server/scripts/transcribe_whisper.py`. The upload route now:

1. Receives an audio file through Multer.
2. Saves upload metadata in MongoDB when connected.
3. Sends the stored file to the local Whisper Python script.
4. Updates the MongoDB record with the transcript, model, provider, and status.
5. Returns the transcript to the frontend.

Install the local runtime once:

```bash
python -m pip install -U openai-whisper
```

Whisper also needs FFmpeg installed and available on PATH so it can read MP3, M4A, WEBM, and similar audio files.

For Hindi audio, you can set:

```bash
WHISPER_LANGUAGE=hi
WHISPER_PROMPT=The audio is in Hindi. Transcribe the vocals accurately in Hindi.
```

The file upload limit is 25 MB to keep local processing responsive.

## Day 5: Frontend UI

The React frontend in `converter/src/App.jsx` now includes:

- Audio file upload.
- Browser audio recording with `MediaRecorder`.
- Submit flow that sends `FormData` to the Express API.
- Transcription result list with copy and remove actions.
- Saved transcription history when MongoDB is connected.

Tailwind CSS is used for the page layout, controls, status messages, and responsive styling.

## Day 6: Connecting Frontend to Backend

The frontend sends audio to the Express backend from `converter/src/App.jsx` using the Fetch API:

1. The selected upload or browser recording is added to `FormData` with the field name `audio`.
2. The request is sent to `POST /api/transcriptions`.
3. While Whisper is generating the transcript, the Transcribe button is disabled and shows a loading spinner with `Transcribing...`.
4. When the backend responds, the returned transcript is displayed at the top of the transcription list.
5. If MongoDB is connected, saved transcription history is loaded from `GET /api/transcriptions`.
