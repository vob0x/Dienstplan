import { toDateStr, daysInMonth } from '@/lib/utils'
import { getHolidays, isHoliday, isWeekend } from '@/lib/holidays'
import type { DpMember, DpCategory, DpDuty } from '@/types'

interface ExportOptions {
  year: number
  month: number // 0-11, or -1 for full year
  members: DpMember[]
  categories: DpCategory[]
  duties: DpDuty[]
  language: string
  monthNames: string[]
  dayNames: string[]
}

/**
 * Build month data rows (shared between XLSX and CSV export)
 */
function buildMonthRows(
  year: number, month: number,
  members: DpMember[], categories: DpCategory[], duties: DpDuty[],
  language: string, dayNames: string[]
): (string | number)[][] {
  const days = daysInMonth(year, month)
  const holidays = getHolidays(year)
  const rows: (string | number)[][] = []

  // Header row
  const header: string[] = [language === 'fr' ? 'Collaborateur' : 'Mitarbeiter']
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d)
    const dow = date.getDay()
    const dayIdx = dow === 0 ? 6 : dow - 1
    header.push(`${dayNames[dayIdx] || ''} ${d}`)
  }
  rows.push(header)

  // Data rows
  for (const member of members) {
    const row: (string | number)[] = [member.name]
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const duty = duties.find((dt) => dt.member_id === member.id && dt.date === dateStr)
      if (duty) {
        const cat = categories.find((c) => c.id === duty.category_id)
        row.push(cat ? cat.letter : '?')
      } else {
        row.push('')
      }
    }
    rows.push(row)
  }

  // Holiday row
  const holidayRow: string[] = [language === 'fr' ? 'Jours fériés' : 'Feiertage']
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const holiday = isHoliday(dateStr, holidays)
    if (holiday) {
      holidayRow.push(language === 'fr' ? (holiday.name_fr || holiday.name) : holiday.name)
    } else {
      const date = new Date(year, month, d)
      holidayRow.push(isWeekend(date) ? 'WE' : '')
    }
  }
  rows.push([])
  rows.push(holidayRow)

  // Legend
  rows.push([])
  rows.push([language === 'fr' ? 'Légende:' : 'Legende:'])
  for (const cat of categories) {
    rows.push([`${cat.letter} = ${cat.name}`])
  }

  return rows
}

function buildStatsRows(
  year: number,
  members: DpMember[], categories: DpCategory[], duties: DpDuty[],
  language: string
): (string | number)[][] {
  const yearDuties = duties.filter((d) => d.date.startsWith(String(year)))
  const holidays = getHolidays(year)
  const holidayDates = new Set(holidays.map((h) => h.date))

  let businessDays = 0
  for (let m = 0; m < 12; m++) {
    const days = daysInMonth(year, m)
    for (let d = 1; d <= days; d++) {
      const date = new Date(year, m, d)
      if (!isWeekend(date) && !holidayDates.has(toDateStr(date))) {
        businessDays++
      }
    }
  }

  const rows: (string | number)[][] = []
  rows.push([
    language === 'fr' ? 'Collaborateur' : 'Mitarbeiter',
    ...categories.map((c) => c.name),
    language === 'fr' ? 'Total' : 'Gesamt',
  ])

  for (const member of members) {
    const memberDuties = yearDuties.filter((d) => d.member_id === member.id)
    const row: (string | number)[] = [member.name]
    for (const cat of categories) {
      row.push(memberDuties.filter((d) => d.category_id === cat.id).length)
    }
    row.push(memberDuties.length)
    rows.push(row)
  }

  rows.push([])
  rows.push([language === 'fr' ? 'Jours ouvrables' : 'Arbeitstage', businessDays])
  return rows
}

/**
 * Export as Excel (.xlsx) — dynamically imports SheetJS
 * Falls back to CSV if xlsx is not installed
 */
