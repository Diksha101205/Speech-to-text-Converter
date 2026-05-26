import fs from 'node:fs'
import path from 'node:path'

import { Router } from 'express'
import multer from 'multer'

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

router.post('/', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Audio file is required.' })
  }

  return res.status(201).json({
    message: 'Audio uploaded successfully.',
    file: {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      source: req.body.source || 'upload',
    },
  })
})

export default router
