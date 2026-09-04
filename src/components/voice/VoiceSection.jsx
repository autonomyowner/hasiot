import { useCallback, useEffect, useRef, useState } from 'react'
import VoiceBlob from './VoiceBlob'
import './voice-agent.css'

/**
 * The "talk to أبشر" section.
 *
 * The ElevenLabs SDK is imported dynamically on first press, never at module scope,
 * so a visitor who scrolls past this section without speaking to it never downloads
 * the voice stack. Auth is the public agent id alone; the API key is server-side
 * only and must never appear in src/.
 */

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

const copy = {
  en: {
    eyebrow: 'ASK ABSHER',
    titleA: 'Talk to',
    titleB: 'أبشر',
    body:
      'Our voice agent knows Al-Ahsa, the app, and where Hasio is going. Ask it anything, ' +
      'in Arabic or English — it answers the way a person would, and you can interrupt.',
    start: 'Start talking',
    permission: 'Allow the microphone…',
    connecting: 'Connecting…',
    listening: 'Listening — go ahead',
    speaking: 'Absher is speaking',
    stop: 'End conversation',
    micDenied: 'Microphone blocked. Allow it from your browser’s address bar, then try again.',
    failed: 'Could not connect right now. Please try again in a moment.',
    unconfigured: 'The voice agent is not configured yet.',
    note: 'Speaks Arabic and English. Nothing is saved to your device.',
  },
  ar: {
    eyebrow: 'اسأل أبشر',
    titleA: 'كلّم',
    titleB: 'أبشر',
    body:
      'وكيلنا الصوتي يعرف الأحساء والتطبيق وإلى أين تتجه Hasio. اسأله عن أي شيء، بالعربية ' +
      'أو الإنجليزية — يرد عليك مثل أي شخص، وتقدر تقاطعه في أي وقت.',
    start: 'ابدأ المحادثة',
    permission: 'اسمح باستخدام الميكروفون…',
    connecting: 'جاري الاتصال…',
    listening: 'أسمعك — تفضل',
    speaking: 'أبشر يتحدث',
    stop: 'إنهاء المحادثة',
    micDenied: 'الميكروفون محظور. اسمح به من شريط العنوان ثم حاول مرة أخرى.',
    failed: 'تعذّر الاتصال الآن. حاول بعد قليل.',
    unconfigured: 'الوكيل الصوتي غير مهيأ بعد.',
    note: 'يتحدث العربية والإنجليزية. لا يُحفظ شيء على جهازك.',
  },
}

export default function VoiceSection({ lang = 'en' }) {
  const t = copy[lang] ?? copy.en

  const [status, setStatus] = useState('idle') // idle | permission | connecting | connected | error
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState(null)

  const convoRef = useRef(null)
  const freqRef = useRef(0)

  /** Polled once per frame by the blob. Never state — see VoiceBlob's header. */
  const getFrequency = useCallback(() => freqRef.current, [])

  // Sample the SDK's analyser outside the draw loop, so the blob keeps animating
  // even if one of these calls throws mid-session.
  useEffect(() => {
    if (status !== 'connected') {
      freqRef.current = 0
      return
    }
    let raf = 0
    const tick = () => {
      const c = convoRef.current
      if (c) {
        try {
          const data = speaking ? c.getOutputByteFrequencyData?.() : c.getInputByteFrequencyData?.()
          if (data && data.length) {
            // Low bins carry the voice; the top of the spectrum is mostly hiss.
            const n = Math.min(data.length, 48)
            let sum = 0
            for (let i = 0; i < n; i++) sum += data[i]
            freqRef.current = Math.min(1, sum / n / 130)
          } else {
            const v = speaking ? c.getOutputVolume?.() : c.getInputVolume?.()
            freqRef.current = typeof v === 'number' ? Math.min(1, v * 1.6) : 0
          }
        } catch {
          freqRef.current = 0
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, speaking])

  const start = useCallback(async () => {
    if (!AGENT_ID) {
      setError(t.unconfigured)
      setStatus('error')
      return
    }
    setError(null)
    // Two distinct waits, and the visitor needs to know which one they are in: the
    // permission prompt can sit open indefinitely, and a bare "Connecting…" gives no
    // hint that the browser is waiting on them.
    setStatus('permission')
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setStatus('connecting')
    } catch {
      setError(t.micDenied)
      setStatus('error')
      return
    }
    try {
      const { Conversation } = await import('@elevenlabs/client')
      convoRef.current = await Conversation.startSession({
        agentId: AGENT_ID,
        // websocket, not webrtc: the webrtc path wants a conversation token this
        // public agent never issues, and fails before onError can say why.
        // `textOnly: false` is required — without it startSession's return type is
        // ambiguous and it can hand back a TextConversation with no audio at all.
        connectionType: 'websocket',
        textOnly: false,
        onConnect: () => setStatus('connected'),
        onDisconnect: () => {
          setStatus('idle')
          setSpeaking(false)
          convoRef.current = null
        },
        onModeChange: ({ mode }) => setSpeaking(mode === 'speaking'),
        onError: (err) => {
          console.error('[VoiceSection] session error:', err)
          setError(t.failed)
          setStatus('error')
        },
      })
    } catch (err) {
      // Keep the on-screen copy friendly, but never swallow the real reason.
      console.error('[VoiceSection] startSession failed:', err?.message || err, err)
      setError(t.failed)
      setStatus('error')
    }
  }, [t])

  const stop = useCallback(async () => {
    const c = convoRef.current
    convoRef.current = null
    setSpeaking(false)
    setStatus('idle')
    if (c) {
      try { await c.endSession() } catch { /* already gone */ }
    }
  }, [])

  // Leaving the page must not leave a call running.
  useEffect(() => () => { convoRef.current?.endSession?.().catch(() => {}) }, [])

  const live = status === 'connected'
  const busy = status === 'permission' || status === 'connecting'

  const state =
    status === 'permission' ? t.permission
    : status === 'connecting' ? t.connecting
    : live && speaking ? t.speaking
    : live ? t.listening
    : null

  return (
    <section className="voice-section" id="voice">
      <div className="voice-inner">
        <p className="voice-eyebrow">{t.eyebrow}</p>
        <h2 className="voice-title">
          {t.titleA} <span className="voice-name">{t.titleB}</span>
        </h2>
        <p className="voice-body">{t.body}</p>

        <div className={`voice-stage ${live ? 'is-live' : ''}`}>
          <VoiceBlob getFrequency={getFrequency} />
        </div>

        <div className="voice-controls">
          <button
            type="button"
            className={`voice-cta ${live ? 'is-live' : ''}`}
            onClick={live ? stop : start}
            disabled={busy}
          >
            {live ? t.stop : busy ? (status === 'permission' ? t.permission : t.connecting) : t.start}
          </button>

          {/* Reserves its line whether or not it has text, so nothing below shifts. */}
          <p className="voice-state" aria-live="polite">{state ?? ' '}</p>

          {error
            ? <p className="voice-error" role="alert">{error}</p>
            : <p className="voice-note">{t.note}</p>}
        </div>
      </div>
    </section>
  )
}
