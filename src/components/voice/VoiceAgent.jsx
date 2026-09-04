import { useCallback, useEffect, useRef, useState } from 'react'
import VoiceOrb from './VoiceOrb'
import './voice-agent.css'

/**
 * أبشر — the Hasio voice agent.
 *
 * The ElevenLabs SDK is imported dynamically on first launch, never at module scope.
 * The landing page ships ~75 kB gzip and that is deliberate (see CLAUDE.md); an
 * anonymous visitor who never clicks the orb must not pay for the voice stack.
 *
 * Auth is the public agent id alone. The API key is server-side only and lives in
 * .env.local for scripts/elevenlabs-agent.mjs — it must never appear in src/.
 */

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

const copy = {
  en: {
    launch: 'Talk to أبشر',
    launchShort: 'Talk to us',
    title: 'أبشر',
    subtitle: 'Hasio’s voice — ask about Al-Ahsa, the app, or the business.',
    connecting: 'Connecting…',
    listening: 'Listening',
    speaking: 'Speaking',
    idle: 'Tap to start',
    start: 'Start talking',
    stop: 'End call',
    close: 'Close',
    micDenied:
      'Microphone access was blocked. Allow it in your browser’s address bar, then try again.',
    failed: 'Could not connect right now. Please try again in a moment.',
    unconfigured: 'The voice agent is not configured yet.',
    hint: 'Speak naturally in Arabic or English — you can interrupt any time.',
  },
  ar: {
    launch: 'كلّم أبشر',
    launchShort: 'كلّمنا',
    title: 'أبشر',
    subtitle: 'صوت Hasio — اسأل عن الأحساء أو التطبيق أو المشروع.',
    connecting: 'جاري الاتصال…',
    listening: 'يستمع',
    speaking: 'يتحدث',
    idle: 'اضغط للبدء',
    start: 'ابدأ المحادثة',
    stop: 'إنهاء',
    close: 'إغلاق',
    micDenied: 'تم حظر الميكروفون. اسمح به من شريط العنوان في المتصفح ثم حاول مرة أخرى.',
    failed: 'تعذّر الاتصال الآن. حاول بعد قليل.',
    unconfigured: 'الوكيل الصوتي غير مهيأ بعد.',
    hint: 'تكلّم بالعربية أو الإنجليزية — تقدر تقاطعه في أي وقت.',
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

  /** Polled by the orb once per frame. Output while the agent talks, input while it listens. */
  const getLevel = useCallback(() => levelRef.current, [])

  // Sample the SDK's analyser on a timer rather than inside the render loop, so the
  // orb keeps drawing smoothly even if a call throws mid-session.
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
        connectionType: 'webrtc',
        onConnect: () => setStatus('connected'),
        onDisconnect: () => {
          setStatus('idle')
          setSpeaking(false)
          convoRef.current = null
        },
        onModeChange: ({ mode }) => setSpeaking(mode === 'speaking'),
        onError: (err) => {
          console.warn('[VoiceAgent]', err)
          setError(t.failed)
          setStatus('error')
        },
      })
      convoRef.current = convo
    } catch (err) {
      console.warn('[VoiceAgent] start failed', err)
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

  // Escape closes; leaving the page must not leave a call running.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => () => { convoRef.current?.endSession?.().catch(() => {}) }, [])

  const live = status === 'connected'
  const stateLabel =
    status === 'connecting' ? t.connecting
    : live && speaking ? t.speaking
    : live ? t.listening
    : t.idle

  return (
    <>
      <button
        type="button"
        className="va-launch"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="va-launch-orb" aria-hidden="true" />
        <span className="va-launch-label">{t.launch}</span>
      </button>

      {open && (
        <div
          className="va-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
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
              <div className="va-stage-glow" aria-hidden="true" />
            </div>

            <h2 className="va-title">{t.title}</h2>
            <p className="va-subtitle">{t.subtitle}</p>

            <p className={`va-state ${live ? 'is-live' : ''}`} aria-live="polite">
              <span className="va-dot" aria-hidden="true" />
              {stateLabel}
            </p>

            {error && <p className="va-error">{error}</p>}

            {!live ? (
              <button
                type="button"
                className="va-action"
                onClick={start}
                disabled={status === 'connecting'}
              >
                {status === 'connecting' ? t.connecting : t.start}
              </button>
            ) : (
              <button type="button" className="va-action is-stop" onClick={stop}>
                {t.stop}
              </button>
            )}

            <p className="va-hint">{t.hint}</p>
          </div>
        </div>
      )}
    </>
  )
}
