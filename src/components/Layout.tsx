import React, { lazy, Suspense, useState, useMemo, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useI18n } from '@/i18n'
import { isSupabaseAvailable } from '@/lib/supabase'
import { useDutyStore } from '@/stores/dutyStore'
import { useSwapStore } from '@/stores/swapStore'
import { syncTeamMembersToDpMembers } from '@/lib/syncTeamMembers'
import { usePermissions } from '@/lib/permissions'
import {
  Home, Calendar, ArrowRightLeft, Users, Settings, BarChart3,
  Sun, Moon, LogOut, Globe, WifiOff, HelpCircle, RefreshCw,
  MoreHorizontal, X,
} from 'lucide-react'
import ToastContainer from '@/components/UI/Toast'
import HelpPanel from '@/components/UI/HelpPanel'
import RoleGuard from '@/components/UI/RoleGuard'
import MonthView from '@/components/Calendar/MonthView'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import type { ViewType } from '@/types'

// ---------------------------------------------------------------------------
// Lazy imports with retry
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch(() => {
      if ('caches' in window) caches.keys().then((k) => k.forEach((n) => caches.delete(n)))
      if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then((r) => r.forEach((sw) => sw.unregister()))
      return factory()
    })
  )
}

const WeekView = lazyRetry(() => import('@/components/Calendar/WeekView'))
const DayView = lazyRetry(() => import('@/components/Calendar/DayView'))
const YearView = lazyRetry(() => import('@/components/Calendar/YearView'))
const DashboardView = lazyRetry(() => import('@/components/Dashboard/DashboardView'))
const SwapsView = lazyRetry(() => import('@/components/Swaps/SwapsView'))
const TeamView = lazyRetry(() => import('@/components/Team/TeamView'))
const ManageView = lazyRetry(() => import('@/components/Manage/ManageView'))
const StatsView = lazyRetry(() => import('@/components/Stats/StatsView'))
const SetupWizard = lazyRetry(() => import('@/components/Setup/SetupWizard'))

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------
class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Ansicht konnte nicht geladen werden.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}
          >
            Seite neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Mobile breakpoint hook
// ---------------------------------------------------------------------------
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

