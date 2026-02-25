// Auth exports (stubs - ready for Clerk migration)
export * from "./auth";

// ElevenLabs exports
export { ELEVENLABS_CONFIG, getSignedUrl } from "./elevenlabs";

// Voice service
export { voiceService } from "./voiceService";
export type { VoiceState, VoiceServiceCallbacks } from "./voiceService";

// R2 Upload utilities
export {
  uploadToR2,
  uploadMultipleToR2,
  deleteFromR2,
  getR2PublicUrl,
  isR2Url,
} from "./r2Upload";
export type { UploadResult } from "./r2Upload";
