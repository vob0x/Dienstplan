import { useState, useRef } from 'react'
import { useDutyStore } from '@/stores/dutyStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { Plus, Pencil, Trash2, GripVertical, Check, X as XIcon } from 'lucide-react'

const COLOR_PALETTE = [
  '#7EB8C4', '#E5A84B', '#B8A8E0', '#6EC49E', '#D4706E', '#8B8578',
  '#C48B9F', '#5BA4CF', '#E88D67', '#82C97D', '#C49BC4', '#D4AA6B',
]

export default function ManageView() {
  const { t } = useI18n()
  const { members, categories, addMember, updateMember, removeMember, reorderMembers, addCategory, updateCategory, removeCategory } = useDutyStore()
  const addToast = useUiStore((s) => s.addToast)

  const [newMemberName, setNewMemberName] = useState('')
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [deleteMember, setDeleteMember] = useState<string | null>(null)

  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatLetter, setEditCatLetter] = useState('')
  const [editCatColor, setEditCatColor] = useState('')
  const [editCatApproval, setEditCatApproval] = useState(false)
  const [deleteCat, setDeleteCat] = useState<string | null>(null)

  // Drag-and-drop state for member reordering
  const dragMember = useRef<string | null>(null)
  const [dragOverMember, setDragOverMember] = useState<string | null>(null)

  const handleDragStart = (memberId: string) => {
    dragMember.current = memberId
  }

  const handleDragOver = (e: React.DragEvent, memberId: string) => {
    e.preventDefault()
    if (dragMember.current && dragMember.current !== memberId) {
      setDragOverMember(memberId)
    }
  }

  const handleDrop = (targetMemberId: string) => {
    if (!dragMember.current || dragMember.current === targetMemberId) return
    const fromIdx = members.findIndex((m) => m.id === dragMember.current)
    const toIdx = members.findIndex((m) => m.id === targetMemberId)
    if (fromIdx === -1 || toIdx === -1) return

    const newOrder = [...members]
    const [moved] = newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, moved)
    reorderMembers(newOrder.map((m) => m.id))
    dragMember.current = null
    setDragOverMember(null)
  }

  const handleDragEnd = () => {
    dragMember.current = null
    setDragOverMember(null)
  }
  const handleAddMember = async () => {
    if (!newMemberName.trim()) return
    try {
      await addMember(newMemberName.trim())
      setNewMemberName('')
      addToast({ type: 'success', message: `${newMemberName.trim()} ${t('members.addedSuccess')}` })
    } catch (error) {
      if (error instanceof Error && error.message === 'duplicate') {
        addToast({ type: 'warning', message: t('members.duplicate') })
      } else {
        addToast({ type: 'error', message: 'Error adding member' })
      }
    }
  }

  const handleSaveMember = async (id: string) => {
    if (!editMemberName.trim()) return
    await updateMember(id, { name: editMemberName.trim() })
    setEditingMember(null)
  }

  const handleDeleteMember = async () => {
    if (!deleteMember) return
    // Find the member data before deletion for undo
    const memberToDelete = members.find((m) => m.id === deleteMember)
    await removeMember(deleteMember)
    setDeleteMember(null)

    // Show toast with undo action
    addToast({
      type: 'info',
      message: t('members.removedSuccess'),
      undoAction: memberToDelete ? async () => {
        await addMember(memberToDelete.name)
      } : undefined,
    })
  }

  const handleAddCategory = async () => {
    const color = COLOR_PALETTE[categories.length % COLOR_PALETTE.length]
    const newName = t('categories.new')
    const result = await addCategory({ name: newName, letter: newName.charAt(0).toUpperCase(), color })
    if (result) {
      // Immediately open edit mode for the new category
      setEditingCat(result.id)
      setEditCatName(newName)
      setEditCatLetter(newName.charAt(0).toUpperCase())
      setEditCatColor(color)
      setEditCatApproval(false)
    }
  }

  const handleSaveCategory = async (id: string) => {
    await updateCategory(id, {
      name: editCatName, letter: editCatLetter.slice(0, 2).toUpperCase(),
      color: editCatColor, requires_approval: editCatApproval,
    })
    setEditingCat(null)
  }

  const handleDeleteCategory = async () => {
    if (!deleteCat) return
    removeCategory(deleteCat)
    setDeleteCat(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Members Section */}
      <section>
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
          {t('members.title')}
        </h2>

        {/* Add member */}
        <div className="flex gap-2 mb-4">
          <input
            type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)}
            placeholder={t('members.namePlaceholder')}
            className="flex-1 px-4 py-2 rounded-xl outline-none text-sm"
            style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
          />
          <button onClick={handleAddMember} className="px-4 py-2 rounded-xl font-medium text-sm"
            style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}
            title={t('members.add')}>
            <Plus size={18} />
          </button>
        </div>

        {/* Member list */}
        <div className="space-y-1">
          {members.map((member) => (
            <div key={member.id}
              draggable={editingMember !== member.id}
              onDragStart={() => handleDragStart(member.id)}
              onDragOver={(e) => handleDragOver(e, member.id)}
              onDrop={() => handleDrop(member.id)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-2 px-3 py-2 rounded-xl group transition-all"
              style={{
                background: dragOverMember === member.id ? 'var(--surface-active)' : 'var(--surface)',
                border: dragOverMember === member.id ? '1px solid var(--neon-cyan)' : '1px solid var(--border-light)',
                opacity: dragMember.current === member.id ? 0.5 : 1,
              }}>
              <GripVertical size={16} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />

              {editingMember === member.id ? (
                <>
                  <input type="text" value={editMemberName} onChange={(e) => setEditMemberName(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-solid)', border: '1px solid var(--border-hover)', color: 'var(--text)' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMember(member.id); if (e.key === 'Escape') setEditingMember(null) }}
                    autoFocus />
                  <button onClick={() => handleSaveMember(member.id)} style={{ color: 'var(--success)' }}><Check size={16} /></button>
                  <button onClick={() => setEditingMember(null)} style={{ color: 'var(--text-muted)' }}><XIcon size={16} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>{member.name}</span>
                  <button onClick={() => { setEditingMember(member.id); setEditMemberName(member.name) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}
                    title={t('members.edit')}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteMember(member.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--danger)' }}
                    title={t('members.remove')}>
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
            {t('categories.title')}
          </h2>
          <button onClick={handleAddCategory} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--surface-active)', color: 'var(--neon-cyan)' }}
            title={t('categories.add')}>
            <Plus size={16} /> {t('categories.add')}
          </button>
        </div>

        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="px-4 py-3 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {editingCat === cat.id ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" value={editCatName} onChange={(e) => {
                      const newName = e.target.value
                      setEditCatName(newName)
                      // Auto-generate letter from name initials (always, unless user manually edited letter)
                      const words = newName.trim().split(/\s+/).filter(Boolean)
                      const autoLetter = words.length >= 2
                        ? (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
                        : (newName.charAt(0).toUpperCase() || 'X')
                      // Auto-set if letter is default, empty, or was auto-generated from previous name
                      const prevWords = editCatName.trim().split(/\s+/).filter(Boolean)
                      const prevAuto = prevWords.length >= 2
                        ? (prevWords[0].charAt(0) + prevWords[1].charAt(0)).toUpperCase()
                        : (editCatName.charAt(0).toUpperCase() || 'X')
                      const defaultLetter = t('categories.new').charAt(0).toUpperCase()
                      if (!editCatLetter || editCatLetter === defaultLetter || editCatLetter === 'X' || editCatLetter.length <= 2 && editCatLetter === t('categories.new').slice(0, 2).toUpperCase() || editCatLetter === prevAuto) {
                        setEditCatLetter(autoLetter)
                      }
                    }}
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      placeholder={t('categories.name')} />
                    <input type="text" value={editCatLetter} onChange={(e) => setEditCatLetter(e.target.value.slice(0, 2).toUpperCase())}
                      className="w-14 px-3 py-1.5 rounded-lg text-sm text-center font-mono outline-none"
                      style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      placeholder={t('categories.letter')} maxLength={2} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_PALETTE.map((c) => (
                      <button key={c} onClick={() => setEditCatColor(c)}
                        className="w-7 h-7 rounded-lg transition-transform"
                        style={{ background: c, border: editCatColor === c ? '3px solid var(--text)' : '2px solid transparent', transform: editCatColor === c ? 'scale(1.15)' : 'scale(1)' }} />
                    ))}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={editCatApproval} onChange={(e) => setEditCatApproval(e.target.checked)} />
                      {t('categories.requiresApproval')}
                    </label>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('categories.approvalHint')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveCategory(cat.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--neon-cyan)', color: '#0A0B0F' }}>{t('ui.save')}</button>
                    <button onClick={() => setEditingCat(null)} className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ color: 'var(--text-muted)' }}>{t('ui.cancel')}</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: `${cat.color}22`, color: cat.color }}>{cat.letter}</span>
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>{cat.name}</span>
                  {cat.requires_approval && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--vacation-bg)', color: 'var(--vacation-text)' }}>
                      {t('categories.requiresApproval')}
                    </span>
                  )}
                  <button onClick={() => { setEditingCat(cat.id); setEditCatName(cat.name); setEditCatLetter(cat.letter); setEditCatColor(cat.color); setEditCatApproval(cat.requires_approval) }}
                    style={{ color: 'var(--text-muted)' }}
                    title={t('categories.edit')}><Pencil size={14} /></button>
                  <button onClick={() => setDeleteCat(cat.id)} style={{ color: 'var(--danger)' }}
                    title={t('categories.remove')}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog open={!!deleteMember} onClose={() => setDeleteMember(null)}
        onConfirm={handleDeleteMember} title={t('members.remove')} message={t('members.confirmRemove')} danger />

      <ConfirmDialog open={!!deleteCat} onClose={() => setDeleteCat(null)}
        onConfirm={handleDeleteCategory} title={t('categories.remove')} message={t('categories.confirmRemove')} danger />
    </div>
  )
}
