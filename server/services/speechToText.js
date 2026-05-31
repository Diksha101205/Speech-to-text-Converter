import { spawn } from 'node:child_process'
import path from 'node:path'

const createHttpError = (message, status = 500) => {
  const error = new Error(message)
  error.status = status
  return error
}

const parseJsonOutput = (output) => {
  const trimmedOutput = output.trim()

  if (!trimmedOutput) {
    throw createHttpError('Whisper did not return any transcription output.', 502)
  }

  const lines = trimmedOutput.split(/\r?\n/)
  const jsonLine = [...lines].reverse().find((line) => line.trim().startsWith('{'))

  if (!jsonLine) {
    throw createHttpError(trimmedOutput, 502)
  }

  return JSON.parse(jsonLine)
}

const runLocalWhisper = (filePath) => {
  const pythonCommand = process.env.WHISPER_PYTHON_PATH || process.env.PYTHON_PATH || 'python'
  const scriptPath = path.resolve('server/scripts/transcribe_whisper.py')
  const args = [
    scriptPath,
    '--audio',
    path.resolve(filePath),
    '--model',
    process.env.WHISPER_MODEL || 'base',
    '--task',
    process.env.WHISPER_TASK || 'transcribe',
  ]

  if (process.env.WHISPER_LANGUAGE) {
    args.push('--language', process.env.WHISPER_LANGUAGE)
  }

  if (process.env.WHISPER_PROMPT) {
    args.push('--prompt', process.env.WHISPER_PROMPT)
  }

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, args, {
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', () => {
      reject(
        createHttpError(
          'Local Whisper could not start Python. Check WHISPER_PYTHON_PATH or install Python.',
          503,
        ),
      )
    })

    child.on('close', (code) => {
      if (code !== 0) {
        const details = stderr.trim() || stdout.trim()
        reject(createHttpError(details || 'Local Whisper transcription failed.', 502))
        return
      }

      try {
        resolve(parseJsonOutput(stdout))
      } catch (error) {
        reject(error)
      }
    })
  })
}

export const transcribeAudio = async (filePath) => {
  const result = await runLocalWhisper(filePath)

  return {
    provider: 'local-whisper',
    model: result.model,
    text: result.text || '',
    language: result.language || '',
  }
}
