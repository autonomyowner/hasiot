import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from './hooks/useLanguage'
import { useReveal } from './hooks/useReveal'
import './App.css'

// The site is a single marketing page for the mobile app. Anything a visitor can
// actually do lives in the app, so every CTA here ends at a store.
const IOS_URL = 'https://apps.apple.com/app/id6800297588'
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.hasio.travel'

// Support runs through WhatsApp. wa.me wants the number bare — country code, no
// "+", no spaces — while the footer shows the readable form.
const WHATSAPP_URL = 'https://wa.me/966537577789'
const WHATSAPP_DISPLAY = '+966 53 757 7789'
const LINKEDIN_URL = 'https://www.linkedin.com/in/marzouq-alshammari-339897160/'

const content = {
  en: { nav:['The edit','Places','The app','Concierge'],getApp:'Get the app',switch:'العربية',eyebrow:'THE OASIS, CURATED',titleA:'Al-Ahsa,',titleB:'beyond the expected.',intro:'A considered guide to the world’s largest oasis—rare stays, storied places and local encounters, selected with care. Now in your pocket.',onIos:'Download on the',appStore:'App Store',onAndroid:'Get it on',playStore:'Google Play',storyKicker:'THE HASIO EDIT',storyTitle:['Travel slowly.','Remember deeply.'],storyBody:'We look beyond the obvious to bring you closer to the people, flavours and landscapes that give Al-Ahsa its soul.',why:'Why travel with us',values:[['Locally considered','Recommendations shaped by people who know the oasis by heart.'],['Quietly exceptional','Distinctive stays and experiences, chosen for character—not crowds.'],['Effortlessly yours','Save, plan and book your entire escape from one beautifully simple place.']],placesKicker:'EXPLORE AL-AHSA',placesTitle:['Timeless places','waiting for you.'],placesBody:'From heritage quarters to natural wonders — experience Al-Ahsa like never before.',placesCta:'Explore in the app',places:[['Heritage','Step into history that still lives.'],['Nature','Breathe in the beauty of the oasis.'],['Culture','Traditions that tell our story.'],['Flavours','A table set by the oasis.'],['Mountains','Caves carved by wind and time.'],['Stays','Desert retreats worth the journey.']],showKicker:'INSIDE THE APP',showTitle:'Everything the oasis holds',shots:[['Discover','Heritage sites, oasis paths and the places locals actually go.'],['Plan','Tell Hasio your pace and your dates. Get an itinerary built around them.'],['Stay & taste','Hotels, farm stays and the tables worth crossing town for.']],plannerName:'Hasio Concierge',plannerStatus:'Online',plannerQuote:'“A quiet three-day escape with heritage, palms and memorable local food.”',plannerRoutes:[['Old Hofuf','Souq, architecture & slow lunch'],['Oasis paths','Private palms & golden hour'],['Al Qarah','Caves & an open-air supper']],serviceKicker:'YOUR PERSONAL CONCIERGE',serviceTitle:['One journey.','Entirely your own.'],serviceBody:'Tell Hasio what moves you. The planner turns your pace, tastes and travel dates into a considered Al-Ahsa itinerary—in Arabic or English.',quote:'“The beauty of Al-Ahsa is not only what you see. It is how time feels while you are here.”',dlKicker:'AVAILABLE NOW',dlTitle:'Carry the oasis with you.',dlBody:'Free on iPhone and Android, in Arabic and English throughout.',footTag:'Curating the soul of Al-Ahsa.',privacy:'Privacy',terms:'Terms',support:'Support' },
  ar: { nav:['اختيارات Hasio','الأماكن','التطبيق','مرشدك'],getApp:'حمّل التطبيق',switch:'English',eyebrow:'الواحة، كما لم ترها من قبل',titleA:'الأحساء،',titleB:'أبعد من المتوقّع.',intro:'دليلك المختار بعناية إلى أكبر واحة في العالم—إقامات نادرة، أماكن تحكي التاريخ، وتجارب محلية أصيلة. الآن بين يديك.',onIos:'حمّله من',appStore:'App Store',onAndroid:'متوفر على',playStore:'Google Play',storyKicker:'اختيارات Hasio',storyTitle:['تمهّل في رحلتك.','واصنع ذكرى أعمق.'],storyBody:'نأخذك إلى ما وراء المألوف، لتقترب من الناس والنكهات والطبيعة التي تمنح الأحساء روحها.',why:'لماذا تسافر معنا',values:[['برؤية محلية','توصيات يصنعها من يعرف الواحة عن قرب.'],['استثنائي بهدوء','إقامات وتجارب لها طابعها الخاص، بعيداً عن الزحام.'],['رحلتك ببساطة','احفظ وخطط واحجز رحلتك كاملة من مكان واحد جميل وسهل.']],placesKicker:'استكشف الأحساء',placesTitle:['أماكن خالدة','بانتظارك.'],placesBody:'من الأحياء التراثية إلى عجائب الطبيعة، عِش الأحساء كما لم تعشها من قبل.',placesCta:'استكشفها في التطبيق',places:[['التراث','ادخل إلى تاريخ ما زال حياً.'],['الطبيعة','تنفّس جمال الواحة.'],['الثقافة','عادات تروي حكايتنا.'],['النكهات','مائدة تصنعها الواحة.'],['الجبال','كهوف نحتتها الريح والزمن.'],['الإقامة','منتجعات صحراوية تستحق الرحلة.']],showKicker:'داخل التطبيق',showTitle:'كل ما تحتضنه الواحة',shots:[['اكتشف','مواقع تراثية ودروب الواحة والأماكن التي يقصدها الأهالي فعلاً.'],['خطط','أخبر Hasio بإيقاعك وتواريخك، واحصل على برنامج مصمم لك.'],['أقم وتذوّق','فنادق ومزارع للإقامة وموائد تستحق عناء الطريق.']],plannerName:'مرشد Hasio',plannerStatus:'متصل',plannerQuote:'«ثلاثة أيام هادئة بين التراث والنخيل ومائدة محلية لا تُنسى.»',plannerRoutes:[['الهفوف القديمة','السوق والعمارة وغداء على مهل'],['دروب الواحة','نخيل خاص وساعة الغروب'],['جبل القارة','كهوف وعشاء في الهواء الطلق']],serviceKicker:'مرشدك الشخصي',serviceTitle:['رحلة واحدة.','مصممة لك.'],serviceBody:'أخبر Hasio بما تحب. يحوّل المخطط وقتك وذوقك وتواريخ سفرك إلى برنامج مدروس للأحساء—بالعربية أو الإنجليزية.',quote:'«جمال الأحساء ليس فقط فيما تراه، بل في إحساس الوقت وأنت هنا.»',dlKicker:'متوفر الآن',dlTitle:'خذ الواحة معك.',dlBody:'مجاناً على أجهزة iPhone وأجهزة Android، بالعربية والإنجليزية بالكامل.',footTag:'نحتفي بروح الأحساء.',privacy:'الخصوصية',terms:'الشروط',support:'الدعم' },
}

