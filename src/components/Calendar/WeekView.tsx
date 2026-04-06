import { useState, useMemo, useCallback } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
import { usePermissions } from '@/lib/permissions'
import { getHolidays, isHoliday, isWeekend } from '@/lib/holidays'
import { toDateStr, getWeekNumber, parseDate } from '@/lib/utils'
import CalendarNav from './CalendarNav'
import DutyPicker from './DutyPicker'

export default function WeekView() {
  const { t, tArray, language } = useI18n()
  const { weekStart, paintMode, paintCategoryId } = useUiStore()
  const { members, categories, getDuties, setDuty, removeDuty } = useDutyStore()
  const { canEditDuty, canUsePaintMode } = usePermissions()
  const [picker, setPicker] = useState<{ memberId: string; date: string } | null>(null)
  const selectedMember = members.find((m) => m.id === picker?.memberId)

  const daysLong = tArray('daysLong') // ['Montag','Dienstag',...,'Sonntag'] index 0=Mo
  const todayStr = useMemo(() => toDateStr(new Date()), [])

  const weekDates = useMemo(() => {
    const d = parseDate(weekStart)
    const result: Array<{ date: Date; dateStr: string; dayIndex: number }> = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(d)
      date.setDate(d.getDate() + i)
      result.push({ date, dateStr: toDateStr(date), dayIndex: i })
    }
    return result
  }, [weekStart])

  const holidays = useMemo(() => {
    const years = [...new Set(weekDates.map((d) => d.date.getFullYear()))]
    return years.flatMap((y) => getHolidays(y))
  }, [weekDates])

  const weekNum = useMemo(() => getWeekNumber(parseDate(weekStart)), [weekStart])

  const handleCellClick = useCallback((memberId: string, dateStr: string) => {
    if (!canEditDuty(memberId)) return
    if (paintMode && paintCategoryId && canUsePaintMode) {
      // Toggle: if duty with this category exists, remove it; otherwise set it
      const existing = getDuties(memberId, dateStr)
      const hasSameCat = existing.some((d) => d.category_id === paintCategoryId)
      if (hasSameCat) {
        removeDuty(memberId, dateStr, paintCategoryId)
      } else {
        setDuty(memberId, dateStr, paintCategoryId)
      }
    } else {
      setPicker({ memberId, date: dateStr })
    }
  }, [paintMode, paintCategoryId, setDuty, removeDuty, getDuties, canEditDuty, canUsePaintMode])

  return (
    <div>
      <CalendarNav />

      <div className="mb-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        {t('calendar.weekNumber')} {weekNum}
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p>{t('calendar.noEntries')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 px-3 py-2 text-left text-xs font-semibold"
                  style={{ background: 'var(--surface-solid)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', minWidth: '120px' }}>
                  {t('members.title')}
                </th>
                {weekDates.map(({ date, dateStr, dayIndex }) => {
                  const holiday = isHoliday(dateStr, holidays)
                  const weekend = isWeekend(date)
                  const isToday = dateStr === todayStr
                  return (
                    <th key={dateStr} className="px-2 py-2 text-center"
                      style={{
                        background: isToday ? 'var(--surface-active)' : weekend ? 'var(--weekend-bg)' : 'var(--surface-solid)',
                        borderBottom: '1px solid var(--border)',
                        color: isToday ? 'var(--neon-cyan)' : holiday ? 'var(--neon-red)' : weekend ? 'var(--text-muted)' : 'var(--text-secondary)',
                        minWidth: '100px',
                      }}
                    >
                      <div className="text-xs font-semibold">{daysLong[dayIndex]}</div>
                      <div className="text-sm font-bold">{date.getDate()}.{date.getMonth() + 1}.</div>
                      {holiday && <div className="text-[10px] truncate max-w-[90px] mx-auto" style={{ color: 'var(--neon-red)' }}>
                        {language === 'fr' ? holiday.name_fr : holiday.name}
                      </div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {members.filter((m) => m.is_active).map((member) => (
                <tr key={member.id}>
                  <td className="sticky left-0 z-10 px-3 py-2 text-sm font-medium"
                    style={{ background: 'var(--surface-solid)', color: 'var(--text)', borderBottom: '1px solid var(--border-light)' }}>
                    {member.name}
                  </td>
                  {weekDates.map(({ dateStr, date }) => {
                    const allDuties = getDuties(member.id, dateStr)
                    const firstCat = allDuties.length > 0 ? categories.find((c) => c.id === allDuties[0]?.category_id) : null
                    const isToday = dateStr === todayStr
                    return (
                      <td
                        key={dateStr}
                        onClick={() => handleCellClick(member.id, dateStr)}
                        className={`duty-cell ${isToday ? 'today' : ''} ${isWeekend(date) ? 'weekend' : ''}`}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          cursor: canEditDuty(member.id) ? 'pointer' : 'default',
                          padding: '8px',
                          background: firstCat ? `${firstCat.color}18` : undefined,
                          minHeight: '50px',
                        }}
                      >
                        {allDuties.map((duty) => {
                          const cat = categories.find((c) => c.id === duty.category_id)
                          return cat ? (
                            <div key={duty.id} className="flex items-center gap-1.5 mb-0.5">
                              <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                                style={{ background: `${cat.color}33`, color: cat.color }}>
                                {cat.letter}
                              </span>
                              <span className="text-xs" style={{ color: cat.color }}>{cat.name}</span>
                            </div>
                          ) : null
                        })}
                        {allDuties[0]?.note && (
                          <div className="text-[10px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{allDuties[0].note}</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picker && selectedMember && (
        <DutyPicker open={!!picker} onClose={() => setPicker(null)}
          memberId={picker.memberId} memberName={selectedMember.name} date={picker.date} />
      )}
    </div>
  )
}
