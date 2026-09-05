import { useEffect, useRef, useState } from 'react'
import './immersive.css'

/**
 * "Be there before you go" — the AR/VR roadmap band.
 *
 * This is the investor-facing section: it is the one place on the site that talks
 * about where Hasio is going rather than what it already ships, so it has to look
 * like a product, not a promise.
 *
 * The background is a video, which is the whole reason this component is lazy and
 * why it carries its own loader. The rules, in order of how much they matter:
 *
 *  1. The <video> is rendered with NO src. Sources are attached only once an
 *     IntersectionObserver says the band is within 400px of the viewport. Until
 *     then the poster (a ~30kB webp still) is the entire cost, so a visitor who
 *     never scrolls this far pays nothing at all and the landing page's TTFB and
 *     LCP are untouched.
 *  2. autoplay only works muted, and only with playsInline on iOS — all three
 *     attributes are load-bearing, do not drop one.
 *  3. play() rejects on its own whenever a browser or a battery-saver decides it
 *     would rather not. That is a fine outcome: the poster stays up and the
 *     section still reads. Hence the empty catch.
 *  4. Save-Data and prefers-reduced-motion both mean "poster only". Neither is a
 *     degraded experience here — the still frame is the same artwork.
 */

// One h264 mp4, no webm alternate. A VP9 encode of this footage measured *larger*
// than x264 at matched quality — it is a slow, high-detail camera move, which is
// x264's best case and VP9's worst — so a second file would have cost a second
// encode to maintain and bought nothing. h264 plays everywhere, iOS included.
//
// The clip is graded for looping: it starts 6s into the master (on the bedroom
// reveal, not the corridor) and fades from and to black, so the seam between the
// bright closing aerial and the dark opening interior reads as an intended dip
// rather than a cut. The poster is its own frame at 0.7s, just past the fade-in.
const POSTER = '/immersive/presence-poster.webp'
const SOURCES = [{ src: '/immersive/presence.mp4', type: 'video/mp4' }]

// Industrial-design renders of the headset, shown on the paper band below the
// video — never on the dark one. Their own background is a warm off-white within
// a couple of values of the page's --paper, so on paper they sit in the page
// instead of on it; over the dark band each would read as a pasted white tile.
// They do carry a vignette, though, which is why each one gets a rounded plate
// with its own surface: the frame is what stops the darker corners looking like
// a mismatched edge. Masters (six views, of which three are used) live in
// design-assets/vr-headset/ — renamed off their generated filenames, which the
// `ChatGPT Image *.png` rule in .gitignore would otherwise swallow.
const views = [
  { src: '/immersive/headset-front.webp', k: 'front' },
  { src: '/immersive/headset-angle.webp', k: 'angle' },
  { src: '/immersive/headset-band.webp', k: 'band' },
]

const copy = {
  en: {
    eyebrow: 'WHAT WE ARE BUILDING NEXT',
    status: 'In development · first captures underway',
    titleA: 'Feel a place',
    titleB: 'before you go.',
    body:
      'Today you choose a hotel, a restaurant or a place to visit from a handful of photographs, and '
      + 'you only find out what it is really like once you are standing in it. We are building the part '
      + 'that takes the guessing out: open Hasio at home and step inside the actual room, the actual '
      + 'courtyard, the actual stretch of coast — at its real size, before you book anything. '
      + 'On the phone in your hand now; on a headset next.',
    points: [
      ['From your living room',
        'Open the app at home and walk through the real place at its real size. No trip, no headset, nothing to set up.'],
      ['No surprises on arrival',
        'Rooms, restaurants and heritage sites captured exactly as they are — not a flattering angle from five years ago.'],
      ['Phone first, headset next',
        'It starts as augmented reality on the phone you already own, and grows into full virtual presence on a headset.'],
    ],
    cta: 'Talk to us about it',
    note: 'Hasio is a Saudi travel app. We are operating in the Eastern Province today — that is where every place we capture starts, and the rest of the Kingdom follows.',
    deviceKicker: 'AND THE HEADSET WE HAVE IN MIND',
    deviceTitle: 'Designed for a long look, not a quick demo.',
    deviceBody:
      'Light enough to keep on while you walk a whole souq, and finished the way the places it '
      + 'shows you are — bone, deep green, a line of gold.',
    deviceAlts: [
      'The headset seen from the front, a coastline reflected in the visor',
      'The headset at three-quarters, with the Hasio wordmark on the side',
      'The headset from above, showing the strap and the Hasio wordmark',
    ],
    deviceNote: 'Industrial design concept — not a product on sale. Everything above runs first on the phone you already own.',
  },
  ar: {
    eyebrow: 'ما نبنيه في المرحلة القادمة',
    status: 'قيد التطوير · بدأنا أول عمليات التصوير',
    titleA: 'اشعر بالمكان',
    titleB: 'قبل أن تذهب إليه.',
    body:
      'اليوم تختار فندقاً أو مطعماً أو مكاناً تزوره من صور قليلة، ولا تعرف حقيقته إلا حين تقف فيه. '
      + 'نحن نبني الجزء الذي يُنهي هذا التخمين: افتح Hasio من بيتك وادخل إلى الغرفة نفسها، والفناء '
      + 'نفسه، وذلك الامتداد من الساحل — بحجمه الحقيقي، قبل أن تحجز أي شيء. على الهاتف الذي بين '
      + 'يديك الآن، وعلى النظارة لاحقاً.',
    points: [
      ['من غرفة جلوسك',
        'افتح التطبيق من البيت وتجوّل في المكان الحقيقي بحجمه الحقيقي. بلا سفر، وبلا نظارة، وبلا أي إعداد.'],
      ['لا مفاجآت عند الوصول',
        'غرف ومطاعم ومواقع تراثية مُلتقطة كما هي تماماً — لا زاوية مصوّرة مجمّلة من قبل خمس سنوات.'],
      ['الهاتف أولاً، ثم النظارة',
        'يبدأ كواقع معزّز على الهاتف الذي تملكه، ثم يتوسّع إلى حضور افتراضي كامل عبر النظارة.'],
    ],
    cta: 'تحدّث إلينا عن ذلك',
    note: 'Hasio تطبيق سفر سعودي. نعمل حالياً في المنطقة الشرقية — منها تبدأ كل الأماكن التي نلتقطها، ثم تتبعها بقية المملكة.',
    deviceKicker: 'والنظارة التي نتصوّرها',
    deviceTitle: 'مصمّمة لجولة طويلة، لا لتجربة عابرة.',
    deviceBody:
      'خفيفة بما يكفي لتبقى على رأسك وأنت تتجوّل في سوق بأكمله، وبخامات تشبه الأماكن التي '
      + 'تعرضها: عاجي، وأخضر عميق، وخط من الذهب.',
    deviceAlts: [
      'النظارة من الأمام، وينعكس على زجاجها خط ساحل',
      'النظارة من زاوية جانبية، وعليها اسم Hasio',
      'النظارة من الأعلى، ويظهر رباط الرأس واسم Hasio',
    ],
    deviceNote: 'تصميم مبدئي للمنتج — وليس جهازاً معروضاً للبيع. كل ما سبق يعمل أولاً على الهاتف الذي تملكه.',
  },
}

