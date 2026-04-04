/**
 * Dienstplan V6 – Type Definitions
 * Shared auth types from Zeiterfassung, Dienstplan-specific types
 */

// ============================================================================
// Shared Auth (from Zeiterfassung)
// ============================================================================

export interface Profile {
  id: string
  codename: string
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  creator_id: string
  invite_code: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  display_name?: string
  joined_at: string
}

export interface Session {
  user: Profile
  access_token: string
  refresh_token: string
}

// ============================================================================
// Dienstplan-Specific Types
// ============================================================================

export interface DpMember {
  id: string
  team_id: string
  user_id?: string | null
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DpCategory {
  id: string
  team_id: string
  name: string
  letter: string // 1-2 Buchstaben, z.B. "A", "TI", "TE"
  color: string
  sort_order: number
  requires_approval: boolean
  created_at: string
  updated_at: string
}

export interface DpDuty {
  id: string
  team_id: string
  member_id: string
  date: string // YYYY-MM-DD
  category_id: string
  note?: string | null
  approval_status: 'none' | 'pending' | 'approved' | 'rejected'
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface DpRole {
  id: string
  team_id: string
  user_id: string
  role: 'admin' | 'planner' | 'member'
  created_at: string
}

// Swap statuses — lifecycle:
//   swap:          pending_responder → accepted → pending_approval → approved
//   reassignment:  pending_approval → approved (admin skips responder step)
export type SwapStatus =
  | 'pending_responder'   // Waiting for target to accept/reject
  | 'accepted'            // Target accepted, now needs admin approval
  | 'pending_approval'    // Marked for admin review (reassignment starts here)
  | 'approved'            // Admin approved — duties were swapped
  | 'rejected_responder'  // Target rejected
  | 'rejected_approval'   // Admin rejected
  | 'cancelled'           // Requester cancelled

export type SwapType = 'swap' | 'reassignment'

export interface DpShiftSwap {
  id: string
  team_id: string
  swap_type: SwapType
  requester_member_id: string
  target_member_id: string
  /** Category the requester offers to swap (from their duties on target_date) */
  requester_category_id: string | null
  /** Category the target has (on target_date) — null if no duty */
  target_category_id: string | null
  target_date: string
  status: SwapStatus
  requester_note: string | null
  responder_note: string | null
  admin_note: string | null
  accepted_at: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export interface DpApproval {
  id: string
  team_id: string
  duty_id: string
  requested_by: string
  status: 'pending' | 'approved' | 'rejected'
  note?: string | null
  decided_by?: string | null
  decided_at?: string | null
  created_at: string
  updated_at: string
}

export interface DpUserSettings {
  id: string
  user_id: string
  theme: Theme
  language: Language
  default_view: CalendarView
  created_at: string
  updated_at: string
}

// ============================================================================
// UI Types
// ============================================================================

export type Language = 'de' | 'fr'
export type Theme = 'cyber' | 'light'
export type CalendarView = 'month' | 'week' | 'day' | 'year'
export type ViewType = 'calendar' | 'team' | 'manage' | 'stats'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
  undoAction?: () => void
}

// ============================================================================
// Undo System
// ============================================================================

export interface UndoAction {
  type: 'set_duty' | 'delete_duty' | 'bulk_set' | 'bulk_delete'
  data: DpDuty | DpDuty[]
  previousData?: DpDuty | DpDuty[] | null
  timestamp: number
}

// ============================================================================
// Form Data
// ============================================================================

export interface SignInFormData {
  codename: string
  password: string
}

export interface SignUpFormData {
  codename: string
  password: string
  password_confirm: string
}

export interface DutyInput {
  member_id: string
  date: string
  category_id: string
  note?: string
}

// ============================================================================
// Holidays
// ============================================================================

export interface Holiday {
  date: string // YYYY-MM-DD
  name: string
  name_fr?: string
}
