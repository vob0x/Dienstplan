import { create } from 'zustand'
import { supabaseClient, isSupabaseAvailable } from '@/lib/supabase'
import { generateId } from '@/lib/utils'
import { useDutyStore } from '@/stores/dutyStore'
import type { DpShiftSwap } from '@/types'

// localStorage helpers
function loadLocal<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : null
  } catch { return null }
}
function saveLocal<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* */ }
}

interface SwapState {
  swaps: DpShiftSwap[]
  loading: boolean

  fetchSwaps: (teamId: string) => Promise<void>
  requestSwap: (swap: Omit<DpShiftSwap, 'id' | 'created_at' | 'updated_at' | 'accepted_at' | 'approved_by' | 'approved_at'>) => Promise<DpShiftSwap | null>
  respondToSwap: (swapId: string, accept: boolean, note?: string) => Promise<void>
  approveSwap: (swapId: string, approve: boolean, adminNote?: string) => Promise<void>
  cancelSwap: (swapId: string) => Promise<void>
  deleteSwap: (swapId: string) => Promise<void>
}

export const useSwapStore = create<SwapState>((set, get) => ({
  swaps: [],
  loading: false,

  fetchSwaps: async (teamId) => {
    set({ loading: true })

    if (!isSupabaseAvailable() || !supabaseClient) {
      const stored = loadLocal<DpShiftSwap[]>(`dp_swaps_${teamId}`)
      set({ swaps: stored || [], loading: false })
      return
    }

    try {
      const { data } = await supabaseClient
        .from('dp_shift_swaps')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

      const swaps = (data || []) as DpShiftSwap[]
      saveLocal(`dp_swaps_${teamId}`, swaps)
      set({ swaps, loading: false })
    } catch (e) {
      console.warn('Failed to fetch swaps:', e)
      const stored = loadLocal<DpShiftSwap[]>(`dp_swaps_${teamId}`)
      set({ swaps: stored || [], loading: false })
    }
  },

  requestSwap: async (swapData) => {
    const now = new Date().toISOString()
    const swap: DpShiftSwap = {
      ...swapData,
      id: generateId(),
      created_at: now,
      updated_at: now,
      accepted_at: null,
      approved_by: null,
      approved_at: null,
    }

    set((s) => ({ swaps: [swap, ...s.swaps] }))
    saveLocal(`dp_swaps_${swap.team_id}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const { data } = await supabaseClient.from('dp_shift_swaps').insert(swap).select().single()
        if (data) {
          set((s) => ({ swaps: s.swaps.map((sw) => sw.id === swap.id ? (data as DpShiftSwap) : sw) }))
        }
      } catch (e) {
        console.warn('Failed to save swap remotely:', e)
      }
    }

    return swap
  },

  respondToSwap: async (swapId, accept, note) => {
    const now = new Date().toISOString()
    const status = accept ? 'accepted' : 'rejected'

    set((s) => ({
      swaps: s.swaps.map((sw) => sw.id === swapId ? {
        ...sw, status, responder_note: note || sw.responder_note,
        accepted_at: accept ? now : sw.accepted_at, updated_at: now,
      } : sw),
    }))

    const teamId = get().swaps.find((sw) => sw.id === swapId)?.team_id
    if (teamId) saveLocal(`dp_swaps_${teamId}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        await supabaseClient.from('dp_shift_swaps')
          .update({ status, responder_note: note, accepted_at: accept ? now : null, updated_at: now })
          .eq('id', swapId)
      } catch (e) { console.warn('Failed to update swap:', e) }
    }
  },

  approveSwap: async (swapId, approve, adminNote) => {
    const now = new Date().toISOString()
    const status = approve ? 'approved' : 'rejected'

    set((s) => ({
      swaps: s.swaps.map((sw) => sw.id === swapId ? {
        ...sw, status, admin_note: adminNote || sw.admin_note,
        approved_at: now, updated_at: now,
      } : sw),
    }))

    const teamId = get().swaps.find((sw) => sw.id === swapId)?.team_id
    if (teamId) saveLocal(`dp_swaps_${teamId}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        await supabaseClient.from('dp_shift_swaps')
          .update({ status, admin_note: adminNote, approved_at: now, updated_at: now })
          .eq('id', swapId)
      } catch (e) { console.warn('Failed to approve swap:', e) }
    }

    // Auto-update calendar on approval
    if (approve) {
      const swap = get().swaps.find(s => s.id === swapId)
      if (swap) {
        const dutyStore = useDutyStore.getState()
        const requesterDuties = dutyStore.getDuties(swap.requester_member_id, swap.target_date)
        const targetDuties = dutyStore.getDuties(swap.target_member_id, swap.target_date)

        // Remove old duties for both
        for (const d of requesterDuties) {
          await dutyStore.removeDuty(swap.requester_member_id, swap.target_date, d.category_id)
        }
        for (const d of targetDuties) {
          await dutyStore.removeDuty(swap.target_member_id, swap.target_date, d.category_id)
        }

        // Set swapped duties
        for (const d of requesterDuties) {
          await dutyStore.setDuty(swap.target_member_id, swap.target_date, d.category_id, d.note || undefined)
        }
        for (const d of targetDuties) {
          await dutyStore.setDuty(swap.requester_member_id, swap.target_date, d.category_id, d.note || undefined)
        }
      }
    }
  },

  cancelSwap: async (swapId) => {
    const now = new Date().toISOString()

    set((s) => ({
      swaps: s.swaps.map((sw) => sw.id === swapId ? { ...sw, status: 'cancelled' as const, updated_at: now } : sw),
    }))

    const teamId = get().swaps.find((sw) => sw.id === swapId)?.team_id
    if (teamId) saveLocal(`dp_swaps_${teamId}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        await supabaseClient.from('dp_shift_swaps')
          .update({ status: 'cancelled', updated_at: now })
          .eq('id', swapId)
      } catch (e) { console.warn('Failed to cancel swap:', e) }
    }
  },

  deleteSwap: async (swapId) => {
    const swap = get().swaps.find(s => s.id === swapId)
    set((s) => ({ swaps: s.swaps.filter(sw => sw.id !== swapId) }))
    if (swap) saveLocal(`dp_swaps_${swap.team_id}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        await supabaseClient.from('dp_shift_swaps').delete().eq('id', swapId)
      } catch (e) { console.warn('Failed to delete swap:', e) }
    }
  },
}))
