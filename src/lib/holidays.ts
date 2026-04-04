import type { Holiday } from '@/types'

/**
 * Swiss public holidays (national + common cantonal)
 * Calculates Easter-dependent holidays dynamically
 */

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmt(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)

  return [
    { date: `${year}-01-01`, name: 'Neujahr', name_fr: 'Nouvel An' },
    { date: `${year}-01-02`, name: 'Berchtoldstag', name_fr: 'Saint-Berchtold' },
    { date: fmt(addDays(easter, -2)), name: 'Karfreitag', name_fr: 'Vendredi Saint' },
    { date: fmt(easter), name: 'Ostersonntag', name_fr: 'Dimanche de Pâques' },
    { date: fmt(addDays(easter, 1)), name: 'Ostermontag', name_fr: 'Lundi de Pâques' },
    { date: `${year}-05-01`, name: 'Tag der Arbeit', name_fr: 'Fête du travail' },
    { date: fmt(addDays(easter, 39)), name: 'Auffahrt', name_fr: 'Ascension' },
    { date: fmt(addDays(easter, 49)), name: 'Pfingstsonntag', name_fr: 'Pentecôte' },
    { date: fmt(addDays(easter, 50)), name: 'Pfingstmontag', name_fr: 'Lundi de Pentecôte' },
    { date: `${year}-08-01`, name: 'Bundesfeier', name_fr: 'Fête nationale' },
    { date: `${year}-12-25`, name: 'Weihnachten', name_fr: 'Noël' },
    { date: `${year}-12-26`, name: 'Stephanstag', name_fr: 'Saint-Étienne' },
  ]
}

export function isHoliday(dateStr: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find(h => h.date === dateStr)
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}
