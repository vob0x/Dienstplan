import { create } from 'zustand'
import { supabaseClient, isSupabaseAvailable } from '@/lib/supabase'
import { generateId } from '@/lib/utils'
import type { DpMember, DpCategory, DpDuty, UndoAction } from '@/types'
import type { BackupData } from '@/lib/exportExcel'

interface DutyState {
  // Data
  members: DpMember[]
  categories: DpCategory[]
  duties: DpDuty[]
  teamId: string | null

  // Undo
  undoStack: UndoAction[]
  redoStack: UndoAction[]

  // Loading
  loading: boolean

  // Actions – Members
  setTeamId: (id: string | null) => void
  fetchAll: (teamId: string) => Promise<void>
  addMember: (name: string) => Promise<DpMember | null>
  updateMember: (id: string, updates: Partial<DpMember>) => Promise<void>
  removeMember: (id: string) => Promise<void>
  reorderMembers: (memberIds: string[]) => Promise<void>

  // Actions – Categories
  addCategory: (cat: Partial<DpCategory>) => Promise<DpCategory | null>
  updateCategory: (id: string, updates: Partial<DpCategory>) => Promise<void>
  removeCategory: (id: string) => Promise<void>

  // Actions – Duties
  setDuty: (memberId: string, date: string, categoryId: string, note?: string) => Promise<void>
  removeDuty: (memberId: string, date: string, categoryId?: string) => Promise<void>
  bulkSetDuties: (entries: Array<{ memberId: string; date: string; categoryId: string; note?: string }>) => Promise<void>
  bulkRemoveDuties: (keys: Array<{ memberId: string; date: string }>) => Promise<void>
  getDuty: (memberId: string, date: string) => DpDuty | undefined
  getDuties: (memberId: string, date: string) => DpDuty[]

  // Approvals
  updateApprovalStatus: (dutyId: string, status: 'approved' | 'rejected') => Promise<void>

  // Import
  importFromBackup: (backup: BackupData) => Promise<{ members: number; categories: number; duties: number }>

  // Undo/Redo
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

// localStorage helpers
function loadLocal<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : null
  } catch { return null }
}

