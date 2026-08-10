import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowDown, ArrowUp, Layers3, RefreshCw, Search } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { categoryLabel } from './categoryNames'
import { CapabilityNameHeader } from './CapabilityNameHeader'

const kindKeys = ['全部', 'Skill', 'Provider', '内置工具']
const SORT_DEFAULT = 'default'
const SORT_USAGE = 'usage'
const SORT_ENABLED = 'enabled'

const statusKeyByZh = {
  '已禁用': 'framework.statusDisabled',
  '已发现': 'framework.statusDiscovered',
  '已配置': 'framework.statusConfigured',
  '缺少地址': 'framework.statusMissingUrl',
  '已注册': 'framework.statusRegistered',
}

const kindLabel = (kind, t) =>
  (kind === 'Skill' || kind === 'Provider' || kind === '内置工具') ? t(`kind.${kind}`) : kind
const statusLabel = (item, t) => {
  if (item.kind === 'Skill') {
    if (item.status === '已禁用') return t('framework.statusDisabled') || '已禁用'
    return t('framework.statusEnabled') || '已启用'
  }
  return t(statusKeyByZh[item.status] || '') || item.status
}
const usageCount = (item) => item.kind === 'Skill' ? Number(item.useCount || 0) : 0

export function CapabilityDirectory({ entryActions }) {
  const { lang, t } = useI18n()
  const [env, setEnv] = useState(null)
  const [data, setData] = useState({ capabilities: [], summary: {} })
  const [kind, setKind] = useState('全部')
  const [category, setCategory] = useState('全部')
  const [sort, setSort] = useState(SORT_DEFAULT)
  const [sortDir, setSortDir] = useState('desc') // asc | desc；方向按钮切换
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [skillLang, setSkillLang] = useState('zh')
  const [translations, setTranslations] = useState({})
  const [pending, setPending] = useState(0)
  const [translating, setTranslating] = useState(false)
  const [translateMsg, setTranslateMsg] = useState('')

  // 环境检测：确认当前运行环境是否具备 Hermes（决定是否展示能力发现）
  useEffect(() => {
    let alive = true
    fetch('/api/project/skills/env?dir=')
      .then(r => r.json()).then(e => { if (alive) setEnv(e) })
      .catch(() => { if (alive) setEnv({ supported: false }) })
    return () => { alive = false }
  }, [])

  const load = () => {
    setLoading(true); setError('')
    fetch('/api/traffic/capabilities').then(r => r.json()).then(p => {
      if (p.error) throw new Error(p.error)
      setData(p)
    }).catch(e => setError(String(e.message || e))).finally(() => setLoading(false))
  }
  const loadTranslations = () => {
    fetch('/api/traffic/capability-translations').then(r => r.json()).then(p => setTranslations(p.items || {})).catch(() => {})
    fetch('/api/traffic/capability-translations/status').then(r => r.json()).then(p => setPending(p.pending || 0)).catch(() => {})
  }

  useEffect(() => { if (env?.supported) { load(); loadTranslations() } }, [env?.supported])

  const runTranslate = () => {
    setTranslating(true); setTranslateMsg('')
    fetch('/api/traffic/capability-translations/run', { method: 'POST' })
      .then(r => r.json()).then(p => {
        if (p.error) throw new Error(p.error)
        setTranslateMsg(t('framework.translateDone', { count: p.translated ?? 0, native: p.nativeApplied ?? 0 }))
        loadTranslations(); load()
      }).catch(e => setTranslateMsg(t('framework.translateError') + (e.message || e)))
      .finally(() => setTranslating(false))
  }

  const categories = data.categories || []

  // 技能统计：前面是未禁用（已启用）的数量，后面是总数
  const allSkills = data.capabilities.filter(item => item.kind === 'Skill')
  const enabledSkills = allSkills.filter(item => item.status !== '已禁用').length
  const totalSkills = data.summary.skills || allSkills.length

  const filtered = useMemo(() => {
    const rows = data.capabilities.filter(item => {
      const tr = translations[item.id] || {}
      const text = `${item.name} ${item.kind} ${item.category} ${categoryLabel(item.category, 'zh')} ${item.description} ${tr.name || ''} ${tr.description || ''}`.toLowerCase()
      return (kind === '全部' || item.kind === kind)
        && (category === '全部' || item.category === category)
        && text.includes(query.toLowerCase())
    })
    // 排序只对 Skill 有意义：内置工具（已注册）、Provider（已配置）没有启用/禁用、使用次数概念。
    // 它们永远沉底、保持原顺序，任何排序方式下都不会"顶到最前"。
    if (sort === SORT_DEFAULT) return rows
    const skills = rows.filter(r => r.kind === 'Skill')
    const others = rows.filter(r => r.kind !== 'Skill')
    const dir = sortDir === 'asc' ? 1 : -1 // desc=-1 → 主键大的在前；asc=+1 → 主键小的在前
    // 名称比较用「显示名」（翻译优先），与表格展示一致；tie 时方向跟随 dir，↓/↑ 都能精确反转
    const displayName = (r) => String((translations[r.id] || {}).name || r.name || '')
    const nameCmp = (a, b) => displayName(a).localeCompare(displayName(b), 'zh') || String(a.id || '').localeCompare(String(b.id || ''))
    // 主键：usage=使用次数多→大；enabled=启用(1) > 禁用(0)
    const primary = sort === SORT_USAGE
      ? (a, b) => usageCount(a) - usageCount(b)
      : (a, b) => (a.status === '已禁用' ? 0 : 1) - (b.status === '已禁用' ? 0 : 1)
    const sorted = [...skills].sort((a, b) => {
      const p = primary(a, b)
      if (p !== 0) return p * dir
      return nameCmp(a, b) * dir
    })
    return [...sorted, ...others]
  }, [data.capabilities, kind, category, query, sort, sortDir, translations])

  // 显示名撞名处理：AI 翻译可能把不同技能翻译成相同中文名（如中英文两个版本的技能），
  // 导致列表出现两行一模一样。规则（不依赖排序顺序）：
  // 翻译名若撞了任何条目的原始名 → 该条目显示自己的原始名（英文版显示英文、中文版显示中文）。
  const shownNames = useMemo(() => {
    const rawNames = new Set(filtered.map(i => String(i.name || '')))
    const map = {}
    for (const item of filtered) {
      const raw = String(item.name || '')
      const trName = translations[item.id]?.name
      map[item.id] = trName && !rawNames.has(trName) ? trName : raw
    }
    return map
  }, [filtered, translations])

  return <div className="content">
    <div className="framework-body">
      <div className="framework-main">
        <div className="hero compact framework-hero">
          <div className="framework-hero-main">
            <div className="framework-hero-actions">
              {entryActions}
            </div>
            <div className="framework-title-row">
              <h1 className="framework-title-small">{t('framework.title')}</h1>
              <p className="framework-desc">{t('framework.desc')}</p>
              <button className="secondary framework-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/>{t('framework.refresh')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="stats">
      <Stat label={t('framework.statAll')} value={data.summary.total || 0} sub={t('framework.subAll')}/>
      <Stat label={t('framework.statSkill')} value={`${enabledSkills}/${totalSkills}`} sub={t('framework.subSkill')}/>
      <Stat label={t('framework.statProvider')} value={data.summary.providers || 0} sub={t('framework.subProvider')}/>
      <Stat label={t('framework.statTool')} value={data.summary.tools || 0} sub={t('framework.subTool')}/>
    </div>
    <div className="framework-notes-bottom">
      <div className="skill-standard-mode framework-ai-note">
        <p>【给 AI 的说明：此页面仅为统计页面，为辅助页面，描的是 Hermes 安装目录（<code>~/.hermes/hermes-agent</code>）中的能力注册信息。若你的平台支持标准 Agent Skills（SKILL.md 格式），能力发现可适配为读取你平台的 skill 目录（如 <code>~/.claude/skills</code>、<code>~/.codex/skills</code>），由平台侧 AI 自行完成适配后即可启用。】</p>
        <p className="framework-ai-note-strong">【不启动时，功能不受影响】</p>
      </div>
      {env && !env.supported && <div className="skill-standard-mode framework-env-note">
        <div className="skill-standard-head"><Layers3 size={16}/><b>当前环境未检测到 Hermes</b></div>
        <p>能力发现已隐藏。项目文档、Wiki 知识库、Git 确认、开启新对话、拖拽布局等通用功能不受影响，可在任何 AI 平台正常使用。</p>
      </div>}
    </div>
    {env?.supported && <>
    {error && <div className="notice error-note">{t('framework.loadError')}{error}</div>}
    {translateMsg && <div className="notice">{translateMsg}</div>}
    <div className="capability-toolbar">
      <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('framework.search')}/></div>
      <label className="toolbar-sort"><ArrowDownAZ size={14}/><select
        value={sort}
        onChange={e => { setSort(e.target.value); setSortDir('desc') }}
        aria-label={t('framework.sort')}
      >
        <option value={SORT_DEFAULT}>{t('framework.sortDefault')}</option>
        <option value={SORT_USAGE}>{t('framework.sortUsage')}</option>
        <option value={SORT_ENABLED}>{t('framework.sortEnabled')}</option>
      </select>
        <button
          type="button"
          className="sort-dir-btn"
          disabled={sort === SORT_DEFAULT}
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          title={sortDir === 'desc' ? t('framework.dirDesc') : t('framework.dirAsc')}
          aria-label={sortDir === 'desc' ? t('framework.dirDesc') : t('framework.dirAsc')}
        >{sortDir === 'desc' ? <ArrowDown size={14}/> : <ArrowUp size={14}/>}</button>
      </label>
      <select value={kind} onChange={e => { setKind(e.target.value); setCategory('全部') }} aria-label={t('framework.ariaType')}>
        {kindKeys.map(k => <option key={k} value={k}>{k === '全部' ? t('framework.all') : kindLabel(k, t)}</option>)}
      </select>
      <select value={category} onChange={e => setCategory(e.target.value)} aria-label={t('framework.ariaCat')}>
        <option value="全部">{t('framework.all')}</option>
        {categories.map(c => <option key={c} value={c}>{categoryLabel(c, lang)}</option>)}
      </select>
    </div>
    <div className="capability-source-note">
      <Layers3 size={16}/><span>{t('framework.source')}</span>
      {sort === SORT_USAGE && <em className="sort-hint">{sortDir === 'desc' ? t('framework.sortUsageDesc') : t('framework.sortUsageAscDesc')}</em>}
      {sort === SORT_ENABLED && <em className="sort-hint">{sortDir === 'desc' ? t('framework.sortEnabledDesc') : t('framework.sortEnabledAscDesc')}</em>}
      <b>{filtered.length} {t('framework.unit')}</b>
    </div>
    {loading && <div className="usage-empty">{t('framework.loading')}</div>}
    {!loading && <div className="capability-table">
      <div className="capability-table-head">
        <CapabilityNameHeader skillLang={skillLang} onToggleLang={setSkillLang} pending={pending} onTranslate={runTranslate} translating={translating}/>
        <span>{t('framework.colKind')}</span><span>{t('framework.colCategory')}</span>
        <span>{t('framework.colStatus')}</span><span>{t('framework.colUsage')}</span>
      </div>
      {filtered.map((item, i) => <CapabilityRow key={`${item.id}:${item.location || i}`} item={item} skillLang={skillLang} shownName={shownNames[item.id]} tr={translations[item.id] || {}}/>)}
    </div>}
    {!loading && filtered.length === 0 && <div className="usage-empty">{t('framework.noResult')}</div>}
    </>}
  </div>
}

