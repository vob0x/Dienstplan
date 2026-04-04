import { useState } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { useDutyStore } from '@/stores/dutyStore'
import { usePermissions } from '@/lib/permissions'
import { parseDate } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Paintbrush, Undo2, Redo2 } from 'lucide-react'
import ExportMenu from './ExportMenu'
import ImportMenu from './ImportMenu'
import type { CalendarView } from '@/types'

export default function CalendarNav() {
  const { t, tArray } = useI18n()
  const {
    calendarView, setCalendarView, year, month, weekStart, dayDate,
    navigateMonth, navigateWeek, navigateDay, goToToday,
    paintMode, togglePaintMode, paintCategoryId, setPaintCategoryId,
  } = useUiStore()
  const { categories, canUndo, canRedo, undo, redo } = useDutyStore()
  const { canUsePaintMode, isPlanner } = usePermissions()
  const months = tArray('months')

  const views: CalendarView[] = ['day', 'week', 'month', 'year']

  const getTitle = () => {
    switch (calendarView) {
      case 'month': return `${months[month]} ${year}`
      case 'week': {
        const d = parseDate(weekStart)
        const end = new Date(d)
        end.setDate(end.getDate() + 6)
        return `${d.getDate()}.${d.getMonth() + 1}. – ${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`
      }
      case 'day': {
        const d = parseDate(dayDate)
        return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`
      }
      case 'year': return `${year}`
    }
  }

  const navigate = (delta: number) => {
    switch (calendarView) {
      case 'month': navigateMonth(delta); break
      case 'week': navigateWeek(delta); break
      case 'day': navigateDay(delta); break
      case 'year': useUiStore.setState({ year: year + delta }); break
    }
  }

  const [legendOpen, setLegendOpen] = useState(true)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div className="space-y-3 mb-4">
      {/* GROUP 1: View tabs + Date navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* View tabs */}
        <div className="flex gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--surface)' }} role="tablist">
          {views.map((v) => {
            const shortcutMap: { [key: string]: string } = { month: 'M', week: 'W', day: 'D', year: 'Y' }
            const shortcut = shortcutMap[v]
            return (
              <button
                key={v}
                onClick={() => setCalendarView(v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: calendarView === v ? 'var(--surface-active)' : 'transparent',
                  color: calendarView === v ? 'var(--neon-cyan)' : 'var(--text-muted)',
                }}
                title={`${t(`views.${v}`)} (${shortcut})`}
                role="tab"
                aria-selected={calendarView === v}
              >
                {t(`views.${v}`)}
              </button>
            )
          })}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-secondary)', background: 'var(--surface)' }}
            title={t('ui.previous')}
            aria-label={t('ui.previous')}>
            <ChevronLeft size={20} />
          </button>
          <button onClick={goToToday} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            style={{ color: 'var(--neon-cyan)', background: 'var(--surface-active)' }}
            title={`${t('calendar.today')} (T)`}>
            {t('calendar.today')}
          </button>
          <button onClick={() => navigate(1)} className="p-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-secondary)', background: 'var(--surface)' }}
            title={t('ui.next')}
            aria-label={t('ui.next')}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold flex-1 sm:flex-none text-center" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
          {getTitle()}
        </h2>
      </div>

      {/* GROUP 2: Category legend + Tools (with divider) */}
      <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        {/* Legend toggle for mobile */}
        {isMobile && (
          <button
            onClick={() => setLegendOpen(!legendOpen)}
            className="w-full px-3 py-2 text-xs font-medium text-left mb-2 rounded-lg transition-colors"
            style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
          >
            {legendOpen ? '▼' : '▶'} {t('ui.categories')}
          </button>
        )}

        {/* Category legend */}
        {(legendOpen || !isMobile) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-3 h-3 rounded" style={{ background: cat.color, opacity: 0.8 }} />
                <span>{cat.letter} {cat.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tools */}
        <div className="flex items-center gap-1 flex-wrap" role="toolbar" aria-label={t('ui.tools')}>
          {/* Undo/Redo — planner+ only */}
          {isPlanner && (
            <>
              <button onClick={undo} disabled={!canUndo} className="p-2 rounded-xl transition-colors"
                style={{ color: canUndo ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: canUndo ? 1 : 0.4 }}
                title={`${t('ui.undo')} (Ctrl+Z)`}
                aria-label={t('ui.undo')}>
                <Undo2 size={18} />
              </button>
              <button onClick={redo} disabled={!canRedo} className="p-2 rounded-xl transition-colors"
                style={{ color: canRedo ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: canRedo ? 1 : 0.4 }}
                title={`${t('ui.redo')} (Ctrl+Y)`}
                aria-label={t('ui.redo')}>
                <Redo2 size={18} />
              </button>
            </>
          )}

          {/* Import menu — planner+ only */}
          {isPlanner && <ImportMenu />}

          {/* Export menu — everyone can export */}
          <ExportMenu />

          {/* Paint mode — planner+ only */}
          {canUsePaintMode && (
            <button
              onClick={togglePaintMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: paintMode ? 'var(--neon-cyan)' : 'var(--surface)',
                color: paintMode ? '#0A0B0F' : 'var(--text-secondary)',
                border: paintMode ? 'none' : '1px solid var(--border)',
              }}
              title={`${paintMode ? t('calendar.exitPaint') : t('calendar.paintMode')} (P)`}
              aria-pressed={paintMode}
            >
              <Paintbrush size={16} />
              {paintMode ? t('calendar.exitPaint') : t('calendar.paintMode')}
            </button>
          )}
        </div>
      </div>

      {/* Paint mode bar */}
      {paintMode && canUsePaintMode && (
        <div className="flex items-center gap-2 p-3 rounded-xl animate-slide-in-down"
          style={{ background: 'var(--surface-active)', border: '1px solid var(--border-hover)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('calendar.paintModeHint')} {t('calendar.paintModeEscHint')}</span>
          <div className="flex gap-1 ml-auto flex-wrap">
            {categories.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setPaintCategoryId(cat.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: paintCategoryId === cat.id ? cat.color : `${cat.color}33`,
                  color: paintCategoryId === cat.id ? '#0A0B0F' : cat.color,
                  border: paintCategoryId === cat.id ? '2px solid #fff' : '1px solid transparent',
                }}
                title={`${i + 1}: ${cat.name}`}
              >
                {cat.letter}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
