import { create } from 'zustand'
import { supabaseClient, isSupabaseAvailable } from '@/lib/supabase'
import { generateId } from '@/lib/utils'
import { useDutyStore } from '@/stores/dutyStore'
import type { DpShiftSwap, SwapStatus, SwapType } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadLocal<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null }
}
function saveLocal<T>(key: string, data: T) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* */ }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export interface SwapCreateInput {
  team_id: string
  swap_type: SwapType
  requester_member_id: string
  target_member_id: string
  requester_category_id: string | null
  target_category_id: string | null
  target_date: string
  requester_note: string | null
}

interface SwapState {
  swaps: DpShiftSwap[]
  loading: boolean

  fetchSwaps: (teamId: string) => Promise<void>

  /** Member or Planer creates a swap request */
  requestSwap: (input: SwapCreateInput) => Promise<DpShiftSwap | null>

  /** Admin creates a one-way reassignment (skips responder step) */
  createReassignment: (input: SwapCreateInput) => Promise<DpShiftSwap | null>

  /** Target member accepts or rejects */
  respondToSwap: (swapId: string, accept: boolean, note?: string) => Promise<void>

  /** Admin/Planer approves or rejects an accepted swap */
  approveSwap: (swapId: string, approve: boolean, adminUserId: string, note?: string) => Promise<void>

  /** Requester cancels their own pending swap */
  cancelSwap: (swapId: string) => Promise<void>

  /** Admin deletes a swap from history */
  deleteSwap: (swapId: string) => Promise<void>
}

