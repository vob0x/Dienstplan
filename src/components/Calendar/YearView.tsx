import { useMemo } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
import { isWeekend } from '@/lib/holidays'
import { daysInMonth, toDateStr } from '@/lib/utils'
import CalendarNav from './CalendarNav'

export default function YearView() {
  const { tArray } = useI18n()
  const { year, setCalendarView, setMonth } = useUiStore()
  const { categories, duties } = useDutyStore()
  const months = tArray('months')
  const todayStr = useMemo(() => toDateStr(new Date()), [])

  // Build duty counts per day
  const dutyCounts = useMemo(() => {
    const map: Record<string, Record<string, number>> = {} // dateStr -> categoryId -> count
    for (const d of duties) {
      if (!d.date.startsWith(String(year))) continue
      if (!map[d.date]) map[d.date] = {}
      map[d.date][d.category_id] = (map[d.date][d.category_id] || 0) + 1
    }
    return map
  }, [duties, year])

  const handleMonthClick = (m: number) => {
    setMonth(m)
    setCalendarView('month')
  }

  return (
    <div>
      <CalendarNav />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, m) => {
          const days = daysInMonth(year, m)
          const firstDay = new Date(year, m, 1).getDay()
          const offset = firstDay === 0 ? 6 : firstDay - 1

          return (
            <div key={m} className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => handleMonthClick(m)}
                className="text-sm font-bold mb-2 hover:underline"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-cyan)' }}
              >
                {months[m]}
              </button>

              <div className="grid grid-cols-7 gap-px text-center">
                {/* Day headers */}
                {tArray('days').map((d: string, i: number) => (
                  <div key={i} className="text-[8px]" style={{ color: i >= 5 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{d.charAt(0)}</div>
                ))}

                {/* Offset empty cells */}
                {Array.from({ length: offset }, (_, i) => <div key={`off-${i}`} />)}

                {/* Day cells */}
                {Array.from({ length: days }, (_, i) => {
                  const d = i + 1
                  const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const date = new Date(year, m, d)
                  const weekend = isWeekend(date)
                  const isToday = dateStr === todayStr
                  const dayCounts = dutyCounts[dateStr]
                  const topCat = dayCounts
                    ? categories.find((c) => c.id === Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0]?.[0])
                    : null

                  return (
                    <div
                      key={d}
                      className="w-full aspect-square flex items-center justify-center rounded-sm text-[9px]"
                      style={{
                        background: topCat ? `${topCat.color}33` : weekend ? 'var(--weekend-bg)' : 'transparent',
                        color: isToday ? 'var(--neon-cyan)' : topCat ? topCat.color : weekend ? 'var(--text-muted)' : 'var(--text-secondary)',
                        fontWeight: isToday ? 700 : 400,
                        boxShadow: isToday ? `inset 0 0 0 1px var(--today-ring)` : 'none',
                      }}
                    >
                      {d}
                    </div>
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
