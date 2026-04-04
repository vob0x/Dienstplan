import { useState, useEffect } from 'react'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
import { parseDate } from '@/lib/utils'
import Modal from '@/components/UI/Modal'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { Trash2 } from 'lucide-react'

interface DutyPickerProps {
  open: boolean
  onClose: () => void
  memberId: string
  memberName: string
  date: string
}

export default function DutyPicker({ open, onClose, memberId, memberName, date }: DutyPickerProps) {
  const { t } = useI18n()
  const { categories, getDuty, setDuty, removeDuty } = useDutyStore()
  const existing = getDuty(memberId, date)
  const [note, setNote] = useState(existing?.note || '')
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Reset note when duty changes (e.g. switching between members/dates)
  useEffect(() => {
    setNote(existing?.note || '')
  }, [existing?.note])

  const d = parseDate(date)
  const dateLabel = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`

  const handleSelect = async (categoryId: string) => {
    await setDuty(memberId, date, categoryId, note || undefined)
    onClose()
  }

  const handleRemove = async () => {
    await removeDuty(memberId, date)
    setConfirmRemove(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`${t('duty.pick')} – ${memberName}`} size="sm">
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{dateLabel}</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleSelect(cat.id)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
            style={{
              background: existing?.category_id === cat.id ? `${cat.color}33` : 'var(--surface)',
              border: existing?.category_id === cat.id ? `2px solid ${cat.color}` : '1px solid var(--border)',
              color: cat.color,
            }}
          >
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: `${cat.color}22`, color: cat.color }}>
              {cat.letter}
            </span>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* Note input */}
      <div className="mb-4">
        <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{t('duty.note')}</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('duty.notePlaceholder')}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      {/* Remove button */}
      {existing && (
        <button
          onClick={() => setConfirmRemove(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'rgba(212,112,110,0.1)', color: 'var(--danger)', border: '1px solid rgba(212,112,110,0.2)' }}
        >
          <Trash2 size={16} />
          {t('duty.remove')}
        </button>
      )}

      <ConfirmDialog open={confirmRemove} onClose={() => setConfirmRemove(false)}
        onConfirm={handleRemove} title={t('duty.remove')} message={t('duty.confirmRemove')} danger />
    </Modal>
  )
}
