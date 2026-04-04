import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { getErrorMessage } from '@/lib/errorMessages'
import { Eye, EyeOff, Calendar } from 'lucide-react'

export default function LoginScreen() {
  const { t } = useI18n()
  const { signIn, signUp, error, clearError } = useAuthStore()
  const [isSignUp, setIsSignUp] = useState(false)
  const [codename, setCodename] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (isSignUp && password !== passwordConfirm) {
      useAuthStore.setState({ error: t('auth.errors.password_mismatch') })
      return
    }
    if (password.length < 6) {
      useAuthStore.setState({ error: t('auth.errors.password_short') })
      return
    }

    setSubmitting(true)
    try {
      if (isSignUp) {
        await signUp(codename.trim(), password)
      } else {
        await signIn(codename.trim(), password)
      }
    } catch {
      // Error already set in store
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animate-fade-in" style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(20px)',
        padding: '2rem',
      }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface-active)', border: '1px solid var(--border-hover)' }}>
            <Calendar size={32} style={{ color: 'var(--neon-cyan)' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
            {t('app.name')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('app.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Codename */}
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.codename')}
            </label>
            <input
              type="text"
              value={codename}
              onChange={(e) => setCodename(e.target.value)}
              placeholder={t('auth.codenamePlaceholder')}
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl outline-none transition-all"
              style={{
                background: 'var(--surface-solid)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: '0.95rem',
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t('auth.password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
                className="w-full px-4 py-2.5 pr-10 rounded-xl outline-none transition-all"
                style={{
                  background: 'var(--surface-solid)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign Up only) */}
          {isSignUp && (
            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.passwordConfirm')}
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                required
                className="w-full px-4 py-2.5 rounded-xl outline-none transition-all"
                style={{
                  background: 'var(--surface-solid)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '0.95rem',
                }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(212,112,110,0.1)', color: 'var(--danger)' }}>
              {getErrorMessage(error, t)}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold transition-all"
            style={{
              background: 'var(--neon-cyan)',
              color: '#0A0B0F',
              opacity: submitting ? 0.6 : 1,
              fontFamily: 'var(--font-display)',
            }}
          >
            {submitting ? t('ui.loading') : isSignUp ? t('auth.signUp') : t('auth.signIn')}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); clearError() }}
            className="font-semibold hover:underline"
            style={{ color: 'var(--neon-cyan)' }}
          >
            {isSignUp ? t('auth.signIn') : t('auth.signUp')}
          </button>
        </p>
      </div>
    </div>
  )
}
