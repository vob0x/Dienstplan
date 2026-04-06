import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useSwapStore } from '@/stores/swapStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { usePermissions } from '@/lib/permissions'
import { toDateStr } from '@/lib/utils'
import { getHolidays, isHoliday, isWeekend } from '@/lib/holidays'
import {
  Calendar, ArrowRightLeft, ShieldCheck, ChevronRight,
  Sunrise, Clock, CalendarDays,
} from 'lucide-react'

export default function DashboardView() {
  const { t, tArray } = useI18n()
  const profile = useAuthStore((s) => s.profile)
  const { members, categories, getDuties } = useDutyStore()
  const swaps = useSwapStore((s) => s.swaps)
  const { setCurrentView, year } = useUiStore()
  const { isPlanner } = usePermissions()
  const months = tArray('months') as string[]
  const daysLong = tArray('daysLong') as string[]

  const myMember = useMemo(() => {
    if (!profile) return null
    return members.find((m) => m.user_id === profile.id) || null
  }, [members, profile])

  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(() => toDateStr(today), [today])
  const holidays = useMemo(() => getHolidays(year), [year])

  // My duties today
  const todayDuties = useMemo(() => {
    if (!myMember) return []
    return getDuties(myMember.id, todayStr)
  }, [myMember, todayStr, getDuties])

  // Upcoming 7 calendar days (always show all 7, even without duties)
  const upcomingDays = useMemo(() => {
    const result: Array<{ date: string; dateObj: Date; duties: ReturnType<typeof getDuties> }> = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const dateStr = toDateStr(d)
      const duties = myMember ? getDuties(myMember.id, dateStr) : []
      result.push({ date: dateStr, dateObj: d, duties })
    }
    return result
  }, [myMember, today, getDuties])

  // Pending swap requests for me
  const myPendingSwaps = useMemo(() => {
    if (!myMember) return 0
    return swaps.filter((s) =>
      s.status === 'pending_responder' && s.target_member_id === myMember.id
    ).length
  }, [swaps, myMember])

  // Pending approvals (planner+)
  const pendingApprovals = useMemo(() => {
    if (!isPlanner) return 0
    return swaps.filter((s) =>
      s.status === 'accepted' || s.status === 'pending_approval'
    ).length
  }, [swaps, isPlanner])

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const formatDayName = (d: Date) => {
    const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1
    return daysLong[dayIdx] || ''
  }

  const formatDateCompact = (d: Date) => {
    return `${d.getDate()}. ${months[d.getMonth()]}`
  }

  // Greeting based on time of day
  const greetingIcon = useMemo(() => {
    const hour = today.getHours()
    if (hour < 12) return Sunrise
    return Clock
  }, [today])
  const GreetingIcon = greetingIcon

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Greeting */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--surface-active)', color: 'var(--neon-cyan)' }}>
          <GreetingIcon size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
            {t('dashboard.greeting')}{profile?.codename ? `, ${profile.codename}` : ''}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDayName(today)}, {formatDateCompact(today)}
          </p>
        </div>
      </div>

      {/* Today's duties */}
      <section className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
          <CalendarDays size={16} style={{ color: 'var(--neon-cyan)' }} />
          {t('dashboard.todayDuties')}
        </h2>
        {todayDuties.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            {t('dashboard.noDutiesToday')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {todayDuties.map((duty) => {
              const cat = catMap.get(duty.category_id)
              if (!cat) return null
              return (
                <div key={duty.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: `${cat.color}25`, color: cat.color }}>
                    {cat.letter}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{cat.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Notification cards */}
      {(myPendingSwaps > 0 || pendingApprovals > 0) && (
        <div className="grid gap-3" style={{ gridTemplateColumns: myPendingSwaps > 0 && pendingApprovals > 0 ? '1fr 1fr' : '1fr' }}>
          {myPendingSwaps > 0 && (
            <button
              onClick={() => setCurrentView('swaps')}
              className="p-4 rounded-2xl text-left transition-all"
              style={{ background: 'rgba(184,168,224,0.08)', border: '1px solid rgba(184,168,224,0.2)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft size={16} style={{ color: 'var(--neon-violet)' }} />
                <span className="text-2xl font-bold" style={{ color: 'var(--neon-violet)' }}>{myPendingSwaps}</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('dashboard.pendingSwaps')}
              </span>
            </button>
          )}
          {pendingApprovals > 0 && (
            <button
              onClick={() => setCurrentView('swaps')}
              className="p-4 rounded-2xl text-left transition-all"
              style={{ background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.2)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={16} style={{ color: '#E8A838' }} />
                <span className="text-2xl font-bold" style={{ color: '#E8A838' }}>{pendingApprovals}</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('dashboard.pendingApprovals')}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Upcoming 7 days */}
      <section className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
          <Calendar size={16} style={{ color: 'var(--neon-cyan)' }} />
          {t('dashboard.nextDays')}
        </h2>
        <div className="space-y-1.5">
          {upcomingDays.map(({ date, dateObj, duties }) => {
            const holiday = isHoliday(date, holidays)
            const weekend = isWeekend(dateObj)
            const hasDuties = duties.length > 0
            return (
              <div key={date} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: hasDuties ? 'var(--surface-hover)' : 'transparent', opacity: hasDuties ? 1 : 0.6 }}>
                <div className="w-12 text-center flex-shrink-0">
                  <div className="text-[10px] font-medium"
                    style={{ color: weekend ? 'var(--text-muted)' : holiday ? 'var(--neon-red)' : 'var(--text-secondary)' }}>
                    {formatDayName(dateObj).slice(0, 2)}
                  </div>
                  <div className="text-lg font-bold leading-tight" style={{ color: 'var(--text)' }}>
                    {dateObj.getDate()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {hasDuties ? duties.map((duty) => {
                    const cat = catMap.get(duty.category_id)
                    if (!cat) return null
                    return (
                      <span key={duty.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                        style={{ background: `${cat.color}20`, color: cat.color }}>
                        {cat.letter} {cat.name}
                      </span>
                    )
                  }) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Quick actions */}
      <section className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCurrentView('calendar')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
            style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
          >
            <Calendar size={18} style={{ color: 'var(--neon-cyan)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {t('dashboard.viewCalendar')}
            </span>
            <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button
            onClick={() => setCurrentView('swaps')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
            style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
          >
            <ArrowRightLeft size={18} style={{ color: 'var(--neon-violet)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {t('dashboard.requestSwap')}
            </span>
            <ChevronRight size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </section>
    </div>
  )
}
