import { useRef } from 'react'
import { useLanguage } from './hooks/useLanguage'
import { useReveal } from './hooks/useReveal'
import './App.css'

// The site is a single marketing page for the mobile app. Anything a visitor can
// actually do lives in the app, so every CTA here ends at a store.
const IOS_URL = 'https://apps.apple.com/app/id6800297588'
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.hasio.travel'

const content = {
  en: { nav:['The edit','Places','The app','Concierge'],getApp:'Get the app',switch:'العربية',eyebrow:'THE OASIS, CURATED',titleA:'Al-Ahsa,',titleB:'beyond the expected.',intro:'A considered guide to the world’s largest oasis—rare stays, storied places and local encounters, selected with care. Now in your pocket.',onIos:'Download on the',appStore:'App Store',onAndroid:'Get it on',playStore:'Google Play',storyKicker:'THE HASIO EDIT',storyTitle:['Travel slowly.','Remember deeply.'],storyBody:'We look beyond the obvious to bring you closer to the people, flavours and landscapes that give Al-Ahsa its soul.',why:'Why travel with us',values:[['Locally considered','Recommendations shaped by people who know the oasis by heart.'],['Quietly exceptional','Distinctive stays and experiences, chosen for character—not crowds.'],['Effortlessly yours','Save, plan and book your entire escape from one beautifully simple place.']],placesKicker:'EXPLORE AL-AHSA',placesTitle:['Timeless places','waiting for you.'],placesBody:'From heritage quarters to natural wonders — experience Al-Ahsa like never before.',placesCta:'Explore in the app',places:[['Heritage','Step into history that still lives.'],['Nature','Breathe in the beauty of the oasis.'],['Culture','Traditions that tell our story.'],['Flavours','A table set by the oasis.'],['Mountains','Caves carved by wind and time.']],showKicker:'INSIDE THE APP',showTitle:'Everything the oasis holds',shots:[['Discover','Heritage sites, oasis paths and the places locals actually go.'],['Plan','Tell Hasio your pace and your dates. Get an itinerary built around them.'],['Stay & taste','Hotels, farm stays and the tables worth crossing town for.']],serviceKicker:'YOUR PERSONAL CONCIERGE',serviceTitle:['One journey.','Entirely your own.'],serviceBody:'Tell Hasio what moves you. The planner turns your pace, tastes and travel dates into a considered Al-Ahsa itinerary—in Arabic or English.',quote:'“The beauty of Al-Ahsa is not only what you see. It is how time feels while you are here.”',dlKicker:'AVAILABLE NOW',dlTitle:'Carry the oasis with you.',dlBody:'Free on iPhone and Android, in Arabic and English throughout.',footTag:'Curating the soul of Al-Ahsa.',privacy:'Privacy',terms:'Terms',support:'Support' },
  ar: { nav:['اختيارات هاسيو','الأماكن','التطبيق','مرشدك'],getApp:'حمّل التطبيق',switch:'English',eyebrow:'الواحة، كما لم ترها من قبل',titleA:'الأحساء،',titleB:'أبعد من المتوقّع.',intro:'دليلك المختار بعناية إلى أكبر واحة في العالم—إقامات نادرة، أماكن تحكي التاريخ، وتجارب محلية أصيلة. الآن بين يديك.',onIos:'حمّله من',appStore:'App Store',onAndroid:'متوفر على',playStore:'Google Play',storyKicker:'اختيارات هاسيو',storyTitle:['تمهّل في رحلتك.','واصنع ذكرى أعمق.'],storyBody:'نأخذك إلى ما وراء المألوف، لتقترب من الناس والنكهات والطبيعة التي تمنح الأحساء روحها.',why:'لماذا تسافر معنا',values:[['برؤية محلية','توصيات يصنعها من يعرف الواحة عن قرب.'],['استثنائي بهدوء','إقامات وتجارب لها طابعها الخاص، بعيداً عن الزحام.'],['رحلتك ببساطة','احفظ وخطط واحجز رحلتك كاملة من مكان واحد جميل وسهل.']],placesKicker:'استكشف الأحساء',placesTitle:['أماكن خالدة','بانتظارك.'],placesBody:'من الأحياء التراثية إلى عجائب الطبيعة، عِش الأحساء كما لم تعشها من قبل.',placesCta:'استكشفها في التطبيق',places:[['التراث','ادخل إلى تاريخ ما زال حياً.'],['الطبيعة','تنفّس جمال الواحة.'],['الثقافة','عادات تروي حكايتنا.'],['النكهات','مائدة تصنعها الواحة.'],['الجبال','كهوف نحتتها الريح والزمن.']],showKicker:'داخل التطبيق',showTitle:'كل ما تحتضنه الواحة',shots:[['اكتشف','مواقع تراثية ودروب الواحة والأماكن التي يقصدها الأهالي فعلاً.'],['خطط','أخبر هاسيو بإيقاعك وتواريخك، واحصل على برنامج مصمم لك.'],['أقم وتذوّق','فنادق ومزارع للإقامة وموائد تستحق عناء الطريق.']],serviceKicker:'مرشدك الشخصي',serviceTitle:['رحلة واحدة.','مصممة لك.'],serviceBody:'أخبر هاسيو بما تحب. يحوّل المخطط وقتك وذوقك وتواريخ سفرك إلى برنامج مدروس للأحساء—بالعربية أو الإنجليزية.',quote:'«جمال الأحساء ليس فقط فيما تراه، بل في إحساس الوقت وأنت هنا.»',dlKicker:'متوفر الآن',dlTitle:'خذ الواحة معك.',dlBody:'مجاناً على أجهزة iPhone وأجهزة Android، بالعربية والإنجليزية بالكامل.',footTag:'نحتفي بروح الأحساء.',privacy:'الخصوصية',terms:'الشروط',support:'الدعم' },
}

