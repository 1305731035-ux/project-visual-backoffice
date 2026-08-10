import React, { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, Trash2, UserRound, X, ArrowDownAZ, SlidersHorizontal } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { categoryLabel } from '../capabilities/categoryNames'
import { CapabilityNameHeader } from '../capabilities/CapabilityNameHeader'
import { projectFiles } from './projectFilesClient.js'

export function ProjectSkills({ dir }) {
  const { lang, t } = useI18n()
  const [env, setEnv] = useState(null)
  const [project, setProject] = useState({ skills: [], available: [] })
  const [translations, setTranslations] = useState({})
  const [skillLang, setSkillLang] = useState('zh')
  const [showAdd, setShowAdd] = useState(false)
  const [checked, setChecked] = useState([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('default')
  const [kind, setKind] = useState('全部')
  const [category, setCategory] = useState('全部')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // 环境检测：确认当前运行环境是否具备 Hermes（决定是否展示 Skill 管理功能）
  useEffect(() => {
    let alive = true
    if (!dir) { if (alive) setEnv(null); return }
    projectFiles.skillsEnv(dir).then(e => { if (alive) setEnv(e) }).catch(() => { if (alive) setEnv({ supported: false }) })
    return () => { alive = false }
  }, [dir])

  const load = async () => {
    if (!dir) return
    setLoading(true); setError('')
    try {
      const [projectData, translationData] = await Promise.all([
        projectFiles.projectSkills(dir),
        fetch('/api/traffic/capability-translations').then(r => r.json()),
      ])
      setProject(projectData)
      setTranslations(translationData.items || {})
    } catch (e) { setError(e.message || String(e)) } finally { setLoading(false) }
  }
  useEffect(() => { if (env?.supported) load() }, [dir, env?.supported])

  const rows = useMemo(() => project.skills.map(item => {
    const tr = translations[`skill:${item.name}`] || {}
    return { ...item, id: `skill:${item.name}`, translatedName: tr.name || item.name, translatedDescription: tr.description || item.description }
  }), [project.skills, translations])

  const displayedRows = useMemo(() => rows
    .filter(item => category === '全部' || item.category === category)
    .filter(item => `${item.name} ${item.category} ${item.description} ${item.translatedName} ${item.translatedDescription}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === 'usage' ? (b.useCount || 0) - (a.useCount || 0) : (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)), [rows, query, category, sort])

  const available = useMemo(() => project.available
    .filter(item => `${item.name} ${item.category} ${item.description} ${translations[`skill:${item.name}`]?.name || ''} ${translations[`skill:${item.name}`]?.description || ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [project.available, query, translations])

  const projectCategories = useMemo(() => [...new Set(rows.map(item => item.category).filter(Boolean))].sort(), [rows])

  const importSkills = async () => {
    try { await projectFiles.importProjectSkills(dir, checked); setChecked([]); setShowAdd(false); await load() }
    catch (e) { setError(e.message || String(e)) }
  }
  const remove = async name => {
    if (!window.confirm(`从本项目移除「${name}」？不会删除已安装的原始 Skill。`)) return
    try { await projectFiles.deleteProjectSkill(dir, name); await load() }
    catch (e) { setError(e.message || String(e)) }
  }

  return <div className="project-skills">
    {env && !env.supported && <div className="skill-standard-mode">
      <div className="skill-standard-head"><SlidersHorizontal size={16}/><b>项目 Skill 管理（标准模式）</b></div>
      <p>当前运行环境未检测到 Hermes。项目 Skill 列表与模式切换已隐藏——它们是 Hermes 专属功能，依赖 <code>~/.hermes</code> 目录与 <code>hermes</code> CLI。</p>
      <p>以下通用功能不受影响，可在任何 AI 平台正常使用：项目文档、Wiki 知识库、Git 确认、开启新对话、拖拽布局。</p>
      <p className="skill-standard-ai">给 AI 的说明：若你的平台支持标准 Agent Skills（SKILL.md 格式），可在「项目设置」中配置 skill 扫描目录（如 <code>~/.claude/skills</code>、<code>~/.codex/skills</code>），由平台侧 AI 自行完成适配后即可启用本项目 Skill 管理。</p>
    </div>}
    {(!env || env.supported) && <>
    <div className="skill-toolbar">
      <span><UserRound size={15}/> {project.profileFile || '项目路径/.hermes-profile/profile.json'}</span>
      <button className="secondary" onClick={() => setShowAdd(true)} disabled={!dir}><Plus size={15}/>添加 Skill</button>
      <button className="icon-btn" onClick={load} disabled={loading} title="刷新"><RefreshCw size={15}/></button>
    </div>
    {error && <div className="error-note">{error}</div>}
    {!dir && <div className="usage-empty">请先在“项目设置”保存项目工作目录。</div>}
    {dir && <>
      <div className="capability-source-note"><UserRound size={16}/><span>项目专属 Profile · 已抓取 Skill</span><b>{displayedRows.length} 个</b></div>
      <div className="capability-toolbar project-skill-filter">
        <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索名称、用途或分类"/></div>
        <label className="toolbar-sort"><ArrowDownAZ size={14}/><select value={sort} onChange={e => setSort(e.target.value)} aria-label="排序"><option value="default">默认排序</option><option value="usage">按使用次数</option></select></label>
        <select value={kind} onChange={e => setKind(e.target.value)} aria-label="类型"><option value="全部">全部</option><option value="Skill">Skill</option></select>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="分类"><option value="全部">全部</option>{projectCategories.map(item => <option key={item} value={item}>{categoryLabel(item, lang)}</option>)}</select>
      </div>
      <div className="capability-table project-skill-table">
        <div className="capability-table-head">
          <CapabilityNameHeader skillLang={skillLang} onToggleLang={setSkillLang} pending={0} onTranslate={() => {}} translating={false}/>
          <span>{t('framework.colCategory')}</span><span>{t('framework.colUsage')}</span><span>操作</span>
        </div>
        {displayedRows.map(item => {
          const showZh = skillLang === 'zh'
          const name = showZh ? item.translatedName : item.name
          const desc = showZh ? item.translatedDescription : item.description
          return <div className="capability-row" key={item.id}>
            <div className="capability-name"><b title={name}>{name}</b><small title={desc}>{desc}</small></div>
            <span className="capability-cat">{categoryLabel(item.category, lang)}</span>
            <span className="capability-usage">使用 {item.useCount || 0} 次</span>
            <button className="icon-btn danger project-skill-delete" onClick={() => remove(item.name)} title="从项目移除"><Trash2 size={14}/></button>
          </div>
        })}
      </div>
      {!rows.length && <div className="usage-empty">还没有项目专属 Skill，点击“添加 Skill”从已安装列表中抓取。</div>}
    </>}
    {showAdd && <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}><div className="modal skill-add-modal" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><h3>添加项目 Skill</h3><div className="skill-add-head-actions"><button className="primary skill-import-head-btn" disabled={!checked.length} onClick={importSkills}>抓取所选（{checked.length}）</button><button className="icon-btn" onClick={() => setShowAdd(false)}><X size={16}/></button></div></div>
      <div className="modal-body"><input className="skill-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索 Skill 名称、分类或说明…"/>
        {available.map(item => <label className="skill-option" key={item.name}><input type="checkbox" checked={checked.includes(item.name)} onChange={() => setChecked(v => v.includes(item.name) ? v.filter(x => x !== item.name) : [...v, item.name])}/><span><b>{translations[`skill:${item.name}`]?.name || item.name}</b><small>{categoryLabel(item.category, lang)} · {translations[`skill:${item.name}`]?.description || item.description}</small></span></label>)}
        {!available.length && <div className="usage-empty">所有已安装 Skill 都已经抓取到本项目。</div>}
      </div>
    </div></div>}
    </>}
  </div>
}
