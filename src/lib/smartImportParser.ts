import type { DpCategory } from '@/types'

export interface ParsedEntry {
  categoryId: string
  categoryName: string
  startDate: string
  endDate: string
  dates: string[]
  raw: string
}

// ============================================================================
// MONTH NAMES (DE + FR, all variations)
// ============================================================================
const MONTH_NAMES: Record<string, number> = {
  // German — full, abbreviated, common typos
  januar: 0, jan: 0, jän: 0, jänner: 0, jaenner: 0,
  februar: 1, feb: 1, feber: 1,
  märz: 2, mrz: 2, mär: 2, maerz: 2, march: 2, mar: 2,
  april: 3, apr: 3,
  mai: 4, may: 4,
  juni: 5, jun: 5, june: 5,
  juli: 6, jul: 6, july: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9, october: 9, oct: 9,
  november: 10, nov: 10,
  dezember: 11, dez: 11, december: 11, dec: 11,
  // French
  janvier: 0, février: 1, fév: 1, fev: 1, fevrier: 1,
  mars: 2, avr: 3, avril: 3,
  juin: 5, juillet: 6, juil: 6,
  août: 7, aout: 7, aou: 7,
  septembre: 8, octobre: 9,
  décembre: 11,
}

// ============================================================================
// NORMALIZATION — clean up user input before parsing
// ============================================================================
function normalizeLine(raw: string): string {
  let s = raw
    .replace(/\r/g, '')                         // Windows line endings
    .replace(/\t/g, ' ')                         // Tabs → spaces
    .replace(/ {2,}/g, ' ')                      // Multiple spaces → single
    .replace(/^[\s\-•*◦▪▸►→#]+/, '')            // Leading bullets, dashes, arrows, #
    .replace(/^\d+[.)]\s+/, '')                  // Numbered lists: "1. " or "1) "
    .replace(/[:]\s*/g, ' ')                     // Colons → space (Ferien: 3.1 → Ferien 3.1)
    .trim()
  return s
}

// ============================================================================
// DATE PARSING — handles every reasonable format a human might type
// ============================================================================
function parseDate(raw: string, currentYear: number): Date | null {
  let s = raw.trim()
    .replace(/\.$/, '')            // trailing dot: "3.1." → "3.1"
    .replace(/^den\s+/i, '')       // "den 3. Januar" → "3. Januar"
    .replace(/^am\s+/i, '')        // "am 3.1." → "3.1."
    .replace(/\.$/, '')            // trailing dot again after stripping
    .trim()

  if (!s) return null

  // DD.MM.YYYY or DD.MM.YY  (3.1.26, 03.02.2026, 3.01.26)
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (m) return buildDate(m[1], m[2], m[3], currentYear)

  // DD.MM  (3.1, 03.02 — no year)
  m = s.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (m) return buildDate(m[1], m[2], null, currentYear)

  // YYYY-MM-DD (ISO)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return buildDate(m[3], m[2], m[1], currentYear)

  // DD/MM/YYYY or DD/MM/YY or DD/MM
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (m) return buildDate(m[1], m[2], m[3] || null, currentYear)

  // "1. April", "18. April 2026", "1 April", "3. Jan.", "3 Jan 26"
  m = s.match(/^(\d{1,2})\.?\s+([a-zäöüéèàâ]+)\.?(?:\s+(\d{2,4}))?$/i)
  if (m) {
    const day = parseInt(m[1], 10)
    const month = MONTH_NAMES[m[2].toLowerCase()]
    if (month !== undefined) {
      let year = currentYear
      if (m[3]) { year = parseInt(m[3], 10); if (year < 100) year += 2000 }
      return validDate(day, month, year)
    }
  }

  // "April 3" or "April 3, 2026" (month before day — English-influenced)
  m = s.match(/^([a-zäöüéèàâ]+)\.?\s+(\d{1,2})\.?(?:[,\s]+(\d{2,4}))?$/i)
  if (m) {
    const month = MONTH_NAMES[m[1].toLowerCase()]
    const day = parseInt(m[2], 10)
    if (month !== undefined) {
      let year = currentYear
      if (m[3]) { year = parseInt(m[3], 10); if (year < 100) year += 2000 }
      return validDate(day, month, year)
    }
  }

  return null
}

function buildDate(dayStr: string, monthStr: string, yearStr: string | null, currentYear: number): Date | null {
  const day = parseInt(dayStr, 10)
  const month = parseInt(monthStr, 10) - 1
  let year = currentYear
  if (yearStr) {
    year = parseInt(yearStr, 10)
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year
  }
  return validDate(day, month, year)
}

function validDate(day: number, month: number, year: number): Date | null {
  if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1900 || year > 2100) return null
  const d = new Date(year, month, day)
  if (d.getDate() !== day || d.getMonth() !== month) return null
  return d
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function expandDateRange(start: Date, end: Date): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  // Safety: max 366 days to prevent infinite loops
  let safety = 0
  while (cur <= end && safety < 400) {
    dates.push(dateToStr(cur))
    cur.setDate(cur.getDate() + 1)
    safety++
  }
  return dates
}

