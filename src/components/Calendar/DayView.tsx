import { useState, useMemo } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
import { usePermissions } from '@/lib/permissions'
import { getHolidays, isHoliday, isWeekend } from '@/lib/holidays'
import { parseDate } from '@/lib/utils'
import CalendarNav from './CalendarNav'
import DutyPicker from './DutyPicker'
import { User } from 'lucide-react'

export default function DayView() {
  const { t, tArray, language } = useI18n()
  const { dayDate } = useUiStore()
  const { members, categories, getDuty } = useDutyStore()
  const { canEditDuty } = usePermissions()
  const [picker, setPicker] = useState<{ memberId: string } | null>(null)
  const selectedMember = members.find((m) => m.id === picker?.memberId)

  const daysLong = tArray('daysLong') // index 0=Mo
  const date = useMemo(() => parseDate(dayDate), [dayDate])
  const dayOfWeek = date.getDay() // 0=Sun, 1=Mon, ...
  const dayName = daysLong[dayOfWeek === 0 ? 6 : dayOfWeek - 1] || ''
  const holidays = useMemo(() => getHolidays(date.getFullYear()), [date])
  const holiday = isHoliday(dayDate, holidays)
  const weekend = isWeekend(date)

  return (
    <div>
      <CalendarNav />

      <div className="text-center mb-6">
        <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{dayName}</div>
        {holiday && (
          <div className="text-sm font-medium mt-1" style={{ color: 'var(--neon-red)' }}>
            {language === 'fr' ? holiday.name_fr : holiday.name}
          </div>
        )}
        {weekend && !holiday && (
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('calendar.weekend')}</div>
        )}
      </div>

      <div className="space-y-2 max-w-lg mx-auto">
        {members.filter((m) => m.is_active).map((member) => {
          const duty = getDuty(member.id, dayDate)
          const cat = duty ? categories.find((c) => c.id === duty.category_id) : null

          return (
            <button
              key={member.id}
              onClick={() => canEditDuty(member.id) && setPicker({ memberId: member.id })}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left"
              style={{
                background: cat ? `${cat.color}12` : 'var(--surface)',
                border: `1px solid ${cat ? `${cat.color}33` : 'var(--border)'}`,
                opacity: canEditDuty(member.id) ? 1 : 0.7,
                cursor: canEditDuty(member.id) ? 'pointer' : 'default',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: cat ? `${cat.color}22` : 'var(--surface-active)', color: cat ? cat.color : 'var(--text-muted)' }}>
                {cat ? <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{cat.letter}</span> : <User size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{member.name}</div>
                {cat && <div className="text-xs" style={{ color: cat.color }}>{cat.name}</div>}
                {duty?.note && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{duty.note}</div>}
              </div>
              {duty?.approval_status === 'pending' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--vacation-bg)', color: 'var(--vacation-text)' }}>
                  {t('duty.approval.pending')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {picker && selectedMember && (
        <DutyPicker open={!!picker} onClose={() => setPicker(null)}
          memberId={picker.memberId} memberName={selectedMember.name} date={dayDate} />
      )}
    </div>
  )
}
