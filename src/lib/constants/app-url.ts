/**
 * The application's public origin.
 *
 * Email links (confirmation, password reset) need an absolute URL, and it must
 * come from configuration rather than the request's Host header: an attacker who
 * can set Host could otherwise redirect a real user's confirmation link to their
 * own domain and capture the token in it.
 *
 * Whatever this resolves to must also be listed in the Supabase dashboard under
 * Authentication → URL Configuration, or Supabase silently substitutes the
 * project's Site URL.
 */

/**
 * @throws If NEXT_PUBLIC_APP_URL is unset. Failing loudly beats interpolating
 * `undefined` into an email link that reaches a user as
 * "undefined/auth/callback" — a dead link with no obvious cause.
 */
export function getAppOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;

  if (!configured) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is not set. It is required to build absolute URLs ' +
        'for confirmation and password-reset emails. See .env.example.'
    );
  }

  // Trailing slashes would produce '//auth/callback' when concatenated.
  return configured.replace(/\/+$/, '');
}
