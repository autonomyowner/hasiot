import { useEffect, useState } from "react";
import { minuteNow } from "@/lib/bookingDisplay";

// Often enough that a booking's buttons change within a minute of its start.
const CLOCK_TICK_MS = 30_000;

/**
 * The clock to the minute, ticking while the screen is open.
 *
 * An inbox changes with the time as well as the data: a request leaves
 * Requests when it expires, and a booking's no-show and completed buttons
 * come with its start — moments that pass while someone is looking at the
 * list. Read once per render, the screen would wait for something else to
 * re-render it. Floored to the minute, so a tick that changes nothing renders
 * nothing (setState with an equal value bails out).
 *
 * Shared by the host and provider inboxes (it began in the provider's).
 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => minuteNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(minuteNow()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
