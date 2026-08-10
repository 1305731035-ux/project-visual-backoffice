import React, { useEffect, useRef, useState } from 'react'
import { Save, FileText, Check, AlertTriangle } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { AI_REQUIRED_READ_PATH, loadRequiredReadDraft, saveRequiredReadDraft } from '../../storage/projectPagesStorage'

// 【AI必读】编辑区：本质是项目目录下 项目Wiki/AI必读.md 的可视化编辑器。
// - 有工作目录：从 /api/project/read 读文件，保存时写回本地 md 文件。
// - 无工作目录：内容存浏览器 localStorage 草稿，并提示设置目录后同步到文件。
const STATUS = { IDLE: 'idle', LOADING: 'loading', SAVING: 'saving', SAVED: 'saved', ERROR: 'error' }

export function AIReadEditor({ page, onContentChange }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState(STATUS.IDLE)
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const loadedForDir = useRef('')

  // 把加载到的内容同步给父组件（用于"开启新对话"），但不标记为未保存。
  const applyLoaded = (val) => {
    setContent(val)
    setDirty(false)
    onContentChange && onContentChange(val)
  }

  const hasDir = !!(page.workingDir && page.workingDir.trim())
  const filePath = hasDir ? `${page.workingDir.replace(/[\\/]+$/, '')}/${AI_REQUIRED_READ_PATH}` : AI_REQUIRED_READ_PATH

  // 切换项目或目录后重新加载
  useEffect(() => {
    let cancelled = false
    if (!hasDir) {
      applyLoaded(loadRequiredReadDraft(page.id))
      setStatus(STATUS.IDLE)
      loadedForDir.current = ''
      return
    }
    setStatus(STATUS.LOADING)
    const params = new URLSearchParams({ dir: page.workingDir, path: AI_REQUIRED_READ_PATH })
    fetch('/api/project/read?' + params.toString())
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.error) { applyLoaded(loadRequiredReadDraft(page.id)); setMessage(data.error); setStatus(STATUS.ERROR) }
        else if (data.exists) { applyLoaded(data.content); setStatus(STATUS.IDLE) }
        else { applyLoaded(loadRequiredReadDraft(page.id)); setStatus(STATUS.IDLE) }
        loadedForDir.current = page.workingDir
      })
      .catch(e => {
        if (cancelled) return
        applyLoaded(loadRequiredReadDraft(page.id))
        setMessage(String(e.message || e))
        setStatus(STATUS.ERROR)
      })
    return () => { cancelled = true }
  }, [page.id, page.workingDir, hasDir])

  const onChange = (val) => {
    setContent(val)
    setDirty(true)
    onContentChange && onContentChange(val)
    if (!hasDir) saveRequiredReadDraft(page.id, val) // 无目录时实时存草稿
  }

  const save = async () => {
    if (!hasDir) { setMessage(t('aiRead.needDir')); setStatus(STATUS.ERROR); return }
    setStatus(STATUS.SAVING)
    setMessage('')
    try {
      const r = await fetch('/api/project/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: page.workingDir, path: AI_REQUIRED_READ_PATH, content }),
      })
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(data.error || ('HTTP ' + r.status))
      saveRequiredReadDraft(page.id, content)
      setDirty(false)
      setStatus(STATUS.SAVED)
      setMessage(t('aiRead.saved'))
      setTimeout(() => { setStatus(s => s === STATUS.SAVED ? STATUS.IDLE : s); setMessage('') }, 1800)
    } catch (e) {
      setStatus(STATUS.ERROR)
      setMessage(String(e.message || e))
    }
  }

  return <section className="project-section">
    <div className="project-section-head ai-read-head">
      <div>
        <h2><FileText size={16}/>{t('aiRead.title')}</h2>
        <p>{t('aiRead.hint')}</p>
      </div>
      <div className="ai-read-path" title={filePath}>
        <code>{AI_REQUIRED_READ_PATH}</code>
        <span className={hasDir ? 'save-state ok' : 'save-state warn'}>
          {hasDir ? t('aiRead.synced') : t('aiRead.draftOnly')}
        </span>
      </div>
    </div>

    <textarea
      className="ai-read-editor"
      rows={12}
      value={content}
      placeholder={t('aiRead.placeholder')}
      onChange={e => onChange(e.target.value)}
    />

    <div className="ai-read-foot">
      <span className={'save-msg ' + (status === STATUS.ERROR ? 'error' : status === STATUS.SAVED ? 'ok' : '')}>
        {status === STATUS.ERROR && <AlertTriangle size={13}/>}
        {status === STATUS.SAVED && <Check size={13}/>}
        {message || (dirty && hasDir ? t('aiRead.unsaved') : '')}
      </span>
      <button className="primary" onClick={save} disabled={status === STATUS.SAVING}>
        <Save size={15}/>
        {status === STATUS.SAVING ? t('aiRead.saving') : dirty ? t('aiRead.save') : t('aiRead.savedShort')}
      </button>
    </div>
  </section>
}
