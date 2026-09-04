import { useEffect, useRef } from 'react'

const BARS = 5

/**
 * The little level meter inside the pill.
 *
 * Bars are scaled directly on their DOM nodes from a rAF loop — putting the level in
 * React state would re-render the whole panel sixty times a second for five divs.
 */
export default function Waveform({ getLevel, active }) {
  const barsRef = useRef([])
  const getLevelRef = useRef(getLevel)
  const activeRef = useRef(active)
  getLevelRef.current = getLevel
  activeRef.current = active

  useEffect(() => {
    let raf = 0
    // Each bar lags the one before it, so the meter ripples instead of pumping.
    const held = new Array(BARS).fill(0)

    const frame = () => {
      const level = activeRef.current && getLevelRef.current ? getLevelRef.current() : 0
      for (let i = BARS - 1; i > 0; i--) held[i] += (held[i - 1] - held[i]) * 0.45
      held[0] += (level - held[0]) * 0.5

      for (let i = 0; i < BARS; i++) {
        const el = barsRef.current[i]
        if (!el) continue
        // Centre bars read taller, the way a real meter does.
        const weight = 1 - Math.abs(i - (BARS - 1) / 2) / BARS
        const s = 0.18 + held[i] * (0.5 + weight * 1.5)
        el.style.transform = `scaleY(${Math.min(1, s).toFixed(3)})`
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <span className="va-wave" aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <i key={i} ref={(el) => { barsRef.current[i] = el }} />
      ))}
    </span>
  )
}