// ============================================================================
// CATEGORY MATCHING — fuzzy, forgiving, typo-tolerant
// ============================================================================
function matchCategory(text: string, categories: DpCategory[]): DpCategory | null {
  const lower = text.toLowerCase().trim()
  if (!lower || lower.length === 0) return null

  // 1) Exact match on name
  const exact = categories.find((c) => c.name.toLowerCase() === lower)
  if (exact) return exact

  // 2) Exact match on letter code
  const byLetter = categories.find((c) => c.letter.toLowerCase() === lower)
  if (byLetter) return byLetter

  // 3) Input starts with category name or vice versa
  //    "Eltern" → "Elternurlaub", "Elternurlaub" → "Elternurlaub"
  const startsWith = categories.find((c) =>
    c.name.toLowerCase().startsWith(lower) || lower.startsWith(c.name.toLowerCase())
  )
  if (startsWith) return startsWith

  // 4) Substring match
  const contains = categories.find((c) =>
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  )
  if (contains) return contains

  // 5) Levenshtein distance for typo tolerance (e.g., "Fereien" → "Ferien")
  let bestCat: DpCategory | null = null
  let bestDist = Infinity
  for (const c of categories) {
    const dist = levenshtein(lower, c.name.toLowerCase())
    const threshold = Math.max(1, Math.floor(c.name.length * 0.35)) // allow ~35% errors
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist
      bestCat = c
    }
  }
  if (bestCat) return bestCat

  return null
}

