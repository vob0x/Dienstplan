import React, { createContext, useContext, useMemo } from 'react'
import { de } from './de'
import { fr } from './fr'
import { useUiStore } from '@/stores/uiStore'
import type { Language } from '@/types'

type TranslationKey = string

// Use a loose type to allow different string literal values between languages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const translations: Record<Language, any> = { de, fr }

function getNestedValue(obj: unknown, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path // Fallback: return key
    }
  }
  return typeof current === 'string' ? current : path
}

interface I18nContextValue {
  t: (key: TranslationKey) => string
  tArray: (key: TranslationKey) => string[]
  language: Language
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  tArray: () => [],
  language: 'de',
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useUiStore((s) => s.language)

  const value = useMemo(() => {
    const dict = translations[language] || translations.de

    const t = (key: TranslationKey): string => {
      return getNestedValue(dict, key)
    }

    const tArray = (key: TranslationKey): string[] => {
      const parts = key.split('.')
      let current: unknown = dict
      for (const part of parts) {
        if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part]
        } else {
          return []
        }
      }
      return Array.isArray(current) ? current as string[] : []
    }

    return { t, tArray, language }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
