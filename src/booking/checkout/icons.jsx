// Monochrome line icons in the text colour (the design keeps every icon
// neutral), drawn for left-to-right; booking.css mirrors the back arrow in RTL.

const Svg = ({ children, width = 1.8 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {children}
  </svg>
)

export function CheckIcon() {
  return <Svg width={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
}

export function InfoIcon() {
  return <Svg><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></Svg>
}

export function BackIcon() {
  return <Svg width={2}><path d="M19 12H5m6-6-6 6 6 6" /></Svg>
}

export function PictureIcon() {
  return (
    <Svg width={1.5}>
      <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" />
    </Svg>
  )
}
