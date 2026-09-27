import { useEffect, useState } from 'react'

/**
 * The time, moved on once a minute.
 *
 * What a booking page shows turns on the clock — the Riyadh "today" a stay
 * may start from, whether a request has passed its deadline, whether a
 * service has started — and a page can stay open across midnight. Reading
 * Date.now() during render would also make the component impure, so the time
 * comes from state that a timer moves on.
 */
export function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default useMinuteClock
