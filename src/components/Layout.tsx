import { lazy, Suspense, useState, useMemo } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useI18n } from '@/i18n'
import { isSupabaseAvailable } from '@/lib/supabase'
import { useDutyStore } from '@/stores/dutyStore'
import { useSwapStore } from '@/stores/swapStore'
import { syncTeamMembersToDpMembers } from '@/lib/syncTeamMembers'
import { usePermissions } from '@/lib/permissions'
import { Calendar, Users, Settings, BarChart3, Sun, Moon, LogOut, Globe, WifiOff, HelpCircle, RefreshCw } from 'lucide-react'
import ToastContainer from '@/components/UI/Toast'
import HelpPanel from '@/components/UI/HelpPanel'
import RoleGuard from '@/components/UI/RoleGuard'
import MonthView from '@/components/Calendar/MonthView'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
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
  const { currentView, setCurrentView, theme, toggleTheme, language, setLanguage, helpOpen, setHelpOpen } = useUiStore()
  const signOut = useAuthStore((s) => s.signOut)
  const profile = useAuthStore((s) => s.profile)
  const team = useTeamStore((s) => s.team)
  const fetchAll = useDutyStore((s) => s.fetchAll)
  const fetchSwaps = useSwapStore((s) => s.fetchSwaps)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTeamData = useTeamStore((s) => s.fetchTeamData)

  const handleRefresh = async () => {
    if (!team || refreshing) return
    setRefreshing(true)
    try {
      await fetchTeamData()
      await fetchAll(team.id)
      await syncTeamMembersToDpMembers()
      await fetchSwaps(team.id)
    } finally {
      setRefreshing(false)
    }
  }

  // Setup keyboard shortcuts
  useKeyboardShortcuts(true)

  const { canAccessView, isPlanner } = usePermissions()

  // Reactive swap badge count
  const swaps = useSwapStore((s) => s.swaps)
  const members = useDutyStore((s) => s.members)
  const swapBadge = useMemo(() => {
    if (!profile) return 0
    const myMember = members.find((m) => m.user_id === profile.id)
    if (!myMember) return 0
    let count = 0
    for (const s of swaps) {
      if (s.status === 'pending_responder' && s.target_member_id === myMember.id) count++
      if ((s.status === 'accepted' || s.status === 'pending_approval') && isPlanner) count++
    }
    return count
  }, [swaps, members, profile, isPlanner])

  const allNavItems: Array<{ id: ViewType; icon: typeof Calendar; label: string }> = [
    { id: 'calendar', icon: Calendar, label: t('nav.calendar') },
    { id: 'team', icon: Users, label: t('nav.team') },
    { id: 'manage', icon: Settings, label: t('nav.manage') },
    { id: 'stats', icon: BarChart3, label: t('nav.stats') },
  ]

  // Filter nav items based on user role
  const navItems = allNavItems.filter((item) => canAccessView(item.id))

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 no-print" style={{
        background: 'var(--surface-elevated)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        <div className="flex items-center justify-between px-4 py-2 max-w-[1400px] mx-auto">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
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
          <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label={t('nav.main')}>
            {navItems.map((item, idx) => {
              const active = currentView === item.id
              const shortcutKey = (idx + 1).toString()
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
                  title={`${item.label} (Alt+${shortcutKey})`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="relative">
                    <item.icon size={18} />
                    {item.id === 'team' && swapBadge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full text-[10px] font-bold animate-pulse"
                        style={{ background: 'var(--neon-violet)', color: '#fff' }}>
                        {swapBadge}
                      </span>
                    )}
                  </span>
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {!isSupabaseAvailable() && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(212,112,110,0.1)', color: 'var(--danger)' }} title={t('ui.offline')}>
                <WifiOff size={14} />
                <span className="hidden sm:inline">{t('ui.offline')}</span>
              </div>
            )}
            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 rounded-xl transition-colors" style={{ color: refreshing ? 'var(--neon-cyan)' : 'var(--text-secondary)' }}
              title={t('ui.refresh')}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setHelpOpen(true)} className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-secondary)' }} title={t('help.title') + ' (?)'}>
              <HelpCircle size={18} />
            </button>
            <button onClick={() => setLanguage(language === 'de' ? 'fr' : 'de')} className="p-2 rounded-xl text-xs font-mono font-bold transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={language === 'de' ? 'Français' : 'Deutsch'}>
              <Globe size={18} />
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-secondary)' }} title={theme === 'cyber' ? t('ui.theme.light') : t('ui.theme.dark')}>
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

      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto max-w-[1400px] mx-auto w-full px-4 py-4 pb-20 md:pb-4">
        <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--neon-cyan)' }} /></div>}>
          {currentView === 'calendar' && <CalendarContent />}
          {currentView === 'team' && <TeamView />}
          {currentView === 'manage' && (
            <RoleGuard minRole="planner" showDenied>
              <ManageView />
            </RoleGuard>
          )}
          {currentView === 'stats' && (
            <RoleGuard minRole="planner" showDenied>
              <StatsView />
            </RoleGuard>
          )}
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 no-print" style={{
        background: 'var(--surface-elevated)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }} role="navigation" aria-label={t('nav.mobile')}>
        <div className="flex items-center justify-around py-1">
          {navItems.map((item) => {
            const active = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 transition-all"
                style={{ color: active ? 'var(--neon-cyan)' : 'var(--text-muted)', fontSize: '0.65rem' }}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                  {item.id === 'team' && swapBadge > 0 && (
                    <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full text-[10px] font-bold animate-pulse"
                      style={{ background: 'var(--neon-violet)', color: '#fff' }}>
                      {swapBadge}
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <ToastContainer />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
