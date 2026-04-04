import { useState } from 'react'
import { useDutyStore } from '@/stores/dutyStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import Modal from '@/components/UI/Modal'
import { parseSmartImport } from '@/lib/smartImportParser'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface SmartImportModalProps {
  open: boolean
  onClose: () => void
}

export default function SmartImportModal({ open, onClose }: SmartImportModalProps) {
  const { t } = useI18n()
  const { members, categories, duties, setDuty } = useDutyStore()
  const addToast = useUiStore((s) => s.addToast)

  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [textInput, setTextInput] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parseSmartImport>>([])
  const [showPreview, setShowPreview] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleParse = () => {
    const entries = parseSmartImport(textInput, categories)
    setParsed(entries)
    setShowPreview(true)
  }

  const handleImport = async () => {
    if (!selectedMemberId || parsed.length === 0) return

    setImporting(true)
    try {
      let imported = 0
      for (const entry of parsed) {
        for (const dateStr of entry.dates) {
          // Check for existing duty with same category
          const existing = duties.find(
            (d) => d.member_id === selectedMemberId && d.date === dateStr && d.category_id === entry.categoryId
          )
          if (!existing) {
            await setDuty(selectedMemberId, dateStr, entry.categoryId)
            imported++
          }
        }
      }

      addToast({
        type: 'success',
        message: `${t('import.importSuccess')}: ${imported} ${t('duty.pick')}`,
      })

      // Reset and close
      setTextInput('')
      setParsed([])
      setShowPreview(false)
      setSelectedMemberId('')
      onClose()
    } catch (error) {
      addToast({
        type: 'error',
        message: t('errors.unknown'),
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('import.smartImport')} size="lg">
      {!showPreview ? (
        <>
          {/* Member Selection */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('import.selectMember')}
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <option value="">{t('import.selectMember')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Text Input */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('import.preview')}
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t('import.textPlaceholder')}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: '120px' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              z.B. "Ferien 03.02.2026 - 15.03.2026" oder "Pikett 1. April bis 18. April"
            </p>
          </div>

          {/* Parse Button */}
          <div className="flex gap-2">
            <button
              onClick={handleParse}
              disabled={!selectedMemberId || !textInput.trim()}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: selectedMemberId && textInput.trim() ? 'var(--neon-cyan)' : 'var(--surface)',
                color: selectedMemberId && textInput.trim() ? '#0A0B0F' : 'var(--text-muted)',
                opacity: selectedMemberId && textInput.trim() ? 1 : 0.5,
              }}
            >
              {t('import.parse')}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              {t('ui.cancel')}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Preview */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
              {t('import.preview')} ({parsed.length})
            </h3>

            {parsed.length === 0 ? (
              <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'rgba(212,112,110,0.1)', border: '1px solid rgba(212,112,110,0.2)' }}>
                <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
                <span className="text-xs" style={{ color: 'var(--danger)' }}>
                  {t('import.noMatch')}
                </span>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {parsed.map((entry, idx) => {
                  const conflicts = entry.dates.filter((dateStr) =>
                    duties.some((d) => d.member_id === selectedMemberId && d.date === dateStr && d.category_id === entry.categoryId)
                  )

                  return (
                    <div key={idx} className="p-3 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 flex-1">
                          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                            {entry.categoryName}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {entry.startDate === entry.endDate
                              ? entry.startDate
                              : `${entry.startDate} – ${entry.endDate}`}
                          </span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--surface-solid)', color: 'var(--text-secondary)' }}>
                          {entry.dates.length} {t('duty.pick')}
                        </span>
                      </div>
                      {conflicts.length > 0 && (
                        <div className="mt-1 text-xs" style={{ color: 'var(--neon-amber)' }}>
                          {t('import.conflict')}: {conflicts.join(', ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={parsed.length === 0 || importing}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: parsed.length > 0 && !importing ? 'var(--neon-cyan)' : 'var(--surface)',
                color: parsed.length > 0 && !importing ? '#0A0B0F' : 'var(--text-muted)',
                opacity: parsed.length > 0 && !importing ? 1 : 0.5,
              }}
            >
              {importing ? t('ui.loading') : t('import.apply')}
            </button>
            <button
              onClick={() => {
                setShowPreview(false)
                setParsed([])
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              {t('ui.cancel')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
