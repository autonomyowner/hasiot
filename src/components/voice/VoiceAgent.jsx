import { useCallback, useEffect, useRef, useState } from 'react'
import VoiceOrb from './VoiceOrb'
import Waveform from './Waveform'
import './voice-agent.css'

/**
 * أبشر — the Hasio voice agent.
 *
 * The ElevenLabs SDK is imported dynamically on first launch, never at module scope.
 * The landing page ships ~75 kB gzip and that is deliberate (see CLAUDE.md); a visitor
 * who never opens the agent must not pay for the voice stack.
 *
 * Auth is the public agent id alone. The API key is server-side only, lives in
 * .env.local for scripts/elevenlabs-agent.mjs, and must never appear in src/.
 */

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

const copy = {
  en: {
    launch: 'Talk to أبشر',
    greeting: 'أبشر · Hasio',
    question: 'How can I help you today?',
    connecting: 'Connecting…',
    listening: 'Listening…',
    speaking: 'Speaking…',
    prompt: 'Ask anything',
    end: 'End',
    close: 'Close',
    micDenied: 'Microphone blocked. Allow it from your browser’s address bar, then try again.',
    failed: 'Could not connect right now. Please try again in a moment.',
    unconfigured: 'The voice agent is not configured yet.',
    hint: 'Arabic or English — interrupt any time.',
  },
  ar: {
    launch: 'كلّم أبشر',
    greeting: 'أبشر · Hasio',
    question: 'كيف أقدر أساعدك اليوم؟',
    connecting: 'جاري الاتصال…',
    listening: 'أسمعك…',
    speaking: 'يتحدث…',
    prompt: 'اسأل عن أي شيء',
    end: 'إنهاء',
    close: 'إغلاق',
    micDenied: 'الميكروفون محظور. اسمح به من شريط العنوان ثم حاول مرة أخرى.',
    failed: 'تعذّر الاتصال الآن. حاول بعد قليل.',
    unconfigured: 'الوكيل الصوتي غير مهيأ بعد.',
    hint: 'بالعربية أو الإنجليزية — تقدر تقاطعه في أي وقت.',
  },
}

export default function VoiceAgent({ lang = 'en' }) {
  const t = copy[lang] ?? copy.en
  const isRtl = lang === 'ar'

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle') // idle | connecting | connected | error
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState(null)

  const convoRef = useRef(null)
  const levelRef = useRef(0)

  /** Polled once per frame by the orb and the meter. */
  const getLevel = useCallback(() => levelRef.current, [])

  // Sample the SDK's analyser outside the draw loop, so the orb keeps animating even
  // if one of these calls throws mid-session.
  useEffect(() => {
    if (status !== 'connected') {
      levelRef.current = 0
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
            levelRef.current = Math.min(1, sum / n / 140)
          } else {
            const v = speaking ? c.getOutputVolume?.() : c.getInputVolume?.()
            levelRef.current = typeof v === 'number' ? Math.min(1, v * 1.6) : 0
          }
        } catch {
          levelRef.current = 0
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
    setStatus('connecting')
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(t.micDenied)
      setStatus('error')
      return
    }
    try {
      const { Conversation } = await import('@elevenlabs/client')
      const convo = await Conversation.startSession({
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
          console.error('[VoiceAgent] session error:', err)
          setError(t.failed)
          setStatus('error')
        },
      })
      convoRef.current = convo
    } catch (err) {
      // Keep the on-screen copy friendly, but never swallow the real reason.
      console.error('[VoiceAgent] startSession failed:', err?.message || err, err)
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
      try {
        await c.endSession()
      } catch {
        /* already gone */
      }
    }
  }, [])

  const close = useCallback(() => {
    stop()
    setOpen(false)
  }, [stop])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  // Leaving the page must not leave a call running.
  useEffect(() => () => { convoRef.current?.endSession?.().catch(() => {}) }, [])

  const live = status === 'connected'
  const pillLabel =
    status === 'connecting' ? t.connecting
    : live && speaking ? t.speaking
    : live ? t.listening
    : t.prompt

  return (
    <>
      <button type="button" className="va-launch" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="va-launch-orb" aria-hidden="true" />
        <span className="va-launch-label">{t.launch}</span>
      </button>

      {open && (
        <div
          className="va-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.greeting}
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div className="va-panel">
            <button type="button" className="va-close" onClick={close} aria-label={t.close}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className={`va-stage ${live ? 'is-live' : ''}`}>
              <VoiceOrb getLevel={getLevel} open />
            </div>

            <p className="va-greeting">{t.greeting}</p>
            <h2 className="va-question">{t.question}</h2>

            {error && <p className="va-error">{error}</p>}

            <button
              type="button"
              className={`va-pill ${live ? 'is-live' : ''}`}
              onClick={live ? stop : start}
              disabled={status === 'connecting'}
              aria-live="polite"
            >
              <span className="va-pill-text">{pillLabel}</span>
              <span className="va-pill-right">
                {live && <span className="va-pill-end">{t.end}</span>}
                <Waveform getLevel={getLevel} active={live} />
              </span>
            </button>

            <p className="va-hint">{t.hint}</p>
          </div>
        </div>
      )}
    </>
  )
}
