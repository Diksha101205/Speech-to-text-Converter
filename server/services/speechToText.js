import fs from 'node:fs'

import OpenAI from 'openai'

let openai

const createHttpError = (message, status = 500) => {
  const error = new Error(message)
  error.status = status
  return error
}

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw createHttpError('OPENAI_API_KEY is missing. Add it to .env to transcribe audio.', 503)
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  return openai
}

export const transcribeAudio = async (filePath) => {
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe'
  const prompt = process.env.OPENAI_TRANSCRIPTION_PROMPT

  try {
    const response = await getOpenAIClient().audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model,
      response_format: 'json',
      ...(prompt ? { prompt } : {}),
    })

    return {
      provider: 'openai',
      model,
      text: typeof response === 'string' ? response : response.text || '',
    }
  } catch (error) {
    if (error.status) {
      throw error
    }

    throw createHttpError(error.message || 'Speech-to-Text provider request failed.', 502)
  }
}
