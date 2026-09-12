/**
 * The text a Convex mutation actually sent us.
 *
 * A production deployment redacts the message of a plain `Error` to "Server
 * Error" — deliberately, so an unexpected exception cannot leak internals to a
 * client. Only a `ConvexError`'s payload crosses that line, and it arrives on
 * `data` rather than `message`. Every user-facing throw in `convex/bookings`
 * and `convex/listings` is a ConvexError for exactly this reason; reading only
 * `message` is how a carefully worded reason became "please try again".
 */
export function serverErrorText(error: unknown): string {
  const data = (error as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}
