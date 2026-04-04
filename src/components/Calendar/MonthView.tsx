import { useState, useMemo, useCallback } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
// removeDuty is accessed via useDutyStore.getState() in the callback
import { getHolidays, isHoliday, isWeekend } from '@/lib/holidays'
import { daysInMonth, toDateStr } from '@/lib/utils'
import CalendarNav from './CalendarNav'
import DutyPicker from './DutyPicker'
import { AlertTriangle, Search, X } from 'lucide-react'

export default function MonthView() {
  const { t, tArray, language } = useI18n()
  const { year, month, paintMode, paintCategoryId } = useUiStore()
  const { members, categories, setDuty, getDuties } = useDutyStore()

  const [picker, setPicker] = useState<{ memberId: string; date: string } | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const selectedMember = members.find((m) => m.id === picker?.memberId)
  const duties = useDutyStore((s) => s.duties)

  const dayNames = tArray('days') // ['Mo','Di','Mi','Do','Fr','Sa','So'] index 0=Mo
  const holidays = useMemo(() => getHolidays(year), [year])
  const todayStr = useMemo(() => toDateStr(new Date()), [])

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
    if (paintMode && paintCategoryId) {
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
  }, [paintMode, paintCategoryId, setDuty, getDuties])

  // Detect vacation overlaps: dates where 2+ members have a requires_approval category (e.g. Ferien)
  const overlaps = useMemo(() => {
    const approvalCatIds = new Set(categories.filter((c) => c.requires_approval).map((c) => c.id))
    if (approvalCatIds.size === 0) return []

    const dateMembers: Record<string, string[]> = {}
    for (const duty of duties) {
      if (!duty.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) continue
      if (!approvalCatIds.has(duty.category_id)) continue
      const member = members.find((m) => m.id === duty.member_id)
      if (!member || !member.is_active) continue
      if (!dateMembers[duty.date]) dateMembers[duty.date] = []
      dateMembers[duty.date].push(member.name)
    }

    return Object.entries(dateMembers)
      .filter(([, names]) => names.length >= 2)
      .map(([date, names]) => ({ date, names }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [duties, categories, members, year, month])

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
            {overlaps.map((o) => {
              const d = new Date(o.date + 'T00:00:00')
              return (
                <div key={o.date}>
                  {d.getDate()}.{d.getMonth() + 1}.: {o.names.join(', ')}
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
            <table className="border-collapse" style={{ minWidth: '700px', width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 px-2 py-1 text-left text-xs font-semibold"
                    style={{ background: 'var(--surface-solid)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', minWidth: '100px' }}>
                    {t('members.title')}
                  </th>
                {dates.map(({ date, dateStr, dayOfWeek }) => {
                  const holiday = isHoliday(dateStr, holidays)
                  const weekend = isWeekend(date)
                  const isToday = dateStr === todayStr
                  return (
                    <th
                      key={dateStr}
                      className="px-0.5 py-1 text-center"
                      style={{
                        background: isToday ? 'var(--surface-active)' : weekend ? 'var(--weekend-bg)' : 'var(--surface-solid)',
                        borderBottom: '1px solid var(--border)',
                        color: isToday ? 'var(--neon-cyan)' : holiday ? 'var(--neon-red)' : weekend ? 'var(--text-muted)' : 'var(--text-secondary)',
                        minWidth: '30px',
                      }}
                      title={holiday ? (language === 'fr' ? holiday.name_fr : holiday.name) : undefined}
                    >
                      <div className="font-semibold" style={{ fontFamily: 'var(--font-display)', fontSize: '0.6rem' }}>
                        {dayNames[dayOfWeek === 0 ? 6 : dayOfWeek - 1] || ''}
                      </div>
                      <div className="font-bold" style={{ fontSize: '0.75rem', lineHeight: 1.1 }}>{date.getDate()}</div>
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
                <tr key={member.id} style={{ height: '28px' }}>
                  <td className="sticky left-0 z-10 px-2 text-xs font-medium truncate"
                    style={{
                      background: 'var(--surface-solid)',
                      color: 'var(--text)',
                      borderBottom: '1px solid var(--border-light)',
                      maxWidth: '120px',
                      height: '28px',
                      lineHeight: '28px',
                    }}>
                    {member.name}
                  </td>
                  {dates.map(({ dateStr, date }) => {
                    const allDuties = getDuties(member.id, dateStr)
                    const weekend = isWeekend(date)
                    const isToday = dateStr === todayStr
                    const hasPending = allDuties.some((d) => d.approval_status === 'pending')
                    const hasRejected = allDuties.some((d) => d.approval_status === 'rejected')

                    return (
                      <td
                        key={dateStr}
                        onClick={() => handleCellClick(member.id, dateStr)}
                        className={`duty-cell ${isToday ? 'today' : ''} ${weekend ? 'weekend' : ''} ${paintMode ? 'paint-highlight' : ''} ${hasPending ? 'approval-pending' : ''} ${hasRejected ? 'approval-rejected' : ''}`}
                        style={{
                          borderBottom: '1px solid var(--border-light)',
                          cursor: 'pointer',
                          padding: '1px 2px',
                          height: '28px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          background: allDuties.length > 0 ? `${categories.find((c) => c.id === allDuties[0]?.category_id)?.color || 'transparent'}22` : 'transparent',
                          borderLeft: allDuties.length > 0 ? `3px solid ${categories.find((c) => c.id === allDuties[0]?.category_id)?.color || 'transparent'}` : undefined,
                        }}
                        title={allDuties.map((d) => categories.find((c) => c.id === d.category_id)?.name || '').join(', ')}
                      >
                        {allDuties.map((duty) => {
                          const cat = categories.find((c) => c.id === duty.category_id)
                          return cat ? (
                            <span key={duty.id} style={{ fontSize: '0.65rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: cat.color, marginRight: '1px' }}>
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
