import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
})

export const transcribeAudio = async (audioBlob, fileName = 'recording.webm') => {
  const formData = new FormData()
  formData.append('audio', audioBlob, fileName)

  try {
    const { data } = await API.post('/api/transcriptions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return {
      success: true,
      text: data.transcript,
      id: data.transcription?._id,
      ...data,
    }
  } catch (err) {
    const msg =
      err.response?.data?.error ||
      err.response?.data?.message ||
      'Transcription failed. Please check the local Whisper setup and try again.'

    return { success: false, error: msg }
  }
}

export const fetchTranscriptions = async (page = 1) => {
  try {
    const { data } = await API.get(`/api/transcriptions?page=${page}`)
    return { success: true, ...data }
  } catch {
    return { success: false, transcriptions: [] }
  }
}
