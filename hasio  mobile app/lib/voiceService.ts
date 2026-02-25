import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system/next';
import * as Speech from 'expo-speech';
import { ELEVENLABS_CONFIG, AI_CONFIG } from './elevenlabs';
import { HASIO_SYSTEM_PROMPT, getAlahsaFallbackResponse, isArabicText } from './alahsaKnowledge';

type VoiceState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';

interface VoiceServiceCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string, isUser: boolean) => void;
  onError: (error: string) => void;
}

// ElevenLabs voices - using a nice conversational voice
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - friendly female voice

class VoiceService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private callbacks: VoiceServiceCallbacks | null = null;
  private conversationHistory: { role: string; content: string }[] = [];

  async initialize(callbacks: VoiceServiceCallbacks) {
    this.callbacks = callbacks;
    this.conversationHistory = [];

    // Request audio permissions
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      callbacks.onError('Microphone permission denied');
      return false;
    }

    // Configure audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    return true;
  }

  async startListening() {
    this.callbacks?.onStateChange('listening');

    try {
      // Stop any existing recording
      if (this.recording) {
        try {
          const status = await this.recording.getStatusAsync();
          if (status.isRecording) {
            await this.recording.stopAndUnloadAsync();
          }
        } catch (e) {
          // Ignore - recorder might already be unloaded
          console.log('Cleanup of previous recording:', e);
        }
        this.recording = null;
      }

      // Create new recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.recording = null;
      this.callbacks?.onError('Failed to start microphone');
      this.callbacks?.onStateChange('idle');
    }
  }

  async stopListening() {
    if (!this.recording) {
      console.log('No recording to stop');
      return;
    }

    this.callbacks?.onStateChange('processing');

    try {
      console.log('Stopping recording...');

      // Check if recording is still valid before stopping
      const status = await this.recording.getStatusAsync();
      if (!status.isRecording && !status.isDoneRecording) {
        console.log('Recording not in valid state, cleaning up');
        this.recording = null;
        this.callbacks?.onStateChange('idle');
        return;
      }

      // Get URI before stopping (in case stop fails)
      const uri = this.recording.getURI();

      // Only stop if still recording
      if (status.isRecording) {
        await this.recording.stopAndUnloadAsync();
      }

      this.recording = null;

      if (uri) {
        console.log('Recording URI:', uri);
        await this.processAudio(uri);
      } else {
        console.log('No URI from recording');
        this.callbacks?.onStateChange('idle');
      }
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      // Always clean up the recording reference on error
      this.recording = null;

      // Don't show error for "Recorder does not exist" - just clean up
      if (error?.message?.includes('Recorder does not exist')) {
        console.log('Recorder already cleaned up');
        this.callbacks?.onStateChange('idle');
        return;
      }

      this.callbacks?.onError('Recording failed');
      this.callbacks?.onStateChange('idle');
    }
  }

  private async processAudio(uri: string) {
    try {
      console.log('Processing audio from:', uri);

      // Transcribe audio using Whisper API
      const userMessage = await this.transcribeAudio(uri);

      if (!userMessage || userMessage.trim().length === 0) {
        console.log('No speech detected');
        this.callbacks?.onError('No speech detected');
        this.callbacks?.onStateChange('idle');
        return;
      }

      console.log('Transcribed:', userMessage);
      this.callbacks?.onTranscript(userMessage, true);

      // Get AI response
      const aiResponse = await this.getAIResponse(userMessage);
      console.log('AI Response:', aiResponse);

      this.callbacks?.onTranscript(aiResponse, false);

      // Convert to speech using ElevenLabs TTS
      await this.speakText(aiResponse);

    } catch (error) {
      console.error('Error processing audio:', error);
      this.callbacks?.onError('Processing failed');
      this.callbacks?.onStateChange('idle');
    }
  }

  private async transcribeAudio(uri: string): Promise<string> {
    const hasGroqKey = AI_CONFIG.groqApiKey && AI_CONFIG.groqApiKey.length > 10;
    const hasOpenAIKey = AI_CONFIG.openaiApiKey && AI_CONFIG.openaiApiKey.length > 10;

    if (!hasGroqKey && !hasOpenAIKey) {
      console.log('No API key for transcription');
      throw new Error('No API key configured for speech-to-text');
    }

    try {
      // Create form data with file URI (React Native style)
      const formData = new FormData();

      // React Native FormData accepts file objects with uri, type, name
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      } as any);

      let response: Response;

      if (hasGroqKey) {
        // Use Groq Whisper API
        console.log('Transcribing with Groq Whisper...');
        formData.append('model', 'whisper-large-v3');
        response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.groqApiKey}`,
          },
          body: formData,
        });
      } else {
        // Use OpenAI Whisper API
        console.log('Transcribing with OpenAI Whisper...');
        formData.append('model', 'whisper-1');
        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AI_CONFIG.openaiApiKey}`,
          },
          body: formData,
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error:', response.status, errorText);
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  private async getAIResponse(userMessage: string): Promise<string> {
    // Add to conversation history
    this.conversationHistory.push({ role: 'user', content: userMessage });

    // Detect if user is speaking Arabic to respond appropriately
    const userSpeaksArabic = isArabicText(userMessage);

    // Enhanced system prompt with Al-Ahsa knowledge + language instruction
    const systemPrompt = HASIO_SYSTEM_PROMPT + (userSpeaksArabic
      ? '\n\nIMPORTANT: The user is speaking Arabic. Respond in Arabic (العربية).'
      : '\n\nIMPORTANT: The user is speaking English. Respond in English.');

    // Check if we have an API key configured
    const hasGroqKey = AI_CONFIG.groqApiKey && AI_CONFIG.groqApiKey.length > 10;
    const hasOpenAIKey = AI_CONFIG.openaiApiKey && AI_CONFIG.openaiApiKey.length > 10;

    if (!hasGroqKey && !hasOpenAIKey) {
      // Fallback to smart static responses if no API key
      return this.getFallbackResponse(userMessage);
    }

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory.slice(-10) // Keep last 10 messages for context
      ];

      let response: Response;

      if (hasGroqKey) {
        // Use Groq API (faster, free tier available)
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_CONFIG.groqApiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            max_tokens: 150,
            temperature: 0.7,
          }),
        });
      } else {
        // Use OpenAI API
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_CONFIG.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            max_tokens: 150,
            temperature: 0.7,
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        return this.getFallbackResponse(userMessage);
      }

      const data = await response.json();
      const aiMessage = data.choices[0]?.message?.content || this.getFallbackResponse(userMessage);

      // Add to conversation history
      this.conversationHistory.push({ role: 'assistant', content: aiMessage });

      return aiMessage;
    } catch (error) {
      console.error('Error calling AI API:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  private getFallbackResponse(userMessage: string): string {
    // Use the comprehensive Al-Ahsa specific fallback responses
    return getAlahsaFallbackResponse(userMessage);
  }

  private async speakText(text: string) {
    this.callbacks?.onStateChange('speaking');

    // Check if ElevenLabs API key is configured
    const hasElevenLabsKey = ELEVENLABS_CONFIG.apiKey && ELEVENLABS_CONFIG.apiKey.length > 10;

    if (!hasElevenLabsKey) {
      console.log('No ElevenLabs API key, using device TTS');
      await this.speakWithDeviceTTS(text);
      return;
    }

    try {
      console.log('Generating speech for:', text.substring(0, 50) + '...');

      // Call ElevenLabs TTS API
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_CONFIG.apiKey,
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.5,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, errorText);
        throw new Error(`TTS failed: ${response.status}`);
      }

      console.log('Got audio response from ElevenLabs');

      // Get the audio as blob and convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Convert to base64 using a React Native compatible method
      const base64Audio = this.uint8ArrayToBase64(bytes);

      // Use temp file with timestamp to avoid conflicts
      const audioPath = Paths.cache.uri + `tts_${Date.now()}.mp3`;
      const audioFile = new File(audioPath);
      await audioFile.write(base64Audio, { encoding: 'base64' });

      console.log('Playing audio...');

      // Unload previous sound
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioPath },
        { shouldPlay: true, volume: 1.0 }
      );

      this.sound = sound;
      console.log('Playing audio...');

      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('Finished playing');
          this.callbacks?.onStateChange('idle');
          // Clean up temp file
          try {
            await audioFile.delete();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      });

    } catch (error) {
      console.error('Error in ElevenLabs TTS, falling back to device speech:', error);
      // Fallback to device TTS
      await this.speakWithDeviceTTS(text);
    }
  }

  // Helper method to convert Uint8Array to base64 (React Native compatible)
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    const CHUNK_SIZE = 0x8000; // 32KB chunks to avoid call stack issues
    const chunks: string[] = [];

    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }

    const binary = chunks.join('');

    // Use a simple base64 encoding that works in React Native
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;

    while (i < binary.length) {
      const a = binary.charCodeAt(i++);
      const b = i < binary.length ? binary.charCodeAt(i++) : 0;
      const c = i < binary.length ? binary.charCodeAt(i++) : 0;

      const triplet = (a << 16) | (b << 8) | c;

      result += base64Chars[(triplet >> 18) & 0x3F];
      result += base64Chars[(triplet >> 12) & 0x3F];
      result += i > binary.length + 1 ? '=' : base64Chars[(triplet >> 6) & 0x3F];
      result += i > binary.length ? '=' : base64Chars[triplet & 0x3F];
    }

    return result;
  }

  private async speakWithDeviceTTS(text: string) {
    try {
      console.log('Using device TTS fallback...');

      // Detect if text is Arabic and use appropriate language
      const isArabic = isArabicText(text);
      const language = isArabic ? 'ar-SA' : 'en-US';

      await Speech.speak(text, {
        language: language,
        pitch: 1.0,
        rate: isArabic ? 0.85 : 0.9, // Slightly slower for Arabic
        onDone: () => {
          console.log('Device TTS finished');
          this.callbacks?.onStateChange('idle');
        },
        onError: (error) => {
          console.error('Device TTS error:', error);
          this.callbacks?.onError('Speech failed');
          this.callbacks?.onStateChange('idle');
        },
      });
    } catch (error) {
      console.error('Device TTS error:', error);
      this.callbacks?.onError('Speech failed');
      this.callbacks?.onStateChange('idle');
    }
  }

  async disconnect() {
    // Stop device TTS if running
    Speech.stop();

    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      } catch (error) {
        console.error('Error stopping sound:', error);
      }
    }

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }

    this.conversationHistory = [];
    this.callbacks?.onStateChange('idle');
  }

  // For demo: allow text input as well
  async sendTextMessage(text: string) {
    this.callbacks?.onStateChange('processing');
    this.callbacks?.onTranscript(text, true);

    try {
      const response = await this.getAIResponse(text);
      this.callbacks?.onTranscript(response, false);
      await this.speakText(response);
    } catch (error) {
      console.error('Error sending text message:', error);
      this.callbacks?.onError('Failed to process message');
      this.callbacks?.onStateChange('idle');
    }
  }

  // Get AI response for text chat without voice output
  async getTextChatResponse(userMessage: string): Promise<string> {
    try {
      return await this.getAIResponse(userMessage);
    } catch (error) {
      console.error('Error getting text chat response:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  // Initialize without callbacks for text-only mode
  initializeTextMode() {
    this.conversationHistory = [];
  }
}

export const voiceService = new VoiceService();
export type { VoiceState, VoiceServiceCallbacks };
