/**
 * Human messages for the ?error= codes the Google routes redirect with.
 * Client-safe (no server imports). Each message says what happened and
 * what to do next.
 */
const MESSAGES: Record<string, string> = {
  google_unavailable:
    'Google sign-in is not available right now. Use your email and password instead.',
  google_cancelled:
    'Google sign-in was cancelled. Choose a Google account to continue, or use your email instead.',
  google_state:
    'Your Google sign-in session expired or was opened in a different browser. Start again from this page.',
  google_failed:
    "We couldn't complete Google sign-in. Try again, or use your email and password.",
  google_unverified:
    "Your Google account's email address isn't verified with Google. Verify it with Google first, or sign up with your email.",
  google_conflict:
    'This email is already connected to a different Google account. Sign in with that Google account, or with your password.',
  google_in_use:
    'That Google account is already connected to another Alpha Gemstone account. Sign out and sign in with Google to use it.',
  google_rate_limited:
    'Too many sign-in attempts. Wait a few minutes and try again.',
  google_link_requires_login:
    'Your session ended before Google could be connected. Sign in again, then connect Google from your account page.',
};

export function googleAuthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? null;
}
