import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChevronRight, FileText, FolderKanban, Layers3, MessageSquarePlus, Settings2, Sparkles, Wrench } from 'lucide-react'
import './styles.css'
import { CapabilityDirectory } from './modules/capabilities/CapabilityDirectory.jsx'
import { ProjectPageEntryButtons } from './modules/projects/ProjectPageEntryButtons.jsx'
import { StartupDialog } from './modules/projects/StartupDialog.jsx'
import { projectFiles } from './modules/projects/projectFilesClient.js'
import { AIReadEditor } from './modules/projects/AIReadEditor.jsx'
import { ResourceLibrary } from './modules/projects/ResourceLibrary.jsx'
import { GitHistory } from './modules/projects/GitHistory.jsx'
import { ProjectSkills } from './modules/projects/ProjectSkills.jsx'
import { SkillModeControls } from './modules/projects/SkillModeControls.jsx'
import { Responsive as ResponsiveGridLayout, WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { I18nProvider, LangToggle, useI18n } from './i18n/I18nProvider'
import { listProjectPages, updateProjectPage } from './storage/projectPagesStorage.js'

function App() {
  return <I18nProvider><Shell/></I18nProvider>
}

const PROJECT_ID_PREFIX = 'project:'
const isProjectId = id => typeof id === 'string' && id.startsWith(PROJECT_ID_PREFIX)
const projectIdOf = pageId => PROJECT_ID_PREFIX + pageId
const pageIdOf = activeId => activeId.slice(PROJECT_ID_PREFIX.length)

function Shell() {
  const { t } = useI18n()
  const [active, setActive] = useState('framework')
  // 项目页面列表由 Shell 统一持有，创建/删除后刷新，侧边栏与内容区同步
  const [pages, setPages] = useState(() => listProjectPages())

  const refreshPages = useCallback(() => setPages(listProjectPages()), [])

  // 若当前打开的项目页被删除，自动回到框架能力页，避免侧边栏无高亮、内容区空白
  useEffect(() => {
    if (isProjectId(active) && !pages.some(p => projectIdOf(p.id) === active)) {
      setActive('framework')
    }
  }, [pages, active])

  const fixedNav = [
    { id: 'framework', icon: Layers3, label: t('nav.framework'), tag: t('tag.ability') },
  ]
  const projectNav = pages.map(p => ({
    id: projectIdOf(p.id), icon: FileText, label: p.name, tag: t('tag.project'),
  }))
  const navItems = [...fixedNav, ...projectNav]

  const crumbMap = {
    framework: t('crumb.framework'),
  }
  const activePage = isProjectId(active) ? pages.find(p => p.id === pageIdOf(active)) : null
  const crumbLabel = activePage ? activePage.name : crumbMap[active]

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><div><b>{t('brand.title')}</b><span>{t('brand.subtitle')}</span></div></div>
      <div className="workspace"><span className="dot"/> {t('workspace')} <ChevronRight size={14}/></div>
      <nav>
        {navItems.map(item => (
          <button key={item.id} className={active === item.id ? 'nav active' : 'nav'} onClick={() => setActive(item.id)} title={item.label}>
            <item.icon size={17}/><span className="nav-label">{item.label}</span>{item.tag && <em>{item.tag}</em>}
          </button>
        ))}
      </nav>
      <div className="side-bottom">
        <div className="small-label">{t('nav.quick')}</div>
        <button className="nav"><Sparkles size={17}/><span className="nav-label">{t('nav.nlCreate')}</span></button>
        <button className="nav"><Settings2 size={17}/><span className="nav-label">{t('nav.settings')}</span></button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="crumb">{t('workspace')} <ChevronRight size={14}/> <b>{crumbLabel}</b></div>
        <div className="top-actions">
          <LangToggle className="lang-toggle"/>
          <span className="live"><i/>{t('topbar.localData')}</span>
          <button className="icon-btn"><Wrench size={17}/></button>
        </div>
      </header>
      {active === 'framework' && <CapabilityDirectory
        entryActions={<ProjectPageEntryButtons onCreated={(page) => { refreshPages(); setActive(projectIdOf(page.id)) }} onChanged={refreshPages}/>}
      />}
      {activePage && <ProjectDetail key={activePage.id} page={activePage} onChanged={refreshPages}/>}
    </main>
  </div>
}

// 第1步：项目详情页。本步加入【工作目录】字段与【开启新对话】按钮（生成开场提示词）。
// 后续步骤在此页面内加 新AI必读文件列表 / Wiki / profile 等区块。
function ProjectDetail({ page, onChanged }) {
  const { t } = useI18n()
  const [dir, setDir] = useState(page.workingDir || '')
  const [wikiDir, setWikiDir] = useState(page.wikiDir || '')
  const [saved, setSaved] = useState(false)
  const [wikiSaved, setWikiSaved] = useState(false)
  const [showStartup, setShowStartup] = useState(false)
  const [aiReadContent, setAiReadContent] = useState('')
  const [initRefresh, setInitRefresh] = useState(0)

  const saveDir = async () => {
    const trimmed = dir.trim()
    updateProjectPage(page.id, { workingDir: trimmed })
    onChanged && onChanged()
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
    // 自动初始化基础资料骨架（幂等，已有内容会跳过）
    if (trimmed) {
      try {
        await projectFiles.initBase(trimmed)
        // 刷新 ResourceLibrary 列表
        setInitRefresh(k => k + 1)
      } catch (e) {
        console.warn('初始化基础资料失败：', e)
      }
    }
  }
  const saveWikiDir = () => {
    updateProjectPage(page.id, { wikiDir: wikiDir.trim() })
    onChanged && onChanged()
    setWikiSaved(true)
    setTimeout(() => setWikiSaved(false), 1600)
  }

  return <div className="content">
    <div className="hero compact">
      <div>
        <div className="eyebrow"><FolderKanban size={14} style={{verticalAlign:'-2px',marginRight:6}}/>{t('projectDetail.eyebrow')}</div>
        <h1>{page.name}</h1>
        <p>{page.description || t('projectDetail.noDesc')}</p>
      </div>
      <div className="project-detail-actions">
        <SkillModeControls dir={dir.trim()}/>
        <button className="primary" onClick={() => setShowStartup(true)}>
          <MessageSquarePlus size={16}/>{t('projectDetail.startNewChat')}
        </button>
      </div>
    </div>

    <p className="author-tip">
      <span className="author-say">作者说：</span>其实这里大部分东西你都可以随缘关注，让AI维护就行，唯一要注意的就是，记得经常<span className="gold-highlight">提醒AI蒸馏wiki库</span>。
    </p>

    <ProjectDetailGrid key={page.id} page={page} dir={dir} setDir={setDir} wikiDir={wikiDir} setWikiDir={setWikiDir}
      onSaveDir={saveDir} onSaveWikiDir={saveWikiDir}
      saved={saved} wikiSaved={wikiSaved}
      onAiReadChange={setAiReadContent}
      projectId={page.id} refreshKey={initRefresh}/>

    {showStartup && <StartupDialog
      page={{ ...page, workingDir: dir.trim() }}
      requiredReadContent={aiReadContent}
      onClose={() => setShowStartup(false)}/>}
  </div>
}

const ResponsiveGrid = WidthProvider(ResponsiveGridLayout)

const DEFAULT_LAYOUT = [
  { i: 'settings',       x: 0, y: 0,  w: 5, h: 8  },
  { i: 'git-log',        x: 5, y: 0,  w: 7, h: 8  },
  { i: 'base-lib',       x: 0, y: 8,  w: 7, h: 15 },
  { i: 'ai-read',        x: 7, y: 8,  w: 5, h: 15 },
  { i: 'wiki-lib',       x: 0, y: 23, w: 5, h: 20  },
  { i: 'project-skills', x: 0, y: 43, w: 12, h: 20  },
]

const LAYOUT_KEY = 'hermes-visual-backoffice:project-detail-layout:v1'

function loadLayout(projectId) {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY + ':' + projectId)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    // 布局迁移：旧版本没有 git-log 卡片，自动加进去
    const hasGit = parsed.some(item => item.i === 'git-log')
    if (!hasGit) {
      // 找 base-lib 的位置，把 git-log 放它左边
      const base = parsed.find(item => item.i === 'base-lib')
      if (base) {
        const gitItem = { i: 'git-log', x: base.x, y: base.y, w: 5, h: base.h }
        // 把 base-lib 往右挪
        base.x = base.x + 5
        base.w = 7
        parsed.push(gitItem)
      } else {
        parsed.push({ i: 'git-log', x: 0, y: 9, w: 12, h: 8 })
      }
      // 保存迁移后的布局
      saveLayout(projectId, parsed)
    }
    // 布局迁移：项目 Skill 列表改为 Wiki 下方独占整行
    const projectSkills = parsed.find(item => item.i === 'project-skills')
    if (projectSkills && (projectSkills.x !== 0 || projectSkills.w !== 12)) {
      const otherItems = parsed.filter(item => item.i !== 'project-skills')
      projectSkills.x = 0
      projectSkills.w = 12
      projectSkills.y = otherItems.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0)
      saveLayout(projectId, parsed)
    }
    return parsed
  } catch { return null }
}

