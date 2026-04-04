import { create } from 'zustand'
import { toDateStr, parseDate } from '@/lib/utils'
import { useDutyStore } from '@/stores/dutyStore'
import type { Theme, Language, CalendarView, ViewType, Toast } from '@/types'

interface UiState {
  // Theme & Language
  theme: Theme
  language: Language
  setTheme: (t: Theme) => void
  setLanguage: (l: Language) => void
  toggleTheme: () => void

  // Navigation
  currentView: ViewType
  calendarView: CalendarView
  setCurrentView: (v: ViewType) => void
  setCalendarView: (v: CalendarView) => void

  // Calendar navigation
  year: number
  month: number // 0-11
  weekStart: string // YYYY-MM-DD (Monday)
  dayDate: string // YYYY-MM-DD
  setYear: (y: number) => void
  setMonth: (m: number) => void
  setWeekStart: (ws: string) => void
  setDayDate: (d: string) => void
  goToToday: () => void
  navigateMonth: (delta: number) => void
  navigateWeek: (delta: number) => void
  navigateDay: (delta: number) => void

  // Paint mode
  paintMode: boolean
  paintCategoryId: string | null
  setPaintMode: (on: boolean) => void
  setPaintCategoryId: (id: string | null) => void
  togglePaintMode: () => void

  // Toasts
  toasts: Toast[]
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  // Help panel
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
  toggleHelp: () => void

  // Mobile
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

const now = new Date()

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return toDateStr(d)
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: (localStorage.getItem('dp-theme') as Theme) || 'cyber',
  language: (localStorage.getItem('dp-lang') as Language) || 'de',
  currentView: 'calendar',
  calendarView: 'month',
  year: now.getFullYear(),
  month: now.getMonth(),
  weekStart: getMonday(now),
  dayDate: toDateStr(now),
  paintMode: false,
  paintCategoryId: null,
  toasts: [],
  helpOpen: false,
  sidebarOpen: false,

  setTheme: (t) => { localStorage.setItem('dp-theme', t); set({ theme: t }) },
  setLanguage: (l) => { localStorage.setItem('dp-lang', l); set({ language: l }) },
  toggleTheme: () => {
    const next = get().theme === 'cyber' ? 'light' : 'cyber'
    localStorage.setItem('dp-theme', next)
    set({ theme: next })
  },

  setCurrentView: (v) => set({ currentView: v }),
  setCalendarView: (v) => set({ calendarView: v }),

  setYear: (y) => set({ year: y }),
  setMonth: (m) => set({ month: m }),
  setWeekStart: (ws) => set({ weekStart: ws }),
  setDayDate: (d) => set({ dayDate: d }),

  goToToday: () => {
    const today = new Date()
    set({
      year: today.getFullYear(),
      month: today.getMonth(),
      weekStart: getMonday(today),
      dayDate: toDateStr(today),
    })
  },

  navigateMonth: (delta) => {
    const { year, month } = get()
    const d = new Date(year, month + delta, 1)
    set({ year: d.getFullYear(), month: d.getMonth() })
  },

  navigateWeek: (delta) => {
    const d = parseDate(get().weekStart)
    d.setDate(d.getDate() + delta * 7)
    set({ weekStart: toDateStr(d) })
  },

  navigateDay: (delta) => {
    const d = parseDate(get().dayDate)
    d.setDate(d.getDate() + delta)
    set({ dayDate: toDateStr(d) })
  },

  setPaintMode: (on) => set({ paintMode: on }),
  setPaintCategoryId: (id) => {
    // Verify category exists
    if (id) {
      const categories = useDutyStore.getState().categories
      if (!categories.find((c) => c.id === id)) {
        // Category was deleted, disable paint mode or auto-select first available
        const cats = useDutyStore.getState().categories
        if (cats.length > 0) {
          set({ paintCategoryId: cats[0].id })
        } else {
          set({ paintCategoryId: null, paintMode: false })
        }
        return
      }
    }
    set({ paintCategoryId: id })
  },
  togglePaintMode: () => {
    const { paintMode, paintCategoryId } = get()
    if (!paintMode && !paintCategoryId) {
      // Auto-select first category when enabling paint mode
      const cats = useDutyStore.getState().categories
      if (cats.length > 0) {
        set({ paintMode: true, paintCategoryId: cats[0].id })
        return
      }
    }
    // Verify current paintCategoryId still exists before toggling
    if (paintMode && paintCategoryId) {
      const categories = useDutyStore.getState().categories
      if (!categories.find((c) => c.id === paintCategoryId)) {
        // Category was deleted, disable paint mode
        set({ paintMode: false })
        return
      }
    }
    set({ paintMode: !paintMode })
  },

  addToast: (t) => {
    const id = Math.random().toString(36).slice(2)
    const toast = { ...t, id }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    // Determine duration based on toast type and undo action
    let duration = t.duration
    if (duration === undefined) {
      if (t.undoAction) {
        duration = 8000 // 8s for undo actions
      } else if (t.type === 'error') {
        duration = 6000 // 6s for errors
      } else if (t.type === 'warning') {
        duration = 5000 // 5s for warnings
      } else {
        duration = 4000 // 4s default
      }
    }
    setTimeout(() => get().removeToast(id), duration)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setHelpOpen: (open) => set({ helpOpen: open }),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
