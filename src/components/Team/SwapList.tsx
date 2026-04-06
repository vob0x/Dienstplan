import { useState, useMemo } from 'react'
import { useSwapStore } from '@/stores/swapStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { usePermissions } from '@/lib/permissions'
import { parseDate } from '@/lib/utils'
import {
  ArrowRightLeft, Check, X as XIcon, Ban, Plus, Trash2,
  Inbox, Send, ShieldCheck, ArrowDownRight, Eye, Layers,
} from 'lucide-react'
import SwapRequestModal from './SwapRequestModal'
import type { DpShiftSwap, SwapStatus } from '@/types'

// ---------------------------------------------------------------------------
// Group helper: groups swaps that share a swap_group_id
// ---------------------------------------------------------------------------
interface SwapGroup {
  groupId: string | null
  swaps: DpShiftSwap[]
}

function groupSwaps(swaps: DpShiftSwap[]): SwapGroup[] {
  const grouped = new Map<string, DpShiftSwap[]>()
  const ungrouped: DpShiftSwap[] = []

  for (const s of swaps) {
    if (s.swap_group_id) {
      const list = grouped.get(s.swap_group_id) || []
      list.push(s)
      grouped.set(s.swap_group_id, list)
    } else {
      ungrouped.push(s)
    }
  }

  const result: SwapGroup[] = []
  for (const [groupId, list] of grouped) {
    result.push({ groupId, swaps: list.sort((a, b) => a.target_date.localeCompare(b.target_date)) })
  }
  // Ungrouped swaps: each is its own "group" of 1
  for (const s of ungrouped) {
    result.push({ groupId: null, swaps: [s] })
  }

  return result
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SwapList() {
  const { t, tArray } = useI18n()
  const {
    swaps, respondToSwap, approveSwap, cancelSwap, deleteSwap,
    respondToGroup, approveGroup, cancelGroup,
  } = useSwapStore()
  const { members, categories } = useDutyStore()
  const profile = useAuthStore((s) => s.profile)
  const addToast = useUiStore((s) => s.addToast)
  const { isPlanner } = usePermissions()
  const months = tArray('months') as string[]
  const [requestOpen, setRequestOpen] = useState(false)

  // Find my dp_member
  const myMemberId = useMemo(() => {
    if (!profile) return null
    return members.find((m) => m.user_id === profile.id)?.id || null
  }, [members, profile])

  // Categorize swaps
  const { incoming, outgoing, pendingApproval, allOpen, history } = useMemo(() => {
    const incoming: DpShiftSwap[] = []
    const outgoing: DpShiftSwap[] = []
    const pendingApproval: DpShiftSwap[] = []
    const allOpen: DpShiftSwap[] = []
    const history: DpShiftSwap[] = []

    for (const s of swaps) {
      const isTerminal = ['approved', 'rejected_responder', 'rejected_approval', 'cancelled'].includes(s.status)

      if (isTerminal) {
        history.push(s)
        continue
      }

      if (s.status === 'pending_responder' && s.target_member_id === myMemberId) {
        incoming.push(s)
      }

      if (s.status === 'pending_responder' && s.requester_member_id === myMemberId) {
        outgoing.push(s)
      }

      if ((s.status === 'accepted' || s.status === 'pending_approval') && isPlanner) {
        pendingApproval.push(s)
      }

      if ((s.status === 'accepted' || s.status === 'pending_approval') && s.requester_member_id === myMemberId && !isPlanner) {
        outgoing.push(s)
      }

      if (isPlanner) {
        allOpen.push(s)
      }
    }

    const shownIds = new Set([
      ...incoming.map((s) => s.id),
      ...outgoing.map((s) => s.id),
      ...pendingApproval.map((s) => s.id),
    ])
    const overview = allOpen.filter((s) => !shownIds.has(s.id))

    return { incoming, outgoing, pendingApproval, allOpen: overview, history: history.slice(0, 10) }
  }, [swaps, myMemberId, isPlanner])

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name || '?'
  const getCat = (catId: string | null) => catId ? categories.find((c) => c.id === catId) : null
  const formatDate = (dateStr: string) => {
    const d = parseDate(dateStr)
    return `${d.getDate()}. ${months[d.getMonth()]}`
  }

  const statusColor = (status: SwapStatus): string => {
    switch (status) {
      case 'pending_responder': return 'var(--neon-violet)'
      case 'accepted':
      case 'pending_approval': return '#E8A838'
      case 'approved': return '#6EC49E'
      case 'rejected_responder':
      case 'rejected_approval': return 'var(--danger)'
      case 'cancelled': return 'var(--text-muted)'
    }
  }

  const statusLabel = (status: SwapStatus): string => {
    const map: Record<SwapStatus, string> = {
      pending_responder: t('swaps.status.pendingResponder'),
      accepted: t('swaps.status.accepted'),
      pending_approval: t('swaps.status.pendingApproval'),
      approved: t('swaps.status.approved'),
      rejected_responder: t('swaps.status.rejectedResponder'),
      rejected_approval: t('swaps.status.rejectedApproval'),
      cancelled: t('swaps.status.cancelled'),
    }
    return map[status] || status
  }

  // ---------------------------------------------------------------------------
  // Single swap card
  // ---------------------------------------------------------------------------
  const SwapCard = ({ swap, actions }: { swap: DpShiftSwap; actions?: React.ReactNode }) => {
    const reqCat = getCat(swap.requester_category_id)
    const tgtCat = getCat(swap.target_category_id)
    const isReassignment = swap.swap_type === 'reassignment'

    return (
      <div className="py-2.5 px-3 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text)' }}>
              <span>{getMemberName(swap.requester_member_id)}</span>
              {reqCat && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: `${reqCat.color}22`, color: reqCat.color }}>
                  {reqCat.letter}
                </span>
              )}
              {isReassignment
                ? <ArrowDownRight size={14} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                : <ArrowRightLeft size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <span>{getMemberName(swap.target_member_id)}</span>
              {tgtCat && !isReassignment && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: `${tgtCat.color}22`, color: tgtCat.color }}>
                  {tgtCat.letter}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(swap.target_date)}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${statusColor(swap.status)}18`, color: statusColor(swap.status) }}>
                {statusLabel(swap.status)}
              </span>
            </div>
            {swap.requester_note && (
              <div className="text-[10px] mt-1 italic" style={{ color: 'var(--text-muted)' }}>
                &quot;{swap.requester_note}&quot;
              </div>
            )}
            {swap.responder_note && (
              <div className="text-[10px] mt-0.5 italic" style={{ color: 'var(--text-muted)' }}>
                ↳ &quot;{swap.responder_note}&quot;
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Group card: shows multiple dates in one card with batch actions
  // ---------------------------------------------------------------------------
  const GroupCard = ({ group, actions }: { group: SwapGroup; actions?: React.ReactNode }) => {
    const first = group.swaps[0]
    const reqCat = getCat(first.requester_category_id)
    const tgtCat = getCat(first.target_category_id)
    const isReassignment = first.swap_type === 'reassignment'

    // Show the "most relevant" status: earliest in the lifecycle
    const statusPriority: SwapStatus[] = ['pending_responder', 'accepted', 'pending_approval', 'approved', 'rejected_responder', 'rejected_approval', 'cancelled']
    const groupStatus = group.swaps.reduce<SwapStatus>((best, sw) => {
      return statusPriority.indexOf(sw.status) < statusPriority.indexOf(best) ? sw.status : best
    }, group.swaps[0].status)

    // Check if statuses are mixed
    const hasMultipleStatuses = new Set(group.swaps.map((s) => s.status)).size > 1

    return (
      <div className="py-2.5 px-3 rounded-lg" style={{ background: 'var(--surface-hover)', border: '1px solid rgba(184,168,224,0.2)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Group badge */}
            <div className="flex items-center gap-1.5 mb-1">
              <Layers size={12} style={{ color: 'var(--neon-violet)' }} />
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(184,168,224,0.15)', color: 'var(--neon-violet)' }}>
                {group.swaps.length}× {t('swaps.groupedSwap')}
              </span>
            </div>

            {/* Members + categories */}
            <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text)' }}>
              <span>{getMemberName(first.requester_member_id)}</span>
              {reqCat && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: `${reqCat.color}22`, color: reqCat.color }}>
                  {reqCat.letter}
                </span>
              )}
              {isReassignment
                ? <ArrowDownRight size={14} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
                : <ArrowRightLeft size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <span>{getMemberName(first.target_member_id)}</span>
              {tgtCat && !isReassignment && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: `${tgtCat.color}22`, color: tgtCat.color }}>
                  {tgtCat.letter}
                </span>
              )}
            </div>

            {/* Date list with per-date status if mixed */}
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {group.swaps.map((sw) => (
                <span key={sw.id} className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: hasMultipleStatuses ? `${statusColor(sw.status)}12` : 'var(--surface)',
                    color: hasMultipleStatuses ? statusColor(sw.status) : 'var(--text-muted)',
                  }}>
                  {formatDate(sw.target_date)}
                </span>
              ))}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${statusColor(groupStatus)}18`, color: statusColor(groupStatus) }}>
                {statusLabel(groupStatus)}
              </span>
            </div>

            {first.requester_note && (
              <div className="text-[10px] mt-1 italic" style={{ color: 'var(--text-muted)' }}>
                &quot;{first.requester_note}&quot;
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-1 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render a swap group (grouped or single)
  // ---------------------------------------------------------------------------
  const renderSwapItem = (
    group: SwapGroup,
    makeActions: (swap: DpShiftSwap, groupId: string | null) => React.ReactNode,
  ) => {
    if (group.groupId && group.swaps.length > 1) {
      return (
        <GroupCard key={group.groupId} group={group}
          actions={makeActions(group.swaps[0], group.groupId)} />
      )
    }
    // Single swap
    const swap = group.swaps[0]
    return <SwapCard key={swap.id} swap={swap} actions={makeActions(swap, null)} />
  }

  // Group helpers for each section
  const incomingGroups = useMemo(() => groupSwaps(incoming), [incoming])
  const outgoingGroups = useMemo(() => groupSwaps(outgoing), [outgoing])
  const pendingApprovalGroups = useMemo(() => groupSwaps(pendingApproval), [pendingApproval])
  const allOpenGroups = useMemo(() => groupSwaps(allOpen), [allOpen])
  const historyGroups = useMemo(() => groupSwaps(history), [history])

  const totalActive = incoming.length + outgoing.length + pendingApproval.length + allOpen.length

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={18} style={{ color: 'var(--neon-violet)' }} />
          <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
            {t('swaps.title')}
          </h3>
          {totalActive > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(184,168,224,0.15)', color: 'var(--neon-violet)' }}>
              {totalActive}
            </span>
          )}
        </div>
        <button onClick={() => setRequestOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
          style={{ background: 'var(--surface-active)', color: 'var(--neon-violet)' }}>
          <Plus size={14} /> {t('swaps.request')}
        </button>
      </div>

      <SwapRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />

      {totalActive === 0 && history.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('swaps.noSwaps')}</p>
      )}

      <div className="space-y-4">
        {/* INCOMING */}
        {incomingGroups.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Inbox size={14} style={{ color: 'var(--neon-violet)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('swaps.incoming')} ({incoming.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {incomingGroups.map((g) => renderSwapItem(g, (_swap, groupId) => (
                <>
                  <button onClick={() => {
                    if (groupId) { respondToGroup(groupId, true); }
                    else { respondToSwap(_swap.id, true) }
                    addToast({ type: 'success', message: t('swaps.accepted') })
                  }}
                    className="p-1.5 rounded-lg" style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                    title={t('swaps.accept')}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => {
                    if (groupId) { respondToGroup(groupId, false) }
                    else { respondToSwap(_swap.id, false) }
                    addToast({ type: 'info', message: t('swaps.rejected') })
                  }}
                    className="p-1.5 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                    title={t('swaps.reject')}>
                    <XIcon size={14} />
                  </button>
                </>
              )))}
            </div>
          </div>
        )}

        {/* OUTGOING */}
        {outgoingGroups.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Send size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('swaps.outgoing')} ({outgoing.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {outgoingGroups.map((g) => renderSwapItem(g, (_swap, groupId) => {
                const canCancel = g.swaps.some((s) => s.status === 'pending_responder')
                if (!canCancel) return null
                return (
                  <button onClick={() => {
                    if (groupId) { cancelGroup(groupId) }
                    else { cancelSwap(_swap.id) }
                    addToast({ type: 'info', message: t('swaps.cancelled') })
                  }}
                    className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}
                    title={t('swaps.cancel')}>
                    <Ban size={14} />
                  </button>
                )
              }))}
            </div>
          </div>
        )}

        {/* APPROVAL QUEUE */}
        {pendingApprovalGroups.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck size={14} style={{ color: '#E8A838' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('swaps.approvalQueue')} ({pendingApproval.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {pendingApprovalGroups.map((g) => renderSwapItem(g, (_swap, groupId) => (
                <>
                  <button onClick={() => {
                    if (!profile) return
                    if (groupId) { approveGroup(groupId, true, profile.id) }
                    else { approveSwap(_swap.id, true, profile.id) }
                    addToast({ type: 'success', message: t('swaps.approvedMsg') })
                  }}
                    className="p-1.5 rounded-lg" style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                    title={t('swaps.approve')}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => {
                    if (!profile) return
                    if (groupId) { approveGroup(groupId, false, profile.id) }
                    else { approveSwap(_swap.id, false, profile.id) }
                    addToast({ type: 'info', message: t('swaps.rejectedApprovalMsg') })
                  }}
                    className="p-1.5 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                    title={t('swaps.reject')}>
                    <XIcon size={14} />
                  </button>
                </>
              )))}
            </div>
          </div>
        )}

        {/* ALL OPEN */}
        {allOpenGroups.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Eye size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('swaps.overview')} ({allOpen.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {allOpenGroups.map((g) => renderSwapItem(g, () => null))}
            </div>
          </div>
        )}

        {/* HISTORY */}
        {historyGroups.length > 0 && (
          <div>
            <div className="text-[10px] font-mono mt-2 mb-1.5" style={{ color: 'var(--text-muted)' }}>
              ─── {t('swaps.history')} ───
            </div>
            <div className="space-y-1 opacity-60">
              {historyGroups.map((g) => renderSwapItem(g, (_swap, groupId) =>
                isPlanner ? (
                  <button onClick={() => {
                    if (groupId) {
                      // Delete all swaps in the group
                      g.swaps.forEach((sw) => deleteSwap(sw.id))
                    } else {
                      deleteSwap(_swap.id)
                    }
                    addToast({ type: 'info', message: t('swaps.deleted') })
                  }}
                    className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--danger)' }}
                    title={t('swaps.delete')}>
                    <Trash2 size={12} />
                  </button>
                ) : null
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