// Chrome the marketing copy never shows but keyboard navigation, the burger
// panel and the footer need, so it lives outside `content`.
const ui = {
  en: { skip: 'Skip to content', menu: 'Menu', explore: 'Explore', legal: 'Legal', support: 'WhatsApp support' },
  ar: { skip: 'تخطي إلى المحتوى', menu: 'القائمة', explore: 'استكشف', legal: 'الشروط والسياسات', support: 'الدعم عبر واتساب' },
}

// Section ids, in nav order — drives both the anchors and the active-link state.
const SECTIONS = ['story', 'places', 'app', 'concierge']

// Two art-directed brand posters. Their typography is baked into the artwork,
// so they are always shown whole — never object-fit: cover, which would crop
// the wordmark — and nothing is ever laid over them.
const posters = [
  { src: '/posters/gate.webp', w: 1085, h: 1335 },
  { src: '/posters/arch.webp', w: 1122, h: 1402 },
]

// Category art comes from the app's own generated Al-Ahsa set, cropped to
// portrait in public/places/.
const places = ['/places/heritage.webp', '/places/nature.webp', '/places/culture.webp', '/places/flavours.webp', '/places/mountains.webp', '/places/stays.webp']

// Monochrome line icons — the brand never uses coloured iconography.
const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' }
const placeIcons = [
  <svg {...icon} key="h"><path d="M3 21h18M5 21V10l7-6 7 6v11M10 21v-6a2 2 0 0 1 4 0v6"/></svg>,
  <svg {...icon} key="n"><path d="M12 22V9M12 9c-1.7-3.4-5.4-4-8-2.2 2.7-.7 5.6.2 8 2.2m0 0c1.7-3.4 5.4-4 8-2.2-2.7-.7-5.6.2-8 2.2m0 0C11.4 5.2 8.6 2.9 5.2 3c3 .8 5.5 3 6.8 6m0 0c.6-3.8 3.4-6.1 6.8-6-3 .8-5.5 3-6.8 6"/></svg>,
  <svg {...icon} key="c"><path d="M10 2h4M12 2v2M8 4h8l-1 4H9zM9 8h6l1.5 9h-9zM12 17v5M8.5 22h7"/></svg>,
  <svg {...icon} key="f"><path d="M3 14a9 9 0 0 1 18 0zM2 18h20M8 9c0-1.5.8-2 .8-3.2M12 8c0-1.5.8-2 .8-3.2M16 9c0-1.5.8-2 .8-3.2"/></svg>,
  <svg {...icon} key="m"><path d="M2 20h20L14.5 7l-3.6 6.2L8.2 9zM8.2 9 2 20"/></svg>,
  // A bed, not a building: the heritage icon is already a house silhouette.
  <svg {...icon} key="s"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M2 18h20"/></svg>,
]