export default function ImmersiveSection({ lang = 'en', contactUrl }) {
  const t = copy[lang] || copy.en
  const hostRef = useRef(null)
  const videoRef = useRef(null)
  // Attaching the sources is a one-way switch: once armed, the <source> children
  // render and never come back out, so scrolling past twice does not re-download.
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    // Two ways to opt out of the download entirely, both of them the visitor's
    // own setting rather than our guess about their connection.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const saveData = navigator.connection?.saveData
    if (reduced || saveData) return

    const el = hostRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setArmed(true)
        io.disconnect()
      },
      // Start the fetch just before the band is on screen so the first loop is
      // already playing by the time it is, without pulling it in on page load.
      { rootMargin: '400px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // <source> elements added after mount are invisible to the element until it is
  // told to look again; without load() the video sits at readyState 0 forever.
  useEffect(() => {
    if (!armed) return
    const v = videoRef.current
    if (!v) return
    v.load()
    v.play().catch(() => { /* blocked by the browser — the poster carries it */ })
  }, [armed])

  return (
    <>
    <section className="imx" id="immersive" ref={hostRef}>
      <div className="imx-stage" aria-hidden="true">
        <video
          ref={videoRef}
          className={`imx-video ${armed ? 'is-live' : ''}`}
          poster={POSTER}
          preload="none"
          muted
          loop
          playsInline
          disablePictureInPicture
          tabIndex={-1}
        >
          {armed && SOURCES.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
        </video>
        <div className="imx-scrim" />
      </div>

      <div className="imx-inner">
        <div data-reveal className="imx-copy">
          <span className="eyebrow light">{t.eyebrow}</span>
          <p className="imx-status"><i />{t.status}</p>
          <h2>{t.titleA}<br /><em>{t.titleB}</em></h2>
          <p className="imx-body">{t.body}</p>
          {contactUrl && (
            <a className="imx-cta" href={contactUrl} target="_blank" rel="noopener noreferrer">
              {t.cta}
              {/* Drawn, not &#8594; — the entity renders as a hairline in the
                  display face. Symmetric about x=12 so it centres in the chip. */}
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.5 12h15M13.5 6l6 6-6 6" />
                </svg>
              </span>
            </a>
          )}
        </div>

        <div className="imx-points">
          {t.points.map((p, i) => (
            <article data-reveal key={p[0]} style={{ '--d': i + 1 }}>
              <span>0{i + 1}</span>
              <h3>{p[0]}</h3>
              <p>{p[1]}</p>
            </article>
          ))}
        </div>

        <p data-reveal className="imx-note">{t.note}</p>
      </div>
    </section>

    {/* A separate paper band rather than more of the dark one — see `views`. It
        is still part of "What's next", so it carries no id of its own and the
        nav's active-link observer keeps pointing at the section above. */}
    <section className="imx-device">
      <div className="imx-device-inner">
        <div data-reveal className="imx-device-head">
          <span className="eyebrow gold">{t.deviceKicker}</span>
          <h3>{t.deviceTitle}</h3>
          <p>{t.deviceBody}</p>
        </div>
        <div className="imx-views">
          {views.map((v, i) => (
            <figure data-reveal key={v.k} style={{ '--d': i }}>
              <img src={v.src} alt={t.deviceAlts[i]} loading="lazy" width="900" height="900" />
            </figure>
          ))}
        </div>
        <p data-reveal className="imx-device-note">{t.deviceNote}</p>
      </div>
    </section>
    </>
  )
}
