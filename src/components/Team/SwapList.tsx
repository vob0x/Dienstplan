import { useState } from 'react'
import { useSwapStore } from '@/stores/swapStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { parseDate } from '@/lib/utils'
import { ArrowRightLeft, Check, X as XIcon, Ban, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import SwapRequestModal from './SwapRequestModal'

export default function SwapList() {
  const { t, tArray } = useI18n()
  const { swaps, respondToSwap, approveSwap, cancelSwap } = useSwapStore()
  const { members } = useDutyStore()
  const { isAdmin, isPlanner } = useTeamStore()
  const profile = useAuthStore((s) => s.profile)
  const addToast = useUiStore((s) => s.addToast)
  const months = tArray('months') as string[]
  const [expanded, setExpanded] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)

  const canApprove = profile ? (isAdmin(profile.id) || isPlanner(profile.id)) : false

  // Show active swaps (not completed/cancelled)
  const activeSwaps = swaps.filter((s) =>
    s.status === 'pending' || s.status === 'accepted'
  )
  const recentSwaps = swaps.filter((s) =>
    s.status !== 'pending' && s.status !== 'accepted'
  ).slice(0, 5)

  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.name || '?'

  const formatDate = (dateStr: string) => {
    const d = parseDate(dateStr)
    return `${d.getDate()}. ${months[d.getMonth()]}`
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'var(--vacation-text)'
      case 'accepted': return 'var(--neon-cyan)'
      case 'approved': return '#6EC49E'
      case 'rejected': return 'var(--danger)'
      case 'completed': return 'var(--text-muted)'
      case 'cancelled': return 'var(--text-muted)'
      default: return 'var(--text-muted)'
    }
  }

  if (activeSwaps.length === 0 && recentSwaps.length === 0) {
    return (
      <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} style={{ color: 'var(--neon-violet)' }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
              {t('swaps.title')}
            </h3>
          </div>
          <button onClick={() => setRequestOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: 'var(--surface-active)', color: 'var(--neon-violet)' }}>
            <Plus size={14} /> {t('swaps.request')}
          </button>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('swaps.noSwaps')}</p>
        <SwapRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={18} style={{ color: 'var(--neon-violet)' }} />
          <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
            {t('swaps.title')}
          </h3>
          {activeSwaps.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(184,168,224,0.15)', color: 'var(--neon-violet)' }}>
              {activeSwaps.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setRequestOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: 'var(--surface-active)', color: 'var(--neon-violet)' }}>
            <Plus size={14} /> {t('swaps.request')}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded"
            style={{ color: 'var(--text-muted)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <SwapRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />

      {expanded && (
        <div className="space-y-2">
          {activeSwaps.map((swap) => {
            return (
              <div key={swap.id} className="py-2 px-3 rounded-lg"
                style={{ background: 'var(--surface-hover)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {getMemberName(swap.requester_member_id)} ↔ {getMemberName(swap.target_member_id)}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(swap.target_date)}
                      {swap.requester_note && <span className="ml-2 italic">"{swap.requester_note}"</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ color: statusColor(swap.status), background: `${statusColor(swap.status)}15` }}>
                      {t(`swaps.status.${swap.status}`)}
                    </span>

                    {/* Target member can accept/reject */}
                    {swap.status === 'pending' && profile && (
                      <div className="flex gap-1">
                        <button onClick={() => { respondToSwap(swap.id, true); addToast({ type: 'success', message: t('swaps.accept') + ' ✓' }) }}
                          className="p-1 rounded-lg" style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                          title={t('swaps.accept')}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => { respondToSwap(swap.id, false); addToast({ type: 'info', message: t('swaps.reject') + ' ✓' }) }}
                          className="p-1 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                          title={t('swaps.reject')}>
                          <XIcon size={14} />
                        </button>
                      </div>
                    )}

                    {/* Admin can approve accepted swaps */}
                    {swap.status === 'accepted' && canApprove && (
                      <div className="flex gap-1">
                        <button onClick={() => { approveSwap(swap.id, true); addToast({ type: 'success', message: t('swaps.approve') + ' ✓' }) }}
                          className="p-1 rounded-lg" style={{ color: '#6EC49E', background: 'rgba(110,196,158,0.1)' }}
                          title={t('swaps.approve')}>
                          <Check size={14} />
                        </button>
                        <button onClick={() => { approveSwap(swap.id, false); addToast({ type: 'info', message: t('swaps.reject') + ' ✓' }) }}
                          className="p-1 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}
                          title={t('swaps.reject')}>
                          <XIcon size={14} />
                        </button>
                      </div>
                    )}

                    {/* Requester can cancel pending swaps */}
                    {swap.status === 'pending' && (
                      <button onClick={() => { cancelSwap(swap.id); addToast({ type: 'info', message: t('swaps.cancel') + ' ✓' }) }}
                        className="p-1 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}
                        title={t('swaps.cancel')}>
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Recent history */}
          {recentSwaps.length > 0 && (
            <>
              <div className="text-[10px] font-mono mt-3 mb-1" style={{ color: 'var(--text-muted)' }}>
                ─── {t('swaps.title')} ───
              </div>
              {recentSwaps.map((swap) => (
                <div key={swap.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg opacity-60"
                  style={{ background: 'var(--surface-hover)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {getMemberName(swap.requester_member_id)} ↔ {getMemberName(swap.target_member_id)}
                    <span className="ml-2">{formatDate(swap.target_date)}</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ color: statusColor(swap.status), background: `${statusColor(swap.status)}15` }}>
                    {t(`swaps.status.${swap.status}`)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
