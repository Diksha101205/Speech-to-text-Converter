import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  Copy,
  Database,
  FileAudio,
  LoaderCircle,
  Mic,
  RefreshCcw,
  Square,
  Trash2,
  UploadCloud,
  UserRound,
} from 'lucide-react'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
const AUDIO_EXTENSIONS = ['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg', '.aac', '.flac']
const SESSION_STORAGE_KEY = 'speech-to-text-session-id'

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB'

  const units = ['B', 'KB', 'MB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const formatDate = (value) => {
  if (!value) return 'Just now'

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const createLocalId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const getStoredSessionId = () => {
  const existingSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY)

  if (existingSessionId) return existingSessionId

  const sessionId = createLocalId()
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)

  return sessionId
}

const isAudioFile = (file) => {
  if (file.type?.startsWith('audio/')) return true

  return AUDIO_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))
}

const getApiErrorMessage = (response, data) => {
  if (data?.message) return data.message

  if (response.status === 400) return 'Please check the audio file and try again.'
  if (response.status === 413) return 'Audio must be 25 MB or smaller.'
  if (response.status >= 500) return 'The transcription service is unavailable right now. Please try again.'

  return 'Transcription failed. Please try again.'
}

function App() {
  const [sessionId, setSessionId] = useState(getStoredSessionId)
  const [selectedFile, setSelectedFile] = useState(null)
  const [recordedFile, setRecordedFile] = useState(null)
  const [recordingUrl, setRecordingUrl] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [transcriptions, setTranscriptions] = useState([])

  const chunksRef = useRef([])
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)

  const activeFile = recordedFile || selectedFile
  const source = recordedFile ? 'recording' : 'upload'

  const loadHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsHistoryLoading(true)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/transcriptions`, {
        headers: {
          'X-Session-Id': sessionId,
        },
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data))
      }

      const savedItems = (data.transcriptions || []).map((item) => ({
        id: item._id,
        text: item.transcript,
        fileName: item.originalName,
        source: item.source,
        saved: true,
        provider: item.provider,
        model: item.model,
        createdAt: item.createdAt,
      }))

      setTranscriptions(savedItems)

      if (!silent) {
        setNotice(data.saved ? 'Saved history refreshed.' : 'MongoDB history is unavailable right now.')
      }
    } catch {
      if (!silent) {
        setError('Saved history could not be loaded. Check that the backend is running.')
      }
    } finally {
      setIsHistoryLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    const historyTimer = window.setTimeout(() => {
      loadHistory({ silent: true })
    }, 0)

    return () => window.clearTimeout(historyTimer)
  }, [loadHistory])

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl)
      }

      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [recordingUrl])

  const resetMessages = () => {
    setNotice('')
    setError('')
  }

  const replaceRecordingUrl = (url) => {
    setRecordingUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }

      return url
    })
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setRecordedFile(null)
    replaceRecordingUrl('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (event) => {
    resetMessages()
    const file = event.target.files?.[0]

    if (!file) return

    if (!isAudioFile(file)) {
      setError('Please choose a valid audio file: MP3, MP4, M4A, WAV, WEBM, OGG, AAC, or FLAC.')
      clearSelection()
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Audio must be 25 MB or smaller.')
      clearSelection()
      return
    }

    setRecordedFile(null)
    replaceRecordingUrl('')
    setSelectedFile(file)
  }

  const startRecording = async () => {
    resetMessages()

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not available in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const options = MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : {}
      const recorder = new MediaRecorder(stream, options)

      chunksRef.current = []
      streamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })

        if (blob.size === 0) {
          stream.getTracks().forEach((track) => track.stop())
          streamRef.current = null
          setError('No audio was captured. Please record again.')
          return
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const file = new File([blob], `recording-${timestamp}.webm`, {
          type: blob.type || 'audio/webm',
        })

        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setSelectedFile(null)
        setRecordedFile(file)
        replaceRecordingUrl(URL.createObjectURL(blob))
        setNotice('Recording ready.')
      }

      recorder.start()
      setIsRecording(true)
    } catch {
      setError('Microphone permission was not granted.')
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }

    mediaRecorderRef.current = null
    setIsRecording(false)
  }

  const submitAudio = async () => {
    if (!activeFile) {
      setError('Choose or record audio first.')
      return
    }

    resetMessages()
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('audio', activeFile)
    formData.append('source', source)
    formData.append('sessionId', sessionId)

    try {
      const response = await fetch(`${API_BASE_URL}/api/transcriptions`, {
        method: 'POST',
        headers: {
          'X-Session-Id': sessionId,
        },
        body: formData,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, data))
      }

      const item = {
        id: data.transcription?._id || createLocalId(),
        text: data.transcript || data.transcription?.transcript || '',
        fileName: data.file?.originalName || activeFile.name,
        source,
        saved: data.saved,
        provider: data.provider,
        model: data.model,
        sessionId: data.sessionId || sessionId,
        createdAt: data.transcription?.createdAt || new Date().toISOString(),
      }

      setTranscriptions((items) => [item, ...items])
      setNotice(data.saved ? 'Transcription saved to MongoDB.' : 'Transcription complete.')
      clearSelection()
    } catch (submitError) {
      setError(
        submitError instanceof TypeError
          ? 'Cannot reach the backend. Make sure the server is running and try again.'
          : submitError.message,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyTranscript = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Copied.')
    } catch {
      setError('Could not copy the transcription. Please copy it manually.')
    }
  }

  const removeTranscript = (id) => {
    setTranscriptions((items) => items.filter((item) => item.id !== id))
  }

  const startNewSession = () => {
    const nextSessionId = createLocalId()
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextSessionId)
    setSessionId(nextSessionId)
    setTranscriptions([])
    setNotice('New session started.')
    setError('')
  }

  return (
    <main className="min-h-screen bg-paper text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-mint">
              <AudioLines aria-hidden="true" size={18} />
              <span>Speech-to-Text Converter</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight text-ink sm:text-4xl">
              Convert speech into clean transcripts
            </h1>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-teal-800">
              <CheckCircle2 aria-hidden="true" size={16} />
              React + Express
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sky-800">
              <AudioLines aria-hidden="true" size={16} />
              Local Whisper
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              <Database aria-hidden="true" size={16} />
              MongoDB
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-violet-800">
              <UserRound aria-hidden="true" size={16} />
              Session
            </span>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
          <div className="flex flex-col gap-5">
            <section className="app-panel">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title">User Session</h2>
                <UserRound aria-hidden="true" className="text-violet-700" size={22} />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Current browser session</p>
                  <p className="break-all text-sm text-slate-500">{sessionId}</p>
                </div>
                <button className="secondary-button shrink-0" onClick={startNewSession} type="button">
                  <RefreshCcw aria-hidden="true" size={18} />
                  New Session
                </button>
              </div>
            </section>

            <section className="app-panel">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="section-title">Audio Source</h2>
                <FileAudio aria-hidden="true" className="text-teal-700" size={22} />
              </div>

              <label
                htmlFor="audio-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition duration-200 hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-50 hover:shadow-sm"
              >
                <UploadCloud aria-hidden="true" className="text-teal-700" size={34} />
                <span className="text-base font-semibold text-slate-900">Choose audio</span>
                <span className="text-sm text-slate-500">MP3, MP4, M4A, WAV, WEBM up to 25 MB</span>
              </label>
              <input
                ref={fileInputRef}
                id="audio-upload"
                className="sr-only"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
              />
            </section>

            <section className="app-panel">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="section-title">Recorder</h2>
                <Mic aria-hidden="true" className="text-amber-700" size={22} />
              </div>

              <div className="mb-5 flex h-20 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-950 px-4 shadow-inner">
                {Array.from({ length: 28 }).map((_, index) => (
                  <span
                    className={`wave-bar ${isRecording ? 'is-live' : ''}`}
                    key={index}
                    style={{ '--delay': `${(index % 7) * 0.08}s` }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="primary-button"
                  disabled={isRecording || isSubmitting}
                  onClick={startRecording}
                  type="button"
                >
                  <Mic aria-hidden="true" size={18} />
                  Record
                </button>
                <button
                  className="secondary-button hover:border-amber-500 hover:text-amber-800"
                  disabled={!isRecording}
                  onClick={stopRecording}
                  type="button"
                >
                  <Square aria-hidden="true" size={18} />
                  Stop
                </button>
              </div>
            </section>

            <section className="app-panel">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title">Selected Audio</h2>
                {activeFile ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-600">
                    {source}
                  </span>
                ) : null}
              </div>

              {activeFile ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <FileAudio aria-hidden="true" className="mt-1 shrink-0 text-teal-700" size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-slate-900">{activeFile.name}</p>
                      <p className="text-sm text-slate-500">{formatBytes(activeFile.size)}</p>
                    </div>
                  </div>

                  {recordingUrl ? <audio className="w-full" controls src={recordingUrl} /> : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="dark-button"
                      disabled={isSubmitting}
                      onClick={submitAudio}
                      type="button"
                    >
                      {isSubmitting ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
                      ) : (
                        <RefreshCcw aria-hidden="true" size={18} />
                      )}
                      {isSubmitting ? 'Transcribing...' : 'Transcribe'}
                    </button>
                    <button
                      className="secondary-button hover:border-red-300 hover:text-red-700"
                      onClick={clearSelection}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={18} />
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No audio selected.
                </p>
              )}

              {notice ? (
                <p className="mt-4 flex animate-card-in items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
                  <span>{notice}</span>
                </p>
              ) : null}

              {error ? (
                <p className="mt-4 flex animate-card-in items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
                  <span>{error}</span>
                </p>
              ) : null}
            </section>
          </div>

          <section className="app-panel">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">Transcriptions</h2>
                <p className="text-sm text-slate-500">
                  {isHistoryLoading ? 'Loading saved items...' : `${transcriptions.length} item${transcriptions.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                aria-label="Refresh saved transcriptions"
                className="icon-button"
                disabled={isHistoryLoading}
                onClick={() => loadHistory()}
                title="Refresh saved transcriptions"
                type="button"
              >
                {isHistoryLoading ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
                ) : (
                  <RefreshCcw aria-hidden="true" size={18} />
                )}
              </button>
            </div>

            {transcriptions.length > 0 ? (
              <div className="space-y-3">
                {transcriptions.map((item) => (
                  <article className="transcript-card" key={item.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold leading-6 text-slate-900">{item.fileName}</p>
                        <p className="text-sm text-slate-500">
                          {formatDate(item.createdAt)} | {item.model || 'transcription model'}
                        </p>
                      </div>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                        {item.saved ? 'Saved' : item.source}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                      {item.text}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        aria-label="Copy transcription"
                        className="icon-button"
                        onClick={() => copyTranscript(item.text)}
                        title="Copy transcription"
                        type="button"
                      >
                        <Copy aria-hidden="true" size={17} />
                      </button>
                      <button
                        aria-label="Remove transcription"
                        className="icon-button hover:border-red-300 hover:text-red-700"
                        onClick={() => removeTranscript(item.id)}
                        title="Remove transcription"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <AudioLines aria-hidden="true" className="mb-3 text-slate-400" size={36} />
                <p className="font-semibold text-slate-800">No transcriptions yet.</p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}

export default App
