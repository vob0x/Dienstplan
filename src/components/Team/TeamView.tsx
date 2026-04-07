import { useState } from 'react'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { changePassword } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { getNotificationPermission, requestNotificationPermission } from '@/lib/notifications'
import Modal from '@/components/UI/Modal'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { Users, Plus, LogIn, Copy, Shield, Crown, UserCog, Bell, KeyRound, Loader2, User } from 'lucide-react'

export default function TeamView() {
  const { t } = useI18n()
  const { team, members, createTeam, joinTeam, leaveTeam, setRole, isAdmin, getUserRole } = useTeamStore()
  const profile = useAuthStore((s) => s.profile)
  const addToast = useUiStore((s) => s.addToast)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentUserIsAdmin = profile ? isAdmin(profile.id) : false
  const [notifPerm, setNotifPerm] = useState<string>(() => getNotificationPermission())
  const [notifDismissed, setNotifDismissed] = useState(() => !!localStorage.getItem('dp_notif_dismissed'))

  // Password change
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async () => {
    setPwError('')
    if (pwNew.length < 6) { setPwError(t('auth.errors.password_short')); return }
    if (pwNew !== pwConfirm) { setPwError(t('auth.errors.password_mismatch')); return }
    setPwLoading(true)
    const result = await changePassword(pwCurrent, pwNew)
    setPwLoading(false)
    if (result.success) {
      addToast({ type: 'success', message: t('auth.passwordChanged') })
      setPwModalOpen(false)
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
    } else if (result.error === 'WRONG_PASSWORD') {
      setPwError(t('auth.wrongPassword'))
    } else {
      setPwError(result.error || t('errors.unknown'))
    }
  }

  const handleEnableNotifs = async () => {
    const granted = await requestNotificationPermission()
    setNotifPerm(granted ? 'granted' : 'denied')
  }
  const dismissNotifBanner = () => {
    setNotifDismissed(true)
    localStorage.setItem('dp_notif_dismissed', '1')
  }

  const handleCreate = async () => {
    if (!teamName.trim()) return
    setSubmitting(true)
    const newTeam = await createTeam(teamName.trim())
    setSubmitting(false)
    if (newTeam) {
      addToast({ type: 'success', message: `${t('team.createdSuccess')} ${newTeam.invite_code}` })
      setCreateOpen(false)
      setTeamName('')
    } else {
      addToast({ type: 'error', message: t('errors.unknown') })
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setSubmitting(true)
    const success = await joinTeam(inviteCode.trim())
    setSubmitting(false)
    if (success) {
      addToast({ type: 'success', message: t('team.joinedSuccess') })
      setJoinOpen(false)
      setInviteCode('')
    } else {
      addToast({ type: 'error', message: t('team.joinError') })
    }
  }

  const handleLeave = async () => {
    await leaveTeam()
    addToast({ type: 'info', message: t('team.leftSuccess') })
  }

  const copyCode = async () => {
    if (team?.invite_code) {
      try {
        await navigator.clipboard.writeText(team.invite_code)
        addToast({ type: 'success', message: t('team.codeCopied') })
      } catch {
        // Fallback for browsers that deny clipboard access
        addToast({ type: 'info', message: `Code: ${team.invite_code}` })
      }
    }
  }

  if (!team) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <Users size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
          {t('team.noTeam')}
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>{t('team.noTeamHint')}</p>

        <div className="flex gap-3 justify-center">
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all"
            style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}>
            <Plus size={18} /> {t('team.create')}
          </button>
          <button onClick={() => setJoinOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <LogIn size={18} /> {t('team.join')}
          </button>
        </div>

        {/* Create Team Modal */}
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('team.create')}>
          <div className="space-y-4">
            <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)}
              placeholder={t('team.namePlaceholder')} className="w-full px-4 py-2.5 rounded-xl outline-none"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()} autoFocus />
            <button onClick={handleCreate} disabled={submitting || !teamName.trim()}
              className="w-full py-2.5 rounded-xl font-semibold" style={{ background: 'var(--neon-cyan)', color: '#0A0B0F', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? t('ui.loading') : t('team.create')}
            </button>
          </div>
        </Modal>

        {/* Join Team Modal */}
        <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title={t('team.join')}>
          <div className="space-y-4">
            <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder={t('team.codePlaceholder')} maxLength={6}
              className="w-full px-4 py-2.5 rounded-xl outline-none font-mono text-center text-xl tracking-widest"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()} autoFocus />
            <button onClick={handleJoin} disabled={submitting || inviteCode.length < 6}
              className="w-full py-2.5 rounded-xl font-semibold" style={{ background: 'var(--neon-cyan)', color: '#0A0B0F', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? t('ui.loading') : t('team.join')}
            </button>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Team header */}
      <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{team.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>
              {team.invite_code}
            </span>
            <button onClick={copyCode} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}><Copy size={14} /></button>
          </div>
        </div>
        <button onClick={() => setLeaveConfirm(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--danger)', background: 'rgba(212,112,110,0.1)' }}>
          {t('team.leave')}
        </button>
      </div>

      {/* Notification prompt — show once if not yet granted/dismissed */}
      {notifPerm === 'default' && !notifDismissed && (
        <div className="flex items-center gap-3 p-3 rounded-xl animate-slide-in-down"
          style={{ background: 'rgba(184,168,224,0.08)', border: '1px solid rgba(184,168,224,0.2)' }}>
          <Bell size={18} style={{ color: 'var(--neon-violet)', flexShrink: 0 }} />
          <p className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
            {t('notifications.enableHint')}
          </p>
          <button onClick={handleEnableNotifs}
            className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
            style={{ background: 'var(--neon-violet)', color: '#fff' }}>
            {t('notifications.enable')}
          </button>
          <button onClick={dismissNotifBanner}
            className="text-xs px-2 py-1.5 rounded-lg flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}>
            {t('ui.close')}
          </button>
        </div>
      )}

      {/* Approvals and swaps moved to dedicated Swaps tab in V2 */}

      {/* Members & Roles */}
      <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
          {t('team.members')} ({members.length})
        </h3>
        <div className="space-y-2">
          {members.map((member) => {
            const role = getUserRole(member.user_id)
            const isMe = member.user_id === profile?.id
            const roleIcon = role === 'admin' ? Crown : role === 'planner' ? UserCog : Shield
            const RoleIcon = roleIcon

            return (
              <div key={member.id} className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ background: isMe ? 'var(--surface-active)' : 'transparent' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
                    <RoleIcon size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {member.display_name || member.user_id?.slice(0, 8) || '...'}
                      {isMe && <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>({t('team.youIndicator')})</span>}
                    </span>
                    <div className="text-[10px] font-mono" style={{ color: role === 'admin' ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                      {t(`team.role.${role}`)}
                    </div>
                  </div>
                </div>

                {currentUserIsAdmin && !isMe && (
                  <select
                    value={role}
                    onChange={(e) => setRole(member.user_id, e.target.value as 'admin' | 'planner' | 'member')}
                    className="text-xs px-2 py-1 rounded-lg outline-none cursor-pointer"
                    style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <option value="admin">{t('team.role.admin')}</option>
                    <option value="planner">{t('team.role.planner')}</option>
                    <option value="member">{t('team.role.member')}</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Profile section */}
      {profile && (
        <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
            {t('nav.dashboard') === 'Start' ? 'Profil' : 'Profil'}
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--surface-active)', color: 'var(--neon-cyan)' }}>
                <User size={20} />
              </div>
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{profile.codename}</span>
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {currentUserIsAdmin ? t('team.role.admin') : getUserRole(profile.id) === 'planner' ? t('team.role.planner') : t('team.role.member')}
                </div>
              </div>
            </div>
            <button onClick={() => { setPwModalOpen(true); setPwError('') }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: 'var(--surface-active)', color: 'var(--text-secondary)' }}>
              <KeyRound size={14} /> {t('auth.changePassword')}
            </button>
          </div>
        </div>
      )}

      {/* Password change modal */}
      <Modal open={pwModalOpen} onClose={() => { setPwModalOpen(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('') }} title={t('auth.changePassword')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('auth.currentPassword')}</label>
            <input type="password" value={pwCurrent} onChange={(e) => { setPwCurrent(e.target.value); setPwError('') }}
              className="w-full px-4 py-2.5 rounded-xl outline-none text-sm"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
              autoFocus />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('auth.newPassword')}</label>
            <input type="password" value={pwNew} onChange={(e) => { setPwNew(e.target.value); setPwError('') }}
              className="w-full px-4 py-2.5 rounded-xl outline-none text-sm"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{t('auth.newPasswordConfirm')}</label>
            <input type="password" value={pwConfirm} onChange={(e) => { setPwConfirm(e.target.value); setPwError('') }}
              onKeyDown={(e) => e.key === 'Enter' && !pwLoading && handleChangePassword()}
              className="w-full px-4 py-2.5 rounded-xl outline-none text-sm"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>
          {pwError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{pwError}</p>}
          <button onClick={handleChangePassword}
            disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--neon-cyan)', color: '#0A0B0F', opacity: pwLoading || !pwCurrent || !pwNew || !pwConfirm ? 0.5 : 1 }}>
            {pwLoading && <Loader2 size={16} className="animate-spin" />}
            {t('auth.changePassword')}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={leaveConfirm} onClose={() => setLeaveConfirm(false)}
        onConfirm={handleLeave} title={t('team.leave')} message={t('team.confirmLeave')} danger />
    </div>
  )
}
