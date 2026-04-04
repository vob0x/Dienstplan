declare module 'xlsx' {
  export interface WorkSheet {
    '!cols'?: Array<{ wch?: number }>
    '!rows'?: Array<{ hpx?: number }>
    [key: string]: unknown
  }
  export interface WorkBook {
    SheetNames: string[]
    Sheets: Record<string, WorkSheet>
  }
  export const utils: {
    book_new(): WorkBook
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void
    aoa_to_sheet(data: unknown[][]): WorkSheet
    json_to_sheet(data: unknown[]): WorkSheet
  }
  export function writeFile(wb: WorkBook, filename: string): void
  export function write(wb: WorkBook, opts: unknown): unknown
}
