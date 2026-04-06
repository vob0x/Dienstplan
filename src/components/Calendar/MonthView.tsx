import { useState, useMemo, useCallback, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
import { usePermissions } from '@/lib/permissions'
import { getHolidays, isHoliday, isWeekend } from '@/lib/holidays'
import { daysInMonth, toDateStr } from '@/lib/utils'
import CalendarNav from './CalendarNav'
import DutyPicker from './DutyPicker'
import { AlertTriangle, Search, X } from 'lucide-react'

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

export default function MonthView() {
  const { t, tArray, language } = useI18n()
  const { year, month, paintMode, paintCategoryId } = useUiStore()
  const { members, categories, setDuty, getDuties } = useDutyStore()

  const { canEditDuty, canUsePaintMode, isPlanner } = usePermissions()

  const [picker, setPicker] = useState<{ memberId: string; date: string } | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const selectedMember = members.find((m) => m.id === picker?.memberId)
  const duties = useDutyStore((s) => s.duties)

  const isMobile = useIsMobile()
  const dayNames = tArray('days') // ['Mo','Di','Mi','Do','Fr','Sa','So'] index 0=Mo
  const holidays = useMemo(() => getHolidays(year), [year])
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  // Memoized category lookup for O(1) access in cell rendering
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Build date array for the month
  const dates = useMemo(() => {
    const count = daysInMonth(year, month)
    const result: Array<{ date: Date; dateStr: string; dayOfWeek: number }> = []
    for (let d = 1; d <= count; d++) {
      const date = new Date(year, month, d)
      result.push({ date, dateStr: toDateStr(date), dayOfWeek: date.getDay() })
    }
    return result
  }, [year, month])

  const handleCellClick = useCallback((memberId: string, dateStr: string) => {
    // Permission check: can this user edit this member's duties?
    if (!canEditDuty(memberId)) return

    if (paintMode && paintCategoryId && canUsePaintMode) {
      const duties = getDuties(memberId, dateStr)
      // Toggle: if category already exists, remove it; otherwise add it
      const hasCategory = duties.some((d) => d.category_id === paintCategoryId)
      if (hasCategory) {
        useDutyStore.getState().removeDuty(memberId, dateStr, paintCategoryId)
      } else {
        setDuty(memberId, dateStr, paintCategoryId)
      }
    } else {
      setPicker({ memberId, date: dateStr })
    }
  }, [paintMode, paintCategoryId, setDuty, getDuties, canEditDuty, canUsePaintMode])

  // Detect overlaps: dates where 2+ members share the same absence category OR the same duty type
  // Different duty types on the same day = normal, no warning needed
  const overlaps = useMemo(() => {
    if (!isPlanner) return [] // Only visible to admin/planner

    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const catMap = new Map(categories.map((c) => [c.id, c]))

    // Group by date+category → list of member names
    const dateCatMembers: Record<string, string[]> = {}
    for (const duty of duties) {
      if (!duty.date.startsWith(monthPrefix)) continue
      if (duty.approval_status === 'rejected') continue
      const member = members.find((m) => m.id === duty.member_id)
      if (!member || !member.is_active) continue
      const key = `${duty.date}::${duty.category_id}`
      if (!dateCatMembers[key]) dateCatMembers[key] = []
      dateCatMembers[key].push(member.name)
    }

    // Filter: 2+ members with the same category on the same date
    // Only for absence categories (requires_approval) or identical regular duties
    const results: { date: string; categoryName: string; names: string[] }[] = []
    for (const [key, names] of Object.entries(dateCatMembers)) {
      if (names.length < 2) continue
      const [date, categoryId] = key.split('::')
      const cat = catMap.get(categoryId)
      if (!cat) continue
      results.push({ date, categoryName: cat.name, names })
    }

    return results.sort((a, b) => a.date.localeCompare(b.date))
  }, [duties, categories, members, year, month, isPlanner])

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      <CalendarNav />

      {/* Overlap warnings */}
      {overlaps.length > 0 && (
        <div className="mb-3 p-3 rounded-xl flex items-start gap-3 animate-slide-in-down"
          style={{ background: 'var(--vacation-bg)', border: '1px solid var(--vacation-border)' }}>
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--vacation-text)' }} />
          <div className="text-xs" style={{ color: 'var(--vacation-text)' }}>
            <div className="font-bold mb-1">{t('ui.overlap')}</div>
            {overlaps.map((o, idx) => {
              const d = new Date(o.date + 'T00:00:00')
              return (
                <div key={idx}>
                  {d.getDate()}.{d.getMonth() + 1}. <span className="font-semibold">{o.categoryName}</span>: {o.names.join(', ')}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p className="text-lg mb-2">{t('calendar.noEntries')}</p>
          <p className="text-sm">{t('members.title')} → {t('members.add')}</p>
        </div>
      ) : (
        <div>
          {/* Member search */}
          <div className="mb-3 sticky top-0 z-20 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)' }}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={t('calendar.searchMembers')}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="text-xs bg-transparent outline-none flex-1"
              style={{ color: 'var(--text)', caretColor: 'var(--neon-cyan)' }}
            />
            {memberSearch && (
              <button
                onClick={() => setMemberSearch('')}
                className="p-0.5 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Calendar table */}
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)', WebkitOverflowScrolling: 'touch' }}>
            <table className="border-collapse" style={{ minWidth: isMobile ? `${dates.length * 28 + 80}px` : '600px', width: isMobile ? undefined : '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 px-2 py-1 text-left text-xs font-semibold"
                    style={{
                      background: 'var(--surface-solid)',
                      color: 'var(--text-secondary)',
                      borderBottom: '1px solid var(--border)',
                      width: isMobile ? '80px' : '140px',
                      minWidth: isMobile ? '80px' : '140px',
                    }}>
                    {isMobile ? '' : t('members.title')}
                  </th>
                {dates.map(({ date, dateStr, dayOfWeek }) => {
                  const holiday = isHoliday(dateStr, holidays)
                  const weekend = isWeekend(date)
                  const isToday = dateStr === todayStr
                  return (
                    <th
                      key={dateStr}
                      className="px-0 py-1 text-center"
                      style={{
                        background: isToday ? 'var(--surface-active)' : weekend ? 'var(--weekend-bg)' : 'var(--surface-solid)',
                        borderBottom: '1px solid var(--border)',
                        color: isToday ? 'var(--neon-cyan)' : holiday ? 'var(--neon-red)' : weekend ? 'var(--text-muted)' : 'var(--text-secondary)',
                        minWidth: isMobile ? '28px' : '30px',
                      }}
                      title={holiday ? (language === 'fr' ? holiday.name_fr : holiday.name) : undefined}
                    >
                      {!isMobile && (
                        <div className="font-semibold" style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem' }}>
                          {dayNames[dayOfWeek === 0 ? 6 : dayOfWeek - 1] || ''}
                        </div>
                      )}
                      <div className="font-bold" style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', lineHeight: 1.1 }}>{date.getDate()}</div>
                      {holiday && <div className="w-1 h-1 rounded-full mx-auto mt-px" style={{ background: 'var(--neon-red)' }} />}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {members
                .filter((m) => m.is_active && m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                .map((member) => (
                <tr key={member.id} style={{ height: isMobile ? '30px' : '28px' }}>
                  <td className="sticky left-0 z-10 px-1.5 text-xs font-medium truncate"
                    style={{
                      background: 'var(--surface-solid)',
                      color: 'var(--text)',
                      borderBottom: '1px solid var(--border-light)',
                      width: isMobile ? '80px' : '140px',
                      maxWidth: isMobile ? '80px' : '160px',
                      height: isMobile ? '30px' : '28px',
                      lineHeight: isMobile ? '30px' : '28px',
                      fontSize: isMobile ? '0.65rem' : undefined,
                    }}>
                    {member.name}
                  </td>
                  {dates.map(({ dateStr, date }) => {
                    const allDuties = getDuties(member.id, dateStr)
                    const weekend = isWeekend(date)
                    const isToday = dateStr === todayStr
                    const hasPending = allDuties.some((d) => d.approval_status === 'pending')
                    const editable = canEditDuty(member.id)
                    const firstCat = allDuties.length > 0 ? catMap.get(allDuties[0].category_id) : null

                    return (
                      <td
                        key={dateStr}
                        onClick={() => handleCellClick(member.id, dateStr)}
                        className={`duty-cell ${isToday ? 'today' : ''} ${weekend ? 'weekend' : ''} ${paintMode && canUsePaintMode ? 'paint-highlight' : ''} ${hasPending ? 'approval-pending' : ''}`}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          cursor: editable ? 'pointer' : 'default',
                          padding: '1px',
                          height: isMobile ? '30px' : '28px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          minWidth: isMobile ? '28px' : undefined,
                          background: firstCat ? `${firstCat.color}22` : 'transparent',
                          borderLeft: firstCat ? `3px solid ${firstCat.color}` : undefined,
                        }}
                        title={allDuties.map((d) => catMap.get(d.category_id)?.name || '').join(', ')}
                      >
                        {allDuties.map((duty) => {
                          const cat = catMap.get(duty.category_id)
                          return cat ? (
                            <span key={duty.id} style={{
                              fontSize: isMobile ? '0.6rem' : '0.65rem',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              color: cat.color,
                              marginRight: '1px',
                            }}>
                              {cat.letter}
                            </span>
                          ) : null
                        })}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duty Picker Modal */}
      {picker && selectedMember && (
        <DutyPicker
          open={!!picker}
          onClose={() => setPicker(null)}
          memberId={picker.memberId}
          memberName={selectedMember.name}
          date={picker.date}
        />
      )}
    </div>
  )
}
