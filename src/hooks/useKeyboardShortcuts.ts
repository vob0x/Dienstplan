import { useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useI18n } from '@/i18n'

export interface KeyboardShortcut {
  key: string
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[]
  description: string
  action: () => void
}

export function useKeyboardShortcuts(enabled: boolean = true) {
  const { setCalendarView, goToToday, togglePaintMode, setCurrentView, toggleHelp } = useUiStore()
  const { canUndo, canRedo, undo, redo } = useDutyStore()
  const { t } = useI18n()

  const shortcuts: KeyboardShortcut[] = [
    // Calendar view shortcuts
    { key: 'm', modifiers: [], description: t('help.shortcutsList.month'), action: () => setCalendarView('month') },
    { key: 'w', modifiers: [], description: t('help.shortcutsList.week'), action: () => setCalendarView('week') },
    { key: 'd', modifiers: [], description: t('help.shortcutsList.day'), action: () => setCalendarView('day') },
    { key: 'y', modifiers: [], description: t('help.shortcutsList.year'), action: () => setCalendarView('year') },
    { key: 'j', modifiers: [], description: t('help.shortcutsList.year'), action: () => setCalendarView('year') },
    // Navigation
    { key: 't', modifiers: [], description: t('help.shortcutsList.today'), action: () => goToToday() },
    // Paint mode
    { key: 'p', modifiers: [], description: t('help.shortcutsList.paint'), action: () => togglePaintMode() },
    { key: 'Escape', modifiers: [], description: t('help.shortcutsList.escape'), action: () => useUiStore.setState({ paintMode: false }) },
    // Undo/Redo
    { key: 'z', modifiers: ['ctrl'], description: t('help.shortcutsList.undo'), action: () => canUndo && undo() },
    { key: 'y', modifiers: ['ctrl'], description: t('help.shortcutsList.redo'), action: () => canRedo && redo() },
    // Navigation views (number keys, simpler shortcuts)
    { key: '1', modifiers: [], description: t('help.shortcutsList.navCalendar'), action: () => setCurrentView('calendar') },
    { key: '2', modifiers: [], description: t('help.shortcutsList.navTeam'), action: () => setCurrentView('team') },
    { key: '3', modifiers: [], description: t('help.shortcutsList.navManage'), action: () => setCurrentView('manage') },
    { key: '4', modifiers: [], description: t('help.shortcutsList.navStats'), action: () => setCurrentView('stats') },
    // Alt+1-4 for compatibility
    { key: '1', modifiers: ['alt'], description: t('help.shortcutsList.navCalendar'), action: () => setCurrentView('calendar') },
    { key: '2', modifiers: ['alt'], description: t('help.shortcutsList.navTeam'), action: () => setCurrentView('team') },
    { key: '3', modifiers: ['alt'], description: t('help.shortcutsList.navManage'), action: () => setCurrentView('manage') },
    { key: '4', modifiers: ['alt'], description: t('help.shortcutsList.navStats'), action: () => setCurrentView('stats') },
    // Help
    { key: '?', modifiers: ['shift'], description: t('help.shortcutsList.help'), action: () => toggleHelp() },
  ]

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement

      // Don't intercept if typing in an input or textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // Also check contenteditable elements (but allow if no modifiers for better UX)
      if (target.contentEditable === 'true' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        return
      }

      const key = e.key.toLowerCase()
      const hasCtrl = e.ctrlKey || e.metaKey
      const hasAlt = e.altKey
      const hasShift = e.shiftKey

      for (const shortcut of shortcuts) {
        const matchKey = key === shortcut.key.toLowerCase() || e.key === shortcut.key

        let modifiersMatch = true
        if (shortcut.modifiers.length === 0) {
          modifiersMatch = !hasCtrl && !hasAlt && !hasShift
        } else {
          const hasRequired = shortcut.modifiers.every((m) => {
            if (m === 'ctrl') return hasCtrl
            if (m === 'alt') return hasAlt
            if (m === 'shift') return hasShift
            if (m === 'meta') return e.metaKey
            return false
          })
          modifiersMatch = hasRequired
        }

        if (matchKey && modifiersMatch) {
          e.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, canUndo, canRedo])

  return shortcuts
}
