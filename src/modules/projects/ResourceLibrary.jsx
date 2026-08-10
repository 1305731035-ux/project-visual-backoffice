import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronRight, ChevronDown, FolderPlus, FilePlus2, FileText, Folder,
  Save, Trash2, RefreshCw, AlertTriangle, Check, FolderTree, X,
} from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { projectFiles, LIBRARY_ROOT } from './projectFilesClient'

// 资料库：项目目录下 项目Wiki/ 的文件树 + md 编辑器。
// 支持：新建文件夹/文件、展开折叠、点击文件编辑并保存、删除。
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const invalidName = (n) => {
  const v = (n || '').trim()
  if (!v) return 'empty'
  if (/[\\/]/.test(v)) return 'separator'
  if (RESERVED.test(v)) return 'reserved'
  if (/[<>:"|?*\x00-\x1f]/.test(v)) return 'illegal'
  return ''
}
const ensureExt = (name) => /\.[a-zA-Z0-9]+$/.test(name) ? name : name + '.md'

export function ResourceLibrary({ page, mode = 'base', title, needDirTitle, needDirDesc, compact = false, refreshKey = 0 }) {
  const { t } = useI18n()
  // base 模式：根目录 = 工作目录/<基础资料>，所有操作在该子目录下
  // wiki 模式：根目录 = 用户指定的 wikiDir 绝对路径本身
  const isWiki = mode === 'wiki'
  const rootDir = isWiki ? (page.wikiDir || '').trim() : (page.workingDir || '').trim()
  const rootRel = isWiki ? '' : LIBRARY_ROOT
  const rootLabel = isWiki ? title || t('wiki.title') : LIBRARY_ROOT + '/'
  const hasDir = !!rootDir
  const [rootEntries, setRootEntries] = useState([])
  const [expanded, setExpanded] = useState({}) // relPath -> entries[]
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState(null) // { relPath, name }
  const [adding, setAdding] = useState(null) // { parent, kind: 'file'|'folder' }
  const [reloadKey, setReloadKey] = useState(0)
  const [statusMap, setStatusMap] = useState({}) // relPath -> 'confirmed'|'new'|'issue'|'unconfirmed'|null (from content markers)
  const [wikiStatus, setWikiStatus] = useState({}) // relPath -> { confirmed, count, lastConfirmedAt } (from json)

  // 加载 wiki 确认状态（从 .wiki-确认状态.json）
  const loadWikiStatus = useCallback(async () => {
    if (!hasDir) { setWikiStatus({}); return }
    try {
      const data = await projectFiles.wikiStatus(rootDir)
      setWikiStatus(data.status || {})
    } catch { /* ignore */ }
  }, [hasDir, rootDir])

  const refresh = useCallback(() => setReloadKey(k => k + 1), [])

  // 首次/目录变化时加载根目录。base 模式确保 基础资料 子目录存在。
  useEffect(() => {
    let cancelled = false
    if (!hasDir) { setRootEntries([]); setLoadError(''); return }
    setLoadError('')
    ;(async () => {
      try {
        if (!isWiki) await projectFiles.mkdir(rootDir, rootRel)
        const data = await projectFiles.list(rootDir, rootRel)
        if (!cancelled) setRootEntries(data.entries || [])
      } catch (e) {
        if (!cancelled) setLoadError(String(e.message || e))
      }
    })()
    return () => { cancelled = true }
  }, [rootDir, hasDir, reloadKey, isWiki, rootRel, refreshKey])

  // 异步加载所有 md 文件的状态（用于文件树左侧的状态圆点）
  const loadAllStatus = useCallback(async () => {
    if (!hasDir) { setStatusMap({}); return }
    try {
      const allMd = await collectMdFiles(rootDir, rootRel)
      const newMap = {}
      const concurrency = 5
      let idx = 0
      const worker = async () => {
        while (idx < allMd.length) {
          const i = idx++
          const relPath = allMd[i]
          try {
            const data = await projectFiles.read(rootDir, relPath)
            if (data.exists) {
              const s = parseContentStatus(data.content)
              newMap[relPath] = s.level
            }
          } catch { /* skip */ }
        }
      }
      await Promise.all(Array.from({ length: concurrency }, () => worker()))
      setStatusMap(newMap)
    } catch { /* 状态加载失败不影响主功能 */ }
  }, [rootDir, rootRel, hasDir])

  useEffect(() => {
    loadAllStatus()
    loadWikiStatus()
  }, [loadAllStatus, loadWikiStatus, reloadKey])

  const reloadFolder = useCallback(async (relPath) => {
    if (relPath === rootRel) return refresh()
    try {
      const data = await projectFiles.list(rootDir, relPath)
      setExpanded(prev => ({ ...prev, [relPath]: data.entries || [] }))
    } catch (e) {
      setLoadError(String(e.message || e))
    }
  }, [rootDir, rootRel, refresh])

  if (!hasDir) {
    return <SectionShell title={title || t('library.title')} icon={<FolderTree size={16}/>} compact={compact}>
      <div className="lib-empty"><FolderTree size={20}/><b>{needDirTitle || t('library.needDirTitle')}</b><span>{needDirDesc || t('library.needDirDesc')}</span></div>
    </SectionShell>
  }

  return <SectionShell
    title={title || t('library.title')}
    icon={<FolderTree size={16}/>}
    compact={compact}
    actions={<button className="text-btn" onClick={refresh}><RefreshCw size={13}/>{t('library.refresh')}</button>}
  >
    {loadError && <div className="lib-error"><AlertTriangle size={14}/>{loadError}</div>}
    <div className="lib-layout">
      <div className="lib-tree">
        <div className="lib-tree-head">
          <span><Folder size={14}/>{rootLabel}</span>
          <div className="lib-head-actions inline">
            <button className="icon-btn sm" title={t('library.newFile')} onClick={() => setAdding({ parent: rootRel, kind: 'file' })}><FilePlus2 size={14}/></button>
            <button className="icon-btn sm" title={t('library.newFolder')} onClick={() => setAdding({ parent: rootRel, kind: 'folder' })}><FolderPlus size={14}/></button>
          </div>
        </div>
        {rootEntries.length === 0 && !adding && <div className="lib-tree-empty">{t('library.empty')}</div>}
        {rootEntries.map(e => (
          <TreeItem key={e.name} entry={e} parentPath={rootRel} depth={1}
            expanded={expanded} setExpanded={setExpanded}
            selected={selected} onSelect={setSelected}
            adding={adding} setAdding={setAdding}
            onReload={reloadFolder} dir={rootDir}
            onChanged={refresh}
            statusMap={statusMap} onStatusLoaded={setStatusMap}
            wikiStatus={wikiStatus}
          />
        ))}
        {adding && adding.parent === rootRel && <AddRow adding={adding} depth={1}
          onCancel={() => setAdding(null)} onDone={() => {
            setAdding(null); refresh()
          }} dir={rootDir}/>}
      </div>

      <div className="lib-editor-pane">
        {selected
          ? <FileEditor key={selected.relPath} dir={rootDir} file={selected} onChanged={refresh}
            wikiStatusItem={wikiStatus[selected.relPath]}
            onWikiStatusChanged={(path, item) => {
              setWikiStatus(prev => {
                const next = { ...prev }
                if (item && item.confirmed === false && !item.count) delete next[path]
                else next[path] = { ...next[path], ...item }
                return next
              })
            }}/>
          : <div className="lib-empty"><FileText size={20}/><b>{t('library.noFileTitle')}</b><span>{t('library.noFileDesc')}</span></div>}
      </div>
    </div>
  </SectionShell>
}

function SectionShell({ title, icon, actions, children, compact = false }) {
  return <section className={"project-section " + (compact ? "lib-compact" : "")}>
    <div className="project-section-head lib-head">
      <h2>{icon}{title}</h2>
      <div className="lib-head-actions">{actions}</div>
    </div>
    {children}
  </section>
}

function TreeItem({ entry, parentPath, depth, expanded, setExpanded, selected, onSelect, adding, setAdding, onReload, dir, onChanged, statusMap, onStatusLoaded, wikiStatus }) {
  const { t } = useI18n()
  const relPath = projectFiles.join(parentPath, entry.name)
  const isOpen = Array.isArray(expanded[relPath])
  const isSelected = selected && selected.relPath === relPath
  const childDepth = depth + 1
  const contentStatus = statusMap?.[relPath] || null
  const wikiConfirmed = wikiStatus?.[relPath]?.confirmed || false
  // 合并优先级：内容有疑议(issue) > 内容有新增(new) > wiki已确认(confirmed) > 未确认(unconfirmed)
  const status = contentStatus === 'issue' ? 'issue'
    : contentStatus === 'new' ? 'new'
    : wikiConfirmed ? 'confirmed'
    : contentStatus === 'confirmed' ? 'confirmed' // fallback (old content markers)
    : 'unconfirmed'
  const isMd = entry.type === 'file' && entry.name.toLowerCase().endsWith('.md')

  const toggle = async () => {
    if (entry.type !== 'dir') { onSelect({ relPath, name: entry.name }); return }
    if (isOpen) { setExpanded(prev => { const c = { ...prev }; delete c[relPath]; return c }); return }
    try {
      const data = await projectFiles.list(dir, relPath)
      setExpanded(prev => ({ ...prev, [relPath]: data.entries || [] }))
    } catch (e) { /* shown at top via reload */ }
  }

  const del = async (e) => {
    e.stopPropagation()
    if (!confirm(t('library.confirmDelete', { name: entry.name }))) return
    try {
      await projectFiles.delete(dir, relPath)
      onReload(parentPath)
      onChanged()
    } catch (err) { alert(String(err.message || err)) }
  }

  return <div>
    <div className={'lib-row ' + (isSelected ? 'selected' : '')} style={{ paddingLeft: 10 + depth * 14 }} onClick={toggle}>
      {entry.type === 'dir'
        ? <>{isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}<Folder size={14} className="lib-ic-folder"/></>
        : <><span className="lib-spacer"/>{isMd && <span className={'status-dot ' + (status || 'none')}/>}<FileText size={14} className="lib-ic-file"/></>}
      <span className="lib-row-name">{entry.name}</span>
      <span className="lib-row-actions" onClick={e => e.stopPropagation()}>
        {entry.type === 'dir' && <>
          <button className="icon-btn sm" title={t('library.newFile')} onClick={() => setAdding({ parent: relPath, kind: 'file' })}><FilePlus2 size={13}/></button>
          <button className="icon-btn sm" title={t('library.newFolder')} onClick={() => setAdding({ parent: relPath, kind: 'folder' })}><FolderPlus size={13}/></button>
        </>}
        <button className="icon-btn sm danger" title={t('library.delete')} onClick={del}><Trash2 size={13}/></button>
      </span>
    </div>
    {entry.type === 'dir' && isOpen && (
      <>
        {(expanded[relPath] || []).map(child => (
          <TreeItem key={child.name} entry={child} parentPath={relPath} depth={childDepth}
            expanded={expanded} setExpanded={setExpanded}
            selected={selected} onSelect={onSelect}
            adding={adding} setAdding={setAdding}
            onReload={onReload} dir={dir} onChanged={onChanged}
            statusMap={statusMap} onStatusLoaded={onStatusLoaded}
            wikiStatus={wikiStatus}
          />
        ))}
        {adding && adding.parent === relPath && <AddRow adding={adding} depth={childDepth}
          onCancel={() => setAdding(null)} onDone={() => { setAdding(null); onReload(relPath) }} dir={dir}/>}
      </>
    )}
  </div>
}

function AddRow({ adding, depth = 1, onCancel, onDone, dir }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current && inputRef.current.focus() }, [])

  const submit = async () => {
    const bad = invalidName(name)
    if (bad) { setErr(t('library.invalidName.' + bad) || t('library.invalidName.generic')); return }
    const finalName = adding.kind === 'file' ? ensureExt(name.trim()) : name.trim()
    const target = projectFiles.join(adding.parent, finalName)
    try {
      if (adding.kind === 'folder') await projectFiles.mkdir(dir, target)
      else await projectFiles.write(dir, target, '')
      setErr('')
      onDone()
    } catch (e) {
      setErr(String(e.message || e))
    }
  }

  return <div className="lib-add-row" style={{ paddingLeft: 10 + depth * 14 }}>
    {adding.kind === 'folder' ? <Folder size={14}/> : <FileText size={14}/>}
    <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
      placeholder={adding.kind === 'folder' ? t('library.folderName') : t('library.fileName')}
      onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}/>
    <button className="primary xs" onClick={submit}>{t('library.confirmCreate')}</button>
    <button className="secondary xs" onClick={onCancel}>{t('library.cancel')}</button>
    {err && <span className="lib-add-err">{err}</span>}
  </div>
}

