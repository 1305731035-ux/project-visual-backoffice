import React, { useMemo, useState } from 'react'
import { X, Copy, Check, MessageSquareText } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { buildStartupPrompt } from '../../storage/projectPagesStorage'

// 【开启新对话】弹窗：生成可一键复制的开场提示词（标准化开头 + AI必读全文）。
// requiredReadContent: AI必读区域的当前文字（由父组件传入，未保存的编辑也会带入）。
export function StartupDialog({ page, requiredReadContent = '', onClose }) {
  const { t } = useI18n()
  const prompt = useMemo(() => buildStartupPrompt(page, requiredReadContent), [page, requiredReadContent])
  const [copied, setCopied] = useState('')

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.getElementById('copy-' + key)
      if (ta) { ta.select(); document.execCommand('copy') }
    }
    setCopied(key)
    setTimeout(() => setCopied(''), 1600)
  }

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal startup-modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head">
        <h3>{t('startup.title', { name: page.name })}</h3>
        <button className="icon-btn" onClick={onClose} aria-label="close"><X size={17}/></button>
      </div>
      <div className="modal-body">
        <p className="startup-tip">{t('startup.tip')}</p>

        <div className="startup-block">
          <div className="startup-block-head">
            <MessageSquareText size={15}/>
            <b>{t('startup.promptLabel')}</b>
            <button className="text-btn" onClick={() => copy('prompt', prompt)}>
              {copied === 'prompt' ? <Check size={14}/> : <Copy size={14}/>}
              {copied === 'prompt' ? t('startup.copied') : t('startup.copy')}
            </button>
          </div>
          <textarea id="copy-prompt" readOnly value={prompt} rows={14} className="startup-text"/>
        </div>

      </div>
    </div>
  </div>
}
