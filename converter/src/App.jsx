import { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

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

function App() {
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

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/transcriptions`)

        if (!response.ok) return

        const data = await response.json()
        const savedItems = (data.transcriptions || [])
          .filter((item) => item.transcript)
          .map((item) => ({
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
      } catch {
        setNotice('Backend history is unavailable right now.')
      } finally {
        setIsHistoryLoading(false)
      }
    }

    loadHistory()
  }, [])

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

    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file.')
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

    try {
      const response = await fetch(`${API_BASE_URL}/api/transcriptions`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Transcription failed.')
      }

      const item = {
        id: data.transcription?._id || createLocalId(),
        text: data.transcript || data.transcription?.transcript || '',
        fileName: data.file?.originalName || activeFile.name,
        source,
        saved: data.saved,
        provider: data.provider,
        model: data.model,
        createdAt: data.transcription?.createdAt || new Date().toISOString(),
      }

      setTranscriptions((items) => [item, ...items])
      setNotice(data.saved ? 'Transcription saved to MongoDB.' : 'Transcription complete.')
      clearSelection()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyTranscript = async (text) => {
    await navigator.clipboard.writeText(text)
    setNotice('Copied.')
  }

  const removeTranscript = (id) => {
    setTranscriptions((items) => items.filter((item) => item.id !== id))
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700">
              <AudioLines aria-hidden="true" size={18} />
              <span>Speech-to-Text Converter</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
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
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
          <div className="flex flex-col gap-5">
            <section className="border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-950">Audio Source</h2>
                <FileAudio aria-hidden="true" className="text-teal-700" size={22} />
              </div>

              <label
                htmlFor="audio-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-teal-400 hover:bg-teal-50"
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

            <section className="border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-950">Recorder</h2>
                <Mic aria-hidden="true" className="text-amber-700" size={22} />
              </div>

              <div className="mb-5 flex h-20 items-center justify-center gap-1 border border-slate-200 bg-slate-950 px-4">
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isRecording || isSubmitting}
                  onClick={startRecording}
                  type="button"
                >
                  <Mic aria-hidden="true" size={18} />
                  Record
                </button>
                <button
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 transition hover:border-amber-500 hover:text-amber-800 disabled:cursor-not-allowed disabled:text-slate-400"
                  disabled={!isRecording}
                  onClick={stopRecording}
                  type="button"
                >
                  <Square aria-hidden="true" size={18} />
                  Stop
                </button>
              </div>
            </section>

            <section className="border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-950">Selected Audio</h2>
                {activeFile ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-600">
                    {source}
                  </span>
                ) : null}
              </div>

              {activeFile ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 border border-slate-200 bg-slate-50 p-3">
                    <FileAudio aria-hidden="true" className="mt-1 shrink-0 text-teal-700" size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-slate-900">{activeFile.name}</p>
                      <p className="text-sm text-slate-500">{formatBytes(activeFile.size)}</p>
                    </div>
                  </div>

                  {recordingUrl ? <audio className="w-full" controls src={recordingUrl} /> : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
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
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 transition hover:border-red-300 hover:text-red-700"
                      onClick={clearSelection}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={18} />
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <p className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No audio selected.
                </p>
              )}

              {notice ? (
                <p className="mt-4 flex items-start gap-2 border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
                  <span>{notice}</span>
                </p>
              ) : null}

              {error ? (
                <p className="mt-4 flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
                  <span>{error}</span>
                </p>
              ) : null}
            </section>
          </div>

          <section className="border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Transcriptions</h2>
                <p className="text-sm text-slate-500">
                  {isHistoryLoading ? 'Loading saved items...' : `${transcriptions.length} item${transcriptions.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <AudioLines aria-hidden="true" className="text-teal-700" size={24} />
            </div>

            {transcriptions.length > 0 ? (
              <div className="space-y-3">
                {transcriptions.map((item) => (
                  <article className="border border-slate-200 bg-slate-50 p-4" key={item.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-900">{item.fileName}</p>
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
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
                        onClick={() => copyTranscript(item.text)}
                        title="Copy transcription"
                        type="button"
                      >
                        <Copy aria-hidden="true" size={17} />
                      </button>
                      <button
                        aria-label="Remove transcription"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-red-300 hover:text-red-700"
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
              <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
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
