import { useDutyStore } from '@/stores/dutyStore'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { parseDate } from '@/lib/utils'
import { ClipboardCheck, Check, X as XIcon } from 'lucide-react'
import StatusBadge from '@/components/UI/StatusBadge'

export default function ApprovalList() {
  const { t, tArray } = useI18n()
  const { duties, members, categories, updateApprovalStatus } = useDutyStore()
  const { isAdmin, isPlanner } = useTeamStore()
  const profile = useAuthStore((s) => s.profile)
  const addToast = useUiStore((s) => s.addToast)
  const months = tArray('months') as string[]

  const canDecide = profile ? (isAdmin(profile.id) || isPlanner(profile.id)) : false

  const pendingDuties = duties
    .filter((d) => d.approval_status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date))

  if (!canDecide || pendingDuties.length === 0) return null

  const handleApprove = async (dutyId: string) => {
    await updateApprovalStatus(dutyId, 'approved')
    addToast({ type: 'success', message: t('approvals.approve') + ' ✓' })
  }

  const handleReject = async (dutyId: string) => {
    await updateApprovalStatus(dutyId, 'rejected')
    addToast({ type: 'info', message: t('approvals.reject') + ' ✓' })
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck size={18} style={{ color: 'var(--vacation-text)' }} />
        <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
          {t('approvals.title')}
        </h3>
        <StatusBadge status={t('duty.approval.pending')} />
      </div>

      <div className="space-y-2">
        {pendingDuties.map((duty) => {
          const member = members.find((m) => m.id === duty.member_id)
          const category = categories.find((c) => c.id === duty.category_id)
          const d = parseDate(duty.date)
          const dateLabel = `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`

          return (
            <div key={duty.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: 'var(--surface-hover)' }}>
              <div className="flex items-center gap-3">
                {category && (
                  <span className="w-3 h-3 rounded" style={{ background: category.color }} />
                )}
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {member?.name || '?'} — {category?.name || '?'}
                  </span>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {dateLabel}
                    {duty.note && <span className="ml-2 italic">"{duty.note}"</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleApprove(duty.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                  title={t('approvals.approve')}
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => handleReject(duty.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                  title={t('approvals.reject')}
                >
                  <XIcon size={16} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
