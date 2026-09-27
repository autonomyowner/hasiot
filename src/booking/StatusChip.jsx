import { effectiveStatus, statusLabel, statusTone } from './status'

// One small monochrome mark per tone, so the chip reads without its colour.
const ICONS = {
  wait: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  ok: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  done: <path d="m8 12.5 3 3 5-6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  bad: <path d="M7 7l10 10M17 7 7 17" />,
}

/** A booking's status as the app's chip shows it; a lapsed request reads Expired. */
export default function StatusChip({ booking, lang, now }) {
  const status = effectiveStatus(booking, now)
  const tone = statusTone(status)
  return (
    <span className="bk-status" data-tone={tone}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[tone]}
      </svg>
      {statusLabel(status, booking.kind, lang)}
    </span>
  )
}
