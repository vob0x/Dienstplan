import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: '360px',
  md: '420px',
  lg: '520px',
}

export default function Modal({ open, onClose, title, children, maxWidth, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`
  const finalMaxWidth = maxWidth || sizeMap[size]

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', handler)
      return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
    }
    document.body.style.overflow = ''
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      role="none"
    >
      <div
        className="w-full animate-slide-in-up"
        style={{
          maxWidth: finalMaxWidth,
          background: 'var(--surface-elevated)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: 'min(92vh, 680px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 id={titleId} className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              aria-label="Close dialog">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-4" style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
