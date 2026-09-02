/**
 * Turns a failed `fetch` call into one clear message for auth forms.
 *
 * Before this, `useAuth`'s login/signup/verifyOtp all did:
 *   const data = await res.json();
 *   if (!res.ok) throw new Error(data.message || 'Login failed');
 * Two problems:
 *   1. If the network request itself fails (offline, DNS, CORS, the API
 *      route throwing before it can respond) `fetch` rejects and `res` is
 *      never defined — the `catch` in the page component then shows the
 *      raw browser error (e.g. "Failed to fetch") instead of something a
 *      user can act on.
 *   2. If the server ever responds with something that isn't valid JSON
 *      (a proxy's HTML error page, a timeout page, etc.) `res.json()`
 *      itself throws, again surfacing a raw parse error.
 *
 * `runAuthRequest` wraps a fetch call and always throws a clean, human
 * `Error` with a message safe to show directly in the UI.
 */
export async function runAuthRequest<T>(
  input: RequestInfo,
  init: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error(
      "We couldn't reach the server. Check your internet connection and try again."
    );
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(
        `Something went wrong on our end (error ${res.status}). Please try again in a moment.`
      );
    }
    throw new Error('Unexpected response from the server. Please try again.');
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Something went wrong. Please try again.');
  }

  return data as T;
}