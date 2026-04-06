import { useMemo, useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'
import { getHolidays, isWeekend } from '@/lib/holidays'
import { toDateStr } from '@/lib/utils'
import { BarChart3, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

export default function StatsView() {
  const { t } = useI18n()
  const { year } = useUiStore()
  const { members, categories, duties } = useDutyStore()
  const holidays = useMemo(() => getHolidays(year), [year])
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)))

  // Count business days in the year (exclude weekends & holidays)
  const businessDays = useMemo(() => {
    let count = 0
    const holidayDates = new Set(holidays.map((h) => h.date))
    for (let m = 0; m < 12; m++) {
      const days = new Date(year, m + 1, 0).getDate()
      for (let d = 1; d <= days; d++) {
        const date = new Date(year, m, d)
        if (!isWeekend(date) && !holidayDates.has(toDateStr(date))) {
          count++
        }
      }
    }
    return count
  }, [year, holidays])

  // Build stats per member (only count duties on business days)
  const stats = useMemo(() => {
    const yearDuties = duties.filter((d) => d.date.startsWith(String(year)) && d.approval_status !== 'rejected')
    const holidayDates = new Set(holidays.map((h) => h.date))

    return members.filter((m) => m.is_active).map((member) => {
      const memberDuties = yearDuties.filter((d) => d.member_id === member.id)
      const counts: Record<string, number> = {}

      for (const cat of categories) {
        // Only count duties on business days (not weekends, not holidays)
        counts[cat.id] = memberDuties.filter((d) => {
          if (d.category_id !== cat.id) return false
          const date = new Date(d.date + 'T00:00:00')
          return !isWeekend(date) && !holidayDates.has(d.date)
        }).length
      }

      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      return { member, counts, total }
    })
  }, [members, categories, duties, year, holidays])

  // Toggle category filter
  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} style={{ color: 'var(--neon-cyan)' }} />
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
            {t('stats.title')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => useUiStore.setState({ year: year - 1 })} className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-secondary)' }}><ChevronLeft size={18} /></button>
          <span className="text-sm font-bold font-mono" style={{ color: 'var(--text)' }}>{year}</span>
          <button onClick={() => useUiStore.setState({ year: year + 1 })} className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-secondary)' }}><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Business days info */}
      <div className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('stats.workDays')}: <span className="font-bold" style={{ color: 'var(--text)' }}>{businessDays}</span>
      </div>

      {/* Category filter */}
      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('stats.filter')}:</span>
        {categories.map(cat => {
          const active = selectedCategories.has(cat.id)
          return (
            <button key={cat.id} onClick={() => toggleCategory(cat.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: active ? `${cat.color}22` : 'var(--surface)',
                color: active ? cat.color : 'var(--text-muted)',
                border: active ? `1px solid ${cat.color}44` : '1px solid var(--border)',
                opacity: active ? 1 : 0.5,
              }}>
              <span className="w-3 h-3 rounded" style={{ background: cat.color, opacity: active ? 1 : 0.3 }} />
              {cat.name}
            </button>
          )
        })}
        {selectedCategories.size < categories.length && (
          <button onClick={() => setSelectedCategories(new Set(categories.map(c => c.id)))}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--surface-active)', color: 'var(--neon-cyan)', border: '1px solid var(--border)' }}>
            <RotateCcw size={12} />
            {t('stats.resetFilter')}
          </button>
        )}
      </div>

      {/* Member stats cards */}
      <div className="space-y-4">
        {stats.map(({ member, counts }) => {
          // Filter totals based on selected categories
          const filteredTotal = Object.entries(counts).reduce((sum, [catId, count]) => {
            return selectedCategories.has(catId) ? sum + count : sum
          }, 0)

          return (
            <div key={member.id} className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{member.name}</h3>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {t('stats.totalDays')}: {filteredTotal}
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                {categories
                  .filter(cat => selectedCategories.has(cat.id))
                  .map((cat) => {
                    const count = counts[cat.id] || 0
                    const pct = businessDays > 0 ? Math.round((count / businessDays) * 100) : 0
                    return (
                      <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: `${cat.color}12`, border: `1px solid ${cat.color}22` }}>
                        <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                          style={{ background: `${cat.color}33`, color: cat.color }}>{cat.letter}</span>
                        <div>
                          <div className="text-xs font-medium" style={{ color: cat.color }}>{cat.name}</div>
                          <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                            {count} <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>({pct}%)</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Mini bar chart */}
              {filteredTotal > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden mt-3" style={{ background: 'var(--surface-solid)' }}>
                  {categories
                    .filter(cat => selectedCategories.has(cat.id))
                    .map((cat) => {
                      const count = counts[cat.id] || 0
                      const pct = (count / filteredTotal) * 100
                      if (pct === 0) return null
                      return <div key={cat.id} style={{ width: `${pct}%`, background: cat.color }} title={`${cat.name}: ${count}`} />
                    })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {members.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <p>{t('calendar.noEntries')}</p>
        </div>
      )}
    </div>
  )
}
