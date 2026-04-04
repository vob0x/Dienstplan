import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useDutyStore } from '@/stores/dutyStore'
import { useTeamStore } from '@/stores/teamStore'
import { useI18n } from '@/i18n'
import { exportToExcel, exportToJSON } from '@/lib/exportExcel'
import { Download, FileSpreadsheet, FileJson, Printer, ChevronDown } from 'lucide-react'

export default function ExportMenu() {
  const { t, tArray, language } = useI18n()
  const { year, month } = useUiStore()
  const { members, categories, duties } = useDutyStore()
  const team = useTeamStore((s) => s.team)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const monthNames = tArray('months') as string[]
  const dayNames = tArray('days') as string[]

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleExcelMonth = async () => {
    setOpen(false)
    await exportToExcel({ year, month, members, categories, duties, language, monthNames, dayNames })
  }

  const handleExcelYear = async () => {
    setOpen(false)
    await exportToExcel({ year, month: -1, members, categories, duties, language, monthNames, dayNames })
  }

  const handleJSON = () => {
    exportToJSON(members, categories, duties, team?.name || 'Dienstplan')
    setOpen(false)
  }

  const handlePrint = () => {
    setOpen(false)
    window.print()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
        style={{
          background: open ? 'var(--surface-active)' : 'var(--surface)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <Download size={16} />
        {t('export.title')}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 rounded-xl z-50 min-w-[200px] animate-slide-in-down"
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-hover)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <button onClick={handleExcelMonth}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgba(201,169,98,0.05)]"
            style={{ color: 'var(--text)' }}>
            <FileSpreadsheet size={16} style={{ color: 'var(--neon-green)' }} />
            <div>
              <div className="font-medium">{t('export.excel')} – {monthNames[month]}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {monthNames[month]} {year}
              </div>
            </div>
          </button>

          <button onClick={handleExcelYear}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgba(201,169,98,0.05)]"
            style={{ color: 'var(--text)' }}>
            <FileSpreadsheet size={16} style={{ color: 'var(--neon-cyan)' }} />
            <div>
              <div className="font-medium">{t('export.excel')} – {year}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {t('export.fullYear')} + {t('export.statistics')}
              </div>
            </div>
          </button>

          <div className="mx-3 my-1" style={{ borderTop: '1px solid var(--border)' }} />

          <button onClick={handleJSON}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgba(201,169,98,0.05)]"
            style={{ color: 'var(--text)' }}>
            <FileJson size={16} style={{ color: 'var(--neon-amber)' }} />
            <div>
              <div className="font-medium">{t('export.json')}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {t('export.backupDescription')}
              </div>
            </div>
          </button>

          <div className="mx-3 my-1" style={{ borderTop: '1px solid var(--border)' }} />

          <button onClick={handlePrint}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[rgba(201,169,98,0.05)]"
            style={{ color: 'var(--text)' }}>
            <Printer size={16} style={{ color: 'var(--text-secondary)' }} />
            <div>
              <div className="font-medium">{t('export.print')}</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
