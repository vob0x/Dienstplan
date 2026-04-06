/**
 * Auto-sync: Ensures every team_member has a corresponding dp_member in the calendar.
 * Called on login, refresh, polling, and visibility change.
 */
import { useTeamStore } from '@/stores/teamStore'
import { useDutyStore } from '@/stores/dutyStore'
import { ensureValidSession } from '@/lib/supabase'

export async function syncTeamMembersToDpMembers(): Promise<number> {
  // Validate session first — avoids spamming 401s for each member
  const sessionValid = await ensureValidSession()
  if (!sessionValid) {
    console.warn('[Sync] Skipping team sync — no valid session')
    return 0
  }

  const teamMembers = useTeamStore.getState().members
  const dpMembers = useDutyStore.getState().members
  let synced = 0

  for (const tm of teamMembers) {
    const alreadyLinked = dpMembers.some((m) => m.user_id === tm.user_id)
    if (!alreadyLinked) {
      const displayName = tm.display_name || tm.user_id.slice(0, 8)
      try {
        const newMember = await useDutyStore.getState().addMember(displayName)
        if (newMember) {
          await useDutyStore.getState().updateMember(newMember.id, { user_id: tm.user_id })
          synced++
        }
      } catch (e) {
        // duplicate name, RLS denial, or other — skip silently
        console.debug('[Sync] Skipping member:', displayName, e)
      }
    }
  }

  return synced
}
