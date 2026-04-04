import { useState, useMemo } from 'react'
import { useSwapStore } from '@/stores/swapStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { usePermissions } from '@/lib/permissions'
import { toDateStr } from '@/lib/utils'
import Modal from '@/components/UI/Modal'
import { ArrowRight, ArrowLeft, ArrowRightLeft, ArrowDownRight } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

type Step = 'date' | 'duty' | 'partner' | 'confirm'

export default function SwapRequestModal({ open, onClose }: Props) {
  const { t, tArray } = useI18n()
  const { requestSwap, createReassignment } = useSwapStore()
  const { members: dpMembers, categories, getDuties } = useDutyStore()
  const team = useTeamStore((s) => s.team)
  const profile = useAuthStore((s) => s.profile)
  const addToast = useUiStore((s) => s.addToast)
  const { isPlanner } = usePermissions()
  const months = tArray('months') as string[]

  const [step, setStep] = useState<Step>('date')
  const [targetDate, setTargetDate] = useState('')
  const [requesterMemberId, setRequesterMemberId] = useState('')
  const [requesterCategoryId, setRequesterCategoryId] = useState<string | null>(null)
  const [targetMemberId, setTargetMemberId] = useState('')
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [swapType, setSwapType] = useState<'swap' | 'reassignment'>('swap')
  const [submitting, setSubmitting] = useState(false)

  const activeMembers = dpMembers.filter((m) => m.is_active)
  const today = new Date()
  const minDate = toDateStr(today)
  const maxDateStr = toDateStr(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))

  // Auto-detect requester: the dp_member linked to the current user
  const myMember = useMemo(() => {
    if (!profile) return null
    return dpMembers.find((m) => m.user_id === profile.id) || null
  }, [dpMembers, profile])

  // Duties of requester on selected date
  const requesterDuties = useMemo(() => {
    const mid = requesterMemberId || myMember?.id
    if (!mid || !targetDate) return []
    return getDuties(mid, targetDate)
  }, [requesterMemberId, myMember, targetDate, getDuties])

  // Duties of target on selected date
  const targetDuties = useMemo(() => {
    if (!targetMemberId || !targetDate) return []
    return getDuties(targetMemberId, targetDate)
  }, [targetMemberId, targetDate, getDuties])

  const getCatName = (catId: string | null) => {
    if (!catId) return '—'
    return categories.find((c) => c.id === catId)?.name || '?'
  }
  const getCatLetter = (catId: string | null) => {
    if (!catId) return '–'
    return categories.find((c) => c.id === catId)?.letter || '?'
  }
  const getCatColor = (catId: string | null) => {
    if (!catId) return 'var(--text-muted)'
    return categories.find((c) => c.id === catId)?.color || 'var(--text-muted)'
  }
  const getMemberName = (mid: string) => dpMembers.find((m) => m.id === mid)?.name || '?'

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`
  }

  const reset = () => {
    setStep('date')
    setTargetDate('')
    setRequesterMemberId('')
    setRequesterCategoryId(null)
    setTargetMemberId('')
    setTargetCategoryId(null)
    setNote('')
    setSwapType('swap')
    setSubmitting(false)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!team) return
    const reqId = requesterMemberId || myMember?.id
    if (!reqId || !targetMemberId || !targetDate) return

    setSubmitting(true)
    try {
      const input = {
        team_id: team.id,
        swap_type: swapType as 'swap' | 'reassignment',
        requester_member_id: reqId,
        target_member_id: targetMemberId,
        requester_category_id: requesterCategoryId,
        target_category_id: targetCategoryId,
        target_date: targetDate,
        requester_note: note || null,
      }

      if (swapType === 'reassignment') {
        await createReassignment(input)
      } else {
        await requestSwap(input)
      }

      addToast({ type: 'success', message: t('swaps.requestSent') })
      handleClose()
    } catch {
      addToast({ type: 'error', message: t('swaps.createError') })
    } finally {
      setSubmitting(false)
    }
  }

  // Step navigation
  const canGoNext = () => {
    switch (step) {
      case 'date': return !!targetDate
      case 'duty': return true // category selection is optional (whole day swap)
      case 'partner': return !!targetMemberId
      case 'confirm': return true
    }
  }

  const goNext = () => {
    switch (step) {
      case 'date':
        // If not planner, auto-select own member
        if (!isPlanner && myMember) {
          setRequesterMemberId(myMember.id)
        }
        setStep('duty')
        break
      case 'duty': setStep('partner'); break
      case 'partner': setStep('confirm'); break
      case 'confirm': handleSubmit(); break
    }
  }

  const goBack = () => {
    switch (step) {
      case 'duty': setStep('date'); break
      case 'partner': setStep('duty'); break
      case 'confirm': setStep('partner'); break
    }
  }

  const stepIndex = ['date', 'duty', 'partner', 'confirm'].indexOf(step)

  return (
    <Modal open={open} onClose={handleClose} title={t('swaps.newRequest')} size="md">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1 rounded-full transition-all" style={{
            width: i === stepIndex ? '32px' : '12px',
            background: i <= stepIndex ? 'var(--neon-cyan)' : 'var(--border)',
          }} />
        ))}
      </div>

      {/* STEP 1: Date */}
      {step === 'date' && (
        <div className="space-y-4">
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('swaps.selectDate')}
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            min={minDate}
            max={maxDateStr}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
            autoFocus
          />

          {/* Swap type toggle (planner+ only) */}
          {isPlanner && (
            <div className="flex gap-2">
              <button
                onClick={() => setSwapType('swap')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: swapType === 'swap' ? 'var(--surface-active)' : 'var(--surface)',
                  color: swapType === 'swap' ? 'var(--neon-cyan)' : 'var(--text-muted)',
                  border: `1px solid ${swapType === 'swap' ? 'var(--neon-cyan)' : 'var(--border)'}`,
                }}
              >
                <ArrowRightLeft size={14} /> {t('swaps.typeSwap')}
              </button>
              <button
                onClick={() => setSwapType('reassignment')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: swapType === 'reassignment' ? 'var(--surface-active)' : 'var(--surface)',
                  color: swapType === 'reassignment' ? 'var(--neon-violet)' : 'var(--text-muted)',
                  border: `1px solid ${swapType === 'reassignment' ? 'var(--neon-violet)' : 'var(--border)'}`,
                }}
              >
                <ArrowDownRight size={14} /> {t('swaps.typeReassignment')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Select duty (requester + category) */}
      {step === 'duty' && (
        <div className="space-y-4">
          {/* Requester selection (planner+ can choose any member) */}
          {isPlanner ? (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('swaps.selectRequester')}
              </label>
              <select
                value={requesterMemberId}
                onChange={(e) => { setRequesterMemberId(e.target.value); setRequesterCategoryId(null) }}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                <option value="">— {t('swaps.selectRequester')} —</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          ) : (
            myMember && (
              <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                {myMember.name}
              </div>
            )
          )}

          {/* Duties on that date for the selected requester */}
          {(requesterMemberId || myMember?.id) && (
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                {t('swaps.selectDuty')} ({formatDate(targetDate)})
              </label>
              {requesterDuties.length === 0 ? (
                <div className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>
                  {t('swaps.noDutyOnDate')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {requesterDuties.map((d) => {
                    const cat = categories.find((c) => c.id === d.category_id)
                    const selected = requesterCategoryId === d.category_id
                    return (
                      <button
                        key={d.id}
                        onClick={() => setRequesterCategoryId(selected ? null : d.category_id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: selected ? `${cat?.color || 'var(--neon-cyan)'}22` : 'var(--surface)',
                          border: `1px solid ${selected ? cat?.color || 'var(--neon-cyan)' : 'var(--border)'}`,
                        }}
                      >
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                          style={{ background: `${cat?.color}33`, color: cat?.color }}>
                          {cat?.letter || '?'}
                        </span>
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{cat?.name || '?'}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {requesterDuties.length > 0 && !requesterCategoryId && (
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('swaps.noCategoryHint')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Select swap partner */}
      {step === 'partner' && (
        <div className="space-y-4">
          <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {swapType === 'reassignment' ? t('swaps.selectTarget') : t('swaps.selectPartner')}
          </label>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {activeMembers
              .filter((m) => m.id !== (requesterMemberId || myMember?.id))
              .map((m) => {
                const duties = getDuties(m.id, targetDate)
                const selected = targetMemberId === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setTargetMemberId(m.id)
                      // Auto-select target's first duty category if available
                      setTargetCategoryId(duties.length > 0 ? duties[0].category_id : null)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: selected ? 'var(--surface-active)' : 'var(--surface)',
                      border: `1px solid ${selected ? 'var(--neon-cyan)' : 'var(--border)'}`,
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.name}</span>
                    <div className="flex gap-1">
                      {duties.length > 0 ? duties.map((d) => {
                        const cat = categories.find((c) => c.id === d.category_id)
                        return cat ? (
                          <span key={d.id} className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                            style={{ background: `${cat.color}33`, color: cat.color }}>
                            {cat.letter}
                          </span>
                        ) : null
                      }) : (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                  </button>
                )
              })}
          </div>

          {/* If target has multiple duties, let user select which one */}
          {targetMemberId && targetDuties.length > 1 && swapType === 'swap' && (
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                {t('swaps.selectTargetDuty')}
              </label>
              <div className="space-y-1.5">
                {targetDuties.map((d) => {
                  const cat = categories.find((c) => c.id === d.category_id)
                  const selected = targetCategoryId === d.category_id
                  return (
                    <button
                      key={d.id}
                      onClick={() => setTargetCategoryId(d.category_id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all"
                      style={{
                        background: selected ? `${cat?.color || 'var(--neon-cyan)'}22` : 'var(--surface)',
                        border: `1px solid ${selected ? cat?.color || 'var(--neon-cyan)' : 'var(--border)'}`,
                      }}
                    >
                      <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                        style={{ background: `${cat?.color}33`, color: cat?.color }}>
                        {cat?.letter}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text)' }}>{cat?.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--surface-active)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {formatDate(targetDate)}
            </div>

            <div className="flex items-center gap-3">
              {/* Requester side */}
              <div className="flex-1 text-center">
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                  {getMemberName(requesterMemberId || myMember?.id || '')}
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                  style={{ background: `${getCatColor(requesterCategoryId)}22`, color: getCatColor(requesterCategoryId) }}>
                  {getCatLetter(requesterCategoryId)} {getCatName(requesterCategoryId)}
                </span>
              </div>

              {/* Arrow */}
              <div style={{ color: 'var(--text-muted)' }}>
                {swapType === 'swap' ? <ArrowRightLeft size={20} /> : <ArrowDownRight size={20} />}
              </div>

              {/* Target side */}
              <div className="flex-1 text-center">
                <div className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
                  {getMemberName(targetMemberId)}
                </div>
                {swapType === 'swap' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                    style={{ background: `${getCatColor(targetCategoryId)}22`, color: getCatColor(targetCategoryId) }}>
                    {getCatLetter(targetCategoryId)} {getCatName(targetCategoryId)}
                  </span>
                )}
              </div>
            </div>

            {swapType === 'reassignment' && (
              <div className="text-[10px] text-center" style={{ color: 'var(--neon-violet)' }}>
                {t('swaps.reassignmentHint')}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('duty.note')} ({t('ui.optional')})
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
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        {step !== 'date' ? (
          <button onClick={goBack} className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium"
            style={{ color: 'var(--text-secondary)', background: 'var(--surface)' }}>
            <ArrowLeft size={14} /> {t('ui.back')}
          </button>
        ) : <div />}

        <button
          onClick={goNext}
          disabled={!canGoNext() || submitting}
          className="flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: canGoNext() ? 'var(--neon-cyan)' : 'var(--surface)',
            color: canGoNext() ? '#0A0B0F' : 'var(--text-muted)',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {step === 'confirm'
            ? (submitting ? t('ui.loading') : t('swaps.confirm'))
            : <>{t('ui.next')} <ArrowRight size={14} /></>
          }
        </button>
      </div>
    </Modal>
  )
}
