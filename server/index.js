import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import transcriptionRoutes from './routes/transcriptions.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 5000

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
  }),
)
app.use(express.json())
app.use('/uploads', express.static('server/uploads'))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'speech-to-text-api',
  })
})

app.use('/api/transcriptions', transcriptionRoutes)

app.use((err, _req, res, _next) => {
  const status = err.status || 500

  res.status(status).json({
    message: err.message || 'Something went wrong while processing the request.',
  })
})

app.listen(port, () => {
  console.log(`Speech-to-text server running on http://localhost:${port}`)
})