// ---------------------------------------------------------------------------
// Calendar sub-router
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export default function Layout() {
  const { t } = useI18n()
  const { currentView, setCurrentView, theme, toggleTheme, language, setLanguage, helpOpen, setHelpOpen } = useUiStore()
  const signOut = useAuthStore((s) => s.signOut)
  const profile = useAuthStore((s) => s.profile)
  const team = useTeamStore((s) => s.team)
  const fetchAll = useDutyStore((s) => s.fetchAll)
  const fetchSwaps = useSwapStore((s) => s.fetchSwaps)
  const members = useDutyStore((s) => s.members)
  const categories = useDutyStore((s) => s.categories)
  const [refreshing, setRefreshing] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const isMobile = useIsMobile()
  const { canAccessView, isPlanner, isAdmin } = usePermissions()
  const dutyLoading = useDutyStore((s) => s.loading)

  const fetchTeamData = useTeamStore((s) => s.fetchTeamData)

  // Check if setup wizard should show (admin only, after data has loaded)
  useEffect(() => {
    if (team && !dutyLoading && members.length === 0 && categories.length === 0 && isAdmin) {
      const setupDone = localStorage.getItem('dp_setup_complete')
      if (!setupDone) {
        setShowSetup(true)
      }
    }
  }, [team, dutyLoading, members.length, categories.length, isAdmin])

  const handleRefresh = async () => {
    if (!team || refreshing) return
    setRefreshing(true)
    try {
      await fetchTeamData()
      await fetchAll(team.id)
      // Sync team→dp_members only for admin/planner (member management is admin-only)
      if (isPlanner) {
        try { await syncTeamMembersToDpMembers() } catch {}
      }
      await fetchSwaps(team.id)
    } catch (e) {
      console.warn('Refresh failed:', e)
    } finally {
      setRefreshing(false)
    }
  }

  useKeyboardShortcuts(true)

  // Swap badge count
  const swaps = useSwapStore((s) => s.swaps)
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

  // Navigation items
  const allNavItems: Array<{ id: ViewType; icon: typeof Calendar; label: string; mobileOnly?: boolean; desktopOnly?: boolean }> = [
    { id: 'dashboard', icon: Home, label: t('nav.dashboard') },
    { id: 'calendar', icon: Calendar, label: t('nav.calendar') },
    { id: 'swaps', icon: ArrowRightLeft, label: t('nav.swaps') },
    { id: 'team', icon: Users, label: t('nav.team') },
    { id: 'manage', icon: Settings, label: t('nav.manage') },
    { id: 'stats', icon: BarChart3, label: t('nav.stats') },
  ]

  const navItems = allNavItems.filter((item) => canAccessView(item.id))

  // Mobile: show max 4 items in bottom nav, rest in overflow
  const mobileMainNav = navItems.slice(0, 4)
  const mobileOverflowNav = navItems.slice(4)
  const hasOverflow = mobileOverflowNav.length > 0

  // Setup wizard
  if (showSetup && team) {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        <header className="sticky top-0 z-40 no-print" style={{
          background: 'var(--surface-elevated)',
          borderBottom: '1px solid var(--border)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}>
          <div className="flex items-center justify-between px-4 py-2">
            <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--neon-cyan)' }}>
              {t('app.name')}
            </h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={null}>
            <SetupWizard onComplete={() => setShowSetup(false)} />
          </Suspense>
        </main>
        <ToastContainer />
      </div>
    )
  }

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
              <span className="text-xs px-2 py-0.5 rounded-full hidden sm:inline-block"
                style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>
                {team.name}
              </span>
            )}
          </div>

          {/* Center: Navigation (desktop) */}
          <nav className="hidden md:flex items-center gap-1" role="navigation" aria-label={t('nav.main')}>
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
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="relative">
                    <item.icon size={18} />
                    {item.id === 'swaps' && swapBadge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full text-[10px] font-bold"
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
          <div className="flex items-center gap-1.5">
            {!isSupabaseAvailable() && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{ background: 'rgba(212,112,110,0.1)', color: 'var(--danger)' }}
                title={t('ui.offline')}>
                <WifiOff size={14} />
                <span className="hidden sm:inline">{t('ui.offline')}</span>
              </div>
            )}
            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ color: refreshing ? 'var(--neon-cyan)' : 'var(--text-secondary)' }}
              title={t('ui.refresh')}>
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {!isMobile && (
              <>
                <button onClick={() => setHelpOpen(true)}
                  className="p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  style={{ color: 'var(--text-secondary)' }}
                  title={t('help.title') + ' (?)'}>
                  <HelpCircle size={18} />
                </button>
                <button onClick={() => setLanguage(language === 'de' ? 'fr' : 'de')}
                  className="p-2 rounded-xl text-xs font-mono font-bold transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  style={{ color: 'var(--text-secondary)' }}
                  title={language === 'de' ? 'Français' : 'Deutsch'}>
                  <Globe size={18} />
                </button>
                <button onClick={toggleTheme}
                  className="p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  style={{ color: 'var(--text-secondary)' }}
                  title={theme === 'cyber' ? t('ui.theme.light') : t('ui.theme.dark')}>
                  {theme === 'cyber' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </>
            )}
            {profile && (
              <span className="text-xs font-mono px-2 py-1 rounded-lg hidden sm:block"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                {profile.codename}
              </span>
            )}
            <button onClick={signOut}
              className="p-2 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ color: 'var(--text-muted)' }}
              title={t('auth.signOut')}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto max-w-[1400px] mx-auto w-full px-4 py-4 pb-24 md:pb-4">
        <ChunkErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--neon-cyan)' }} /></div>}>
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'calendar' && <CalendarContent />}
            {currentView === 'swaps' && <SwapsView />}
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
        </ChunkErrorBoundary>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 no-print" style={{
        background: 'var(--surface-elevated)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }} role="navigation" aria-label={t('nav.mobile')}>
        <div className="flex items-center justify-around py-1">
          {mobileMainNav.map((item) => {
            const active = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setCurrentView(item.id); setMoreMenuOpen(false) }}
                className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 transition-all min-w-[60px] min-h-[48px] justify-center"
                style={{ color: active ? 'var(--neon-cyan)' : 'var(--text-muted)', fontSize: '0.6rem' }}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                  {item.id === 'swaps' && swapBadge > 0 && (
                    <span className="absolute -top-1 -right-2.5 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full text-[10px] font-bold"
                      style={{ background: 'var(--neon-violet)', color: '#fff' }}>
                      {swapBadge}
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: active ? 700 : 400 }}>{item.label}</span>
                {/* Active indicator line */}
                {active && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                    style={{ background: 'var(--neon-cyan)' }} />
                )}
              </button>
            )
          })}

          {/* Overflow "More" button */}
          {hasOverflow && (
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="flex flex-col items-center gap-0.5 py-1.5 px-3 transition-all min-w-[60px] min-h-[48px] justify-center relative"
              style={{
                color: moreMenuOpen || mobileOverflowNav.some((i) => i.id === currentView)
                  ? 'var(--neon-cyan)'
                  : 'var(--text-muted)',
                fontSize: '0.6rem',
              }}
            >
              <MoreHorizontal size={22} strokeWidth={1.8} />
              <span>{t('nav.more')}</span>
            </button>
          )}
        </div>

        {/* Overflow menu */}
        {moreMenuOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={() => setMoreMenuOpen(false)} />

            {/* Menu */}
            <div className="absolute bottom-full left-0 right-0 z-40 p-3 animate-slide-in-up"
              style={{
                background: 'var(--surface-elevated)',
                borderTop: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
              }}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('nav.more')}</span>
                <button onClick={() => setMoreMenuOpen(false)} className="p-1 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {mobileOverflowNav.map((item) => {
                  const active = currentView === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setCurrentView(item.id); setMoreMenuOpen(false) }}
                      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all min-h-[60px] justify-center"
                      style={{
                        background: active ? 'var(--surface-active)' : 'var(--surface)',
                        color: active ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                      }}
                    >
                      <item.icon size={20} />
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </button>
                  )
                })}

                {/* Settings items in overflow for mobile */}
                <button
                  onClick={() => { setLanguage(language === 'de' ? 'fr' : 'de'); setMoreMenuOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all min-h-[60px] justify-center"
                  style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                >
                  <Globe size={20} />
                  <span className="text-[11px] font-medium">{language === 'de' ? 'FR' : 'DE'}</span>
                </button>
                <button
                  onClick={() => { toggleTheme(); setMoreMenuOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all min-h-[60px] justify-center"
                  style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                >
                  {theme === 'cyber' ? <Sun size={20} /> : <Moon size={20} />}
                  <span className="text-[11px] font-medium">
                    {theme === 'cyber' ? t('ui.theme.light') : t('ui.theme.dark')}
                  </span>
                </button>
                <button
                  onClick={() => { setHelpOpen(true); setMoreMenuOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all min-h-[60px] justify-center"
                  style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                >
                  <HelpCircle size={20} />
                  <span className="text-[11px] font-medium">{t('help.title')}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </nav>

      <ToastContainer />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
