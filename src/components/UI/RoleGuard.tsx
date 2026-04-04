/**
 * RoleGuard — Conditionally renders children based on the current user's role.
 *
 * Usage:
 *   <RoleGuard minRole="planner">
 *     <SensitiveContent />
 *   </RoleGuard>
 *
 *   <RoleGuard minRole="admin" fallback={<p>Kein Zugriff</p>}>
 *     <AdminPanel />
 *   </RoleGuard>
 */
import type { ReactNode } from 'react'
import { usePermissions, type Role } from '@/lib/permissions'
import { useI18n } from '@/i18n'

interface RoleGuardProps {
  /** Minimum role required to render children */
  minRole: Role
  /** What to render when the user doesn't have permission (default: nothing) */
  fallback?: ReactNode
  /** Show a styled "no access" message instead of nothing */
  showDenied?: boolean
  children: ReactNode
}

export default function RoleGuard({ minRole, fallback, showDenied, children }: RoleGuardProps) {
  const { t } = useI18n()
  const { role } = usePermissions()

  const hierarchy: Record<Role, number> = { admin: 3, planner: 2, member: 1 }
  const hasAccess = hierarchy[role] >= hierarchy[minRole]

  if (hasAccess) return <>{children}</>

  if (fallback) return <>{fallback}</>

  if (showDenied) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center px-6 py-8 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
            {t('roles.noAccess')}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('roles.noAccessHint')}
          </p>
        </div>
      </div>
    )
  }

  return null
}
