import { useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if in input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return

      const { calendarView, setCalendarView, setCurrentView, navigateMonth, navigateWeek, navigateDay, goToToday, togglePaintMode, setPaintCategoryId } = useUiStore.getState()
      const { undo, redo, canUndo, canRedo } = useDutyStore.getState()

      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) undo()
        return
      }

      // Ctrl/Cmd + Y or Ctrl+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        if (canRedo) redo()
        return
      }

      // Arrow keys: navigate
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (calendarView === 'month') navigateMonth(-1)
        else if (calendarView === 'week') navigateWeek(-1)
        else if (calendarView === 'day') navigateDay(-1)
        else if (calendarView === 'year') useUiStore.setState({ year: useUiStore.getState().year - 1 })
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (calendarView === 'month') navigateMonth(1)
        else if (calendarView === 'week') navigateWeek(1)
        else if (calendarView === 'day') navigateDay(1)
        else if (calendarView === 'year') useUiStore.setState({ year: useUiStore.getState().year + 1 })
        return
      }

      // View switching
      if (e.key === 'm' || e.key === 'M') { setCalendarView('month'); return }
      if (e.key === 'w' || e.key === 'W') { setCalendarView('week'); return }
      if (e.key === 'd' || e.key === 'D') { setCalendarView('day'); return }
      if (e.key === 'j' || e.key === 'J' || e.key === 'y' || e.key === 'Y') { setCalendarView('year'); return }

      // T = Today
      if (e.key === 't' || e.key === 'T') { goToToday(); return }

      // P = Paint mode
      if (e.key === 'p' || e.key === 'P') { togglePaintMode(); return }

      // 1-9 = Select paint category (without Alt, to avoid conflict with Alt+1-4 view switch)
      const num = parseInt(e.key)
      if (!e.altKey && !e.ctrlKey && !e.metaKey && num >= 1 && num <= 9) {
        const cats = useDutyStore.getState().categories
        if (cats[num - 1]) {
          setPaintCategoryId(cats[num - 1].id)
          if (!useUiStore.getState().paintMode) togglePaintMode()
        }
        return
      }

      // Escape = Close paint mode
      if (e.key === 'Escape') {
        if (useUiStore.getState().paintMode) {
          useUiStore.setState({ paintMode: false })
        }
        return
      }

      // Nav shortcuts: 1-4 with Alt
      if (e.altKey && e.key === '1') { setCurrentView('calendar'); return }
      if (e.altKey && e.key === '2') { setCurrentView('team'); return }
      if (e.altKey && e.key === '3') { setCurrentView('manage'); return }
      if (e.altKey && e.key === '4') { setCurrentView('stats'); return }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
