import Modal from '@/components/UI/Modal'
import { useI18n } from '@/i18n'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { Code2, Users, GitBranch } from 'lucide-react'

interface HelpPanelProps {
  open: boolean
  onClose: () => void
}

export default function HelpPanel({ open, onClose }: HelpPanelProps) {
  const { t } = useI18n()
  // Initialize hook but don't enable keyboard handling (modal handles its own)
  useKeyboardShortcuts(false)

  return (
    <Modal open={open} onClose={onClose} title={t('help.title')} size="lg">
      <div className="space-y-8">
        {/* Keyboard Shortcuts Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Code2 size={20} style={{ color: 'var(--neon-cyan)' }} />
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {t('help.shortcuts')}
            </h3>
          </div>
          <div className="grid gap-2">
            {/* View shortcuts */}
            <div className="space-y-1">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('help.viewShortcuts')}
              </p>
              <div className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex justify-between">
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>M</kbd> - {t('help.shortcutsList.month')}</span>
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>W</kbd> - {t('help.shortcutsList.week')}</span>
                </div>
                <div className="flex justify-between">
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>D</kbd> - {t('help.shortcutsList.day')}</span>
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Y</kbd> - {t('help.shortcutsList.year')}</span>
                </div>
              </div>
            </div>

            {/* Navigation shortcuts */}
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('help.navigationShortcuts')}
              </p>
              <div className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex justify-between">
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>T</kbd> - {t('help.shortcutsList.today')}</span>
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>P</kbd> - {t('help.shortcutsList.paint')}</span>
                </div>
                <div className="flex justify-between">
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Esc</kbd> - {t('help.shortcutsList.escape')}</span>
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>?</kbd> - {t('help.title')}</span>
                </div>
              </div>
            </div>

            {/* Paint mode shortcuts */}
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('help.paintShortcuts')}
              </p>
              <div className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <p>{t('help.paintInfo')}</p>
              </div>
            </div>

            {/* Undo/Redo shortcuts */}
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('help.editShortcuts')}
              </p>
              <div className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex justify-between">
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Ctrl+Z</kbd> - {t('help.shortcutsList.undo')}</span>
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Ctrl+Y</kbd> - {t('help.shortcutsList.redo')}</span>
                </div>
              </div>
            </div>

            {/* Navigation view shortcuts */}
            <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('help.navViewShortcuts')}
              </p>
              <div className="grid gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <div className="flex justify-between">
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Alt+1</kbd> - {t('nav.calendar')}</span>
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Alt+2</kbd> - {t('nav.team')}</span>
                </div>
                <div className="flex justify-between">
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Alt+3</kbd> - {t('nav.manage')}</span>
                  <span><kbd className="px-2 py-0.5 rounded" style={{ background: 'var(--surface)' }}>Alt+4</kbd> - {t('nav.stats')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roles Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} style={{ color: 'var(--neon-cyan)' }} />
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {t('help.roles')}
            </h3>
          </div>
          <div className="space-y-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('team.role.admin')}</p>
              <p>{t('help.rolesDesc.admin')}</p>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('team.role.planner')}</p>
              <p>{t('help.rolesDesc.planner')}</p>
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('team.role.member')}</p>
              <p>{t('help.rolesDesc.member')}</p>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={20} style={{ color: 'var(--neon-cyan)' }} />
            <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {t('help.workflow')}
            </h3>
          </div>
          <div className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <div className="flex gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}>1</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('help.workflowSteps.step1Title')}</p>
                <p>{t('help.workflowSteps.step1')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}>2</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('help.workflowSteps.step2Title')}</p>
                <p>{t('help.workflowSteps.step2')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}>3</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{t('help.workflowSteps.step3Title')}</p>
                <p>{t('help.workflowSteps.step3')}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}
