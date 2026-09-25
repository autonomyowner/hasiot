import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { safeHttpUrl } from '../constants'

/**
 * A detail panel that slides in from the page's end edge — the left, in this
 * RTL panel — over a dimmed page.
 *
 * Radix's Dialog underneath, like Modal, and for the same reasons: focus moves
 * in and is trapped, Escape and a click outside close it, the page behind is
 * inert. A drawer rather than a centred modal because it is for reading a
 * whole record (photos, description, bookings) and then acting on it; it keeps
 * the table visible beside it on a wide screen, and takes the full width on a
 * phone.
 *
 * Confirmations raised from inside it (useConfirm) stack above it: Radix hands
 * pointer events and Escape to the topmost layer only.
 *
 * Callers mount it conditionally, so it is always open while rendered.
 */
export default function Drawer({ title, subtitle, badges, onClose, children, footer, width = 560 }) {
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose?.() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="admin-drawer-overlay" />
        <DialogPrimitive.Content
          className="admin-drawer"
          dir="rtl"
          style={{ '--drawer-width': `${width}px` }}
        >
          <header className="admin-drawer-head">
            <div className="admin-drawer-heading">
              <DialogPrimitive.Title className="admin-drawer-title">{title}</DialogPrimitive.Title>
              {subtitle
                ? <DialogPrimitive.Description className="admin-drawer-subtitle">{subtitle}</DialogPrimitive.Description>
                /* Radix warns when a dialog has no description. */
                : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
              {badges && <div className="admin-drawer-badges">{badges}</div>}
            </div>
            <DialogPrimitive.Close className="admin-drawer-close" aria-label="إغلاق">
              <XIcon aria-hidden="true" />
            </DialogPrimitive.Close>
          </header>

          {/* The only scrolling region, so the head and the actions stay put. */}
          <div className="admin-drawer-body">{children}</div>

          {footer && <footer className="admin-drawer-foot">{footer}</footer>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** A titled block inside a drawer. */
export function DrawerSection({ title, children, aside }) {
  return (
    <section className="admin-drawer-section">
      {(title || aside) && (
        <div className="admin-drawer-section-head">
          {title && <h3 className="admin-drawer-section-title">{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

/** Label/value pairs in two columns. Rows with no value are left out. */
export function Facts({ items }) {
  const shown = items.filter((item) => item && item.value !== undefined && item.value !== null && item.value !== '')
  if (shown.length === 0) return null
  return (
    <dl className="admin-facts">
      {shown.map((item) => (
        <div key={item.label} className={item.wide ? 'wide' : undefined}>
          <dt>{item.label}</dt>
          <dd dir={item.ltr ? 'ltr' : undefined}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A strip of photos, each opening full size in a new tab. The URLs came from
 * the app, so only an http(s) one becomes a link (safeHttpUrl).
 */
export function Gallery({ images, emptyText = 'لا توجد صور.' }) {
  if (!images?.length) return <p className="admin-inline-hint">{emptyText}</p>
  return (
    <div className="admin-gallery">
      {images.map((url, index) => {
        const photo = (
          <>
            <img src={url} alt={`صورة ${index + 1}`} loading="lazy" />
            {index === 0 && <span className="admin-gallery-cover">الغلاف</span>}
          </>
        )
        const href = safeHttpUrl(url)
        return href ? (
          <a key={`${url}-${index}`} href={href} target="_blank" rel="noopener noreferrer">{photo}</a>
        ) : (
          <span key={`${url}-${index}`} className="admin-gallery-item">{photo}</span>
        )
      })}
    </div>
  )
}

/** Placeholder lines while a drawer's record loads. */
export function DrawerSkeleton() {
  return (
    <div aria-hidden="true" className="admin-drawer-skeleton">
      {[72, 100, 56, 88, 64].map((width, i) => (
        <span key={i} className="admin-skeleton-bar" style={{ width: `${width}%` }} />
      ))}
    </div>
  )
}
