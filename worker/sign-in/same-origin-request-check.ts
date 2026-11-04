/**
 * A browser sends the sign-in cookie with requests that other websites start too, so the
 * Worker only accepts edits and WebSockets that this site's own page opened. The browser
 * says so in the Origin header, which a web page can't fake.
 */
export function isRequestFromOwnPage(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * True when the browser says another website started this request (the Sec-Fetch-Site
 * header). Tools such as curl don't send the header, so they aren't refused by this check.
 */
export function isRequestFromAnotherSite(request: Request): boolean {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return fetchSite !== null && fetchSite !== 'same-origin' && fetchSite !== 'none';
}