const shots = ['/app/discover.webp', '/app/plan.webp', '/app/stay.webp']

// Category art comes from the app's own generated Al-Ahsa set, cropped to
// portrait in public/places/.
const places = ['/places/heritage.webp', '/places/nature.webp', '/places/culture.webp', '/places/flavours.webp', '/places/mountains.webp']

// Monochrome line icons — the brand never uses coloured iconography.
const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' }
const placeIcons = [
  <svg {...icon} key="h"><path d="M3 21h18M5 21V10l7-6 7 6v11M10 21v-6a2 2 0 0 1 4 0v6"/></svg>,
  <svg {...icon} key="n"><path d="M12 22V9M12 9c-1.7-3.4-5.4-4-8-2.2 2.7-.7 5.6.2 8 2.2m0 0c1.7-3.4 5.4-4 8-2.2-2.7-.7-5.6.2-8 2.2m0 0C11.4 5.2 8.6 2.9 5.2 3c3 .8 5.5 3 6.8 6m0 0c.6-3.8 3.4-6.1 6.8-6-3 .8-5.5 3-6.8 6"/></svg>,
  <svg {...icon} key="c"><path d="M10 2h4M12 2v2M8 4h8l-1 4H9zM9 8h6l1.5 9h-9zM12 17v5M8.5 22h7"/></svg>,
  <svg {...icon} key="f"><path d="M3 14a9 9 0 0 1 18 0zM2 18h20M8 9c0-1.5.8-2 .8-3.2M12 8c0-1.5.8-2 .8-3.2M16 9c0-1.5.8-2 .8-3.2"/></svg>,
  <svg {...icon} key="m"><path d="M2 20h20L14.5 7l-3.6 6.2L8.2 9zM8.2 9 2 20"/></svg>,
]

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
  const rail = useRef(null)
  useReveal()

  // Step the carousel by exactly one card. scrollBy's axis is visual, not
  // logical, so RTL has to invert it.
  const slide = (dir) => {
    const el = rail.current
    if (!el) return
    const card = el.querySelector('.place-card')
    const step = card ? card.offsetWidth + 18 : 264
    el.scrollBy({ left: dir * step * (isRtl ? -1 : 1), behavior: 'smooth' })
  }

  return (
    <main className={`home-redesign ${isRtl ? 'rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>

      <header className="home-nav">
        <a className="wordmark" href="#top"><img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" /><span>Hasio</span></a>
        <nav className="nav-menu"><a href="#story">{t.nav[0]}</a><a href="#places">{t.nav[1]}</a><a href="#app">{t.nav[2]}</a><a href="#concierge">{t.nav[3]}</a></nav>
        <div className="nav-actions">
          <button onClick={toggleLang}>{t.switch}</button>
          <a className="join" href="#download">{t.getApp}<span>↓</span></a>
        </div>
      </header>

      <section className="hero-wrap" id="top">
        <div className="hero-media" /><div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow light">{t.eyebrow}</span>
          <h1>{t.titleA}<br /><em>{t.titleB}</em></h1>
          <p>{t.intro}</p>
          <StoreBadges t={t} tone="light" />
        </div>
        <span className="hero-index">25°23′N&nbsp;&nbsp; 49°35′E</span>
      </section>

      <section className="story section-shell" id="story">
        <div data-reveal className="story-heading">
          <span className="eyebrow">{t.storyKicker}</span>
          <h2>{t.storyTitle[0]}<br /><em>{t.storyTitle[1]}</em></h2>
        </div>
        <div data-reveal className="story-copy"><p>{t.storyBody}</p></div>
        <div className="story-image"><img src="/hero.webp" alt="" loading="lazy" /></div>
        <div className="values">
          <h3>{t.why}</h3>
          {t.values.map((v, i) => <article data-reveal key={v[0]}><span>0{i + 1}</span><h4>{v[0]}</h4><p>{v[1]}</p></article>)}
        </div>
      </section>


      <section className="places" id="places">
        <div className="places-inner section-shell">
          <div data-reveal className="places-copy">
            <span className="eyebrow gold">{t.placesKicker}</span>
            <h2>{t.placesTitle[0]}<br />{t.placesTitle[1]}</h2>
            <p>{t.placesBody}</p>
            <a className="place-cta" href="#download">{t.placesCta}<span>&#8594;</span></a>
          </div>
          <div className="rail-wrap">
            <div className="rail-nav">
              <button type="button" onClick={() => slide(-1)} aria-label="Previous">&#8592;</button>
              <button type="button" onClick={() => slide(1)} aria-label="Next">&#8594;</button>
            </div>
            <div className="rail" ref={rail}>
              {t.places.map((c, i) => (
                <a className="place-card" key={c[0]} href="#download">
                  <img src={places[i]} alt={c[0]} loading="lazy" width="520" height="880" />
                  <div className="place-shade" />
                  <div className="place-body">
                    {placeIcons[i]}
                    <h3>{c[0]}</h3><p>{c[1]}</p>
                    <span className="place-go">&#8594;</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="showcase section-shell" id="app">
        <div className="section-title"><div><span className="eyebrow">{t.showKicker}</span><h2>{t.showTitle}</h2></div></div>
        <div className="shot-grid">
          {t.shots.map((s, i) => (
            <article data-reveal key={s[0]} className="shot">
              <div className="phone"><img src={shots[i]} alt={s[0]} loading="lazy" width="440" height="892" /></div>
              <h3>{s[0]}</h3><p>{s[1]}</p>
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
        <div className="planner-card">
          <div className="planner-top"><img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" /><div><b>Hasio Concierge</b><small><i /> Online</small></div></div>
          <p>“A quiet three-day escape with heritage, palms and memorable local food.”</p>
          {[['Old Hofuf','Souq, architecture & slow lunch'],['Oasis paths','Private palms & golden hour'],['Al Qarah','Caves & an open-air supper']].map((r, i) => (
            <div className="planner-route" key={r[0]}><span>0{i + 1}</span><div><b>{r[0]}</b><small>{r[1]}</small></div></div>
          ))}
        </div>
      </section>

      <section className="quote section-shell">
        <span>✦</span><blockquote>{t.quote}</blockquote><small>— HASIO FIELD NOTES, VOL. 01</small>
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
        <a className="wordmark" href="#top"><img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" /><span>Hasio</span></a>
        <p>{t.footTag}</p>
        <div>
          <a href="/privacy-policy.html">{t.privacy}</a>
          <a href="/terms-of-service.html">{t.terms}</a>
          <a href="/support.html">{t.support}</a>
        </div>
        <small>© 2026 HASIO</small>
      </footer>

    </main>
  )
}