const Stat = ({ label, value, sub }) =>
  <div className="stat"><div className="stat-icon"><Layers3 size={17}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>

function CapabilityRow({ item, skillLang, shownName, tr }) {
  const { lang, t } = useI18n()
  const usage = item.kind === 'Skill'
    ? (item.lastUsedAt ? t('framework.usageTpl', { count: item.useCount, date: new Date(item.lastUsedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US') }) : t('framework.noUsage'))
    : item.kind === 'Provider' ? t('framework.modelsTpl', { count: item.models?.length || 0 }) : t('framework.registered')
  const cat = item.category || t('framework.uncategorized')
  const showZh = skillLang === 'zh'
  const name = showZh ? (shownName || item.name) : item.name
  const desc = showZh ? (tr.description || item.description) : item.description
  const translated = showZh && (tr.name || tr.description)
  return <div className="capability-row">
    <div className="capability-name"><b title={name}>{name}</b><small title={desc}>{desc}{translated && <i className="tr-flag" title={t('framework.toggleZh')}>✓{t('framework.toggleZh')}</i>}</small></div>
    <span className="capability-kind">{kindLabel(item.kind, t)}</span>
    <span className="capability-cat">{categoryLabel(cat, lang)}</span>
    <span className={`pill ${item.status === '已禁用' || item.status === '缺少地址' ? 'red' : 'green'}`}>{statusLabel(item, t)}</span>
    <span className="capability-usage">{usage}</span>
  </div>
}
