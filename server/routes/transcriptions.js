import fs from 'node:fs'
import path from 'node:path'

import { Router } from 'express'
import multer from 'multer'

import { isDatabaseConnected } from '../config/db.js'
import Transcription from '../models/Transcription.js'
import { transcribeAudio } from '../services/speechToText.js'

const router = Router()
const uploadDir = path.resolve('server/uploads')

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
    fileSize: 25 * 1024 * 1024,
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

router.get('/', async (_req, res, next) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({
        saved: false,
        transcriptions: [],
      })
    }

    const transcriptions = await Transcription.find()
      .sort({ createdAt: -1 })
      .limit(12)

    return res.json({
      saved: true,
      transcriptions,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/', upload.single('audio'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Audio file is required.' })
  }

  const uploadDetails = {
    originalName: req.file.originalname,
    fileName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storagePath: req.file.path,
    source: req.body.source === 'recording' ? 'recording' : 'upload',
  }

  try {
    const savedTranscription = isDatabaseConnected()
      ? await Transcription.create(uploadDetails)
      : null

    const result = await transcribeAudio(req.file.path)

    if (savedTranscription) {
      savedTranscription.provider = result.provider
      savedTranscription.model = result.model
      savedTranscription.status = 'transcribed'
      savedTranscription.transcript = result.text
      savedTranscription.error = ''
      await savedTranscription.save()
    }

    return res.status(201).json({
      message: savedTranscription
        ? 'Audio uploaded, transcribed, and saved successfully.'
        : 'Audio uploaded and transcribed successfully. Add MONGODB_URI to save it in MongoDB.',
      saved: Boolean(savedTranscription),
      transcription: savedTranscription,
      transcript: result.text,
      provider: result.provider,
      model: result.model,
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
