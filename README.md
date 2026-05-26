# Speech-to-Text Converter

A MERN web project that lets users upload or record audio, transcribe it through a Speech-to-Text API, and store the transcription details in MongoDB.

## Day 1: Project Understanding & Initial Setup

### MERN Stack

- **MongoDB** stores uploaded audio metadata and generated transcription text.
- **Express.js** exposes backend API routes for uploads, transcription, and saved history.
- **React** powers the browser UI for upload, recording, and reading results.
- **Node.js** runs the server and connects Express, MongoDB, Multer, and the transcription provider.

### How Speech-to-Text APIs Work

Speech-to-Text services accept an audio file or stream, analyze the waveform, detect spoken words, and return text. Most providers require an API key and charge based on audio length or usage. This project sends uploaded or recorded audio to a backend route first so the API key stays private on the server.

### API Choice

This project uses **OpenAI Speech-to-Text** through the official `openai` Node SDK. The default model is `gpt-4o-mini-transcribe`, and it can be changed with `OPENAI_TRANSCRIPTION_MODEL`.

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
OPENAI_API_KEY=your_openai_api_key
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_TRANSCRIPTION_PROMPT=
```

The server loads the real `.env` file at runtime. Keep this file local because it contains private keys.

## Project Days

- **Day 1:** MERN overview, API selection, Vite React setup, Tailwind setup, Git setup.
- **Day 2:** Express server, dependencies, Multer audio upload route.
- **Day 3:** MongoDB connection, Mongoose schema for audio uploads and transcriptions.
- **Day 4:** OpenAI Speech-to-Text integration.
- **Day 5:** React UI for audio upload, browser recording, and transcription display.

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

OpenAI Speech-to-Text is implemented in `server/services/speechToText.js` with the official `openai` Node SDK. The upload route now:

1. Receives an audio file through Multer.
2. Saves upload metadata in MongoDB when connected.
3. Sends the stored file to OpenAI's transcription endpoint.
4. Updates the MongoDB record with the transcript, model, provider, and status.
5. Returns the transcript to the frontend.

The file upload limit is 25 MB to match the OpenAI transcription file limit.

## Day 5: Frontend UI

The React frontend in `converter/src/App.jsx` now includes:

- Audio file upload.
- Browser audio recording with `MediaRecorder`.
- Submit flow that sends `FormData` to the Express API.
- Transcription result list with copy and remove actions.
- Saved transcription history when MongoDB is connected.

Tailwind CSS is used for the page layout, controls, status messages, and responsive styling.
