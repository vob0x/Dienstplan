import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore, subscribeToDutySync, unsubscribeFromDutySync } from '@/stores/dutyStore'
import { useTeamStore } from '@/stores/teamStore'
import { useSwapStore } from '@/stores/swapStore'
import { syncTeamMembersToDpMembers } from '@/lib/syncTeamMembers'
import { I18nProvider, useI18n } from '@/i18n'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import Layout from '@/components/Layout'
import LoginScreen from '@/components/Auth/LoginScreen'

function AppContent() {
  const { t } = useI18n()
  useKeyboardShortcuts()
  const { isAuthenticated, loading, initializeAuth } = useAuthStore()
  const { theme } = useUiStore()
  const fetchTeamData = useTeamStore((s) => s.fetchTeamData)
  const fetchAll = useDutyStore((s) => s.fetchAll)
  const fetchSwaps = useSwapStore((s) => s.fetchSwaps)
  const team = useTeamStore((s) => s.team)

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Load team data and duties once authenticated, then auto-sync team members → dp_members
  useEffect(() => {
    if (isAuthenticated) {
      fetchTeamData().then(async () => {
        const currentTeam = useTeamStore.getState().team
        if (currentTeam) {
          await fetchAll(currentTeam.id)
          await syncTeamMembersToDpMembers()
          subscribeToDutySync()
          fetchSwaps(currentTeam.id)
        }
      })
    }
    return () => { unsubscribeFromDutySync() }
  }, [isAuthenticated, fetchTeamData, fetchAll])

  // Refetch when team changes
  useEffect(() => {
    if (team) {
      fetchAll(team.id).then(() => {
        subscribeToDutySync()
      })
      fetchSwaps(team.id)
    }
  }, [team?.id, fetchAll, fetchSwaps])

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'cyber')
  }, [theme])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--neon-cyan)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{t('ui.loading')}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <Layout />
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
