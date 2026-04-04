import type { DpCategory } from '@/types'

export interface ParsedEntry {
  categoryId: string
  categoryName: string
  startDate: string
  endDate: string
  dates: string[]
  raw: string
}

// ---------------------------------------------------------------------------
// Month names (DE + FR)
// ---------------------------------------------------------------------------
const MONTH_NAMES: Record<string, number> = {
  // German
  januar: 0, jan: 0, jän: 0,
  februar: 1, feb: 1,
  märz: 2, mrz: 2, mär: 2, maerz: 2,
  april: 3, apr: 3,
  mai: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  dezember: 11, dez: 11,
  // French
  janvier: 0, février: 1, fév: 1, fevrier: 1,
  mars: 2, avril: 3, avr: 3,
  juin: 5, juillet: 6, juil: 6,
  août: 7, aout: 7,
  septembre: 8, octobre: 9, oct: 9,
  décembre: 11, dec: 11,
}

// ---------------------------------------------------------------------------
// Date parsing — supports many common formats
// ---------------------------------------------------------------------------
function parseDate(raw: string, currentYear: number): Date | null {
  const s = raw.trim().replace(/\.$/, '') // remove trailing dot

  // DD.MM.YYYY or DD.MM.YY  (e.g., 03.02.2026, 3.1.26)
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (m) {
    let year = parseInt(m[3], 10)
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
    return validDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, year)
  }

  // DD.MM  (no year — assume current year)
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.?$/)
  if (m) {
    return validDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, currentYear)
  }

  // YYYY-MM-DD (ISO)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    return validDate(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10))
  }

  // DD/MM/YYYY or DD/MM/YY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    let year = parseInt(m[3], 10)
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
    return validDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, year)
  }

  // "1. April" / "18. April 2026" / "1 April" — natural language
  m = s.match(/^(\d{1,2})\.?\s+([a-zäöüéèàâ]+)(?:\s+(\d{2,4}))?$/i)
  if (m) {
    const day = parseInt(m[1], 10)
    const monthName = m[2].toLowerCase()
    const month = MONTH_NAMES[monthName]
    if (month !== undefined) {
      let year = currentYear
      if (m[3]) {
        year = parseInt(m[3], 10)
        if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
      }
      return validDate(day, month, year)
    }
  }

  return null
}

function validDate(day: number, month: number, year: number): Date | null {
  if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > 2100) return null
  const d = new Date(year, month, day)
  // Verify the date didn't roll over (e.g., Feb 30 → Mar 2)
  if (d.getDate() !== day || d.getMonth() !== month) return null
  return d
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function expandDateRange(start: Date, end: Date): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(dateToStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// ---------------------------------------------------------------------------
// Category matching — tries multiple strategies
// ---------------------------------------------------------------------------
function matchCategory(text: string, categories: DpCategory[]): DpCategory | null {
  const lower = text.toLowerCase().trim()
  if (!lower) return null

  // 1) Exact match on name
  const exact = categories.find((c) => c.name.toLowerCase() === lower)
  if (exact) return exact

  // 2) Exact match on letter code (e.g., "A", "F", "EU")
  const byLetter = categories.find((c) => c.letter.toLowerCase() === lower)
  if (byLetter) return byLetter

  // 3) Input starts with category name or vice versa (e.g., "Eltern" matches "Elternurlaub")
  const startsWith = categories.find((c) =>
    c.name.toLowerCase().startsWith(lower) || lower.startsWith(c.name.toLowerCase())
  )
  if (startsWith) return startsWith

  // 4) Substring match — category name contains the input or input contains category name
  const contains = categories.find((c) =>
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  )
  if (contains) return contains

  // 5) Levenshtein-like: match if most characters are shared (for typos)
  const fuzzy = categories.find((c) => {
    const name = c.name.toLowerCase()
    if (Math.abs(name.length - lower.length) > 3) return false
    let matches = 0
    const shorter = lower.length <= name.length ? lower : name
    const longer = lower.length > name.length ? lower : name
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++
    }
    return matches / shorter.length > 0.7
  })
  if (fuzzy) return fuzzy

  return null
}

