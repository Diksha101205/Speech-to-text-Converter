import fs from 'node:fs'
import path from 'node:path'

import { Router } from 'express'
import multer from 'multer'

import { isDatabaseConnected } from '../config/db.js'
import Transcription from '../models/Transcription.js'
import { transcribeAudio } from '../services/speechToText.js'

const router = Router()
const uploadDir = path.resolve('server/uploads')
const MAX_AUDIO_SIZE = 25 * 1024 * 1024
const SESSION_PATTERN = /^[a-zA-Z0-9._:-]{8,120}$/

fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')
    cb(null, `${Date.now()}-${safeName}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_AUDIO_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('audio/')) {
      cb(null, true)
      return
    }

    const error = new Error('Please upload an audio file.')
    error.status = 400
    cb(error)
  },
})

const handleAudioUpload = (req, res, next) => {
  upload.single('audio')(req, res, (error) => {
    if (!error) {
      return next()
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'Audio must be 25 MB or smaller.',
      })
    }

    return res.status(error.status || 400).json({
      message: error.message || 'Audio upload failed.',
    })
  })
}

const getSessionId = (req) => {
  const sessionId = req.get('x-session-id') || req.body?.sessionId || ''
  const trimmedSessionId = sessionId.trim()

  return SESSION_PATTERN.test(trimmedSessionId) ? trimmedSessionId : ''
}

router.get('/', async (req, res, next) => {
  try {
    const sessionId = getSessionId(req)

    if (!isDatabaseConnected()) {
      return res.json({
        saved: false,
        count: 0,
        sessionId,
        transcriptions: [],
      })
    }

    const transcriptions = await Transcription.find({
      status: 'transcribed',
      transcript: { $ne: '' },
      ...(sessionId ? { sessionId } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(25)

    return res.json({
      saved: true,
      count: transcriptions.length,
      sessionId,
      transcriptions,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/', handleAudioUpload, async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Audio file is required.' })
  }

  if (req.file.size === 0) {
    return res.status(400).json({ message: 'Audio file is empty. Please choose or record audio again.' })
  }

  const uploadDetails = {
    originalName: req.file.originalname,
    fileName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storagePath: req.file.path,
    sessionId: getSessionId(req),
    source: req.body.source === 'recording' ? 'recording' : 'upload',
  }

  try {
    const savedTranscription = isDatabaseConnected()
      ? await Transcription.create(uploadDetails)
      : null

    const result = await transcribeAudio(req.file.path)
    const transcriptText = result.text.trim()

    if (!transcriptText) {
      if (savedTranscription) {
        savedTranscription.provider = result.provider
        savedTranscription.model = result.model
        savedTranscription.status = 'failed'
        savedTranscription.error = 'No speech was detected in the audio.'
        await savedTranscription.save()
      }

      return res.status(422).json({
        message: 'No speech was detected in the audio. Please try a clearer recording.',
        saved: Boolean(savedTranscription),
        transcription: savedTranscription,
        provider: result.provider,
        model: result.model,
        sessionId: uploadDetails.sessionId,
        file: uploadDetails,
      })
    }

    if (savedTranscription) {
      savedTranscription.provider = result.provider
      savedTranscription.model = result.model
      savedTranscription.status = 'transcribed'
      savedTranscription.transcript = transcriptText
      savedTranscription.error = ''
      await savedTranscription.save()
    }

    return res.status(201).json({
      message: savedTranscription
        ? 'Audio uploaded, transcribed, and saved successfully.'
        : 'Audio uploaded and transcribed successfully. Add MONGODB_URI to save it in MongoDB.',
      saved: Boolean(savedTranscription),
      transcription: savedTranscription,
      transcript: transcriptText,
      provider: result.provider,
      model: result.model,
      sessionId: uploadDetails.sessionId,
      file: uploadDetails,
    })
  } catch (error) {
    if (isDatabaseConnected()) {
      await Transcription.findOneAndUpdate(
        { fileName: uploadDetails.fileName },
        {
          status: 'failed',
          error: error.message,
        },
      )
    }

    return next(error)
  }
})

export default router
