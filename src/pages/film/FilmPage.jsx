import { createElement, useEffect, useRef, useState } from 'react'
import { useLiveHotels, preloadLiveHotels } from './useLiveHotels'
import './Film.css'

// /hasiofilm — the project told as a short film rather than a deck of slides.
// Each scene is a fixed length; the clock below advances through them and the
// scene's own CSS animations (delays measured from its mount, via --d) do the
// choreography. Pausing freezes those animations with animation-play-state on
// the root, so the clock and the picture never drift apart. Every scene fades
// in from black and back out (--dur on .stage), which is the "cut".

// Who signs the closing card. Placeholder until the owner says what it reads.
const FOUNDER = { name: 'The Hasio team', role: 'Founders' }

const A = ({ d, as = 'div', className = '', children, ...rest }) =>
  createElement(as, { className: `a ${className}`, style: { '--d': `${d}s` }, ...rest }, children)

function Opening() {
  const word = 'Hasio'
  const line = ['Saudi', 'Arabia,', 'the', 'way', 'locals', 'know', 'it.']
  return (
    <div className="sc sc-open">
      <div className="open-photo" />
      <div className="open-scrim" />
      <div className="open-rule" />
      <h1 className="open-mark" aria-label={word}>
        {[...word].map((c, i) => <span key={i} style={{ '--i': i }}>{c}</span>)}
      </h1>
      <p className="open-line">
        {line.map((w, i) => <span key={i} style={{ '--i': i }}>{w}&nbsp;</span>)}
      </p>
      <p className="open-sub">A film about the travel app for the Kingdom</p>
    </div>
  )
}

function Problem() {
  // Three live hotels with their own photos (uploaded, not stock), so the prints
  // are real rooms on Hasio today; the picture cards stand in until they load.
  const hotels = useLiveHotels()
  const own = (hotels || []).filter((h) => !h.images[0].includes('unsplash.com'))
  const shots = own.length >= 3
    ? own.slice(0, 3).map((h) => ({ key: h._id, img: h.images[0], name: h.name_en || h.name }))
    : ['stays', 'heritage', 'culture'].map((s) => ({ key: s, img: `/places/${s}.webp` }))
  return (
    <div className="sc sc-problem">
      <A d={0.3} className="chapter">Chapter one — Made easy</A>
      <div className="polaroids">
        {shots.map((s, i) => (
          <A key={s.key} d={0.8 + i * 0.35} className="polaroid" style={{ '--d': `${0.8 + i * 0.35}s`, '--r': `${(i - 1) * 7}deg` }}>
            <img src={s.img} alt="" />
            {s.name && <span className="polaroid-name">{s.name}</span>}
          </A>
        ))}
      </div>
      <A d={2.4} as="h2" className="big">Book a hotel<br /><em>with ease.</em></A>
      <A d={4.6} as="p" className="big dim">See the rooms, the price and the place —<br />before you arrive.</A>
    </div>
  )
}