export async function exportToExcel(options: ExportOptions) {
  const { year, month, members, categories, duties, language, monthNames, dayNames } = options
  const activeMembers = members.filter((m) => m.is_active)

  let XLSX: any = null
  try {
    // Use variable to prevent Vite from statically analyzing this import
    const xlsxModule = 'xlsx'
    XLSX = await import(/* @vite-ignore */ xlsxModule)
  } catch {
    // xlsx not installed — fall back to CSV
    exportToCSV(options)
    return
  }

  const wb = XLSX.utils.book_new()

  if (month === -1) {
    for (let m = 0; m < 12; m++) {
      const rows = buildMonthRows(year, m, activeMembers, categories, duties, language, dayNames)
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 20 }, ...Array.from({ length: daysInMonth(year, m) }, () => ({ wch: 6 }))]
      XLSX.utils.book_append_sheet(wb, ws, monthNames[m])
    }
    const statsRows = buildStatsRows(year, activeMembers, categories, duties, language)
    const statsWs = XLSX.utils.aoa_to_sheet(statsRows)
    statsWs['!cols'] = [{ wch: 20 }, ...categories.map(() => ({ wch: 14 })), { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, statsWs, language === 'fr' ? 'Statistiques' : 'Statistik')
  } else {
    const rows = buildMonthRows(year, month, activeMembers, categories, duties, language, dayNames)
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, ...Array.from({ length: daysInMonth(year, month) }, () => ({ wch: 6 }))]
    XLSX.utils.book_append_sheet(wb, ws, monthNames[month])
  }

  const filename = month === -1
    ? `Dienstplan_${year}.xlsx`
    : `Dienstplan_${year}-${String(month + 1).padStart(2, '0')}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * CSV fallback when xlsx library is not installed
 */
function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((row) =>
    row.map((cell) => {
      const s = String(cell)
      return s.includes(';') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(';')
  ).join('\n')
}

function downloadCsv(csv: string, filename: string) {
  const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportToCSV(options: ExportOptions) {
  const { year, month, members, categories, duties, language, monthNames, dayNames } = options
  const activeMembers = members.filter((m) => m.is_active)

  if (month === -1) {
    // Full year: combine all months + stats into one CSV
    const allRows: (string | number)[][] = []
    for (let m = 0; m < 12; m++) {
      if (m > 0) { allRows.push([]); allRows.push([]) }
      allRows.push([`=== ${monthNames[m]} ${year} ===`])
      allRows.push(...buildMonthRows(year, m, activeMembers, categories, duties, language, dayNames))
    }
    allRows.push([]); allRows.push([])
    allRows.push([language === 'fr' ? '=== Statistiques ===' : '=== Statistik ==='])
    allRows.push(...buildStatsRows(year, activeMembers, categories, duties, language))

    downloadCsv(rowsToCsv(allRows), `Dienstplan_${year}.csv`)
  } else {
    const rows = buildMonthRows(year, month, activeMembers, categories, duties, language, dayNames)
    downloadCsv(rowsToCsv(rows), `Dienstplan_${year}-${String(month + 1).padStart(2, '0')}.csv`)
  }
}

/**
 * Export duties as JSON backup
 */
export function exportToJSON(
  members: DpMember[], categories: DpCategory[], duties: DpDuty[], teamName: string
) {
  const data = {
    version: '6.0.0',
    exportedAt: new Date().toISOString(),
    team: teamName,
    members,
    categories,
    duties,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Dienstplan_Backup_${toDateStr(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * JSON backup format for import validation
 */
export interface BackupData {
  version: string
  exportedAt: string
  team: string
  members: DpMember[]
  categories: DpCategory[]
  duties: DpDuty[]
}

/**
 * Validate and parse a JSON backup file
 */
export function parseBackupJSON(jsonString: string): { data: BackupData | null; error: string | null } {
  try {
    const parsed = JSON.parse(jsonString)

    // Validate structure
    if (!parsed.version || !parsed.members || !parsed.categories || !parsed.duties) {
      return { data: null, error: 'INVALID_FORMAT' }
    }
    if (!Array.isArray(parsed.members) || !Array.isArray(parsed.categories) || !Array.isArray(parsed.duties)) {
      return { data: null, error: 'INVALID_FORMAT' }
    }

    return { data: parsed as BackupData, error: null }
  } catch {
    return { data: null, error: 'PARSE_ERROR' }
  }
}
