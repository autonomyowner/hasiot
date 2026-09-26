/**
 * Where an email about a booking sends its reader, and whether email is on.
 *
 * Push reaches only the app. Someone who booked on hasio.net, or a host who
 * answers requests from /partners, has no app to open — the email is how
 * they learn the answer, and its button is how they get back to the page that
 * acts on it. Pure, so the paths are tested without a deployment.
 */

type Env = Record<string, string | undefined>;

// Where the website is lives with the auth config's other uses of it.
export { publicSiteUrl } from "../lib/site";

/** Whether an email can actually be sent: the Resend key is what deliver.ts needs. */
export function emailDeliveryOn(env: Env = process.env): boolean {
  return typeof env.RESEND_API_KEY === "string" && env.RESEND_API_KEY.trim().length > 0;
}

type LinkedBooking = { _id: string; kind?: string; serviceId?: string; listingId?: string };

/**
 * The page an email about this booking opens: the traveller's trip, or the
 * inbox where the host or provider answers it. The inbox rather than the
 * booking because the portal's inbox is where the answer buttons are.
 */
export function bookingActionUrl(
  audience: "owner" | "tourist",
  booking: LinkedBooking,
  base: string
): string {
  if (audience === "tourist") return `${base}/trips/${booking._id}`;
  const isService = booking.kind === "service" || booking.serviceId !== undefined;
  return `${base}/partners/${isService ? "services" : "hotel"}/bookings`;
}
