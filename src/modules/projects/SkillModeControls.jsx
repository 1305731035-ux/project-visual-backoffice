import React, { useEffect, useState } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { projectFiles } from './projectFilesClient.js'

export function SkillModeControls({ dir }) {
  const [mode, setMode] = useState({ enabled: false, activeProfile: 'default' })
  const [env, setEnv] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // 环境检测：非 Hermes 环境直接隐藏（项目 Skill 模式是 Hermes 专属功能）
  useEffect(() => {
    let alive = true
    if (!dir) { if (alive) setEnv(null); return }
    projectFiles.skillsEnv(dir).then(e => { if (alive) setEnv(e) }).catch(() => { if (alive) setEnv({ supported: false }) })
    return () => { alive = false }
  }, [dir])

  const load = async () => {
    if (!dir) return
    try { setMode(await projectFiles.skillMode(dir)); setError('') }
    catch (e) { setError(e.message || String(e)) }
  }
  useEffect(() => { if (env?.supported) load() }, [dir, env?.supported])

  const switchProject = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await projectFiles.switchProjectSkills(dir)
      setMode({ ...result, enabled: true })
      const extra = result.activeProjectCount > 1 ? `（已叠加 ${result.activeProjectCount} 个项目，技能并集去重后共 ${result.skillCount} 个）` : ''
      setMessage(`已切换到项目 Skill（${result.skillCount} 个）${extra}。配置已写入当前 Profile。请重新启动后再新建对话。`)
    }
    catch (e) { setError(e.message || String(e)) } finally { setBusy(false) }
  }
  const restoreGlobal = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await projectFiles.restoreGlobalSkills(dir)
      setMode({ ...result, enabled: false })
      const extra = result.activeProjectCount > 0 ? `（剩余 ${result.activeProjectCount} 个项目仍在项目 Skill 模式）` : ''
      setMessage(`已恢复全局 Skill 原始状态${extra}。请重新启动后再新建对话。`)
    }
    catch (e) { setError(e.message || String(e)) } finally { setBusy(false) }
  }

  if (!dir || !env?.supported) return null
  return <div className={mode.enabled ? 'skill-mode-controls active' : 'skill-mode-controls'}>
    <div className="skill-mode-buttons">
      <button className={mode.enabled ? 'secondary skill-mode-active' : 'secondary'} onClick={switchProject} disabled={busy || mode.enabled}>切换到项目 Skill</button>
      <button className="secondary" onClick={restoreGlobal} disabled={busy || !mode.enabled}><RotateCcw size={14}/>恢复到全局 Skill</button>
    </div>
    {message && <div className="skill-mode-message">
      <span className="skill-mode-message-text">{message.replace(/请重新启动后再新建对话。?$/, '')}</span>
      <span className="skill-mode-message-highlight">请重新启动后再新建对话。</span>
    </div>}
    {error && <span className="error-note">{error}</span>}
  </div>
}