// Directional glyphs, drawn rather than typed: the &#8594; / &#8592; entities render
// as a hairline in Instrument Serif and all but vanish inside a 40px chip.
// Stroked at 1.9 they read at any size and inherit the button's colour.
// The path is symmetric about x=12 (4.5 → 19.5) so that centring the svg box
// inside a round chip actually centres the mark; the usual "M4 12h15" sits
// half a unit left of the viewBox centre.
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </svg>
)
const Chevron = ({ back }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {/* Also symmetric about x=12: the chevron spans exactly 7 units, so it has
        to start at 8.5, not the usual 9. */}
    <path d={back ? 'M15.5 5l-7 7 7 7' : 'M8.5 5l7 7-7 7'} />
  </svg>
)

// Brand marks are drawn monochrome and inherit currentColor — the design rules
// forbid coloured iconography, so no WhatsApp green or LinkedIn blue anywhere.
// LinkedIn is the "in" letterform rather than the boxed logo: a square badge
// inside a round chip reads as two competing containers.
const WhatsAppMark = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.91-9.91a9.86 9.86 0 0 0-2.91-7.01Zm-7.01 15.24h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.06s.89 2.39 1.01 2.56c.12.16 1.74 2.66 4.22 3.73.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.46-.6 1.67-1.18.21-.57.21-1.07.14-1.17-.06-.11-.22-.17-.46-.29Z" />
  </svg>
)
const LinkedInMark = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 8.48H3V21h4V8.48Zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68Z" />
  </svg>
)

