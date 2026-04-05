import { useSwapStore } from '@/stores/swapStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useUiStore } from '@/stores/uiStore'
import type { DpShiftSwap } from '@/types'

// ---------------------------------------------------------------------------
// Browser Notification API wrapper
// ---------------------------------------------------------------------------
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showBrowserNotification(title: string, body: string, tag?: string) {
  if (getNotificationPermission() !== 'granted') return
  // Only show when tab is NOT focused
  if (document.hasFocus()) return
  try {
    const opts: NotificationOptions & { renotify?: boolean } = {
      body,
      icon: './icon-192.png',
      tag: tag || 'dienstplan-swap',
      renotify: true,
    }
    const n = new Notification(title, opts as NotificationOptions)
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    // SW-based notification fallback
    navigator.serviceWorker?.ready?.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: './icon-192.png',
        tag: tag || 'dienstplan-swap',
      })
    }).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Swap badge count – how many actionable swaps for the current user
// ---------------------------------------------------------------------------
export function getSwapBadgeCount(): number {
  const swaps = useSwapStore.getState().swaps
  const profile = useAuthStore.getState().profile
  const members = useDutyStore.getState().members
  if (!profile) return 0

  const myMember = members.find((m) => m.user_id === profile.id)
  if (!myMember) return 0

  const isPlanner = useTeamStore.getState().isPlanner(profile.id)

  let count = 0
  for (const s of swaps) {
    // Incoming swap waiting for MY response
    if (s.status === 'pending_responder' && s.target_member_id === myMember.id) {
      count++
    }
    // Swap waiting for admin/planner approval
    if ((s.status === 'accepted' || s.status === 'pending_approval') && isPlanner) {
      count++
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// Process Realtime swap changes → notifications
// ---------------------------------------------------------------------------
let previousSwapMap: Map<string, DpShiftSwap> = new Map()

export function initSwapNotifications() {
  // Snapshot current swaps as baseline (no notifications on initial load)
  const swaps = useSwapStore.getState().swaps
  previousSwapMap = new Map(swaps.map((s) => [s.id, s]))
}

export function processSwapChanges() {
  const swaps = useSwapStore.getState().swaps
  const profile = useAuthStore.getState().profile
  const members = useDutyStore.getState().members
  const addToast = useUiStore.getState().addToast

  if (!profile) return

  const myMember = members.find((m) => m.user_id === profile.id)
  if (!myMember) return

  const isPlanner = useTeamStore.getState().isPlanner(profile.id)

  const getMemberName = (id: string) => members.find((m) => m.id === id)?.name || '?'

  const newMap = new Map(swaps.map((s) => [s.id, s]))

  for (const [id, swap] of newMap) {
    const prev = previousSwapMap.get(id)

    // === NEW swap (didn't exist before) ===
    if (!prev) {
      // Notify target member of incoming swap request
      if (swap.status === 'pending_responder' && swap.target_member_id === myMember.id) {
        const from = getMemberName(swap.requester_member_id)
        addToast({ type: 'info', message: `🔄 ${from} möchte einen Dienst tauschen` })
        showBrowserNotification(
          'Neue Tausch-Anfrage',
          `${from} möchte einen Dienst am ${formatDateShort(swap.target_date)} tauschen`,
          `swap-new-${id}`
        )
      }

      // Notify planner/admin of new reassignment needing approval
      if (swap.status === 'pending_approval' && isPlanner && swap.requester_member_id !== myMember.id) {
        addToast({ type: 'info', message: '📋 Neue Zuweisung wartet auf Genehmigung' })
        showBrowserNotification(
          'Genehmigung erforderlich',
          `${getMemberName(swap.requester_member_id)} → ${getMemberName(swap.target_member_id)}`,
          `swap-approval-${id}`
        )
      }
      continue
    }

    // === STATUS CHANGED ===
    if (prev.status === swap.status) continue

    // Responder accepted → Notify requester + planner/admin
    if (swap.status === 'accepted') {
      if (swap.requester_member_id === myMember.id) {
        const partner = getMemberName(swap.target_member_id)
        addToast({ type: 'success', message: `✅ ${partner} hat den Tausch angenommen` })
        showBrowserNotification('Tausch angenommen', `${partner} hat deine Anfrage angenommen`, `swap-accepted-${id}`)
      }
      if (isPlanner) {
        addToast({ type: 'info', message: '📋 Tausch wartet auf Genehmigung' })
        showBrowserNotification(
          'Genehmigung erforderlich',
          `${getMemberName(swap.requester_member_id)} ↔ ${getMemberName(swap.target_member_id)}`,
          `swap-needs-approval-${id}`
        )
      }
    }

    // Responder rejected → Notify requester
    if (swap.status === 'rejected_responder' && swap.requester_member_id === myMember.id) {
      const partner = getMemberName(swap.target_member_id)
      addToast({ type: 'warning', message: `❌ ${partner} hat den Tausch abgelehnt` })
      showBrowserNotification('Tausch abgelehnt', `${partner} hat deine Anfrage abgelehnt`, `swap-rejected-${id}`)
    }

    // Admin approved → Notify both parties
    if (swap.status === 'approved') {
      if (swap.requester_member_id === myMember.id || swap.target_member_id === myMember.id) {
        addToast({ type: 'success', message: '✅ Schicht-Tausch wurde genehmigt' })
        showBrowserNotification(
          'Tausch genehmigt!',
          `${getMemberName(swap.requester_member_id)} ↔ ${getMemberName(swap.target_member_id)} am ${formatDateShort(swap.target_date)}`,
          `swap-approved-${id}`
        )
      }
    }

    // Admin rejected → Notify both parties
    if (swap.status === 'rejected_approval') {
      if (swap.requester_member_id === myMember.id || swap.target_member_id === myMember.id) {
        addToast({ type: 'warning', message: '❌ Schicht-Tausch wurde nicht genehmigt' })
        showBrowserNotification(
          'Tausch nicht genehmigt',
          `Der Tausch am ${formatDateShort(swap.target_date)} wurde abgelehnt`,
          `swap-rejected-approval-${id}`
        )
      }
    }

    // Cancelled → Notify target
    if (swap.status === 'cancelled' && swap.target_member_id === myMember.id) {
      const from = getMemberName(swap.requester_member_id)
      addToast({ type: 'info', message: `${from} hat die Anfrage zurückgezogen` })
    }
  }

  previousSwapMap = newMap
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}.${d.getMonth() + 1}.`
}