// 递归收集目录下所有 .md 文件的相对路径
async function collectMdFiles(dir, relPath) {
  const result = []
  try {
    const data = await projectFiles.list(dir, relPath)
    const entries = data.entries || []
    for (const e of entries) {
      const childRel = projectFiles.join(relPath, e.name)
      if (e.type === 'dir') {
        const sub = await collectMdFiles(dir, childRel)
        result.push(...sub)
      } else if (e.name.toLowerCase().endsWith('.md')) {
        result.push(childRel)
      }
    }
  } catch { /* ignore */ }
  return result
}

// 简单字符串 hash（djb2），用于比较内容是否变化
function hashString(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i)
  return String(h >>> 0)
}

// 内容状态解析：判断文件的确认状态和次数
// 规则：
// - 包含 [!NOTE] AI 新增 → 有新增待确认
// - 包含 [!CAUTION] AI 疑议 → 有疑议待确认
// - 包含 [!CONFIRMED] count=N → 已确认 N 次
// 优先级：疑议 > 新增 > 已确认
const CONFIRMED_RE = /\[!CONFIRMED\][^\n]*\bcount\s*=\s*(\d+)/i

export function parseContentStatus(content) {
  if (!content) return { level: 'empty', count: 0, newCount: 0, issueCount: 0 }
  // 按行检测：只有以 "> " 开头的引用块里的标记才算真标记
  // 正文里举例提到的 "[!NOTE] AI 新增" 字符串不算
  const lines = content.split('\n')
  let hasNew = false, hasIssue = false
  let newCount = 0, issueCount = 0
  for (const line of lines) {
    if (/^>\s*\[!NOTE\]\s*AI\s*新增/i.test(line)) { hasNew = true; newCount++ }
    if (/^>\s*\[!CAUTION\]\s*AI\s*疑议/i.test(line)) { hasIssue = true; issueCount++ }
  }
  const m = content.match(CONFIRMED_RE)
  const count = m ? parseInt(m[1], 10) : 0
  let level
  if (hasIssue) level = 'issue'
  else if (hasNew) level = 'new'
  else if (count > 0) level = 'confirmed'
  else level = 'unconfirmed'
  return { level, count, newCount, issueCount }
}