const AppleMark = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
const PlayMark = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.61 1.81 13.79 12 3.61 22.19a1 1 0 0 1-.61-.92V2.73c0-.4.24-.74.61-.92zm10.89 10.9 2.3 2.3-10.94 6.33 8.64-8.63zm3.2-3.2 2.8 1.63a1.05 1.05 0 0 1 0 1.73l-2.8 1.62L15.29 12l2.41-2.49zM5.86 2.66 16.8 8.99l-2.3 2.3-8.64-8.63z"/></svg>

// Both badges together, wherever a CTA is needed. `tone` picks the light-on-dark
// variant used over the hero photo and the green concierge panel.
function StoreBadges({ t, tone = 'dark' }) {
  return (
    <div className={`badges ${tone}`}>
      <a href={IOS_URL} target="_blank" rel="noopener noreferrer" className="badge">
        <AppleMark /><span><small>{t.onIos}</small><b>{t.appStore}</b></span>
      </a>
      <a href={ANDROID_URL} target="_blank" rel="noopener noreferrer" className="badge">
        <PlayMark /><span><small>{t.onAndroid}</small><b>{t.playStore}</b></span>
      </a>
    </div>
  )
}

export default function App() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = content[lang]
  const u = ui[lang]
  const rail = useRef(null)
  const [stuck, setStuck] = useState(false)
  const [active, setActive] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scroll, setScroll] = useState({ atStart: true, atEnd: false, w: 0.3, p: 0 })
  // Lists here are keyed by translated strings, so switching language mounts
  // fresh nodes — the reveal observer has to pick them up again.
  useReveal(lang)

  // The nav is fixed. Over the hero it stays transparent; once the hero's
  // bottom edge passes under it, it turns into a solid paper bar. An observer
  // inset by the nav height beats a scroll listener — no per-frame work, and
  // the switch point tracks the hero's real height at any viewport.
  useEffect(() => {
    const hero = document.querySelector('.hero-wrap')
    if (!hero) return
    const io = new IntersectionObserver(([e]) => {
      setStuck(!e.isIntersecting)
      // Back at the top, no section link should read as current.
      if (e.isIntersecting) setActive('')
    }, { rootMargin: '-88px 0px 0px 0px' })
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  // Highlight whichever section is crossing the middle of the viewport.
  useEffect(() => {
    const els = SECTIONS.map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  // Rail position, for the progress bar and for disabling the arrows at the
  // ends. RTL scrollLeft is negative in Chrome, hence the abs().
  const syncRail = useCallback(() => {
    const el = rail.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const x = Math.abs(el.scrollLeft)
    setScroll({
      atStart: x <= 2,
      atEnd: max <= 0 || x >= max - 2,
      w: el.clientWidth / el.scrollWidth,
      p: el.scrollWidth ? x / el.scrollWidth : 0,
    })
  }, [])

  useEffect(() => {
    const el = rail.current
    if (!el) return
    syncRail()
    el.addEventListener('scroll', syncRail, { passive: true })
    window.addEventListener('resize', syncRail)
    return () => {
      el.removeEventListener('scroll', syncRail)
      window.removeEventListener('resize', syncRail)
    }
  }, [syncRail])

  // Switching language re-lays the rail out mirrored; re-measure after paint.
  useEffect(() => {
    const id = requestAnimationFrame(syncRail)
    return () => cancelAnimationFrame(id)
  }, [lang, syncRail])

  // Escape or a scroll dismisses the mobile panel. Deliberately not a body
  // scroll lock: the panel links are in-page anchors, and locking the body
  // races the browser's own jump to the target.
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close)
    }
  }, [menuOpen])

  // Step the carousel by exactly one card. scrollBy's axis is visual, not
  // logical, so RTL has to invert it.
  const slide = (dir) => {
    const el = rail.current
    if (!el) return
    const card = el.querySelector('.place-card')
    const step = card ? card.offsetWidth + 18 : 274
    el.scrollBy({ left: dir * step * (isRtl ? -1 : 1), behavior: 'smooth' })
  }

  return (
    <main className={`home-redesign ${isRtl ? 'rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>

      <a className="skip-link" href="#story">{u.skip}</a>

      {/* The open panel is paper-coloured, so the bar above it has to be too —
          otherwise the hero photo shows through in a strip between them. */}
      <header className={`home-nav ${stuck || menuOpen ? 'is-stuck' : ''}`}>
        <a className="wordmark" href="#top"><img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" /><span>Hasio</span></a>
        <nav className="nav-menu">
          {t.nav.map((label, i) => (
            <a key={label} href={`#${SECTIONS[i]}`} aria-current={active === SECTIONS[i] ? 'true' : undefined}>{label}</a>
          ))}
        </nav>
        <div className="nav-actions">
          <button className="lang-btn" onClick={toggleLang}>{t.switch}</button>
          <a className="join" href="#download">{t.getApp}<span>↓</span></a>
          <button
            className="nav-toggle"
            aria-label={u.menu}
            aria-expanded={menuOpen}
            aria-controls="nav-panel"
            onClick={() => setMenuOpen((o) => !o)}
          ><i /></button>
        </div>
      </header>

      {menuOpen && (
        <div className="nav-panel" id="nav-panel">
          {t.nav.map((label, i) => (
            <a key={label} href={`#${SECTIONS[i]}`} onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
          <a className="panel-cta" href="#download" onClick={() => setMenuOpen(false)}>{t.getApp}</a>
        </div>
      )}

      <section className="hero-wrap" id="top">
        <div className="hero-media" /><div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow light">{t.eyebrow}</span>
          <h1>{t.titleA}<br /><em>{t.titleB}</em></h1>
          <p>{t.intro}</p>
          <StoreBadges t={t} tone="light" />
        </div>
        <span className="hero-cue" aria-hidden="true"><i />SCROLL</span>
        <span className="hero-index">25°23′N&nbsp;&nbsp; 49°35′E</span>
      </section>

      <section className="story section-shell" id="story">
        <div data-reveal className="story-heading">
          <span className="eyebrow">{t.storyKicker}</span>
          <h2>{t.storyTitle[0]}<br /><em>{t.storyTitle[1]}</em></h2>
        </div>
        <div data-reveal className="story-copy"><p>{t.storyBody}</p></div>
        <div data-reveal className="story-image"><img src="/hero.webp" alt="" loading="lazy" /></div>
        <div className="values">
          <h3>{t.why}</h3>
          {t.values.map((v, i) => (
            <article data-reveal key={v[0]} style={{ '--d': i }}><span>0{i + 1}</span><h4>{v[0]}</h4><p>{v[1]}</p></article>
          ))}
        </div>
      </section>


      <section className="places" id="places">
        <div className="places-inner section-shell">
          <div data-reveal className="places-copy">
            <span className="eyebrow gold">{t.placesKicker}</span>
            <h2>{t.placesTitle[0]}<br />{t.placesTitle[1]}</h2>
            <p>{t.placesBody}</p>
            <a className="place-cta" href="#download">{t.placesCta}<span><Arrow /></span></a>
          </div>
          <div className="rail-wrap">
            <div className="rail-nav">
              <button type="button" onClick={() => slide(-1)} aria-label="Previous" disabled={scroll.atStart}><Chevron back /></button>
              <button type="button" onClick={() => slide(1)} aria-label="Next" disabled={scroll.atEnd}><Chevron /></button>
            </div>
            <div className="rail" ref={rail} tabIndex="0" role="region" aria-label={t.placesKicker}>
              {t.places.map((c, i) => (
                <a className="place-card" key={c[0]} href="#download">
                  <img src={places[i]} alt={c[0]} loading="lazy" width="520" height="880" />
                  <div className="place-shade" />
                  <div className="place-body">
                    {placeIcons[i]}
                    <h3>{c[0]}</h3><p>{c[1]}</p>
                    <span className="place-go"><Arrow /></span>
                  </div>
                </a>
              ))}
            </div>
            <div className="rail-progress" aria-hidden="true">
              <i style={{ '--w': scroll.w, '--p': scroll.p }} />
            </div>
          </div>
        </div>
      </section>

      <section className="showcase section-shell" id="app">
        <div data-reveal className="section-title"><div><span className="eyebrow">{t.showKicker}</span><h2>{t.showTitle}</h2></div></div>
        <div className="plates">
          {posters.map((p, i) => (
            <figure data-reveal key={p.src} className="plate" style={{ '--d': i }}>
              <img src={p.src} alt="" loading="lazy" width={p.w} height={p.h} />
            </figure>
          ))}
        </div>
        <div className="app-features">
          {t.shots.map((s, i) => (
            <article data-reveal key={s[0]} className="feature" style={{ '--d': i }}>
              <span>0{i + 1}</span><h3>{s[0]}</h3><p>{s[1]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="concierge" id="concierge">
        <div className="concierge-photo" />
        <div data-reveal className="concierge-copy">
          <span className="eyebrow light">{t.serviceKicker}</span>
          <h2>{t.serviceTitle[0]}<br />{t.serviceTitle[1]}</h2>
          <p>{t.serviceBody}</p>
          <StoreBadges t={t} tone="light" />
        </div>
        <div data-reveal className="planner-card" style={{ '--d': 1 }}>
          <div className="planner-top"><img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" /><div><b>{t.plannerName}</b><small><i /> {t.plannerStatus}</small></div></div>
          <p>{t.plannerQuote}</p>
          {t.plannerRoutes.map((r, i) => (
            <div className="planner-route" key={r[0]}><span>0{i + 1}</span><div><b>{r[0]}</b><small>{r[1]}</small></div></div>
          ))}
        </div>
      </section>

      <section className="quote section-shell">
        <div data-reveal>
          <span aria-hidden="true">✦</span><blockquote>{t.quote}</blockquote><small>— HASIO FIELD NOTES, VOL. 01</small>
        </div>
      </section>

      <section className="download section-shell" id="download">
        <div data-reveal className="download-inner">
          <span className="eyebrow">{t.dlKicker}</span>
          <h2>{t.dlTitle}</h2>
          <p>{t.dlBody}</p>
          <StoreBadges t={t} />
        </div>
      </section>

      <footer className="home-footer">
        <div className="foot-top">
          <div className="foot-brand">
            <a className="wordmark" href="#top"><img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" /><span>Hasio</span></a>
            <p>{t.footTag}</p>
            <div className="foot-contact">
              <a className="wa-btn" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <WhatsAppMark />
                {/* dir=ltr for the same reason .foot-bottom needs it: bidi moves
                    the leading "+" to the wrong end of the number in Arabic. */}
                <span><small>{u.support}</small><b dir="ltr">{WHATSAPP_DISPLAY}</b></span>
              </a>
              <a className="foot-social" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <LinkedInMark />
              </a>
            </div>
          </div>
          <nav className="foot-col">
            <b>{u.explore}</b>
            {t.nav.map((label, i) => <a key={label} href={`#${SECTIONS[i]}`}>{label}</a>)}
          </nav>
          <div className="foot-col">
            <b>{t.getApp}</b>
            <a href={IOS_URL} target="_blank" rel="noopener noreferrer">{t.appStore}</a>
            <a href={ANDROID_URL} target="_blank" rel="noopener noreferrer">{t.playStore}</a>
          </div>
          <div className="foot-col">
            <b>{u.legal}</b>
            <a href="/privacy-policy.html">{t.privacy}</a>
            <a href="/terms-of-service.html">{t.terms}</a>
            <a href="/support.html">{t.support}</a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 HASIO</span>
          <span>25°23′N&nbsp;&nbsp;49°35′E&nbsp;&nbsp;·&nbsp;&nbsp;AL-AHSA</span>
        </div>
      </footer>

    </main>
  )
}
