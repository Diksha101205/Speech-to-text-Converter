import mongoose from 'mongoose'

export const isDatabaseConnected = () => mongoose.connection.readyState === 1

export const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI

  if (!uri) {
    console.warn('MONGODB_URI is not set. Uploads will not be saved to MongoDB.')
    return false
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    })
    console.log('MongoDB connected')
    return true
  } catch (error) {
    console.error('MongoDB connection failed:', error.message)
    return false
  }
}
