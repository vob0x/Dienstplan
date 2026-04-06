/**
 * V2 Setup Wizard
 * Guides first-time users through initial team setup
 */
import { useState } from 'react'
import { useDutyStore } from '@/stores/dutyStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { UserPlus, Tag, Rocket, ChevronRight, Plus, Check } from 'lucide-react'

const COLOR_PALETTE = [
  '#7EB8C4', '#E5A84B', '#B8A8E0', '#6EC49E', '#D4706E', '#8B8578',
  '#C48B9F', '#5BA4CF', '#E88D67', '#82C97D', '#C49BC4', '#D4AA6B',
]

interface Props {
  onComplete: () => void
}

type WizardStep = 'members' | 'categories' | 'done'

export default function SetupWizard({ onComplete }: Props) {
  const { t } = useI18n()
  const { members, categories, addMember, addCategory } = useDutyStore()
  const addToast = useUiStore((s) => s.addToast)

  const [step, setStep] = useState<WizardStep>('members')
  const [memberInput, setMemberInput] = useState('')
  const [catName, setCatName] = useState('')
  const [catLetter, setCatLetter] = useState('')
  const [catColor, setCatColor] = useState(COLOR_PALETTE[0])

  const handleAddMember = async () => {
    if (!memberInput.trim()) return
    try {
      await addMember(memberInput.trim())
      setMemberInput('')
    } catch (err) {
      if (err instanceof Error && err.message === 'duplicate') {
        addToast({ type: 'warning', message: t('members.duplicate') })
      }
    }
  }

  const handleAddCategory = async () => {
    if (!catName.trim()) return
    const letter = catLetter || catName.charAt(0).toUpperCase()
    const color = catColor || COLOR_PALETTE[categories.length % COLOR_PALETTE.length]
    await addCategory({ name: catName.trim(), letter, color })
    setCatName('')
    setCatLetter('')
    setCatColor(COLOR_PALETTE[(categories.length + 1) % COLOR_PALETTE.length])
  }

  const handleFinish = () => {
    localStorage.setItem('dp_setup_complete', '1')
    onComplete()
  }

  const steps: { id: WizardStep; icon: typeof UserPlus; title: string }[] = [
    { id: 'members', icon: UserPlus, title: t('setup.step2Title') },
    { id: 'categories', icon: Tag, title: t('setup.step3Title') },
    { id: 'done', icon: Rocket, title: t('setup.step4Title') },
  ]

  const currentIdx = steps.findIndex((s) => s.id === step)

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={{
                background: i <= currentIdx ? 'var(--neon-cyan)' : 'var(--surface)',
                color: i <= currentIdx ? '#0A0B0F' : 'var(--text-muted)',
                border: i <= currentIdx ? 'none' : '1px solid var(--border)',
              }}>
              {i < currentIdx ? <Check size={14} /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-0.5 rounded" style={{ background: i < currentIdx ? 'var(--neon-cyan)' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'members' && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <UserPlus size={32} className="mx-auto mb-3" style={{ color: 'var(--neon-cyan)' }} />
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {t('setup.step2Title')}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('setup.step2Desc')}</p>
          </div>

          {/* Add member input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              placeholder={t('members.namePlaceholder')}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
              autoFocus
            />
            <button
              onClick={handleAddMember}
              disabled={!memberInput.trim()}
              className="px-4 py-3 rounded-xl font-medium text-sm transition-all"
              style={{
                background: memberInput.trim() ? 'var(--neon-cyan)' : 'var(--surface)',
                color: memberInput.trim() ? '#0A0B0F' : 'var(--text-muted)',
              }}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Added members */}
          {members.length > 0 && (
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Check size={14} style={{ color: 'var(--success)' }} />
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{m.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Next button */}
          <button
            onClick={() => setStep('categories')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: members.length > 0 ? 'var(--neon-cyan)' : 'var(--surface-active)',
              color: members.length > 0 ? '#0A0B0F' : 'var(--text-secondary)',
            }}
          >
            {members.length > 0 ? t('setup.looksGood') : t('setup.skip')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {step === 'categories' && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <Tag size={32} className="mx-auto mb-3" style={{ color: 'var(--neon-cyan)' }} />
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {t('setup.step3Title')}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('setup.step3Desc')}</p>
          </div>

          {/* Category form */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={catName}
                onChange={(e) => {
                  setCatName(e.target.value)
                  if (!catLetter || catLetter === catName.charAt(0).toUpperCase()) {
                    setCatLetter(e.target.value.charAt(0).toUpperCase())
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder={t('categories.name')}
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
                autoFocus
              />
              <input
                type="text"
                value={catLetter}
                onChange={(e) => setCatLetter(e.target.value.slice(0, 2).toUpperCase())}
                placeholder={t('categories.letter')}
                maxLength={2}
                className="w-14 px-3 py-3 rounded-xl text-sm text-center font-mono outline-none"
                style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <button
                onClick={handleAddCategory}
                disabled={!catName.trim()}
                className="px-4 py-3 rounded-xl font-medium text-sm transition-all"
                style={{
                  background: catName.trim() ? 'var(--neon-cyan)' : 'var(--surface)',
                  color: catName.trim() ? '#0A0B0F' : 'var(--text-muted)',
                }}
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Color picker */}
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button key={c} onClick={() => setCatColor(c)}
                  className="w-7 h-7 rounded-lg transition-transform"
                  style={{
                    background: c,
                    border: catColor === c ? '3px solid var(--text)' : '2px solid transparent',
                    transform: catColor === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Added categories */}
          {categories.length > 0 && (
            <div className="space-y-1">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
                    style={{ background: `${cat.color}33`, color: cat.color }}>
                    {cat.letter}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{cat.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Next button */}
          <button
            onClick={() => setStep('done')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: categories.length > 0 ? 'var(--neon-cyan)' : 'var(--surface-active)',
              color: categories.length > 0 ? '#0A0B0F' : 'var(--text-secondary)',
            }}
          >
            {categories.length > 0 ? t('setup.looksGood') : t('setup.skip')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-6 animate-fade-in text-center">
          <div>
            <Rocket size={48} className="mx-auto mb-4" style={{ color: 'var(--neon-cyan)' }} />
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {t('setup.step4Title')}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('setup.step4Desc')}</p>
          </div>

          {/* Summary */}
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--neon-cyan)' }}>{members.length}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('members.title')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--neon-violet)' }}>{categories.length}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('categories.title')}</div>
            </div>
          </div>

          <button
            onClick={handleFinish}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}
          >
            {t('setup.done')} 🎉
          </button>
        </div>
      )}
    </div>
  )
}
