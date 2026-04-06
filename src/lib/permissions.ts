/**
 * Role-Based Permissions System
 *
 * Roles: admin > planner > member
 * - Admin:   Full access (manage members, categories, roles, approve swaps, edit all duties)
 * - Planner: Can edit all duties, use paint mode, view stats. Cannot manage roles.
 * - Member:  Can only edit own duties, request swaps. Limited navigation.
 */

import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useDutyStore } from '@/stores/dutyStore'
import type { ViewType } from '@/types'

export type Role = 'admin' | 'planner' | 'member'

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Get the current user's role in the active team */
export function getCurrentUserRole(): Role {
  const userId = useAuthStore.getState().profile?.id
  if (!userId) return 'member'
  return useTeamStore.getState().getUserRole(userId) as Role
}

/** Check if the current user has at least the given role level */
export function hasMinRole(minRole: Role): boolean {
  const role = getCurrentUserRole()
  const hierarchy: Record<Role, number> = { admin: 3, planner: 2, member: 1 }
  return hierarchy[role] >= hierarchy[minRole]
}

/** Current user is admin */
export function isCurrentAdmin(): boolean {
  return getCurrentUserRole() === 'admin'
}

/** Current user is planner or admin */
export function isCurrentPlanner(): boolean {
  return hasMinRole('planner')
}

// ---------------------------------------------------------------------------
// Permission checks for specific actions
// ---------------------------------------------------------------------------

export const permissions = {
  // Navigation / Views
  canAccessView(view: ViewType): boolean {
    switch (view) {
      case 'dashboard': return true                    // everyone
      case 'calendar': return true                     // everyone
      case 'swaps':    return true                     // everyone can see swaps
      case 'team':     return true                     // everyone can see team
      case 'manage':   return hasMinRole('planner')    // planner+
      case 'stats':    return hasMinRole('planner')    // planner+
      default:         return false
    }
  },

  // Calendar editing
  canEditDuty(memberId: string): boolean {
    if (hasMinRole('planner')) return true  // planner+ can edit any duty
    // Members can only edit their own
    const userId = useAuthStore.getState().profile?.id
    if (!userId) return false
    const member = useDutyStore.getState().members.find((m) => m.id === memberId)
    return member?.user_id === userId
  },

  /** Can use paint mode (bulk assignment) */
  canUsePaintMode(): boolean {
    return hasMinRole('planner')
  },

  /** Can add/remove/reorder members */
  canManageMembers(): boolean {
    return hasMinRole('planner')
  },

  /** Can add/edit/remove categories */
  canManageCategories(): boolean {
    return hasMinRole('planner')
  },

  /** Can assign roles to other users */
  canManageRoles(): boolean {
    return isCurrentAdmin()
  },

  /** Can approve/reject swap requests */
  canApproveSwaps(): boolean {
    return hasMinRole('planner')
  },

  /** Can view statistics */
  canViewStats(): boolean {
    return hasMinRole('planner')
  },
}

// ---------------------------------------------------------------------------
// React hook for reactive permission checks
// ---------------------------------------------------------------------------

import { useMemo } from 'react'

/** Reactive hook that returns permissions based on current user's role */
export function usePermissions() {
  const userId = useAuthStore((s) => s.profile?.id)
  const roles = useTeamStore((s) => s.roles)
  const teamId = useTeamStore((s) => s.team?.id)

  return useMemo(() => {
    const role = userId
      ? (roles.find((r) => r.user_id === userId && r.team_id === teamId)?.role as Role) || 'member'
      : 'member' as Role

    const hierarchy: Record<Role, number> = { admin: 3, planner: 2, member: 1 }
    const hasMin = (min: Role) => hierarchy[role] >= hierarchy[min]

    return {
      role,
      isAdmin: role === 'admin',
      isPlanner: hasMin('planner'),
      isMember: role === 'member',

      canAccessView: (view: ViewType) => {
        if (view === 'dashboard' || view === 'calendar' || view === 'team' || view === 'swaps') return true
        return hasMin('planner')
      },
      canEditDuty: (memberId: string) => {
        if (hasMin('planner')) return true
        if (!userId) return false
        const member = useDutyStore.getState().members.find((m) => m.id === memberId)
        return member?.user_id === userId
      },
      canUsePaintMode: hasMin('planner'),
      canManageMembers: hasMin('planner'),
      canManageCategories: hasMin('planner'),
      canManageRoles: role === 'admin',
      canApproveSwaps: hasMin('planner'),
      canViewStats: hasMin('planner'),
    }
  }, [userId, roles, teamId])
}