/** Simple Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ============================================================================
// CATEGORY DETECTION IN LINE — tries category at start AND end
// ============================================================================
function detectCategoryInLine(line: string, categories: DpCategory[]): { category: DpCategory; rest: string } | null {
  const lower = line.toLowerCase()

  // --- Strategy 1: Category name at START of line (longest match first) ---
  const sorted = [...categories].sort((a, b) => b.name.length - a.name.length)

  for (const cat of sorted) {
    const catLower = cat.name.toLowerCase()

    // Full name at start: "Elternurlaub 3.1-10.1"
    if (lower.startsWith(catLower) && line.length > cat.name.length) {
      const nextChar = line[cat.name.length]
      // Must be followed by space, tab, colon, or digit
      if (/[\s:,\d]/.test(nextChar)) {
        const rest = line.slice(cat.name.length).replace(/^[\s:,]+/, '').trim()
        if (rest.length > 0) return { category: cat, rest }
      }
    }

    // Letter code at start: "F 3.1-10.1" or "EU: 3.1"
    const letterLower = cat.letter.toLowerCase()
    if (lower.startsWith(letterLower) && line.length > cat.letter.length) {
      const nextChar = line[cat.letter.length]
      if (/[\s:,]/.test(nextChar)) {
        const rest = line.slice(cat.letter.length).replace(/^[\s:,]+/, '').trim()
        if (rest.length > 0) return { category: cat, rest }
      }
    }
  }

  // --- Strategy 2: First word(s) fuzzy match ---
  const spaceIdx = line.search(/\s/)
  if (spaceIdx > 0) {
    const firstWord = line.slice(0, spaceIdx)
    const rest = line.slice(spaceIdx).trim()

    // Skip if first word looks like a date (starts with digit)
    if (!/^\d/.test(firstWord)) {
      const cat = matchCategory(firstWord, categories)
      if (cat) return { category: cat, rest }

      // Try first two words: "Eltern Urlaub 3.1-10.1"
      const secondSpace = rest.search(/\s/)
      if (secondSpace > 0) {
        const twoWords = firstWord + ' ' + rest.slice(0, secondSpace)
        const cat2 = matchCategory(twoWords, categories)
        if (cat2) return { category: cat2, rest: rest.slice(secondSpace).trim() }

        // Try first three words: "Tag des Herrn 3.1"
        const thirdPart = rest.slice(secondSpace).trim()
        const thirdSpace = thirdPart.search(/\s/)
        if (thirdSpace > 0) {
          const threeWords = twoWords + ' ' + thirdPart.slice(0, thirdSpace)
          const cat3 = matchCategory(threeWords, categories)
          if (cat3) return { category: cat3, rest: thirdPart.slice(thirdSpace).trim() }
        }
      }
    }
  }

  // --- Strategy 3: Category at END of line: "3.1-10.1 Ferien" ---
  // Find the last word(s) and check if they match a category
  const words = line.split(/\s+/)
  if (words.length >= 2) {
    // Try last word
    const lastWord = words[words.length - 1]
    if (!/^\d/.test(lastWord)) {
      const cat = matchCategory(lastWord, categories)
      if (cat) {
        const rest = words.slice(0, -1).join(' ').trim()
        if (rest.length > 0) return { category: cat, rest }
      }

      // Try last two words
      if (words.length >= 3) {
        const lastTwo = words.slice(-2).join(' ')
        if (!/^\d/.test(lastTwo)) {
          const cat2 = matchCategory(lastTwo, categories)
          if (cat2) {
            const rest = words.slice(0, -2).join(' ').trim()
            if (rest.length > 0) return { category: cat2, rest }
          }
        }
      }
    }
  }

  return null
}

// ============================================================================
// DATE RANGE SPLITTING — handles every separator variant
// ============================================================================
function splitDateRange(text: string): { startStr: string; endStr: string } | null {
  let cleaned = text
    .replace(/^(vom|ab|von|du|from|depuis|de)\s+/i, '')  // "vom 3.1" → "3.1"
    .replace(/\s+(an|bis zum|bis|to|until|jusqu'au|au)\s+/g, ' BIS ') // normalize separator
    .trim()

  // Try "BIS" separator first (from normalization above)
  if (cleaned.includes(' BIS ')) {
    const parts = cleaned.split(' BIS ')
    if (parts.length === 2) return cleanParts(parts[0], parts[1])
  }

  // En-dash / Em-dash (with or without spaces): "3.1 – 10.1"
  const dashMatch = cleaned.match(/^(.+?)\s*[–—]\s*(.+)$/)
  if (dashMatch) return cleanParts(dashMatch[1], dashMatch[2])

  // Spaced hyphen: "3.1 - 10.1"
  const spacedHyphenMatch = cleaned.match(/^(.+?)\s+-\s+(.+)$/)
  if (spacedHyphenMatch) return cleanParts(spacedHyphenMatch[1], spacedHyphenMatch[2])

  // Hyphen between date-like tokens: "3.1.26-10.1.26" or "3.1-10.1"
  // Match: (date-like thing) - (date-like thing)
  // Date-like = contains digits and possibly dots/slashes
  const compactDashMatch = cleaned.match(/^([\d.\/]+)-(\d[\d.\/]*)$/)
  if (compactDashMatch) return cleanParts(compactDashMatch[1], compactDashMatch[2])

  // Natural language date: "3. Januar - 10. Januar" (with month names)
  // More complex pattern: anything with a dash in the middle
  const generalDashMatch = cleaned.match(/^(.+\d[.\s]?\s*\w*)\s*-\s*(\d.+)$/)
  if (generalDashMatch) return cleanParts(generalDashMatch[1], generalDashMatch[2])

  return null
}

function cleanParts(a: string, b: string): { startStr: string; endStr: string } | null {
  const s = a.trim().replace(/^(den|am)\s+/i, '').trim()
  const e = b.trim().replace(/^(den|am)\s+/i, '').trim()
  if (s && e) return { startStr: s, endStr: e }
  return null
}

// ============================================================================
// SPECIAL PATTERN: Day-range with shared month
// "3.-10. Januar 2026" or "3-10 Januar" or "3. bis 10. April"
// ============================================================================
function parseDayRangeWithMonth(text: string, currentYear: number): { start: Date; end: Date } | null {
  let s = text
    .replace(/^(vom|ab|von)\s+/i, '')
    .trim()

  // "3.-10. Januar 2026" or "3. - 10. Januar" or "3-10 Januar" or "3 bis 10 Januar 2026"
  const m = s.match(
    /^(\d{1,2})\.?\s*(?:-|–|—|bis)\s*(\d{1,2})\.?\s+([a-zäöüéèàâ]+)\.?(?:\s+(\d{2,4}))?$/i
  )
  if (m) {
    const day1 = parseInt(m[1], 10)
    const day2 = parseInt(m[2], 10)
    const month = MONTH_NAMES[m[3].toLowerCase()]
    if (month !== undefined) {
      let year = currentYear
      if (m[4]) { year = parseInt(m[4], 10); if (year < 100) year += 2000 }
      const start = validDate(day1, month, year)
      const end = validDate(day2, month, year)
      if (start && end) return { start, end }
    }
  }

  // "3.-10.1." or "3.-10.1.26" or "3-10.1"  (day range with numeric month)
  const n = s.match(
    /^(\d{1,2})\.?\s*(?:-|–|—|bis)\s*(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/
  )
  if (n) {
    const day1 = parseInt(n[1], 10)
    const day2 = parseInt(n[2], 10)
    const month = parseInt(n[3], 10) - 1
    let year = currentYear
    if (n[4]) { year = parseInt(n[4], 10); if (year < 100) year += 2000 }
    const start = validDate(day1, month, year)
    const end = validDate(day2, month, year)
    if (start && end) return { start, end }
  }

  return null
}

// ============================================================================
// MAIN PARSER
// ============================================================================
export function parseSmartImport(text: string, categories: DpCategory[]): ParsedEntry[] {
  if (!text.trim() || categories.length === 0) return []

  const currentYear = new Date().getFullYear()
  const entries: ParsedEntry[] = []

  // Split by newline (handle \r\n) and semicolons
  const rawLines = text.split(/[\r\n;]+/).map((s) => s.trim()).filter(Boolean)

  // Expand comma-separated entries, but be smart about it
  const lines: string[] = []
  for (const rawLine of rawLines) {
    // Don't split by comma if the line contains a date range (would break "3,000" edge case too)
    if (/\d\s*[-–—]\s*\d|\bbis\b/i.test(rawLine)) {
      lines.push(rawLine)
    } else {
      // Split by comma, but only if both parts look meaningful
      const parts = rawLine.split(',').map((s) => s.trim()).filter(Boolean)
      if (parts.length > 1 && parts.every((p) => p.length > 2)) {
        lines.push(...parts)
      } else {
        lines.push(rawLine)
      }
    }
  }

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine)
    if (!line || line.length < 3) continue

    // Step 1: Detect which category this line refers to
    const detected = detectCategoryInLine(line, categories)
    if (!detected) continue

    const { category, rest } = detected

    // Step 2a: Try "day range with shared month" pattern first
    //   "3.-10. Januar 2026" or "3-10 Januar"
    const dayRange = parseDayRangeWithMonth(rest, currentYear)
    if (dayRange) {
      let { start, end } = dayRange
      if (start > end) [start, end] = [end, start] // swap if reversed
      entries.push({
        categoryId: category.id,
        categoryName: category.name,
        startDate: dateToStr(start),
        endDate: dateToStr(end),
        dates: expandDateRange(start, end),
        raw: rawLine,
      })
      continue
    }

    // Step 2b: Try regular date range ("3.1.26 - 10.1.26" etc.)
    const range = splitDateRange(rest)
    if (range) {
      let startDate = parseDate(range.startStr, currentYear)
      let endDate = parseDate(range.endStr, currentYear)

      if (startDate && endDate) {
        // Auto-swap if user typed dates in wrong order
        if (startDate > endDate) [startDate, endDate] = [endDate, startDate]

        const dates = expandDateRange(startDate, endDate)
        if (dates.length > 0) {
          entries.push({
            categoryId: category.id,
            categoryName: category.name,
            startDate: dateToStr(startDate),
            endDate: dateToStr(endDate),
            dates,
            raw: rawLine,
          })
          continue
        }
      }
    }

    // Step 2c: Try as single date
    const singleDate = parseDate(rest, currentYear)
    if (singleDate) {
      const ds = dateToStr(singleDate)
      entries.push({
        categoryId: category.id,
        categoryName: category.name,
        startDate: ds,
        endDate: ds,
        dates: [ds],
        raw: rawLine,
      })
    }
  }

  return entries
}
