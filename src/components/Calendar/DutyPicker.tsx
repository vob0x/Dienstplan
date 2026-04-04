import { useState } from 'react'
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
  const { categories, getDuties, setDuty, removeDuty } = useDutyStore()
  const allDuties = getDuties(memberId, date)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const d = parseDate(date)
  const dateLabel = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`

  const handleSelect = async (categoryId: string) => {
    // Check if this category already exists
    const exists = allDuties.some((d) => d.category_id === categoryId)
    if (exists) {
      // Toggle off: remove it
      await removeDuty(memberId, date, categoryId)
    } else {
      // Toggle on: add it
      await setDuty(memberId, date, categoryId)
    }
  }

  const handleRemoveSpecific = async (dutyId: string) => {
    const duty = allDuties.find((d) => d.id === dutyId)
    if (duty) {
      await removeDuty(memberId, date, duty.category_id)
      setConfirmRemoveId(null)
    }
  }

  const handleRemoveAll = async () => {
    await removeDuty(memberId, date)
    setConfirmRemoveId(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`${t('duty.pick')} – ${memberName}`} size="sm">
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{dateLabel}</p>

      {/* Show existing duties */}
      {allDuties.length > 0 && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>{t('duty.multipleHint')}</p>
          <div className="space-y-1">
            {allDuties.map((duty) => {
              const cat = categories.find((c) => c.id === duty.category_id)
              return (
                <div key={duty.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 flex-1">
                    {cat && (
                      <>
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${cat.color}22`, color: cat.color }}>
                          {cat.letter}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text)' }}>{cat.name}</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmRemoveId(duty.id)}
                    className="p-0.5 rounded transition-colors"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Category grid to toggle */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {categories.map((cat) => {
          const hasCategory = allDuties.some((d) => d.category_id === cat.id)
          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={{
                background: hasCategory ? `${cat.color}33` : 'var(--surface)',
                border: hasCategory ? `2px solid ${cat.color}` : '1px solid var(--border)',
                color: cat.color,
              }}
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: `${cat.color}22`, color: cat.color }}>
                {cat.letter}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{cat.name}</span>
            </button>
          )
        })}
      </div>

      {/* Remove all button */}
      {allDuties.length > 0 && (
        <button
          onClick={() => setConfirmRemoveId('all')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'rgba(212,112,110,0.1)', color: 'var(--danger)', border: '1px solid rgba(212,112,110,0.2)' }}
        >
          <Trash2 size={16} />
          {t('duty.remove')}
        </button>
      )}

      <ConfirmDialog
        open={!!confirmRemoveId}
        onClose={() => setConfirmRemoveId(null)}
        onConfirm={() => {
          if (confirmRemoveId === 'all') {
            handleRemoveAll()
          } else if (confirmRemoveId) {
            handleRemoveSpecific(confirmRemoveId)
          }
        }}
        title={t('duty.remove')}
        message={t('duty.confirmRemove')}
        danger
      />
    </Modal>
  )
}
