import React from 'react'
import { useI18n } from '../../i18n/I18nProvider'

// "能力"列表头：标题 + 中/英切换 + 待翻译触发按钮
export function CapabilityNameHeader({ skillLang, onToggleLang, pending, onTranslate, translating }) {
  const { t } = useI18n()
  const isZh = skillLang === 'zh'
  return (
    <span className="cap-name-head">
      <span className="cap-name-title">{t('framework.colName')}</span>
      <span className="lang-seg" role="group" aria-label={t('framework.colName')}>
        <button
          type="button"
          className={isZh ? 'seg active' : 'seg'}
          onClick={() => onToggleLang('zh')}
          title={t('framework.colName')}
        >{t('framework.toggleZh')}</button>
        <button
          type="button"
          className={!isZh ? 'seg active' : 'seg'}
          onClick={() => onToggleLang('en')}
        >{t('framework.toggleEn')}</button>
      </span>
      {isZh && pending > 0 && (
        <button type="button" className="translate-trigger" onClick={onTranslate} disabled={translating}
          title={t('framework.translateMissing', { count: pending })}>
          {translating ? t('framework.translating') : t('framework.toggleEn') + '→' + t('framework.toggleZh') + ` ${pending}`}
        </button>
      )}
    </span>
  )
}
