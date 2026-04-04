import type { DpCategory } from '@/types'

export interface ParsedEntry {
  categoryId: string
  categoryName: string
  startDate: string
  endDate: string
  dates: string[]
  raw: string
}

const GERMAN_MONTHS: Record<string, number> = {
  januar: 0, jan: 0,
  februar: 1, feb: 1,
  märz: 2, mrz: 2, mär: 2,
  april: 3, apr: 3,
  mai: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  dezember: 11, dez: 11,
}

function parseGermanDate(dateStr: string, currentYear: number): Date | null {
  dateStr = dateStr.trim()

  // Try DD.MM.YYYY or DD.MM.YY format (e.g., "03.02.2026" or "03.02.26")
  const numericMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (numericMatch) {
    let day = parseInt(numericMatch[1], 10)
    let month = parseInt(numericMatch[2], 10) - 1
    let year = parseInt(numericMatch[3], 10)

    if (year < 100) {
      year = year < 30 ? 2000 + year : 1900 + year
    }

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      return new Date(year, month, day)
    }
  }

  // Try natural German date format (e.g., "1. April", "18. April", "1. april")
  const naturalMatch = dateStr.match(/^(\d{1,2})\.?\s+([a-zäöüß]+)$/i)
  if (naturalMatch) {
    const day = parseInt(naturalMatch[1], 10)
    const monthName = naturalMatch[2].toLowerCase()
    const month = GERMAN_MONTHS[monthName]

    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(currentYear, month, day)
    }
  }

  return null
}

function dateToStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function expandDateRange(startDate: Date, endDate: Date): string[] {
  const dates: string[] = []
  const current = new Date(startDate)

  while (current <= endDate) {
    dates.push(dateToStr(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function fuzzyMatchCategory(text: string, categories: DpCategory[]): DpCategory | null {
  const lower = text.toLowerCase()

  // Exact match on name or letter
  const exact = categories.find((c) => c.name.toLowerCase() === lower || c.letter.toLowerCase() === lower)
  if (exact) return exact

  // Partial match on name (case-insensitive)
  const partial = categories.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
  if (partial) return partial

  return null
}

export function parseSmartImport(text: string, categories: DpCategory[]): ParsedEntry[] {
  if (!text.trim()) return []

  const currentYear = new Date().getFullYear()
  const entries: ParsedEntry[] = []

  // Split by comma or newline
  const lines = text.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)

  for (const line of lines) {
    // Pattern: "CategoryName DateRange" or "CategoryName StartDate - EndDate" or "CategoryName StartDate bis EndDate"
    // Examples:
    // "Ferien 03.02.2026 - 15.03.26"
    // "Pikett 1. April bis 18. April"
    // "Krank 5.3.26 - 8.03.26"

    // Try to split by " - " or " bis "
    const rangeMatch = line.match(/^(.+?)\s+(.+?)\s+(?:-|bis)\s+(.+)$/i)

    if (rangeMatch) {
      const categoryName = rangeMatch[1].trim()
      const startDateStr = rangeMatch[2].trim()
      const endDateStr = rangeMatch[3].trim()

      const category = fuzzyMatchCategory(categoryName, categories)
      if (!category) continue

      const startDate = parseGermanDate(startDateStr, currentYear)
      const endDate = parseGermanDate(endDateStr, currentYear)

      if (!startDate || !endDate) continue

      const dates = expandDateRange(startDate, endDate)
      if (dates.length === 0) continue

      entries.push({
        categoryId: category.id,
        categoryName: category.name,
        startDate: dateToStr(startDate),
        endDate: dateToStr(endDate),
        dates,
        raw: line,
      })
    } else {
      // Try single date format: "CategoryName Date"
      const singleMatch = line.match(/^(.+?)\s+(.+)$/)
      if (singleMatch) {
        const categoryName = singleMatch[1].trim()
        const dateStr = singleMatch[2].trim()

        const category = fuzzyMatchCategory(categoryName, categories)
        if (!category) continue

        const date = parseGermanDate(dateStr, currentYear)
        if (!date) continue

        const dateStrFormatted = dateToStr(date)
        entries.push({
          categoryId: category.id,
          categoryName: category.name,
          startDate: dateStrFormatted,
          endDate: dateStrFormatted,
          dates: [dateStrFormatted],
          raw: line,
        })
      }
    }
  }

  return entries
}
