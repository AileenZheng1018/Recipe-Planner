import { createContext, useContext, useState, type ReactNode } from 'react'

type Lang = 'en' | 'zh'

const LANG_STORAGE_KEY = 'recipe-planner-lang'

function readStoredLang(): Lang {
  try {
    const s = localStorage.getItem(LANG_STORAGE_KEY)
    if (s === 'zh' || s === 'en') return s
  } catch (_) {}
  return 'en'
}

type LangContextType = { lang: Lang; setLang: (l: Lang) => void }

const LangContext = createContext<LangContextType | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)
  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l)
    } catch (_) {}
  }
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}
