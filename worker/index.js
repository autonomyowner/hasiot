/**
 * hasio.net's Worker. Static files are served by the assets binding as before;
 * only `/api/auth/*` runs this code (`run_worker_first` in wrangler.jsonc).
 *
 * Why sign-in goes through hasio.net rather than straight to the Convex site:
 * a session cookie set by `…convex.site` is, to a page on hasio.net, a
 * third-party cookie — and Safari, Brave, Firefox and Chrome with third-party
 * cookies blocked drop it. The owner's first Google sign-in on production
 * (2026-09-26) created the account and then landed back on the sign-in page
 * for exactly that reason. Proxied here, every auth cookie belongs to
 * hasio.net itself, and Google's consent screen names hasio.net instead of
 * the backend's machine name.
 *
 * The proxy is transparent: method, headers and body pass through, redirects
 * are handed to the browser rather than followed (the OAuth flow is made of
 * them), and every Set-Cookie comes back as the backend wrote it — with no
 * Domain attribute, so the browser files it under hasio.net.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/auth/")) return env.ASSETS.fetch(request);

    const target = new URL(url.pathname + url.search, env.CONVEX_SITE_URL);
    const headers = new Headers(request.headers);
    headers.delete("host");
    // Better Auth reads the client's IP from x-forwarded-for; without this
    // every visitor would look like this Worker.
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
    });
    // A fresh Response so the headers are mutable-safe and nothing is cached
    // by accident: auth answers are per person.
    // A failed OAuth return is a redirect carrying `error=<code>`, and Better
    // Auth logs nothing for most of them (a missing state cookie, say). Log
    // the code — only the code: the rest of the URL can hold a session.
    if (url.pathname.startsWith("/api/auth/callback/")) {
      const location = response.headers.get("location") ?? "";
      const code = location.match(/[?&]error=([^&#]*)/)?.[1];
      console.log(
        JSON.stringify({ oauthCallback: url.pathname, status: response.status, error: code ?? null })
      );
    }
    const out = new Response(response.body, response);
    out.headers.set("cache-control", "no-store");
    return out;
  },
};