export const useSwapStore = create<SwapState>((set, get) => ({
  swaps: [],
  loading: false,

  // ---------------------------------------------------------------------------
  fetchSwaps: async (teamId) => {
    set({ loading: true })
    if (!isSupabaseAvailable() || !supabaseClient) {
      set({ swaps: loadLocal<DpShiftSwap[]>(`dp_swaps_${teamId}`) || [], loading: false })
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
      set({ swaps: loadLocal<DpShiftSwap[]>(`dp_swaps_${teamId}`) || [], loading: false })
    }
  },

  // ---------------------------------------------------------------------------
  requestSwap: async (input) => {
    const now = new Date().toISOString()
    const swap: DpShiftSwap = {
      ...input,
      id: generateId(),
      swap_type: 'swap',
      status: 'pending_responder',
      responder_note: null,
      admin_note: null,
      accepted_at: null,
      approved_by: null,
      approved_at: null,
      created_at: now,
      updated_at: now,
    }

    set((s) => ({ swaps: [swap, ...s.swaps] }))
    saveLocal(`dp_swaps_${swap.team_id}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const { data } = await supabaseClient.from('dp_shift_swaps').insert(swap).select().single()
        if (data) {
          set((s) => ({ swaps: s.swaps.map((sw) => sw.id === swap.id ? (data as DpShiftSwap) : sw) }))
          saveLocal(`dp_swaps_${swap.team_id}`, get().swaps)
        }
      } catch (e) { console.warn('Failed to save swap:', e) }
    }
    return swap
  },

  // ---------------------------------------------------------------------------
  createReassignment: async (input) => {
    const now = new Date().toISOString()
    const swap: DpShiftSwap = {
      ...input,
      id: generateId(),
      swap_type: 'reassignment',
      status: 'pending_approval', // Skip responder step
      responder_note: null,
      admin_note: null,
      accepted_at: null,
      approved_by: null,
      approved_at: null,
      created_at: now,
      updated_at: now,
    }

    set((s) => ({ swaps: [swap, ...s.swaps] }))
    saveLocal(`dp_swaps_${swap.team_id}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const { data } = await supabaseClient.from('dp_shift_swaps').insert(swap).select().single()
        if (data) {
          set((s) => ({ swaps: s.swaps.map((sw) => sw.id === swap.id ? (data as DpShiftSwap) : sw) }))
          saveLocal(`dp_swaps_${swap.team_id}`, get().swaps)
        }
      } catch (e) { console.warn('Failed to save reassignment:', e) }
    }
    return swap
  },

  // ---------------------------------------------------------------------------
  respondToSwap: async (swapId, accept, note) => {
    const now = new Date().toISOString()
    const newStatus: SwapStatus = accept ? 'accepted' : 'rejected_responder'

    set((s) => ({
      swaps: s.swaps.map((sw) => sw.id === swapId ? {
        ...sw,
        status: newStatus,
        responder_note: note !== undefined ? note : sw.responder_note,
        accepted_at: accept ? now : sw.accepted_at,
        updated_at: now,
      } : sw),
    }))

    const teamId = get().swaps.find((sw) => sw.id === swapId)?.team_id
    if (teamId) saveLocal(`dp_swaps_${teamId}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        await supabaseClient.from('dp_shift_swaps')
          .update({
            status: newStatus,
            responder_note: note || null,
            accepted_at: accept ? now : null,
            updated_at: now,
          })
          .eq('id', swapId)
      } catch (e) { console.warn('Failed to respond to swap:', e) }
    }
  },

  // ---------------------------------------------------------------------------
  approveSwap: async (swapId, approve, adminUserId, note) => {
    const now = new Date().toISOString()
    const newStatus: SwapStatus = approve ? 'approved' : 'rejected_approval'

    set((s) => ({
      swaps: s.swaps.map((sw) => sw.id === swapId ? {
        ...sw,
        status: newStatus,
        admin_note: note !== undefined ? note : sw.admin_note,
        approved_by: adminUserId,
        approved_at: now,
        updated_at: now,
      } : sw),
    }))

    const teamId = get().swaps.find((sw) => sw.id === swapId)?.team_id
    if (teamId) saveLocal(`dp_swaps_${teamId}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        await supabaseClient.from('dp_shift_swaps')
          .update({
            status: newStatus,
            admin_note: note || null,
            approved_by: adminUserId,
            approved_at: now,
            updated_at: now,
          })
          .eq('id', swapId)
      } catch (e) { console.warn('Failed to approve swap:', e) }
    }

    // Execute the swap in the calendar
    if (approve) {
      const swap = get().swaps.find((s) => s.id === swapId)
      if (swap) {
        await executeSwapDuties(swap)
      }
    }
  },

  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  deleteSwap: async (swapId) => {
    const swap = get().swaps.find((s) => s.id === swapId)
    set((s) => ({ swaps: s.swaps.filter((sw) => sw.id !== swapId) }))
    if (swap) saveLocal(`dp_swaps_${swap.team_id}`, get().swaps)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        await supabaseClient.from('dp_shift_swaps').delete().eq('id', swapId)
      } catch (e) { console.warn('Failed to delete swap:', e) }
    }
  },
}))

// ---------------------------------------------------------------------------
// Execute swap: update calendar duties after approval
// ---------------------------------------------------------------------------
async function executeSwapDuties(swap: DpShiftSwap) {
  const ds = useDutyStore.getState()
  const { requester_member_id: reqId, target_member_id: tgtId, target_date: date } = swap

  try {
    if (swap.swap_type === 'reassignment') {
      // One-way: move requester's specific duty to target
      if (swap.requester_category_id) {
        await ds.removeDuty(reqId, date, swap.requester_category_id)
        await ds.setDuty(tgtId, date, swap.requester_category_id)
      }
      return
    }

    // Two-way swap: exchange specific categories between members
    const reqCatId = swap.requester_category_id
    const tgtCatId = swap.target_category_id

    // Remove the swapped duties first
    if (reqCatId) await ds.removeDuty(reqId, date, reqCatId)
    if (tgtCatId) await ds.removeDuty(tgtId, date, tgtCatId)

    // Re-assign swapped
    if (reqCatId) await ds.setDuty(tgtId, date, reqCatId)
    if (tgtCatId) await ds.setDuty(reqId, date, tgtCatId)
  } catch (e) {
    console.error('[Swap] executeSwapDuties failed — calendar may be inconsistent. Refreshing…', e)
    // Re-fetch all data to restore consistent state
    const teamId = swap.team_id
    if (teamId) {
      await ds.fetchAll(teamId)
    }
  }
}