function saveLocal(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

export const useDutyStore = create<DutyState>((set, get) => ({
  members: [],
  categories: [],
  duties: [],
  teamId: null,
  undoStack: [],
  redoStack: [],
  loading: false,

  setTeamId: (id) => set({ teamId: id }),

  fetchAll: async (teamId: string) => {
    set({ loading: true, teamId })

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const [membersRes, catsRes, dutiesRes] = await Promise.all([
          supabaseClient.from('dp_members').select('*').eq('team_id', teamId).order('sort_order'),
          supabaseClient.from('dp_categories').select('*').eq('team_id', teamId).order('sort_order'),
          supabaseClient.from('dp_duties').select('*').eq('team_id', teamId),
        ])

        const members = (membersRes.data || []) as DpMember[]
        const categories = (catsRes.data || []) as DpCategory[]
        const duties = (dutiesRes.data || []) as DpDuty[]

        saveLocal(`dp_members_${teamId}`, members)
        saveLocal(`dp_categories_${teamId}`, categories)
        saveLocal(`dp_duties_${teamId}`, duties)

        set({ members, categories, duties, loading: false })
        return
      } catch (e) {
        console.warn('Supabase fetch failed, using local data:', e)
      }
    }

    // Offline fallback
    set({
      members: loadLocal(`dp_members_${teamId}`) || [],
      categories: loadLocal(`dp_categories_${teamId}`) || [],
      duties: loadLocal(`dp_duties_${teamId}`) || [],
      loading: false,
    })
  },

  // -- Members --

  addMember: async (name: string) => {
    const { teamId, members } = get()
    if (!teamId) return null

    // Check for duplicate name (case-insensitive)
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('duplicate')
    }

    const member: DpMember = {
      id: generateId(),
      team_id: teamId,
      name,
      sort_order: members.length,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    set((s) => ({ members: [...s.members, member] }))
    saveLocal(`dp_members_${teamId}`, get().members)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const { data } = await supabaseClient.from('dp_members').insert(member).select().single()
        if (data) {
          set((s) => ({ members: s.members.map((m) => m.id === member.id ? data as DpMember : m) }))
          saveLocal(`dp_members_${teamId}`, get().members)
          return data as DpMember
        }
      } catch (e) { console.warn('Failed to sync member:', e) }
    }
    return member
  },

  updateMember: async (id, updates) => {
    const { teamId } = get()
    set((s) => ({ members: s.members.map((m) => m.id === id ? { ...m, ...updates, updated_at: new Date().toISOString() } : m) }))
    saveLocal(`dp_members_${teamId}`, get().members)

    if (isSupabaseAvailable() && supabaseClient) {
      try { await supabaseClient.from('dp_members').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id) }
      catch (e) { console.warn('Failed to sync member update:', e) }
    }
  },

  removeMember: async (id) => {
    const { teamId, members, duties } = get()
    // Optimistic local removal
    set((s) => ({
      members: s.members.filter((m) => m.id !== id),
      duties: s.duties.filter((d) => d.member_id !== id),
    }))
    saveLocal(`dp_members_${teamId}`, get().members)
    saveLocal(`dp_duties_${teamId}`, get().duties)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const { error } = await supabaseClient.from('dp_members').delete().eq('id', id)
        if (error) {
          console.error('Supabase delete failed (RLS?):', error.message)
          // Rollback: re-add member and duties locally since server rejected
          set({ members, duties })
          saveLocal(`dp_members_${teamId}`, members)
          saveLocal(`dp_duties_${teamId}`, duties)
          throw new Error('DELETE_BLOCKED')
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'DELETE_BLOCKED') throw e
        console.warn('Failed to sync member delete:', e)
      }
    }
  },

  reorderMembers: async (memberIds) => {
    const { teamId, members } = get()
    const updated = memberIds.map((id, i) => {
      const m = members.find((m) => m.id === id)
      return m ? { ...m, sort_order: i } : null
    }).filter(Boolean) as DpMember[]

    set({ members: updated })
    saveLocal(`dp_members_${teamId}`, updated)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        for (const m of updated) {
          await supabaseClient.from('dp_members').update({ sort_order: m.sort_order }).eq('id', m.id)
        }
      } catch (e) { console.warn('Failed to sync member reorder:', e) }
    }
  },

  // -- Categories --

  addCategory: async (cat) => {
    const { teamId, categories } = get()
    if (!teamId) return null

    const category: DpCategory = {
      id: generateId(),
      team_id: teamId,
      name: cat.name || 'Neu',
      letter: cat.letter?.slice(0, 2) || 'N',
      color: cat.color || '#7EB8C4',
      sort_order: categories.length,
      requires_approval: cat.requires_approval || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    set((s) => ({ categories: [...s.categories, category] }))
    saveLocal(`dp_categories_${teamId}`, get().categories)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const { data } = await supabaseClient.from('dp_categories').insert(category).select().single()
        if (data) {
          set((s) => ({ categories: s.categories.map((c) => c.id === category.id ? data as DpCategory : c) }))
          saveLocal(`dp_categories_${teamId}`, get().categories)
          return data as DpCategory
        }
      } catch (e) { console.warn('Failed to sync category:', e) }
    }
    return category
  },

  updateCategory: async (id, updates) => {
    const { teamId } = get()
    set((s) => ({ categories: s.categories.map((c) => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c) }))
    saveLocal(`dp_categories_${teamId}`, get().categories)

    if (isSupabaseAvailable() && supabaseClient) {
      try { await supabaseClient.from('dp_categories').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id) }
      catch (e) { console.warn('Failed to sync category update:', e) }
    }
  },

  removeCategory: async (id) => {
    const { teamId, duties } = get()
    const inUse = duties.some((d) => d.category_id === id)
    if (inUse) {
      console.warn('Cannot delete category: still in use')
      return
    }
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
    saveLocal(`dp_categories_${teamId}`, get().categories)

    if (isSupabaseAvailable() && supabaseClient) {
      try { await supabaseClient.from('dp_categories').delete().eq('id', id) }
      catch (e) { console.warn('Failed to sync category delete:', e) }
    }
  },

  // -- Duties --

  getDuty: (memberId, date) => {
    return get().duties.find((d) => d.member_id === memberId && d.date === date)
  },

  getDuties: (memberId, date) => {
    return get().duties.filter((d) => d.member_id === memberId && d.date === date)
  },

  setDuty: async (memberId, date, categoryId, note) => {
    const { teamId, duties } = get()
    if (!teamId) return

    // Check if this exact combination already exists
    const existing = duties.find((d) => d.member_id === memberId && d.date === date && d.category_id === categoryId)
    if (existing) return // Already exists, do nothing

    // Create new duty
    const duty: DpDuty = {
      id: generateId(),
      team_id: teamId,
      member_id: memberId,
      date,
      category_id: categoryId,
      note: note || null,
      approval_status: 'none',
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Check if category requires approval
    const cat = get().categories.find((c) => c.id === categoryId)
    if (cat?.requires_approval) {
      duty.approval_status = 'pending'
    }

    // Push undo
    const undoAction: UndoAction = {
      type: 'set_duty',
      data: duty,
      previousData: null,
      timestamp: Date.now(),
    }

    const newUndo = [...get().undoStack.slice(-19), undoAction]
    set({
      duties: [...get().duties, duty],
      undoStack: newUndo,
      redoStack: [],
      canUndo: newUndo.length > 0,
      canRedo: false,
    })
    saveLocal(`dp_duties_${teamId}`, get().duties)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        const { data } = await supabaseClient.from('dp_duties').insert(duty).select().single()
        if (data) {
          set((s) => ({ duties: s.duties.map((d) => d.id === duty.id ? data as DpDuty : d) }))
          saveLocal(`dp_duties_${teamId}`, get().duties)
        }
      } catch (e) { console.warn('Failed to sync duty insert:', e) }
    }
  },

  removeDuty: async (memberId, date, categoryId) => {
    const { teamId, duties } = get()

    // If categoryId provided, remove only that specific category; otherwise remove all for that member+date
    let toRemove: DpDuty[]
    if (categoryId) {
      toRemove = duties.filter((d) => d.member_id === memberId && d.date === date && d.category_id === categoryId)
    } else {
      toRemove = duties.filter((d) => d.member_id === memberId && d.date === date)
    }

    if (toRemove.length === 0) return

    // Create undo action for each removed duty
    const undoActions: UndoAction[] = toRemove.map((existing) => ({
      type: 'delete_duty',
      data: existing,
      previousData: existing,
      timestamp: Date.now(),
    }))

    // For simplicity, just add the first one to undo stack (could be improved to handle arrays)
    const newUndoR = undoActions.length > 0
      ? [...get().undoStack.slice(-19), undoActions[0]]
      : get().undoStack

    set({
      duties: get().duties.filter((d) => !toRemove.find((tr) => tr.id === d.id)),
      undoStack: newUndoR,
      redoStack: [],
      canUndo: newUndoR.length > 0,
      canRedo: false,
    })
    saveLocal(`dp_duties_${teamId}`, get().duties)

    if (isSupabaseAvailable() && supabaseClient) {
      try {
        for (const duty of toRemove) {
          await supabaseClient.from('dp_duties').delete().eq('id', duty.id)
        }
      } catch (e) { console.warn('Failed to sync duty delete:', e) }
    }
  },

  bulkSetDuties: async (entries) => {
    for (const e of entries) {
      await get().setDuty(e.memberId, e.date, e.categoryId, e.note)
    }
  },

  bulkRemoveDuties: async (keys) => {
    for (const k of keys) {
      await get().removeDuty(k.memberId, k.date)
    }
  },

  // -- Undo/Redo --

  undo: () => {
    const { undoStack, duties } = get()
    if (undoStack.length === 0) return
    const action = undoStack[undoStack.length - 1]
    const newUndo = undoStack.slice(0, -1)
    const newRedo = [...get().redoStack, action]

    let newDuties = duties
    if (action.type === 'set_duty' && action.previousData) {
      const prev = action.previousData as DpDuty
      newDuties = duties.map((d) => d.member_id === prev.member_id && d.date === prev.date ? prev : d)
    } else if (action.type === 'set_duty' && !action.previousData) {
      const duty = action.data as DpDuty
      newDuties = duties.filter((d) => !(d.member_id === duty.member_id && d.date === duty.date))
    } else if (action.type === 'delete_duty') {
      const duty = action.previousData as DpDuty
      newDuties = [...duties, duty]
    }

    set({ duties: newDuties, undoStack: newUndo, redoStack: newRedo, canUndo: newUndo.length > 0, canRedo: newRedo.length > 0 })
    saveLocal(`dp_duties_${get().teamId}`, newDuties)
  },

  updateApprovalStatus: async (dutyId, status) => {
    const teamId = get().teamId
    const duty = get().duties.find((d) => d.id === dutyId)
    if (!duty) return

    const updatedDuty = { ...duty, approval_status: status, updated_at: new Date().toISOString() }

    set((s) => ({
      duties: s.duties.map((d) => d.id === dutyId ? updatedDuty : d),
    }))
    saveLocal(`dp_duties_${teamId}`, get().duties)

    if (isSupabaseAvailable() && supabaseClient && teamId) {
      try {
        await supabaseClient.from('dp_duties').update({ approval_status: status, updated_at: updatedDuty.updated_at }).eq('id', dutyId)
      } catch (e) {
        console.warn('Failed to update approval status remotely:', e)
      }
    }
  },

  importFromBackup: async (backup: BackupData) => {
    const { teamId } = get()
    if (!teamId) return { members: 0, categories: 0, duties: 0 }

    // Build ID mapping for members and categories (backup IDs → new IDs)
    const memberMap = new Map<string, string>()
    const categoryMap = new Map<string, string>()

    // Import categories first (map old IDs to new ones, skip duplicates by name)
    let catCount = 0
    const existingCats = get().categories
    for (const cat of backup.categories) {
      const existing = existingCats.find((c) => c.name === cat.name && c.letter === cat.letter)
      if (existing) {
        categoryMap.set(cat.id, existing.id)
      } else {
        const newCat = await get().addCategory({
          name: cat.name,
          letter: cat.letter,
          color: cat.color,
          requires_approval: cat.requires_approval,
        })
        if (newCat) {
          categoryMap.set(cat.id, newCat.id)
          catCount++
        }
      }
    }

    // Import members (skip duplicates by name)
    let memberCount = 0
    const existingMembers = get().members
    for (const member of backup.members) {
      const existing = existingMembers.find((m) => m.name === member.name)
      if (existing) {
        memberMap.set(member.id, existing.id)
      } else {
        const newMember = await get().addMember(member.name)
        if (newMember) {
          memberMap.set(member.id, newMember.id)
          memberCount++
        }
      }
    }

    // Import duties (skip existing member+date combos)
    let dutyCount = 0
    for (const duty of backup.duties) {
      const newMemberId = memberMap.get(duty.member_id)
      const newCatId = categoryMap.get(duty.category_id)
      if (!newMemberId || !newCatId) continue

      const existing = get().getDuty(newMemberId, duty.date)
      if (!existing) {
        await get().setDuty(newMemberId, duty.date, newCatId, duty.note || undefined)
        dutyCount++
      }
    }

    return { members: memberCount, categories: catCount, duties: dutyCount }
  },

  redo: () => {
    const { redoStack, duties } = get()
    if (redoStack.length === 0) return
    const action = redoStack[redoStack.length - 1]
    const newRedo = redoStack.slice(0, -1)
    const newUndo = [...get().undoStack, action]

    let newDuties = duties
    if (action.type === 'set_duty') {
      const duty = action.data as DpDuty
      const existing = duties.find((d) => d.member_id === duty.member_id && d.date === duty.date)
      if (existing) {
        newDuties = duties.map((d) => d.member_id === duty.member_id && d.date === duty.date ? { ...d, category_id: duty.category_id, note: duty.note } : d)
      } else {
        // Re-create duty with a proper ID
        const newDuty: DpDuty = { ...duty, id: duty.id || generateId(), team_id: get().teamId || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), approval_status: 'none', created_by: null }
        newDuties = [...duties, newDuty]
      }
    } else if (action.type === 'delete_duty') {
      const duty = action.data as DpDuty
      newDuties = duties.filter((d) => !(d.member_id === duty.member_id && d.date === duty.date))
    }

    set({ duties: newDuties, undoStack: newUndo, redoStack: newRedo, canUndo: newUndo.length > 0, canRedo: newRedo.length > 0 })
    saveLocal(`dp_duties_${get().teamId}`, newDuties)
  },

  canUndo: false,
  canRedo: false,
}))

