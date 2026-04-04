/**
 * Error message mapper
 * Maps technical error codes to user-friendly i18n keys
 */

export function getErrorMessage(code: string, t: (key: string) => string): string {
  const errorMap: Record<string, string> = {
    CODENAME_TAKEN: 'auth.errors.codename_taken',
    SIGNUP_TRIGGER_FAILED: 'auth.errors.signup_trigger_failed',
    EMAIL_CONFIRM_REQUIRED: 'auth.errors.email_confirm_required',
    invalid_credentials: 'auth.errors.invalid_credentials',
    password_mismatch: 'auth.errors.password_mismatch',
    password_short: 'auth.errors.password_short',
    PARSE_ERROR: 'errors.parseError',
    INVALID_FORMAT: 'errors.invalidFormat',
    network_error: 'errors.network',
  }

  // Direct match
  if (errorMap[code]) return t(errorMap[code])

  // Partial match for Supabase error messages
  const lc = code.toLowerCase()
  if (lc.includes('already registered') || lc.includes('already been registered')) return t('auth.errors.codename_taken')
  if (lc.includes('invalid login') || lc.includes('invalid_credentials')) return t('auth.errors.invalid_credentials')
  if (lc.includes('database error')) return t('errors.database')
  if (lc.includes('fetch') || lc.includes('network') || lc.includes('failed to fetch')) return t('errors.network')
  if (lc.includes('email not confirmed')) return t('auth.errors.email_confirm_required')
  if (lc.includes('signups not allowed') || lc.includes('signup is disabled')) return t('auth.errors.signup_disabled')

  return t('errors.unknown')
}
