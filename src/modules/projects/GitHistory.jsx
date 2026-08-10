import React, { useEffect, useState } from 'react'
import { GitBranch, RefreshCw, ChevronRight, ChevronDown, AlertTriangle, Loader, Plus } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { projectFiles } from './projectFilesClient.js'

// 格式化时间戳为本地可读日期
function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function GitHistory({ page, compact = false, refreshKey = 0 }) {
  const { t } = useI18n()
  const dir = (page.workingDir || '').trim()
  const hasDir = !!dir

  const [commits, setCommits] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notRepo, setNotRepo] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [reloadSignal, setReloadSignal] = useState(0)
  const [confirmStatus, setConfirmStatus] = useState({}) // hash -> { user: 'approved'|'rejected'|'none', ... }

  const loadConfirmStatus = async () => {
    if (!hasDir) return
    try {
      const data = await projectFiles.gitConfirmStatus(dir)
      setConfirmStatus(data.status || {})
    } catch { /* 状态加载失败不影响主功能 */ }
  }

  const cycleConfirm = async (hash, kind, e) => {
    e.stopPropagation()
    if (!hasDir) return
    if (kind === 'user') {
      const current = confirmStatus[hash]?.user || 'none'
      const next = current === 'none' ? 'approved' : current === 'approved' ? 'rejected' : 'none'
      try {
        await projectFiles.gitConfirm(dir, hash, next, 'user')
        setConfirmStatus(prev => {
          const nextState = { ...prev }
          const cur = { ...(nextState[hash] || {}) }
          if (next === 'none') delete cur.user
          else cur.user = next
          if (!cur.user && !cur.ai) delete nextState[hash]
          else nextState[hash] = cur
          return nextState
        })
      } catch { /* ignore */ }
    } else {
      // AI 标注：none -> userConfirmed -> aiConfirmed -> none（AI 调接口自动写；点击用于手动修正）
      const current = confirmStatus[hash]?.ai || 'none'
      const next = current === 'none' ? 'userConfirmed' : current === 'userConfirmed' ? 'aiConfirmed' : 'none'
      try {
        await projectFiles.gitConfirm(dir, hash, next, 'ai')
        setConfirmStatus(prev => {
          const nextState = { ...prev }
          const cur = { ...(nextState[hash] || {}) }
          if (next === 'none') delete cur.ai
          else cur.ai = next
          if (!cur.user && !cur.ai) delete nextState[hash]
          else nextState[hash] = cur
          return nextState
        })
      } catch { /* ignore */ }
    }
  }

  const load = async () => {
    if (!hasDir) return
    setLoading(true); setError(''); setNotRepo(false)
    try {
      const data = await projectFiles.gitLog(dir, 30)
      setCommits(data.commits || [])
      if (data.notARepo) setNotRepo(true)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(); loadConfirmStatus() }, [dir, reloadSignal, refreshKey])

  const showDetail = async (commit) => {
    if (selected?.hash === commit.hash) { setSelected(null); setDetail(''); return }
    setSelected(commit); setDetail(''); setDetailLoading(true)
    try {
      const data = await projectFiles.gitShow(dir, commit.hash)
      setDetail(data.content || '')
    } catch (e) {
      setDetail('加载失败：' + String(e.message || e))
    } finally {
      setDetailLoading(false)
    }
  }

  const initRepo = async () => {
    if (!hasDir) return
    setInitializing(true); setError('')
    try {
      await projectFiles.gitInit(dir)
      // 初始化完重新加载列表
      await load()
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setInitializing(false)
    }
  }

  if (!hasDir) {
    return <div className="git-empty">
      <GitBranch size={20}/>
      <b>{t('git.needDirTitle')}</b>
      <span>{t('git.needDirDesc')}</span>
    </div>
  }

  return <div className="git-history">
    <div className="git-toolbar">
      <button className="text-btn" onClick={() => setReloadSignal(s => s + 1)}>
        <RefreshCw size={13} className={loading ? 'spin' : ''}/>{t('library.refresh')}
      </button>
      <span className="git-count">{commits.length > 0 ? `${commits.length} commits` : ''}</span>
    </div>

    {error && <div className="lib-error"><AlertTriangle size={14}/>{error}</div>}
    {notRepo && (
      <div className="git-hint">
        <div><AlertTriangle size={14}/>{t('git.notRepo')}</div>
        <button className="secondary sm" onClick={initRepo} disabled={initializing}>
          <Plus size={13}/>{initializing ? t('git.initializing') : t('git.initRepo')}
        </button>
      </div>
    )}
    {loading && <div className="git-loading"><Loader size={16} className="spin"/>{t('git.loading')}</div>}

    {!loading && !error && !notRepo && commits.length === 0 && (
      <div className="git-empty small"><GitBranch size={18}/><span>{t('git.empty')}</span></div>
    )}

    <div className="git-list">
      {commits.map(c => (
        <div key={c.hash} className={"git-commit " + (selected?.hash === c.hash ? 'active' : '')}>
          <div className="git-commit-head" onClick={() => showDetail(c)}>
            <span className="git-confirm-dots">
              <span className={'git-confirm-dot ' + (confirmStatus[c.hash]?.user || 'none')}
                onClick={(e) => cycleConfirm(c.hash, 'user', e)}
                title={'用户确认：' + (confirmStatus[c.hash]?.user === 'approved' ? '已通过（点击切换）' : confirmStatus[c.hash]?.user === 'rejected' ? '不通过（点击切换）' : '未操作（点击标记通过）')}/>
              <span className={'git-confirm-dot ai ' + (confirmStatus[c.hash]?.ai || 'none')}
                onClick={(e) => cycleConfirm(c.hash, 'ai', e)}
                title={'AI标注：' + (confirmStatus[c.hash]?.ai === 'userConfirmed' ? '用户口头确认（点击切换）' : confirmStatus[c.hash]?.ai === 'aiConfirmed' ? 'AI判断可行（点击切换）' : '未标注（点击标记为用户口头确认）')}/>
            </span>
            <span className="git-caret">{selected?.hash === c.hash ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</span>
            <span className="git-hash">{c.shortHash}</span>
            <span className="git-subject" title={c.subject}>{c.subject}</span>
            <span className="git-date">{fmtDate(c.timestamp)}</span>
          </div>
          {selected?.hash === c.hash && (
            <div className="git-commit-detail">
              {detailLoading && <div className="git-loading small"><Loader size={14} className="spin"/>加载中…</div>}
              {!detailLoading && detail && <pre className="git-diff">{detail}</pre>}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
}
