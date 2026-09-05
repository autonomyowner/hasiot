import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './voice-agent.css'

/**
 * أبشر — the voice agent section.
 *
 * The ElevenLabs SDK is imported dynamically on first press, never at module scope,
 * so a visitor who scrolls past this section without speaking to it never downloads
 * the voice stack. Auth is the public agent id alone; the API key is server-side
 * only and must never appear in src/.
 *
 * The visual is a lit studio panel: a green ribbon sweeping behind a floating
 * "ask anything" bubble, three suggestion chips, and two waveforms. It replaced a
 * WebGL blob (473 lines of shader) that needed a black band to glow in and so cut
 * a hole in the middle of an otherwise paper-coloured page.
 *
 * The waveforms are **live**, not decoration: idle they breathe on a synthetic
 * wave, and in session every bar is driven by the SDK's own analyser — your voice
 * going out, Absher's coming back. See the rAF loop below for why none of that
 * touches React state.
 */

const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID

// One waveform, centred, with many thin bars rather than few fat ones: at 3px
// wide on a 5px pitch, 64 of them fill ~500px and read as a trace. Anything
// wider than about 4px stops being a waveform and becomes a row of pills.
const BARS = 64

const copy = {
  en: {
    eyebrow: 'YOUR AI TRAVEL ASSISTANT',
    titleA: 'Talk to',
    titleB: 'أبشر',
    tagline: 'Plan. Explore. Book. Just ask.',
    ask: 'Ask anything…',
    chips: ['Find me a hotel', 'Explore Al Ahsa', 'Plan three days'],
    body:
      'Our voice agent knows the app, the places we cover, and where Hasio is going. Ask it ' +
      'anything, in Arabic or English — it answers the way a person would, and you can interrupt.',
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
    eyebrow: 'مساعدك الصوتي للسفر',
    titleA: 'كلّم',
    titleB: 'أبشر',
    tagline: 'خطط. استكشف. احجز. فقط اسأل.',
    ask: 'اسأل عن أي شيء…',
    chips: ['ابحث لي عن فندق', 'استكشف الأحساء', 'خطط لي ثلاثة أيام'],
    body:
      'وكيلنا الصوتي يعرف التطبيق والأماكن التي نغطيها وإلى أين تتجه Hasio. اسأله عن أي شيء، بالعربية ' +
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

// Monochrome line icons — the brand never uses coloured iconography, so these
// inherit one ink and differ only in shape.
const ico = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true }
const chipIcons = [
  <svg {...ico} key="a"><path d="M12 3l1.9 5.4L19 10l-5.1 1.6L12 17l-1.9-5.4L5 10l5.1-1.6z" /></svg>,
  <svg {...ico} key="b"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>,
  <svg {...ico} key="c"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3.5V6M16 3.5V6" /></svg>,
]
const MicMark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
)

