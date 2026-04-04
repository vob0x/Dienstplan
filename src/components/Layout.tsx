import { lazy, Suspense } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useI18n } from '@/i18n'
import { Calendar, Users, Settings, BarChart3, Sun, Moon, LogOut, Menu, X, Globe } from 'lucide-react'
import ToastContainer from '@/components/UI/Toast'
import MonthView from '@/components/Calendar/MonthView'
import type { ViewType } from '@/types'

const WeekView = lazy(() => import('@/components/Calendar/WeekView'))
const DayView = lazy(() => import('@/components/Calendar/DayView'))
const YearView = lazy(() => import('@/components/Calendar/YearView'))
const TeamView = lazy(() => import('@/components/Team/TeamView'))
const ManageView = lazy(() => import('@/components/Manage/ManageView'))
const StatsView = lazy(() => import('@/components/Stats/StatsView'))

function CalendarContent() {
  const calendarView = useUiStore((s) => s.calendarView)

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--neon-cyan)' }} /></div>}>
      {calendarView === 'month' && <MonthView />}
      {calendarView === 'week' && <WeekView />}
      {calendarView === 'day' && <DayView />}
      {calendarView === 'year' && <YearView />}
    </Suspense>
  )
}

export default function Layout() {
  const { t } = useI18n()
  const { currentView, setCurrentView, theme, toggleTheme, language, setLanguage, sidebarOpen, toggleSidebar } = useUiStore()
  const signOut = useAuthStore((s) => s.signOut)
  const profile = useAuthStore((s) => s.profile)
  const team = useTeamStore((s) => s.team)

  const navItems: Array<{ id: ViewType; icon: typeof Calendar; label: string }> = [
    { id: 'calendar', icon: Calendar, label: t('nav.calendar') },
    { id: 'team', icon: Users, label: t('nav.team') },
    { id: 'manage', icon: Settings, label: t('nav.manage') },
    { id: 'stats', icon: BarChart3, label: t('nav.stats') },
  ]

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 no-print" style={{
        background: 'var(--surface-elevated)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
      }}>
        <div className="flex items-center justify-between px-4 py-2 max-w-[1400px] mx-auto">
          {/* Left: Logo + mobile menu */}
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="md:hidden p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-cyan)' }}>
              {t('app.name')}
            </h1>
            {team && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>
                {team.name}
              </span>
            )}
          </div>

          {/* Center: Navigation (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = currentView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: active ? 'var(--surface-active)' : 'transparent',
                    color: active ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                    borderBottom: active ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <button onClick={() => setLanguage(language === 'de' ? 'fr' : 'de')} className="p-2 rounded-xl text-xs font-mono font-bold transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={language === 'de' ? 'Français' : 'Deutsch'}>
              <Globe size={18} />
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-secondary)' }}>
              {theme === 'cyber' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {profile && (
              <span className="text-xs font-mono px-2 py-1 rounded-lg hidden sm:block" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                {profile.codename}
              </span>
            )}
            <button onClick={signOut} className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-muted)' }} title={t('auth.signOut')}>
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {sidebarOpen && (
          <nav className="md:hidden flex gap-1 px-4 pb-2 animate-slide-in-down">
            {navItems.map((item) => {
              const active = currentView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { setCurrentView(item.id); toggleSidebar() }}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: active ? 'var(--surface-active)' : 'transparent',
                    color: active ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                  }}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto max-w-[1400px] mx-auto w-full px-4 py-4 pb-20 md:pb-4">
        <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--neon-cyan)' }} /></div>}>
          {currentView === 'calendar' && <CalendarContent />}
          {currentView === 'team' && <TeamView />}
          {currentView === 'manage' && <ManageView />}
          {currentView === 'stats' && <StatsView />}
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 no-print" style={{
        background: 'var(--surface-elevated)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div className="flex items-center justify-around py-1">
          {navItems.map((item) => {
            const active = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 transition-all"
                style={{ color: active ? 'var(--neon-cyan)' : 'var(--text-muted)', fontSize: '0.65rem' }}
              >
                <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <ToastContainer />
    </div>
  )
}
