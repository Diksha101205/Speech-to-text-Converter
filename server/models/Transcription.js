import mongoose from 'mongoose'

const transcriptionSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      enum: ['upload', 'recording'],
      default: 'upload',
    },
    provider: {
      type: String,
      default: 'openai',
    },
    model: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['uploaded', 'transcribed', 'failed'],
      default: 'uploaded',
    },
    transcript: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model('Transcription', transcriptionSchema)