// 移除所有 [!NOTE] AI 新增 和 [!CAUTION] AI 疑议 标记块，保留正文内容
// 规则：
// - 标记块以 "> [!NOTE] AI 新增" 或 "> [!CAUTION] AI 疑议" 开头
// - 标记块由连续的以 "> " 开头的行组成（引用块）
// - 标记块后面紧跟的正文保留
function stripMarkers(content) {
  const lines = content.split('\n')
  const result = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // 检测是否是标记块的开头
    if (/^>\s*\[!NOTE\]\s*AI\s*新增/i.test(line) || /^>\s*\[!CAUTION\]\s*AI\s*疑议/i.test(line)) {
      // 跳过整个引用块（所有以 "> " 开头的连续行）
      while (i < lines.length && /^>\s?/.test(lines[i]) && lines[i].trim() !== '>') {
        i++
      }
      // 跳过标记块后的空行（最多跳1行，避免吃掉正文间的段落间隔）
      // 不跳过，保留空行
      continue
    }
    result.push(line)
    i++
  }
  return result.join('\n').trim() + '\n'
}

// 在文件内容顶部插入或更新 [!CONFIRMED] 标记，次数 +1
// 同时清除所有 🟡 / 🔴 标记块（用户确认 = 整份内容已审核）
// 返回新内容
export function incrementConfirm(content) {
  // 先清除所有待确认标记
  let cleaned = stripMarkers(content)

  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const status = parseContentStatus(cleaned)
  const newCount = status.count + 1
  const block = `> [!CONFIRMED] 已确认 · ${newCount}次 · count=${newCount}
> 最近确认时间：${date}
`

  if (status.count > 0) {
    // 替换已有确认标记
    const re = /^>\s*\[!CONFIRMED\][^\n]*\n(?:>\s*[^\n]*\n)*/m
    return cleaned.replace(re, block)
  } else {
    // 在文件顶部插入（跳过空行和标题）
    const lines = cleaned.split('\n')
    let insertAt = 0
    while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++
    if (insertAt < lines.length && /^#\s+/.test(lines[insertAt])) {
      insertAt++
      while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++
    }
    const before = lines.slice(0, insertAt).join('\n')
    const after = lines.slice(insertAt).join('\n')
    let result = ''
    if (before) result += before + '\n'
    result += block
    if (after) result += '\n' + after
    return result
  }
}

