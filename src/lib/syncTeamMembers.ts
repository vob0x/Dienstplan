/**
 * Auto-sync: Ensures every team_member has a corresponding dp_member in the calendar.
 * Called on login, refresh, polling, and visibility change.
 */
import { useTeamStore } from '@/stores/teamStore'
import { useDutyStore } from '@/stores/dutyStore'

export async function syncTeamMembersToDpMembers(): Promise<number> {
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
      } catch { /* duplicate name or other — skip */ }
    }
  }

  return synced
}
