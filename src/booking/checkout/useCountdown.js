import { useEffect, useState } from 'react'

/**
 * Seconds until "Resend code" is offered again. One timeout per second rather
 * than an interval, so a countdown reset to 0 (a code that expired) stops at
 * once and nothing ticks on after the component is gone.
 */
export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft])
  return [secondsLeft, setSecondsLeft]
}

export default useCountdown