export default function VoiceSection({ lang = 'en' }) {
  const t = copy[lang] ?? copy.en

  const [status, setStatus] = useState('idle') // idle | permission | connecting | connected | error
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState(null)

  const convoRef = useRef(null)
  const sectionRef = useRef(null)
  const barsRef = useRef([])

  const live = status === 'connected'
  const busy = status === 'permission' || status === 'connecting'

  // A fixed envelope per bar, so the waveform has the tapered shape of speech
  // rather than a flat block. Deterministic — the same every mount, so nothing
  // flickers if the component remounts on a language toggle.
  const weights = useMemo(
    () => Array.from({ length: BARS }, (_, i) => {
      const p = i / (BARS - 1)
      const envelope = Math.sin(Math.PI * p) ** 0.65          // tall in the middle
      const grain = 0.55 + 0.45 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1)
      return Math.max(0.12, envelope * grain)
    }),
    [],
  )

  /**
   * One rAF loop drives every bar, and it writes heights straight to the DOM.
   *
   * Three deliberate choices here, each of which was the alternative's problem:
   *  · Not React state — 26 bars at 60fps would be 1,560 re-renders a second.
   *  · Gated on an IntersectionObserver, so the loop does not burn a phone's
   *    battery animating a waveform that is four screens down the page.
   *  · Amplitude comes from the analyser only while connected; idle, it runs a
   *    slow synthetic wave, so the section looks alive before you press anything.
   */
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      // Still shape the bars, just never animate them.
      barsRef.current.forEach((b, i) => { if (b) b.style.setProperty('--h', `${18 + weights[i] * 46}%`) })
      return
    }

    let raf = 0
    let visible = false

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(tick)
      if (!visible && raf) { cancelAnimationFrame(raf); raf = 0 }
    }, { rootMargin: '120px 0px' })

    function amplitude(now) {
      const c = convoRef.current
      if (live && c) {
        try {
          // Low bins carry the voice; the top of the spectrum is mostly hiss.
          const data = speaking ? c.getOutputByteFrequencyData?.() : c.getInputByteFrequencyData?.()
          if (data && data.length) {
            const n = Math.min(data.length, 48)
            let sum = 0
            for (let i = 0; i < n; i++) sum += data[i]
            return Math.min(1, sum / n / 130)
          }
          const v = speaking ? c.getOutputVolume?.() : c.getInputVolume?.()
          if (typeof v === 'number') return Math.min(1, v * 1.6)
        } catch { /* analyser gone mid-frame — fall through to the idle wave */ }
        return 0
      }
      // Idle: a slow swell, so it reads as breathing rather than as a meter.
      // The floor matters — dip much below this and the bars collapse to dots.
      return 0.42 + 0.16 * Math.sin(now / 900)
    }

    function tick(now) {
      const amp = amplitude(now)
      for (let i = 0; i < barsRef.current.length; i++) {
        const b = barsRef.current[i]
        if (!b) continue
        const w = weights[i]
        // A per-bar phase offset keeps neighbours from moving in lockstep. The
        // step is small because the bars are now thin and close together — at
        // 0.55 the trace turned into visible stripes rather than a wave.
        const ripple = 0.72 + 0.28 * Math.sin(now / 260 + i * 0.26)
        b.style.setProperty('--h', `${Math.min(100, 8 + amp * w * ripple * 165)}%`)
      }
      raf = requestAnimationFrame(tick)
    }

    io.observe(el)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [live, speaking, weights])

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

  const state =
    status === 'permission' ? t.permission
    : status === 'connecting' ? t.connecting
    : live && speaking ? t.speaking
    : live ? t.listening
    : null

  return (
    <section className="va" id="voice" ref={sectionRef}>
      {/* Purely atmospheric: the sweeping green ribbon and the studio light. */}
      <div className="va-scene" aria-hidden="true">
        <span className="va-ribbon" />
        <span className="va-lift" />
      </div>

      <div className="va-inner">
        <div className="va-stage">
          <div className="va-ask">
            <span className="va-mic"><MicMark /></span>
            <span>{t.ask}</span>
          </div>

          <ul className="va-chips">
            {t.chips.map((c, i) => (
              <li key={c}>{chipIcons[i]}<span>{c}</span></li>
            ))}
          </ul>
        </div>

        {/* One trace, centred under both — the two-column pair read as a stereo
            meter rather than as one agent listening. */}
        <div className="va-wave" aria-hidden="true">
          {Array.from({ length: BARS }, (_, i) => (
            <i key={i} ref={(n) => { barsRef.current[i] = n }} />
          ))}
        </div>

        <div className="va-copy">
          <p className="va-eyebrow">{t.eyebrow}</p>
          <h2 className="va-title">{t.titleA} <em>{t.titleB}</em></h2>
          <p className="va-tag">{t.tagline}</p>
          <p className="va-body">{t.body}</p>

          <button
            type="button"
            className={`va-cta ${live ? 'is-live' : ''}`}
            onClick={live ? stop : start}
            disabled={busy}
          >
            <span className="va-cta-dot" />
            {live ? t.stop : busy ? (status === 'permission' ? t.permission : t.connecting) : t.start}
          </button>

          {/* Reserves its line whether or not it has text, so nothing below shifts. */}
          <p className="va-state" aria-live="polite">{state ?? ' '}</p>

          {error
            ? <p className="va-error" role="alert">{error}</p>
            : <p className="va-note">{t.note}</p>}
        </div>
      </div>
    </section>
  )
}
