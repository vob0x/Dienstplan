import Modal from './Modal'
import { useI18n } from '@/i18n'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  danger?: boolean
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }: ConfirmDialogProps) {
  const { t } = useI18n()

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="400px">
      <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          {t('ui.cancel')}
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={{
            background: danger ? 'var(--danger)' : 'var(--neon-cyan)',
            color: danger ? '#fff' : '#0A0B0F',
          }}
        >
          {t('ui.confirm')}
        </button>
      </div>
    </Modal>
  )
}