// ============================================================================
// Realtime Subscriptions
// ============================================================================

// ============================================================================
// Realtime Subscriptions + Visibility Re-Fetch
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dutiesChannel: any = null
let visibilityHandler: (() => void) | null = null
let pollingInterval: ReturnType<typeof setInterval> | null = null

function syncLocalStorage() {
  const { teamId, members, categories, duties } = useDutyStore.getState()
  if (!teamId) return
  saveLocal(`dp_members_${teamId}`, members)
  saveLocal(`dp_categories_${teamId}`, categories)
  saveLocal(`dp_duties_${teamId}`, duties)
}

export function subscribeToDutySync() {
  const teamId = useDutyStore.getState().teamId
  if (!teamId || !isSupabaseAvailable() || !supabaseClient) return

  // Unsubscribe existing channel first to avoid duplicates
  unsubscribeFromDutySync()

  dutiesChannel = supabaseClient
    .channel(`dp_realtime_${teamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_duties', filter: `team_id=eq.${teamId}` }, (payload) => {
      const store = useDutyStore.getState()
      if (payload.eventType === 'INSERT') {
        const duty = payload.new as DpDuty
        if (!store.duties.find((d) => d.id === duty.id)) {
          useDutyStore.setState((s) => ({ duties: [...s.duties, duty] }))
          syncLocalStorage()
        }
      } else if (payload.eventType === 'UPDATE') {
        const duty = payload.new as DpDuty
        useDutyStore.setState((s) => ({ duties: s.duties.map((d) => d.id === duty.id ? duty : d) }))
        syncLocalStorage()
      } else if (payload.eventType === 'DELETE') {
        const old = payload.old as { id: string }
        if (old.id) {
          useDutyStore.setState((s) => ({ duties: s.duties.filter((d) => d.id !== old.id) }))
          syncLocalStorage()
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_members', filter: `team_id=eq.${teamId}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        const m = payload.new as DpMember
        const store = useDutyStore.getState()
        if (!store.members.find((x) => x.id === m.id)) {
          useDutyStore.setState((s) => ({ members: [...s.members, m] }))
          syncLocalStorage()
        }
      } else if (payload.eventType === 'UPDATE') {
        const m = payload.new as DpMember
        useDutyStore.setState((s) => ({ members: s.members.map((x) => x.id === m.id ? m : x) }))
        syncLocalStorage()
      } else if (payload.eventType === 'DELETE') {
        const old = payload.old as { id: string }
        if (old.id) {
          useDutyStore.setState((s) => ({
            members: s.members.filter((x) => x.id !== old.id),
            // Also remove duties for deleted member
            duties: s.duties.filter((d) => d.member_id !== old.id),
          }))
          syncLocalStorage()
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_categories', filter: `team_id=eq.${teamId}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        const c = payload.new as DpCategory
        const store = useDutyStore.getState()
        if (!store.categories.find((x) => x.id === c.id)) {
          useDutyStore.setState((s) => ({ categories: [...s.categories, c] }))
          syncLocalStorage()
        }
      } else if (payload.eventType === 'UPDATE') {
        const c = payload.new as DpCategory
        useDutyStore.setState((s) => ({ categories: s.categories.map((x) => x.id === c.id ? c : x) }))
        syncLocalStorage()
      } else if (payload.eventType === 'DELETE') {
        const old = payload.old as { id: string }
        if (old.id) {
          useDutyStore.setState((s) => ({ categories: s.categories.filter((x) => x.id !== old.id) }))
          syncLocalStorage()
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_shift_swaps', filter: `team_id=eq.${teamId}` }, async () => {
      // On any swap change, re-fetch all swaps then process notifications
      const { useSwapStore } = await import('@/stores/swapStore')
      await useSwapStore.getState().fetchSwaps(teamId)
      const { processSwapChanges } = await import('@/lib/notifications')
      processSwapChanges()
    })
    .subscribe((status: string) => {
      console.log('[Realtime]', status)
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Connected — fetching latest data')
        useDutyStore.getState().fetchAll(teamId)
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[Realtime] Connection issue — starting polling fallback')
        startPolling(teamId)
      }
    })

  // Visibility change handler: re-fetch when tab becomes visible (incl. team sync)
  if (!visibilityHandler) {
    visibilityHandler = async () => {
      if (document.visibilityState === 'visible') {
        const currentTeamId = useDutyStore.getState().teamId
        if (currentTeamId) {
          console.log('[Visibility] Tab active — re-fetching data + team sync')
          const { useTeamStore } = await import('@/stores/teamStore')
          await useTeamStore.getState().fetchTeamData()
          await useDutyStore.getState().fetchAll(currentTeamId)
          const { syncTeamMembersToDpMembers } = await import('@/lib/syncTeamMembers')
          await syncTeamMembersToDpMembers()
          const { useSwapStore } = await import('@/stores/swapStore')
          await useSwapStore.getState().fetchSwaps(currentTeamId)
        }
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)
  }

  // Polling fallback: every 30s re-fetch as safety net for when Realtime is not working
  startPolling(teamId)
}

function startPolling(teamId: string) {
  if (pollingInterval) clearInterval(pollingInterval)
  pollingInterval = setInterval(async () => {
    if (document.visibilityState === 'visible') {
      const { useTeamStore } = await import('@/stores/teamStore')
      await useTeamStore.getState().fetchTeamData()
      await useDutyStore.getState().fetchAll(teamId)
      const { syncTeamMembersToDpMembers } = await import('@/lib/syncTeamMembers')
      await syncTeamMembersToDpMembers()
      const { useSwapStore } = await import('@/stores/swapStore')
      await useSwapStore.getState().fetchSwaps(teamId)
    }
  }, 30000) // 30 seconds
}

export function unsubscribeFromDutySync() {
  if (dutiesChannel) {
    supabaseClient?.removeChannel(dutiesChannel)
    dutiesChannel = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}
