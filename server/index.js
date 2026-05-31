import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { connectDatabase } from './config/db.js'
import transcriptionsRouter from './routes/transcriptions.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const clientOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: [...new Set([...clientOrigins, 'http://localhost:5173', 'http://localhost:3000'])],
  }),
)
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/transcriptions', transcriptionsRouter)

app.use((error, _req, res, _next) => {
  const status = error.status || 500

  res.status(status).json({
    message:
      status >= 500
        ? 'The server could not complete the request. Please try again.'
        : error.message || 'Something went wrong.',
  })
})

await connectDatabase()

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
