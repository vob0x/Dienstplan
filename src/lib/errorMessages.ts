/**
 * Error message mapper
 * Maps technical error codes to user-friendly i18n keys
 */

export function getErrorMessage(code: string, t: (key: string) => string): string {
  const errorMap: Record<string, string> = {
    CODENAME_TAKEN: 'auth.errors.codename_taken',
    invalid_credentials: 'auth.errors.invalid_credentials',
    password_mismatch: 'auth.errors.password_mismatch',
    password_short: 'auth.errors.password_short',
    PARSE_ERROR: 'errors.parseError',
    INVALID_FORMAT: 'errors.invalidFormat',
    network_error: 'errors.network',
  }

  const key = errorMap[code] || 'errors.unknown'
  return t(key)
}
