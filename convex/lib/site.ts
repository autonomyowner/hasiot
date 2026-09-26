/**
 * The public website's address, for anything the backend sends people to:
 * links in emails, and where a failed sign-in lands.
 *
 * Not SITE_URL: that is Better Auth's base URL and still says hasio.xyz in
 * production, which only redirects. PUBLIC_SITE_URL overrides the default for
 * a staging copy of the site.
 */

type Env = Record<string, string | undefined>;

export function publicSiteUrl(env: Env = process.env): string {
  const configured = env.PUBLIC_SITE_URL?.trim();
  return (configured || "https://hasio.net").replace(/\/+$/, "");
}
