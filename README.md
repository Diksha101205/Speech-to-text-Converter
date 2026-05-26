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
```

## Project Days

- **Day 1:** MERN overview, API selection, Vite React setup, Tailwind setup, Git setup.
- **Day 2:** Express server, dependencies, Multer audio upload route.
- **Day 3:** MongoDB connection, Mongoose schema for audio uploads and transcriptions.
- **Day 4:** OpenAI Speech-to-Text integration.
- **Day 5:** React UI for audio upload, browser recording, and transcription display.
