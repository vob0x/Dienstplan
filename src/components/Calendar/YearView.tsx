import { useMemo } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
import { isWeekend, getHolidays } from '@/lib/holidays'
import { daysInMonth, toDateStr } from '@/lib/utils'
import CalendarNav from './CalendarNav'

export default function YearView() {
  const { tArray } = useI18n()
  const { year, setCalendarView, setMonth, dayDate } = useUiStore()
  const { members, categories, duties } = useDutyStore()
  const months = tArray('months')
  const days = tArray('days')
  const todayStr = useMemo(() => toDateStr(new Date()), [])
  const holidays = useMemo(() => getHolidays(year), [year])
  const holidayDates = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays])

  // Build duty map: dateStr -> Array<{memberName, catLetter, catColor}>
  const dutyMap = useMemo(() => {
    const map: Record<string, Array<{ memberName: string; catLetter: string; catColor: string }>> = {}
    for (const d of duties) {
      if (!d.date.startsWith(String(year))) continue
      const member = members.find(m => m.id === d.member_id)
      const cat = categories.find(c => c.id === d.category_id)
      if (!member || !cat) continue
      if (!map[d.date]) map[d.date] = []
      map[d.date].push({ memberName: member.name, catLetter: cat.letter, catColor: cat.color })
    }
    return map
  }, [duties, members, categories, year])

  const handleMonthClick = (m: number) => {
    setMonth(m)
    setCalendarView('month')
  }

  const handleDayClick = (month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    useUiStore.setState({ dayDate: dateStr })
    setCalendarView('day')
  }

  return (
    <div>
      <CalendarNav />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 12 }, (_, m) => {
          const daysCount = daysInMonth(year, m)
          const firstDay = new Date(year, m, 1).getDay()
          const offset = firstDay === 0 ? 6 : firstDay - 1

          return (
            <div key={m} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {/* Month header */}
              <button
                onClick={() => handleMonthClick(m)}
                className="text-sm font-bold mb-2 hover:underline w-full text-left"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-cyan)' }}
              >
                {months[m]}
              </button>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {(days as string[]).map((d: string, i: number) => (
                  <div key={i} className="text-center text-[9px] font-semibold" style={{ color: i >= 5 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px">
                {/* Offset empty cells */}
                {Array.from({ length: offset }, (_, i) => (
                  <div key={`off-${i}`} />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysCount }, (_, i) => {
                  const d = i + 1
                  const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const date = new Date(year, m, d)
                  const weekend = isWeekend(date)
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === dayDate
                  const dayEntries = dutyMap[dateStr]
                  const isHoliday = holidayDates.has(dateStr)

                  return (
                    <button
                      key={d}
                      onClick={() => handleDayClick(m, d)}
                      className="w-full aspect-square flex flex-col items-center justify-center rounded-sm text-[9px] font-medium transition-all hover:opacity-80 cursor-pointer relative"
                      style={{
                        background: isSelected ? 'var(--neon-cyan)20' : weekend ? 'var(--weekend-bg)' : 'transparent',
                        color: isToday ? 'var(--neon-cyan)' : isHoliday ? 'var(--danger)' : weekend ? 'var(--text-muted)' : 'var(--text-secondary)',
                        boxShadow: isToday ? `inset 0 0 0 1px var(--neon-cyan)` : isSelected ? `inset 0 0 0 1px var(--neon-cyan)` : 'none',
                        fontWeight: isToday || isSelected ? 700 : 500,
                      }}
                      title={dayEntries?.map(e => `${e.memberName}: ${e.catLetter}`).join('\n') || undefined}
                    >
                      <span>{d}</span>
                      {dayEntries && dayEntries.length > 0 && (
                        <div className="flex gap-px mt-px">
                          {dayEntries.slice(0, 3).map((e, idx) => (
                            <div
                              key={idx}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: e.catColor }}
                            />
                          ))}
                          {dayEntries.length > 3 && (
                            <span style={{ fontSize: '6px', color: 'var(--text-muted)' }}>+{dayEntries.length - 3}</span>
                          )}
                        </div>
                      )}
                      {isHoliday && (
                        <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full" style={{ background: 'var(--danger)' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
