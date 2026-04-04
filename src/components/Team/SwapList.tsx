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
  Inbox, Send, ShieldCheck, ArrowDownRight,
} from 'lucide-react'
import SwapRequestModal from './SwapRequestModal'
import type { DpShiftSwap, SwapStatus } from '@/types'

export default function SwapList() {
  const { t, tArray } = useI18n()
  const { swaps, respondToSwap, approveSwap, cancelSwap, deleteSwap } = useSwapStore()
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
  const { incoming, outgoing, pendingApproval, history } = useMemo(() => {
    const incoming: DpShiftSwap[] = []
    const outgoing: DpShiftSwap[] = []
    const pendingApproval: DpShiftSwap[] = []
    const history: DpShiftSwap[] = []

    for (const s of swaps) {
      const isTerminal = ['approved', 'rejected_responder', 'rejected_approval', 'cancelled'].includes(s.status)

      if (isTerminal) {
        history.push(s)
        continue
      }

      // Pending responder → show in incoming for target
      if (s.status === 'pending_responder' && s.target_member_id === myMemberId) {
        incoming.push(s)
      }

      // Pending responder → show in outgoing for requester
      if (s.status === 'pending_responder' && s.requester_member_id === myMemberId) {
        outgoing.push(s)
      }

      // Accepted or pending_approval → show in approval queue for planner+
      if ((s.status === 'accepted' || s.status === 'pending_approval') && isPlanner) {
        pendingApproval.push(s)
      }
      // Also show in outgoing if requester and still not approved
      if ((s.status === 'accepted' || s.status === 'pending_approval') && s.requester_member_id === myMemberId && !isPlanner) {
        outgoing.push(s)
      }
    }

    return { incoming, outgoing, pendingApproval, history: history.slice(0, 10) }
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

  const totalActive = incoming.length + outgoing.length + pendingApproval.length

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
        {/* INCOMING: Swaps waiting for MY response */}
        {incoming.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Inbox size={14} style={{ color: 'var(--neon-violet)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('swaps.incoming')} ({incoming.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {incoming.map((swap) => (
                <SwapCard key={swap.id} swap={swap} actions={
                  <>
                    <button onClick={() => { respondToSwap(swap.id, true); addToast({ type: 'success', message: t('swaps.accepted') }) }}
                      className="p-1.5 rounded-lg" style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                      title={t('swaps.accept')}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => { respondToSwap(swap.id, false); addToast({ type: 'info', message: t('swaps.rejected') }) }}
                      className="p-1.5 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                      title={t('swaps.reject')}>
                      <XIcon size={14} />
                    </button>
                  </>
                } />
              ))}
            </div>
          </div>
        )}

        {/* OUTGOING: My swap requests */}
        {outgoing.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Send size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('swaps.outgoing')} ({outgoing.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {outgoing.map((swap) => (
                <SwapCard key={swap.id} swap={swap} actions={
                  swap.status === 'pending_responder' ? (
                    <button onClick={() => { cancelSwap(swap.id); addToast({ type: 'info', message: t('swaps.cancelled') }) }}
                      className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}
                      title={t('swaps.cancel')}>
                      <Ban size={14} />
                    </button>
                  ) : null
                } />
              ))}
            </div>
          </div>
        )}

        {/* APPROVAL QUEUE: For planner+ */}
        {pendingApproval.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck size={14} style={{ color: '#E8A838' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('swaps.approvalQueue')} ({pendingApproval.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {pendingApproval.map((swap) => (
                <SwapCard key={swap.id} swap={swap} actions={
                  <>
                    <button onClick={() => {
                      if (!profile) return
                      approveSwap(swap.id, true, profile.id)
                      addToast({ type: 'success', message: t('swaps.approvedMsg') })
                    }}
                      className="p-1.5 rounded-lg" style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                      title={t('swaps.approve')}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => {
                      if (!profile) return
                      approveSwap(swap.id, false, profile.id)
                      addToast({ type: 'info', message: t('swaps.rejectedApprovalMsg') })
                    }}
                      className="p-1.5 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                      title={t('swaps.reject')}>
                      <XIcon size={14} />
                    </button>
                  </>
                } />
              ))}
            </div>
          </div>
        )}

        {/* HISTORY */}
        {history.length > 0 && (
          <div>
            <div className="text-[10px] font-mono mt-2 mb-1.5" style={{ color: 'var(--text-muted)' }}>
              ─── {t('swaps.history')} ───
            </div>
            <div className="space-y-1 opacity-60">
              {history.map((swap) => (
                <SwapCard key={swap.id} swap={swap} actions={
                  isPlanner ? (
                    <button onClick={() => { deleteSwap(swap.id); addToast({ type: 'info', message: t('swaps.deleted') }) }}
                      className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--danger)' }}
                      title={t('swaps.delete')}>
                      <Trash2 size={12} />
                    </button>
                  ) : null
                } />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