// ---------------------------------------------------------------------------
// Try to detect category by scanning known names against line start
// ---------------------------------------------------------------------------
function detectCategoryInLine(line: string, categories: DpCategory[]): { category: DpCategory; rest: string } | null {
  const lower = line.toLowerCase()

  // Sort categories by name length descending (longest match first)
  const sorted = [...categories].sort((a, b) => b.name.length - a.name.length)

  for (const cat of sorted) {
    const catLower = cat.name.toLowerCase()
    // Category name at start of line
    if (lower.startsWith(catLower)) {
      const rest = line.slice(cat.name.length).trim()
      if (rest.length > 0) return { category: cat, rest }
    }
    // Letter code at start (e.g., "F 3.1.26-10.1.26")
    const letterLower = cat.letter.toLowerCase()
    if (lower.startsWith(letterLower + ' ') || lower.startsWith(letterLower + '\t')) {
      const rest = line.slice(cat.letter.length).trim()
      if (rest.length > 0) return { category: cat, rest }
    }
  }

  // Fallback: split by first whitespace and fuzzy-match the first word
  const spaceIdx = line.search(/\s/)
  if (spaceIdx > 0) {
    const firstWord = line.slice(0, spaceIdx)
    const rest = line.slice(spaceIdx).trim()
    const cat = matchCategory(firstWord, categories)
    if (cat) return { category: cat, rest }

    // Try first two words (e.g., "Eltern Urlaub 3.1-10.1")
    const secondSpace = rest.search(/\s/)
    if (secondSpace > 0) {
      const twoWords = firstWord + ' ' + rest.slice(0, secondSpace)
      const cat2 = matchCategory(twoWords, categories)
      if (cat2) return { category: cat2, rest: rest.slice(secondSpace).trim() }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Split date range string into start/end
// Handles: "3.1.26 - 10.1.26", "3.1.26-10.1.26", "3.1.26 bis 10.1.26",
//          "vom 3.1.26 bis 10.1.26", "3.1.26 – 10.1.26" (en-dash)
// ---------------------------------------------------------------------------
function splitDateRange(text: string): { startStr: string; endStr: string } | null {
  const cleaned = text
    .replace(/^(vom|ab|von|du|from)\s+/i, '') // remove leading "vom", "ab" etc.
    .trim()

  // Try splitting by various separators (with or without spaces)
  const separators = [
    /\s+(?:bis|to|until|jusqu'au|au)\s+/i,   // "bis", "to", etc.
    /\s*[–—]\s*/,                              // en-dash, em-dash
    /\s+-\s+/,                                 // " - " (spaced dash)
    /(?<=\d)-(?=\d)/,                          // "3.1.26-10.1.26" (dash between digits)
  ]

  for (const sep of separators) {
    const parts = cleaned.split(sep)
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return { startStr: parts[0].trim(), endStr: parts[1].trim() }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------
export function parseSmartImport(text: string, categories: DpCategory[]): ParsedEntry[] {
  if (!text.trim() || categories.length === 0) return []

  const currentYear = new Date().getFullYear()
  const entries: ParsedEntry[] = []

  // Split by newline, comma, or semicolon
  const lines = text.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean)
  // Also split by commas, but only if the comma is not inside a date range
  const expandedLines: string[] = []
  for (const line of lines) {
    // If the line contains a date range (has a dash or "bis"), don't split by comma
    if (/\d\s*[-–—]\s*\d|bis/i.test(line)) {
      expandedLines.push(line)
    } else {
      expandedLines.push(...line.split(',').map((s) => s.trim()).filter(Boolean))
    }
  }

  for (const line of expandedLines) {
    // Step 1: Detect category
    const detected = detectCategoryInLine(line, categories)
    if (!detected) continue

    const { category, rest } = detected

    // Step 2: Try to parse as date range
    const range = splitDateRange(rest)
    if (range) {
      const startDate = parseDate(range.startStr, currentYear)
      const endDate = parseDate(range.endStr, currentYear)

      if (startDate && endDate && startDate <= endDate) {
        const dates = expandDateRange(startDate, endDate)
        entries.push({
          categoryId: category.id,
          categoryName: category.name,
          startDate: dateToStr(startDate),
          endDate: dateToStr(endDate),
          dates,
          raw: line,
        })
        continue
      }
    }

    // Step 3: Try as single date
    const singleDate = parseDate(rest, currentYear)
    if (singleDate) {
      const ds = dateToStr(singleDate)
      entries.push({
        categoryId: category.id,
        categoryName: category.name,
        startDate: ds,
        endDate: ds,
        dates: [ds],
        raw: line,
      })
    }
  }

  return entries
}
