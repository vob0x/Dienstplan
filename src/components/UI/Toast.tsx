import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const colors = {
  success: 'var(--success)',
  error: 'var(--danger)',
  info: 'var(--neon-cyan)',
  warning: 'var(--neon-amber)',
}

export default function ToastContainer() {
  const { t } = useI18n()
  const toasts = useUiStore((s) => s.toasts)
  const removeToast = useUiStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: '360px' }}>
      {toasts.map((toast) => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            className="toast-enter flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <Icon size={20} style={{ color: colors[toast.type], flexShrink: 0 }} />
            <span className="text-sm flex-1" style={{ color: 'var(--text)' }}>{toast.message}</span>
            <div className="flex items-center gap-2">
              {toast.undoAction && (
                <button
                  onClick={() => {
                    toast.undoAction?.()
                    removeToast(toast.id)
                  }}
                  className="text-xs font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{ color: '#0A0B0F', background: 'var(--neon-cyan)' }}
                  title={t('ui.undo')}
                >
                  {t('ui.undo')}
                </button>
              )}
              <button onClick={() => removeToast(toast.id)} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
