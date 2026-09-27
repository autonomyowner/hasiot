// Moved here from src/partners/pages/LoginPage.jsx so both sign-ins share it.
// The countdown a page runs and the ring that draws it must agree on the
// total, so the page imports this constant rather than keeping its own.
export const RESEND_SECONDS = 60

/** The resend countdown as a thin ring that empties, with the seconds beside it. */
export default function ResendRing({ seconds }) {
  const r = 8
  const c = 2 * Math.PI * r
  return (
    <svg className="p-ring" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r={r} className="p-ring-track" />
      <circle
        cx="10"
        cy="10"
        r={r}
        className="p-ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - seconds / RESEND_SECONDS)}
      />
    </svg>
  )
}
