import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { strings } from './strings'

const I18nContext = createContext({ lang: 'zh', setLang: () => {}, t: (key) => key })

const STORAGE_KEY = 'susu-lang'

function readInitialLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(readInitialLang)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* ignore */ }
  }, [lang])

  const t = useMemo(() => (key, vars) => {
    const dict = strings[lang] || strings.zh
    let text = dict[key] ?? strings.zh[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      }
    }
    return text
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LangToggle({ className }) {
  const { lang, setLang, t } = useI18n()
  return (
    <button
      className={className}
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      title={t('lang.title')}
      aria-label={t('lang.title')}
    >
      {t('lang.toggle')}
    </button>
  )
}
