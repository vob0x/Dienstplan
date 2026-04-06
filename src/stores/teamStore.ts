import { create } from 'zustand'
import { supabaseClient, isSupabaseAvailable } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/utils'
import { useDutyStore, unsubscribeFromDutySync } from '@/stores/dutyStore'
import { useSwapStore } from '@/stores/swapStore'
import type { Team, TeamMember, DpRole } from '@/types'

interface TeamState {
  team: Team | null
  members: TeamMember[]
  roles: DpRole[]
  loading: boolean
  error: string | null

  // Actions
  fetchTeamData: () => Promise<void>
  createTeam: (name: string) => Promise<Team | null>
  joinTeam: (inviteCode: string) => Promise<boolean>
  leaveTeam: () => Promise<void>

  // Roles
  fetchRoles: () => Promise<void>
  setRole: (userId: string, role: 'admin' | 'planner' | 'member') => Promise<void>
  removeRole: (userId: string) => Promise<void>
  getUserRole: (userId: string) => 'admin' | 'planner' | 'member'
  isAdmin: (userId: string) => boolean
  isPlanner: (userId: string) => boolean
}

export const useTeamStore = create<TeamState>((set, get) => ({
  team: null,
  members: [],
  roles: [],
  loading: false,
  error: null,

  fetchTeamData: async () => {
    set({ loading: true })
    if (!isSupabaseAvailable() || !supabaseClient) {
      // Load from localStorage
      const storedTeam = localStorage.getItem('dp_team')
      if (storedTeam) {
        const team = JSON.parse(storedTeam) as Team
        set({ team, loading: false })
      } else {
        set({ loading: false })
      }
      return
    }

    try {
      // Get user's team membership
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (!session?.user) { set({ loading: false }); return }

      const { data: memberships } = await supabaseClient
        .from('team_members')
        .select('team_id')
        .eq('user_id', session.user.id)

      if (!memberships || memberships.length === 0) {
        set({ team: null, members: [], loading: false })
        return
      }

      // Get the first team
      const teamId = memberships[0].team_id
      const [teamRes, membersRes, rolesRes] = await Promise.all([
        supabaseClient.from('teams').select('*').eq('id', teamId).single(),
        supabaseClient.from('team_members').select('*').eq('team_id', teamId),
        supabaseClient.from('dp_roles').select('*').eq('team_id', teamId),
      ])

      const team = teamRes.data as Team | null
      let members = (membersRes.data || []) as any[]

      // Fetch codenames separately (the FK join profiles!user_id may not exist)
      const userIds = members.map((m: any) => m.user_id).filter(Boolean)
      let profileMap: Record<string, string> = {}
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('id, codename')
          .in('id', userIds)
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.codename]))
        }
      }

      members = members.map((m: any) => ({
        ...m,
        display_name: profileMap[m.user_id] || m.user_id?.slice(0, 8) || '...',
      })) as TeamMember[]
      const roles = (rolesRes.data || []) as DpRole[]

      if (team) localStorage.setItem('dp_team', JSON.stringify(team))

      set({ team, members, roles, loading: false })
    } catch (e) {
      console.warn('Failed to fetch team data:', e)
      set({ loading: false, error: 'Failed to load team data' })
    }
  },

  createTeam: async (name) => {
    if (!isSupabaseAvailable() || !supabaseClient) return null

    try {
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (!session?.user) return null

      const inviteCode = generateInviteCode()
      const { data: team, error } = await supabaseClient
        .from('teams')
        .insert({ name, creator_id: session.user.id, invite_code: inviteCode })
        .select()
        .single()

      if (error) throw error

      // Add creator as team member
      await supabaseClient
        .from('team_members')
        .insert({ team_id: team.id, user_id: session.user.id })

      // Creator auto-gets admin role via trigger, but ensure it
      const typedTeam = team as Team
      // Clear stale localStorage data from any previous team
      const oldTeamJson = localStorage.getItem('dp_team')
      if (oldTeamJson) {
        try {
          const oldTeam = JSON.parse(oldTeamJson) as Team
          if (oldTeam.id !== typedTeam.id) {
            localStorage.removeItem(`dp_members_${oldTeam.id}`)
            localStorage.removeItem(`dp_categories_${oldTeam.id}`)
            localStorage.removeItem(`dp_duties_${oldTeam.id}`)
          }
        } catch {}
      }
      localStorage.setItem('dp_team', JSON.stringify(typedTeam))

      set({
        team: typedTeam,
        members: [{ id: '', team_id: typedTeam.id, user_id: session.user.id, joined_at: new Date().toISOString(), display_name: session.user.id?.slice(0, 8) }],
      })

      // Refresh roles (trigger should have created admin)
      await get().fetchRoles()

      return typedTeam
    } catch (e) {
      console.error('Failed to create team:', e)
      set({ error: 'Failed to create team' })
      return null
    }
  },

  joinTeam: async (inviteCode) => {
    if (!isSupabaseAvailable() || !supabaseClient) return false

    try {
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (!session?.user) return false

      const { data: team } = await supabaseClient
        .from('teams')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (!team) {
        set({ error: 'Team not found' })
        return false
      }

      // Join as member
      const { error } = await supabaseClient
        .from('team_members')
        .insert({ team_id: team.id, user_id: session.user.id })

      if (error) {
        if (error.message?.includes('duplicate')) {
          // Already a member
          set({ error: 'ALREADY_MEMBER' })
        } else {
          throw error
        }
        return false
      }

      // Add default member role
      await supabaseClient
        .from('dp_roles')
        .insert({ team_id: team.id, user_id: session.user.id, role: 'member' })
        .single()

      const typedTeam = team as Team
      // Clear stale localStorage data from any previous team
      const oldTeamJson = localStorage.getItem('dp_team')
      if (oldTeamJson) {
        try {
          const oldTeam = JSON.parse(oldTeamJson) as Team
          if (oldTeam.id !== typedTeam.id) {
            localStorage.removeItem(`dp_members_${oldTeam.id}`)
            localStorage.removeItem(`dp_categories_${oldTeam.id}`)
            localStorage.removeItem(`dp_duties_${oldTeam.id}`)
          }
        } catch {}
      }
      localStorage.setItem('dp_team', JSON.stringify(typedTeam))
      set({ team: typedTeam })

      await get().fetchTeamData()
      return true
    } catch (e) {
      console.error('Failed to join team:', e)
      set({ error: 'Failed to join team' })
      return false
    }
  },

  leaveTeam: async () => {
    const { team } = get()
    if (!team || !isSupabaseAvailable() || !supabaseClient) return

    try {
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (!session?.user) return

      await supabaseClient
        .from('team_members')
        .delete()
        .eq('team_id', team.id)
        .eq('user_id', session.user.id)

      await supabaseClient
        .from('dp_roles')
        .delete()
        .eq('team_id', team.id)
        .eq('user_id', session.user.id)

      // Clear ALL local data for this team — security: no stale data after leaving
      localStorage.removeItem('dp_team')
      localStorage.removeItem(`dp_members_${team.id}`)
      localStorage.removeItem(`dp_categories_${team.id}`)
      localStorage.removeItem(`dp_duties_${team.id}`)
      localStorage.removeItem('dp_setup_complete')

      // Stop realtime subscriptions
      unsubscribeFromDutySync()

      // Clear duty store (calendar data)
      useDutyStore.setState({
        members: [], categories: [], duties: [],
        teamId: null, undoStack: [], redoStack: [],
        canUndo: false, canRedo: false,
      })

      // Clear swap store
      useSwapStore.setState({ swaps: [] })

      // Clear team store
      set({ team: null, members: [], roles: [] })
    } catch (e) {
      console.error('Failed to leave team:', e)
    }
  },

  fetchRoles: async () => {
    const { team } = get()
    if (!team || !isSupabaseAvailable() || !supabaseClient) return

    try {
      const { data } = await supabaseClient
        .from('dp_roles')
        .select('*')
        .eq('team_id', team.id)

      const roles = (data || []) as DpRole[]
      set({ roles })

      // Auto-repair: if team creator has no role entry, insert admin
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (session?.user && team.creator_id === session.user.id) {
        const hasRole = roles.some((r) => r.user_id === session.user.id)
        if (!hasRole) {
          await supabaseClient
            .from('dp_roles')
            .upsert({ team_id: team.id, user_id: session.user.id, role: 'admin' }, { onConflict: 'team_id,user_id' })
          set((s) => ({
            roles: [...s.roles, { id: '', team_id: team.id, user_id: session.user.id, role: 'admin', created_at: new Date().toISOString() }],
          }))
        }
      }
    } catch (e) {
      console.warn('Failed to fetch roles:', e)
    }
  },

  setRole: async (userId, role) => {
    const { team } = get()
    if (!team || !isSupabaseAvailable() || !supabaseClient) return

    try {
      await supabaseClient
        .from('dp_roles')
        .upsert({ team_id: team.id, user_id: userId, role }, { onConflict: 'team_id,user_id' })

      set((s) => ({
        roles: s.roles.some((r) => r.user_id === userId && r.team_id === team.id)
          ? s.roles.map((r) => r.user_id === userId && r.team_id === team.id ? { ...r, role } : r)
          : [...s.roles, { id: '', team_id: team.id, user_id: userId, role, created_at: new Date().toISOString() }],
      }))
    } catch (e) {
      console.error('Failed to set role:', e)
    }
  },

  removeRole: async (userId) => {
    const { team } = get()
    if (!team || !isSupabaseAvailable() || !supabaseClient) return

    try {
      await supabaseClient
        .from('dp_roles')
        .delete()
        .eq('team_id', team.id)
        .eq('user_id', userId)

      set((s) => ({ roles: s.roles.filter((r) => !(r.user_id === userId && r.team_id === team.id)) }))
    } catch (e) {
      console.error('Failed to remove role:', e)
    }
  },

  getUserRole: (userId) => {
    const { roles, team } = get()
    const role = roles.find((r) => r.user_id === userId && r.team_id === team?.id)
    if (role?.role) return role.role
    // Fallback: team creator is always admin (handles pre-migration teams)
    if (team?.creator_id === userId) return 'admin'
    return 'member'
  },

  isAdmin: (userId) => get().getUserRole(userId) === 'admin',
  isPlanner: (userId) => {
    const role = get().getUserRole(userId)
    return role === 'admin' || role === 'planner'
  },
}))
