import { useMemo, useState } from 'react'
import { useDutyStore } from '@/stores/dutyStore'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { parseDate } from '@/lib/utils'
import { ClipboardCheck, Check, X as XIcon, AlertTriangle, CheckCheck, XCircle } from 'lucide-react'
import StatusBadge from '@/components/UI/StatusBadge'
import type { DpDuty } from '@/types'

interface DutyGroup {
  key: string
  memberId: string
  memberName: string
  categoryId: string
  categoryName: string
  categoryColor: string
  duties: DpDuty[]
  dateRange: string       // "3.–14. April 2026"
  hasConflicts: boolean
}

export default function ApprovalList() {
  const { t, tArray } = useI18n()
  const { duties, members, categories, updateApprovalStatus } = useDutyStore()
  const { isAdmin, isPlanner } = useTeamStore()
  const profile = useAuthStore((s) => s.profile)
  const addToast = useUiStore((s) => s.addToast)
  const months = tArray('months') as string[]
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  const canDecide = profile ? (isAdmin(profile.id) || isPlanner(profile.id)) : false

  const pendingDuties = useMemo(() =>
    duties
      .filter((d) => d.approval_status === 'pending')
      .sort((a, b) => a.date.localeCompare(b.date)),
    [duties]
  )

  // Build conflict map for each duty
  const conflictMap = useMemo(() => {
    const map: Record<string, { label: string; isPending: boolean }[]> = {}

    for (const pending of pendingDuties) {
      const conflicts: { label: string; isPending: boolean }[] = []

      // Same date + same category + different member
      const sameDateCat = duties.filter(
        (d) =>
          d.id !== pending.id &&
          d.date === pending.date &&
          d.category_id === pending.category_id &&
          d.member_id !== pending.member_id &&
          d.approval_status !== 'rejected'
      )
      for (const other of sameDateCat) {
        const m = members.find((x) => x.id === other.member_id)
        if (!m || !m.is_active) continue
        conflicts.push({
          label: m.name,
          isPending: other.approval_status === 'pending',
        })
      }

      // Same date + same member + different category (double-booking)
      const sameDateMember = duties.filter(
        (d) =>
          d.id !== pending.id &&
          d.date === pending.date &&
          d.member_id === pending.member_id &&
          d.category_id !== pending.category_id &&
          d.approval_status !== 'rejected' &&
          d.approval_status !== 'none'
      )
      for (const other of sameDateMember) {
        const cat = categories.find((c) => c.id === other.category_id)
        if (cat) {
          conflicts.push({
            label: `${t('approvals.alsoBooked')}: ${cat.name}`,
            isPending: other.approval_status === 'pending',
          })
        }
      }

      if (conflicts.length > 0) map[pending.id] = conflicts
    }
    return map
  }, [pendingDuties, duties, members, categories, t])

  // Group pending duties by member+category for batch processing
  const groups = useMemo((): DutyGroup[] => {
    const groupMap = new Map<string, DpDuty[]>()

    for (const d of pendingDuties) {
      const key = `${d.member_id}::${d.category_id}`
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(d)
    }

    return Array.from(groupMap.entries()).map(([key, groupDuties]) => {
      const first = groupDuties[0]
      const member = members.find((m) => m.id === first.member_id)
      const category = categories.find((c) => c.id === first.category_id)

      // Build date range label
      const sorted = [...groupDuties].sort((a, b) => a.date.localeCompare(b.date))
      const firstDate = parseDate(sorted[0].date)
      const lastDate = parseDate(sorted[sorted.length - 1].date)
      let dateRange: string

      if (sorted.length === 1) {
        dateRange = `${firstDate.getDate()}. ${months[firstDate.getMonth()]} ${firstDate.getFullYear()}`
      } else if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
        dateRange = `${firstDate.getDate()}.–${lastDate.getDate()}. ${months[firstDate.getMonth()]} ${firstDate.getFullYear()}`
      } else {
        dateRange = `${firstDate.getDate()}. ${months[firstDate.getMonth()]} – ${lastDate.getDate()}. ${months[lastDate.getMonth()]} ${lastDate.getFullYear()}`
      }

      const hasConflicts = groupDuties.some((d) => !!conflictMap[d.id])

      return {
        key,
        memberId: first.member_id,
        memberName: member?.name || '?',
        categoryId: first.category_id,
        categoryName: category?.name || '?',
        categoryColor: category?.color || '#888',
        duties: sorted,
        dateRange,
        hasConflicts,
      }
    })
  }, [pendingDuties, members, categories, months, conflictMap])

  if (!canDecide || pendingDuties.length === 0) return null

  // Single duty approve/reject
  const handleApprove = async (dutyId: string) => {
    setProcessing((s) => new Set(s).add(dutyId))
    await updateApprovalStatus(dutyId, 'approved')
    setProcessing((s) => { const n = new Set(s); n.delete(dutyId); return n })
    addToast({ type: 'success', message: t('approvals.approve') + ' ✓' })
  }

  const handleReject = async (dutyId: string) => {
    setProcessing((s) => new Set(s).add(dutyId))
    await updateApprovalStatus(dutyId, 'rejected')
    setProcessing((s) => { const n = new Set(s); n.delete(dutyId); return n })
    addToast({ type: 'info', message: t('approvals.reject') + ' ✓' })
  }

  // Batch approve/reject all duties in a group
  const handleBatchApprove = async (group: DutyGroup) => {
    const ids = group.duties.map((d) => d.id)
    setProcessing((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n })
    for (const id of ids) {
      await updateApprovalStatus(id, 'approved')
    }
    setProcessing((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n })
    addToast({ type: 'success', message: `${ids.length}× ${t('approvals.approve')} ✓` })
  }

  const handleBatchReject = async (group: DutyGroup) => {
    const ids = group.duties.map((d) => d.id)
    setProcessing((s) => { const n = new Set(s); ids.forEach((id) => n.add(id)); return n })
    for (const id of ids) {
      await updateApprovalStatus(id, 'rejected')
    }
    setProcessing((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n })
    addToast({ type: 'info', message: `${ids.length}× ${t('approvals.reject')} ✓` })
  }

  const formatSingleDate = (dateStr: string) => {
    const d = parseDate(dateStr)
    return `${d.getDate()}.${d.getMonth() + 1}.`
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck size={18} style={{ color: 'var(--vacation-text)' }} />
        <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
          {t('approvals.title')}
        </h3>
        <StatusBadge status={`${pendingDuties.length} ${t('approvals.pendingCount')}`} />
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const isBatch = group.duties.length > 1
          const allProcessing = group.duties.every((d) => processing.has(d.id))

          return (
            <div key={group.key} className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--surface-hover)',
                border: group.hasConflicts ? '1px solid var(--danger)' : '1px solid transparent',
              }}>

              {/* Group header with batch actions */}
              <div className="flex items-center justify-between py-2.5 px-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-3 h-3 rounded flex-shrink-0" style={{ background: group.categoryColor }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {group.memberName} — {group.categoryName}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {group.dateRange}
                      {isBatch && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono"
                          style={{ background: 'rgba(184,168,224,0.12)', color: 'var(--neon-violet)' }}>
                          {group.duties.length} {t('approvals.pendingCount')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Batch buttons for groups with 2+ entries, single buttons otherwise */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isBatch ? (
                    <>
                      <button
                        onClick={() => handleBatchApprove(group)}
                        disabled={allProcessing}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                        style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                        title={t('approvals.approveAll')}
                      >
                        <CheckCheck size={14} />
                        {t('approvals.approveAll')}
                      </button>
                      <button
                        onClick={() => handleBatchReject(group)}
                        disabled={allProcessing}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                        style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                        title={t('approvals.rejectAll')}
                      >
                        <XCircle size={14} />
                        {t('approvals.rejectAll')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(group.duties[0].id)}
                        disabled={processing.has(group.duties[0].id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                        title={t('approvals.approve')}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleReject(group.duties[0].id)}
                        disabled={processing.has(group.duties[0].id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                        title={t('approvals.reject')}
                      >
                        <XIcon size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded day list for batch groups — with individual approve/reject */}
              {isBatch && (
                <div className="px-3 pb-2 space-y-0.5">
                  {group.duties.map((duty) => {
                    const conflicts = conflictMap[duty.id]
                    const hasConflict = conflicts && conflicts.length > 0

                    return (
                      <div key={duty.id} className="flex items-center justify-between py-1 px-2 rounded-md text-xs"
                        style={{
                          background: hasConflict ? 'rgba(212,112,110,0.06)' : 'transparent',
                          color: 'var(--text-secondary)',
                        }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono w-10 flex-shrink-0">{formatSingleDate(duty.date)}</span>
                          {duty.note && <span className="italic truncate" style={{ color: 'var(--text-muted)' }}>"{duty.note}"</span>}
                          {hasConflict && (
                            <span className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--danger)' }}>
                              <AlertTriangle size={10} />
                              {conflicts.map((c) => c.label).join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => handleApprove(duty.id)} disabled={processing.has(duty.id)}
                            className="p-1 rounded transition-opacity hover:opacity-100 opacity-50"
                            style={{ color: '#6EC49E' }} title={t('approvals.approve')}>
                            <Check size={12} />
                          </button>
                          <button onClick={() => handleReject(duty.id)} disabled={processing.has(duty.id)}
                            className="p-1 rounded transition-opacity hover:opacity-100 opacity-50"
                            style={{ color: 'var(--danger)' }} title={t('approvals.reject')}>
                            <XIcon size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Conflict warning for single entries */}
              {!isBatch && conflictMap[group.duties[0].id] && (
                <div className="px-3 pb-2 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                  <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
                    <span className="font-semibold">{t('approvals.conflict')}:</span>{' '}
                    {conflictMap[group.duties[0].id].map((c, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        {c.label}
                        {c.isPending && <span className="opacity-70"> ({t('duty.approval.pending')})</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