function Product() {
  const feats = [
    ['AI trip planner', 'Tell it the days and the mood — it plans the route.'],
    ['Map & directory', 'Hotels, restaurants, attractions, events.'],
    ['Book in a tap', 'Stays and local services, confirmed by the host.'],
    ['Local people', 'Guides, drivers, photographers — booked like hotels.'],
  ]
  return (
    <div className="sc sc-product">
      <div className="prod-poster a zoom" style={{ '--d': '0s' }}><img src="/posters/gate.webp" alt="" /></div>
      <div className="prod-copy">
        <A d={0.4} className="chapter">Chapter two — The app</A>
        <A d={0.8} as="h2" className="big">One app for<br />the whole trip.</A>
        <ul>
          {feats.map(([h, p], i) => (
            <A key={h} as="li" d={2 + i * 0.7}><b>{h}</b><span>{p}</span></A>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Stored listings still carry Al-Ahsa's sub-areas; the site shows the city above them.
const CITY = { Hofuf: 'Al Ahsa', Mubarraz: 'Al Ahsa', 'Al Oyoun': 'Al Ahsa', Dhahran: 'Al Khobar' }

function Hotels() {
  const hotels = useLiveHotels()
  const list = hotels || []
  const fallback = ['stays', 'nature', 'heritage', 'flavours', 'culture', 'mountains']
  const cards = list.length
    ? list.map((h) => ({ key: h._id, img: h.images[0], name: h.name_en || h.name, city: CITY[h.city] || h.city, price: h.pricePerNight }))
    : fallback.map((f) => ({ key: f, img: `/places/${f}.webp` }))
  return (
    <div className="sc sc-hotels">
      <A d={0.3} className="chapter">Chapter three — Real places, live today</A>
      <A d={0.7} as="h2" className="big center">Hotels you can book<br />on Hasio right now.</A>
      <div className="reel">
        <div className="reel-track">
          {[...cards, ...cards].map((c, i) => (
            <figure key={`${c.key}-${i}`} className="reel-card">
              <img src={c.img} alt="" />
              {c.name && (
                <figcaption>
                  <b>{c.name}</b>
                  <span>{c.city}{c.price ? ` · ${Math.round(c.price).toLocaleString('en-US')} SAR / night` : ''}</span>
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
      {list.length > 0 && <A d={2} className="count"><b>{list.length}</b> hotels live on hasio.net — real photos, real nightly prices</A>}
    </div>
  )
}

function Model() {
  const cols = [
    ['Travellers', 'Free', 'Plan, book and review — no fees to use the app.'],
    ['Hotels & hosts', 'Partners', 'List for free, get booking requests, confirm from the partner portal.'],
    ['Local services', 'Providers', 'Guides, drivers and photographers get booked like hotels.'],
  ]
  return (
    <div className="sc sc-model">
      <A d={0.3} className="chapter">Chapter four — The business</A>
      <A d={0.7} as="h2" className="big center">A marketplace with<br />three sides.</A>
      <div className="model-cols">
        {cols.map(([h, tag, p], i) => (
          <A key={h} d={1.8 + i * 0.6} className="model-col">
            <i>{tag}</i><b>{h}</b><p>{p}</p>
          </A>
        ))}
      </div>
      <A d={4.4} className="model-rev">
        <span>Revenue</span> a commission on every confirmed booking · featured placement for partners
      </A>
    </div>
  )
}

function Traction() {
  const stats = [
    ['13', 'cities covered'],
    ['2', 'app stores'],
    ['8', 'countries live'],
    ['24/7', 'AI planner'],
  ]
  return (
    <div className="sc sc-traction">
      <div className="trac-photo" />
      <A d={0.3} className="chapter">Chapter five — Where we are</A>
      <div className="stats">
        {stats.map(([n, l], i) => (
          <A key={l} d={0.8 + i * 0.45} className="stat"><b>{n}</b><span>{l}</span></A>
        ))}
      </div>
      <A d={3.4} as="p" className="big center">Live on the App Store, Google Play<br />and <em>hasio.net</em>.</A>
      <A d={5.4} as="p" className="small center">Eastern Province today — the rest of the Kingdom next.</A>
    </div>
  )
}

function Next() {
  return (
    <div className="sc sc-next">
      <video className="next-video" src="/immersive/presence.mp4" poster="/immersive/presence-poster.webp"
        muted playsInline autoPlay loop />
      <div className="next-scrim" />
      <A d={0.6} className="chapter">Chapter six — What's next</A>
      <A d={1.2} as="h2" className="huge">Feel a place<br />before you go.</A>
      <A d={3.6} as="p" className="small">AR on your phone first. A headset next.</A>
    </div>
  )
}

function Closing() {
  return (
    <div className="sc sc-close">
      <A d={0.4} className="credit-k">A film by</A>
      <A d={0.9} className="credit-n">{FOUNDER.name}</A>
      <A d={1.3} className="credit-r">{FOUNDER.role}</A>
      <A d={2.6} as="h2" className="close-mark">Hasio</A>
      <A d={3.4} className="close-url">hasio.net</A>
      <A d={4.2} className="close-cta">
        <a href="/explore">Explore the places</a>
      </A>
    </div>
  )
}

const SCENES = [
  { id: 'opening', title: 'Opening', dur: 10, vo: 2.5, Comp: Opening },
  { id: 'problem', title: 'Made easy', dur: 8, vo: 0.6, Comp: Problem },
  { id: 'product', title: 'The app', dur: 9, vo: 0.7, Comp: Product },
  { id: 'hotels', title: 'Real places', dur: 12, vo: 1, Comp: Hotels },
  { id: 'model', title: 'The business', dur: 10, vo: 0.6, Comp: Model },
  { id: 'traction', title: 'Where we are', dur: 8, vo: 0.8, Comp: Traction },
  { id: 'next', title: "What's next", dur: 7, vo: 1.2, Comp: Next },
  { id: 'closing', title: 'Credits', dur: 7, vo: 2.4, Comp: Closing },
]
const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0)



export default function FilmPage() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false) // browsers only allow sound after a click
  const [muted, setMuted] = useState(false)
  const [idle, setIdle] = useState(false) // controls hide while the film plays untouched
  const voice = useRef({ id: null, el: null })
  const [take, setTake] = useState(0) // bumping it remounts the scene (replay / jump)
  const last = useRef(null)

  useEffect(() => {
    if (!playing) { last.current = null; return }
    let raf
    const tick = (now) => {
      if (last.current != null) {
        const dt = (now - last.current) / 1000
        setT((v) => Math.min(TOTAL, v + dt))
      }
      last.current = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  useEffect(() => { if (t >= TOTAL) setPlaying(false) }, [t])

  // Space pauses, arrows jump a scene.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') { e.preventDefault(); setStarted(true); setPlaying((p) => !p) }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        setT((v) => {
          let s = 0, i = 0
          for (; i < SCENES.length - 1 && v >= s + SCENES[i].dur; i++) s += SCENES[i].dur
          const j = Math.max(0, Math.min(SCENES.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))
          return SCENES.slice(0, j).reduce((a, x) => a + x.dur, 0)
        })
        setTake((k) => k + 1)
        setStarted(true)
        setPlaying(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  let start = 0, idx = SCENES.length - 1
  for (let i = 0; i < SCENES.length; i++) {
    if (t < start + SCENES[i].dur) { idx = i; break }
    if (i < SCENES.length - 1) start += SCENES[i].dur
  }
  const scene = SCENES[idx]
  const isLast = idx === SCENES.length - 1

  // The voiceover follows the film clock rather than its own: each scene's line
  // starts `vo` seconds into the scene, so pausing, jumping or replaying all come
  // down to "where should the audio be at time t", checked every frame.
  const local = t - start
  useEffect(() => {
    const v = voice.current
    if (v.id !== `${scene.id}-${take}`) {
      v.el?.pause()
      v.el = new Audio(`/film/vo-${scene.id}.mp3`)
      v.el.preload = 'auto'
      v.id = `${scene.id}-${take}`
    }
    const el = v.el
    el.muted = muted
    const want = local - scene.vo
    if (!playing || want < 0 || (el.duration && want >= el.duration)) { if (!el.paused) el.pause(); return }
    if (el.paused && !el.ended) {
      if (Math.abs(el.currentTime - want) > 0.3) el.currentTime = want
      el.play().catch(() => {})
    }
  }, [scene.id, scene.vo, take, local, playing, muted])
  useEffect(() => () => voice.current.el?.pause(), [])
  // Fetch the hotels and warm their photos while the opening plays.
  useEffect(() => { preloadLiveHotels().then((hs) => hs.forEach((h) => { new Image().src = h.images[0] })) }, [])

  // Any mouse move or tap brings the controls back for 2.5s; paused, they stay.
  useEffect(() => {
    let timer
    const wake = () => { setIdle(false); clearTimeout(timer); timer = setTimeout(() => setIdle(true), 2500) }
    wake()
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => { clearTimeout(timer); window.removeEventListener('pointermove', wake); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake) }
  }, [])

  const begin = () => { setStarted(true); setPlaying(true) }

  const jump = (i) => { setStarted(true); setT(SCENES.slice(0, i).reduce((a, x) => a + x.dur, 0)); setTake((k) => k + 1); setPlaying(true) }
  const replay = () => jump(0)

  return (
    <main dir="ltr" lang="en" className={`film${playing ? '' : ' is-paused'}${playing && idle ? ' is-idle' : ''}`}>
      <div className={`stage${isLast ? ' is-last' : ''}`} key={`${scene.id}-${take}`} style={{ '--dur': `${scene.dur}s` }}>
        <scene.Comp />
      </div>
      <div className="grain" aria-hidden />
      <div className="bars" aria-hidden><i /><i /></div>
      {!started && (
        <button className="start" onClick={begin}>
          <span className="start-mark">Hasio</span>
          <span className="start-play">▶&nbsp; Play the film</span>
          <span className="start-note">Sound on · 1 min 11 s</span>
        </button>
      )}
      <div className="ctrl">
        <button onClick={() => (t >= TOTAL ? replay() : setPlaying((p) => !p))}>
          {t >= TOTAL ? 'Replay' : playing ? 'Pause' : 'Play'}
        </button>
        <button className="mute" onClick={() => setMuted((m) => !m)}>{muted ? 'Sound off' : 'Sound on'}</button>
        <div className="track">
          {SCENES.map((s, i) => {
            const s0 = SCENES.slice(0, i).reduce((a, x) => a + x.dur, 0)
            const f = Math.max(0, Math.min(1, (t - s0) / s.dur))
            return (
              <button key={s.id} className="seg" style={{ flex: s.dur }} onClick={() => jump(i)} aria-label={s.title} title={s.title}>
                <b style={{ width: `${f * 100}%` }} />
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
