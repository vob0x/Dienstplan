import { useState, useRef, useEffect } from 'react'
import { useDutyStore } from '@/stores/dutyStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/i18n'
import { parseBackupJSON } from '@/lib/exportExcel'
import SmartImportModal from './SmartImportModal'
import { Upload, FileJson, ChevronDown, Zap } from 'lucide-react'

export default function ImportMenu() {
  const { t } = useI18n()
  const { importFromBackup } = useDutyStore()
  const addToast = useUiStore((s) => s.addToast)
  const [open, setOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [smartImportOpen, setSmartImportOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleJSONImport = () => {
    fileRef.current?.click()
    setOpen(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const { data, error } = parseBackupJSON(text)

      if (error || !data) {
        addToast({ type: 'error', message: error === 'PARSE_ERROR'
          ? 'JSON-Datei konnte nicht gelesen werden'
          : 'Ungültiges Backup-Format' })
        return
      }

      const result = await importFromBackup(data)
      addToast({
        type: 'success',
        message: `Import: ${result.members} ${t('members.title')}, ${result.categories} ${t('categories.title')}, ${result.duties} ${t('duty.pick')}`,
      })
    } catch {
      addToast({ type: 'error', message: 'Import fehlgeschlagen' })
    } finally {
      setImporting(false)
      // Reset file input so same file can be selected again
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div ref={ref} className="relative">
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        onClick={() => setOpen(!open)}
        disabled={importing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
        style={{
          background: open ? 'var(--surface-active)' : 'var(--surface)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          opacity: importing ? 0.6 : 1,
        }}
      >
        <Upload size={16} />
        {t('import.title')}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 rounded-xl z-50 min-w-[220px] animate-slide-in-down"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-hover)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <button
            onClick={() => {
              setSmartImportOpen(true)
              setOpen(false)
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgba(126,184,196,0.05)]"
            style={{ color: 'var(--text)' }}
          >
            <Zap size={16} style={{ color: 'var(--neon-cyan)' }} />
            <div>
              <div className="font-medium">{t('import.smartImport')}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {t('import.smartImportDesc')}
              </div>
            </div>
          </button>

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

          <button onClick={handleJSONImport}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgba(201,169,98,0.05)]"
            style={{ color: 'var(--text)' }}>
            <FileJson size={16} style={{ color: 'var(--neon-amber)' }} />
            <div>
              <div className="font-medium">{t('import.jsonBackup')}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {t('export.backupDescription')}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Smart Import Modal */}
      <SmartImportModal open={smartImportOpen} onClose={() => setSmartImportOpen(false)} />
    </div>
  )
}