function FileEditor({ dir, file, onChanged, wikiStatusItem, onWikiStatusChanged }) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(''); setDirty(false)
    projectFiles.read(dir, file.relPath)
      .then(data => { if (!cancelled) { setContent(data.exists ? data.content : ''); setLoading(false) } })
      .catch(e => { if (!cancelled) { setErr(String(e.message || e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [dir, file.relPath])

  // 合并状态：内容标记(new/issue) + wiki 确认状态(confirmed/count)
  const contentStatus = parseContentStatus(content)
  const wikiConfirmed = !!(wikiStatusItem?.confirmed)
  const wikiCount = wikiStatusItem?.count || 0
  // 显示等级：疑议 > 新增 > 已确认 > 未确认
  const displayLevel = contentStatus.level === 'issue' ? 'issue'
    : contentStatus.level === 'new' ? 'new'
    : wikiConfirmed ? 'confirmed'
    : contentStatus.level === 'confirmed' ? 'confirmed' // fallback
    : 'unconfirmed'
  // 已确认次数：wiki json 里的为准
  const displayCount = displayLevel === 'confirmed' ? wikiCount : 0

  // 计算内容 hash（用于判断内容有没有变）
  const contentHash = content ? hashString(content) : null

  const save = async () => {
    setSaving(true); setErr(''); setMsg('')
    try {
      await projectFiles.write(dir, file.relPath, content)
      setDirty(false); setMsg(t('library.saved'))
      // 如果文件之前是已确认状态，但保存后内容变了 → 自动取消确认（次数不变）
      if (wikiStatusItem?.confirmed) {
        const newHash = content ? hashString(content) : null
        if (newHash !== wikiStatusItem.contentHash) {
          try {
            await projectFiles.wikiConfirm(dir, file.relPath, false, newHash, true)
            onWikiStatusChanged && onWikiStatusChanged(file.relPath, {
              confirmed: false,
              count: wikiStatusItem.count || 0,
              contentHash: newHash,
            })
          } catch { /* ignore */ }
        }
      }
      onChanged()
      setTimeout(() => setMsg(''), 1800)
    } catch (e) {
      setErr(String(e.message || e))
    } finally { setSaving(false) }
  }

  const handleConfirm = async () => {
    setConfirming(true); setErr(''); setMsg('')
    try {
      // 1. 清除正文里的 🟡🔴 标记块
      const cleaned = stripMarkers(content)
      if (cleaned !== content) {
        await projectFiles.write(dir, file.relPath, cleaned)
        setContent(cleaned)
      }
      setDirty(false)
      // 2. 更新 json 确认状态
      const newHash = cleaned ? hashString(cleaned) : null
      const data = await projectFiles.wikiConfirm(dir, file.relPath, true, newHash)
      onWikiStatusChanged && onWikiStatusChanged(file.relPath, {
        confirmed: true,
        count: data.count,
      })
      setMsg(t('confirm.done'))
      setTimeout(() => setMsg(''), 2000)
      onChanged && onChanged()
    } catch (e) {
      setErr(String(e.message || e))
    } finally { setConfirming(false) }
  }

  const handleUnconfirm = async () => {
    setConfirming(true); setErr(''); setMsg('')
    try {
      // 取消确认：json 里 confirmed=false，后端负责 count-1
      const data = await projectFiles.wikiConfirm(dir, file.relPath, false, contentHash)
      onWikiStatusChanged && onWikiStatusChanged(file.relPath, {
        confirmed: false,
        count: data.count,
      })
      setMsg('已取消确认')
      setTimeout(() => setMsg(''), 2000)
      onChanged && onChanged()
    } catch (e) {
      setErr(String(e.message || e))
    } finally { setConfirming(false) }
  }

  const statusLabel = {
    confirmed: <span className="status-badge ok">✅ {t('confirm.confirmed')} · {displayCount}{t('confirm.times')}</span>,
    new: <span className="status-badge new">🟡 {t('confirm.hasNew')} · {contentStatus.newCount}</span>,
    issue: <span className="status-badge issue">🔴 {t('confirm.hasIssue')} · {contentStatus.issueCount}</span>,
    unconfirmed: <span className="status-badge">{t('confirm.unconfirmed')}</span>,
    empty: null,
  }[displayLevel]

  const canConfirm = displayLevel !== 'confirmed' && !dirty
  const canUnconfirm = displayLevel === 'confirmed' && !dirty

  return <div className="file-editor">
    <div className="file-editor-head">
      <b><FileText size={14}/>{file.name}</b>
      <div className="file-editor-actions">
        {msg && <span className="save-msg ok"><Check size={13}/>{msg}</span>}
        {err && <span className="save-msg error"><AlertTriangle size={13}/>{err}</span>}
        <span className="file-status">{statusLabel}</span>
        {canConfirm && <button className="confirm-btn sm"
          onClick={handleConfirm} disabled={confirming || loading || !content}>
          <Check size={14}/>{confirming ? t('confirm.confirming') : t('confirm.confirm')}
        </button>}
        {canUnconfirm && <button className="unconfirm-btn sm"
          onClick={handleUnconfirm} disabled={confirming || loading}>
          <X size={14}/>{confirming ? '...' : '取消确认'}
        </button>}
        <button className="primary sm" onClick={save} disabled={saving || loading}>
          <Save size={14}/>{saving ? t('library.saving') : dirty ? t('library.save') : t('library.savedShort')}
        </button>
      </div>
    </div>
    {loading
      ? <div className="file-editor-loading">{t('library.loading')}</div>
      : <textarea className="file-editor-text" value={content}
          onChange={e => { setContent(e.target.value); setDirty(true); setMsg('') }}
          placeholder={t('library.editorPlaceholder')}/>}
  </div>
}
