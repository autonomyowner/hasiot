// ElevenLabs Conversational AI Configuration
// IMPORTANT: API key must be set via environment variable EXPO_PUBLIC_ELEVENLABS_API_KEY
// Never commit API keys to source code
export const ELEVENLABS_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '',
  agentId: "agent_9701kcffp034epb9apq1astrvjbh",
};

// AI Configuration - Keys loaded from env or config
export const AI_CONFIG = {
  provider: 'groq' as 'groq' | 'openai',
  groqApiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY || '',
  openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
};

// Helper to get signed URL for conversation (if needed for secure connections)
export async function getSignedUrl(): Promise<string> {
  // For client-side usage, we can connect directly with the agent ID
  // If you need server-side signed URLs, implement that endpoint here
  return `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_CONFIG.agentId}`;
}
