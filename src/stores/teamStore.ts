import { create } from 'zustand'
import { supabaseClient, isSupabaseAvailable } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/utils'
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
        supabaseClient.from('team_members').select('*, profiles!user_id(codename)').eq('team_id', teamId),
        supabaseClient.from('dp_roles').select('*').eq('team_id', teamId),
      ])

      const team = teamRes.data as Team | null
      let members = (membersRes.data || []) as any[]
      // Map profile codename to display_name
      members = members.map((m) => ({
        ...m,
        display_name: m.profiles?.codename || m.user_id?.slice(0, 8) || '...',
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

      localStorage.removeItem('dp_team')
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

      set({ roles: (data || []) as DpRole[] })
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
    return role?.role || 'member'
  },

  isAdmin: (userId) => get().getUserRole(userId) === 'admin',
  isPlanner: (userId) => {
    const role = get().getUserRole(userId)
    return role === 'admin' || role === 'planner'
  },
}))
