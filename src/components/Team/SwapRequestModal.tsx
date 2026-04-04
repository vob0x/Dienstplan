import { useState, useMemo } from 'react'
import { useSwapStore } from '@/stores/swapStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useTeamStore } from '@/stores/teamStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { toDateStr } from '@/lib/utils'
import Modal from '@/components/UI/Modal'

interface SwapRequestModalProps {
  open: boolean
  onClose: () => void
}

export default function SwapRequestModal({ open, onClose }: SwapRequestModalProps) {
  const { t } = useI18n()
  const { requestSwap } = useSwapStore()
  const { members: dpMembers, getDuty } = useDutyStore()
  const team = useTeamStore((s) => s.team)
  const addToast = useUiStore((s) => s.addToast)

  const [requesterMemberId, setRequesterMemberId] = useState('')
  const [targetMemberId, setTargetMemberId] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeMembers = dpMembers.filter((m) => m.is_active)

  // Calculate date constraints
  const today = new Date()
  const minDate = toDateStr(today)
  const maxDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
  const maxDateStr = toDateStr(maxDate)

  // Find requester's duty on the target date
  const requesterDuty = useMemo(() => {
    if (!requesterMemberId || !targetDate) return null
    return getDuty(requesterMemberId, targetDate)
  }, [requesterMemberId, targetDate, getDuty])

  // Find target's duty on the target date
  const targetDuty = useMemo(() => {
    if (!targetMemberId || !targetDate) return null
    return getDuty(targetMemberId, targetDate)
  }, [targetMemberId, targetDate, getDuty])

  const canSubmit = requesterMemberId && targetMemberId && targetDate && requesterMemberId !== targetMemberId

  const handleSubmit = async () => {
    if (!canSubmit || !team) return

    setSubmitting(true)
    try {
      await requestSwap({
        team_id: team.id,
        requester_member_id: requesterMemberId,
        target_member_id: targetMemberId,
        requester_duty_id: requesterDuty?.id || '',
        target_duty_id: targetDuty?.id || null,
        target_date: targetDate,
        status: 'pending',
        requester_note: note || null,
        responder_note: null,
        admin_note: null,
      })

      addToast({ type: 'success', message: t('swaps.request') + ' ✓' })
      onClose()
      // Reset form
      setRequesterMemberId('')
      setTargetMemberId('')
      setTargetDate('')
      setNote('')
    } catch {
      addToast({ type: 'error', message: t('swaps.createError') })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('swaps.request')} size="md">
      <div className="space-y-4">
        {/* Requester */}
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('members.title')} ({t('swaps.requestFrom')})
          </label>
          <select
            value={requesterMemberId}
            onChange={(e) => setRequesterMemberId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="">— {t('members.title')} —</option>
            {activeMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Target member */}
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('members.title')} ({t('swaps.swapWith')})
          </label>
          <select
            value={targetMemberId}
            onChange={(e) => setTargetMemberId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="">— {t('members.title')} —</option>
            {activeMembers.filter((m) => m.id !== requesterMemberId).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Target date */}
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('swaps.date')}
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            min={minDate}
            max={maxDateStr}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        {/* Preview duties on selected date */}
        {targetDate && requesterMemberId && targetMemberId && (
          <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: 'var(--surface-active)' }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              {activeMembers.find((m) => m.id === requesterMemberId)?.name}:
              <span className="font-bold ml-1" style={{ color: requesterDuty ? 'var(--text)' : 'var(--text-muted)' }}>
                {requesterDuty ? useDutyStore.getState().categories.find((c) => c.id === requesterDuty.category_id)?.name || '?' : '—'}
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              {activeMembers.find((m) => m.id === targetMemberId)?.name}:
              <span className="font-bold ml-1" style={{ color: targetDuty ? 'var(--text)' : 'var(--text-muted)' }}>
                {targetDuty ? useDutyStore.getState().categories.find((c) => c.id === targetDuty.category_id)?.name || '?' : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('duty.note')}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('duty.notePlaceholder')}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{
            background: canSubmit ? 'var(--neon-cyan)' : 'var(--surface)',
            color: canSubmit ? '#0A0B0F' : 'var(--text-muted)',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? t('ui.loading') : t('swaps.request')}
        </button>
      </div>
    </Modal>
  )
}