function saveLayout(projectId, layout) {
  try { window.localStorage.setItem(LAYOUT_KEY + ':' + projectId, JSON.stringify(layout)) } catch {}
}

function ProjectDetailGrid({ page, dir, setDir, wikiDir, setWikiDir, onSaveDir, onSaveWikiDir, saved, wikiSaved, onAiReadChange, projectId, refreshKey = 0 }) {
  const { t } = useI18n()
  const [layout, setLayout] = useState(() => loadLayout(projectId) || DEFAULT_LAYOUT)

  const onLayoutChange = (newLayout) => {
    setLayout(newLayout)
    saveLayout(projectId, newLayout)
  }

  // 把内容包成可拖拽卡片
  const wrap = (id, title, children) => (
    <div key={id} className="grid-card">
      <div className="grid-card-head" style={{cursor:'grab'}}>
        <b>{title}</b>
      </div>
      <div className="grid-card-body">{children}</div>
    </div>
  )

  return <div className="project-detail-grid-wrap">
    <ResponsiveGrid
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200 }}
      cols={{ lg: 12 }}
      rowHeight={30}
      margin={[12, 12]}
      draggableHandle=".grid-card-head"
      onLayoutChange={onLayoutChange}
      isResizable
      preventCollision={false}
      compactType="vertical"
    >
      {wrap('settings', t('projectDetail.grid.settings'), (
        <>
          <div className="project-section-head">
            <h2 style={{fontSize:14}}>{t('projectDetail.dirTitle')}</h2>
            <p>{t('projectDetail.dirHint')}</p>
          </div>
          <div className="project-dir-row">
            <input value={dir} onChange={e => setDir(e.target.value)}
              placeholder={t('projectDetail.dirPlaceholder')}
              onKeyDown={e => e.key === 'Enter' && onSaveDir()}/>
            <button className="secondary" onClick={onSaveDir}>{saved ? t('projectDetail.saved') : t('projectDetail.saveDir')}</button>
          </div>
          <div className="project-section-head" style={{marginTop:'12px'}}>
            <h2 style={{fontSize:14}}>{t('projectDetail.wikiDirTitle')}</h2>
            <p>{t('projectDetail.wikiDirHint')}</p>
          </div>
          <div className="project-dir-row">
            <input value={wikiDir} onChange={e => setWikiDir(e.target.value)}
              placeholder={t('projectDetail.wikiDirPlaceholder')}
              onKeyDown={e => e.key === 'Enter' && onSaveWikiDir()}/>
            <button className="secondary" onClick={onSaveWikiDir}>{wikiSaved ? t('projectDetail.saved') : t('projectDetail.saveDir')}</button>
          </div>
        </>
      ))}

      {wrap('ai-read', t('projectDetail.grid.aiRead'), (
        <AIReadEditorInner page={page} dir={dir} onContentChange={onAiReadChange}/>
      ))}

      {wrap('git-log', t('git.title'), (
        <div className="git-card-wrap">
          <GitHistory page={{ ...page, workingDir: dir.trim() }} compact refreshKey={refreshKey}/>
        </div>
      ))}

      {wrap('base-lib', t('baseLibrary.title'), (
        <ResourceLibrary page={{ ...page, workingDir: dir.trim() }}
          title="" compact refreshKey={refreshKey}
          needDirTitle={t('baseLibrary.needDirTitle')}
          needDirDesc={t('baseLibrary.needDirDesc')}/>
      ))}

      {wrap('wiki-lib', t('wiki.title'), (
        <ResourceLibrary page={{ ...page, wikiDir: wikiDir.trim() }} mode="wiki"
          title="" compact refreshKey={refreshKey}
          needDirTitle={t('wiki.needDirTitle')}
          needDirDesc={t('wiki.needDirDesc')}/>
      ))}

      {wrap('project-skills', '', (
        <div className="skill-card-inner">
          <div className="skill-page-head">
            <h2 className="skill-page-title">项目 Skill 列表</h2>
            <span className="skill-page-tip">提示：只开启项目专属skill会减少token消耗，不搞也行</span>
          </div>
          <ProjectSkills dir={dir.trim()} />
        </div>
      ))}
    </ResponsiveGrid>
  </div>
}

// AI必读的内层（去掉外层 section，塞进卡片里）
function AIReadEditorInner({ page, dir, onContentChange }) {
  // 直接复用 AIReadEditor，但它自己会带 section 外壳。我们用它并通过 CSS 盖掉外框。
  return <div className="ai-read-no-frame">
    <AIReadEditor page={{ ...page, workingDir: dir.trim() }} onContentChange={onContentChange}/>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
