const copy = {
  ar: {
    heading: 'أكبر واحة طبيعية في العالم',
    // "الأحساء" in Classical Arabic refers to the sound of water underground.
    body: 'الأحساء — حيث يُسمع خرير الماء تحت الأرض. اكتشف نخيلها وعيونها وأسواقها العريقة.',
  },
  en: {
    heading: "The world's largest natural oasis",
    body: 'Al-Ahsa — where the water runs beneath the sand. Discover its palm groves, springs, and old souqs.',
  },
}

/**
 * Decorative photo panel beside the auth form.
 *
 * The image is applied as a CSS background in AuthPages.css, not an <img>, so
 * the `display: none` at the mobile breakpoint prevents the download entirely.
 * Marked aria-hidden — it is atmosphere, and the caption repeats nothing the
 * form needs.
 */
export default function AuthVisual({ lang = 'ar' }) {
  const t = copy[lang] || copy.ar

  return (
    <aside className="auth-visual" aria-hidden="true">
      <div className="auth-visual-caption">
        <div className="auth-visual-rule" />
        <h2>{t.heading}</h2>
        <p>{t.body}</p>
      </div>
    </aside>
  )
}
