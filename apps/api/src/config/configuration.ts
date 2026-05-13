export default () => ({
  env: process.env.NODE_ENV ?? "development",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  database: {
    url: process.env.DATABASE_URL ?? "",
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY ?? "",
    liveModel:
      process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview",
    textModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-flash-latest",
    embeddingModel:
      process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
  },
  audio: {
    sampleRate: Number(process.env.LIVE_AUDIO_SAMPLE_RATE ?? 16000),
    channels: Number(process.env.LIVE_AUDIO_CHANNELS ?? 1),
    language: process.env.LIVE_TRANSCRIPTION_LANGUAGE ?? "es-ES",
  },
  privacy: {
    storeAudio: process.env.STORE_AUDIO === "true",
    storeTranscripts: process.env.STORE_TRANSCRIPTS !== "false",
    retentionDays: Number(process.env.DATA_RETENTION_DAYS ?? 90),
  },
});
