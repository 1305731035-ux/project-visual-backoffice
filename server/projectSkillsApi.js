import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync, rmSync, cpSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, relative, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const hermesRoot = process.env.HERMES_HOME || join(homedir(), '.hermes')
const skillsRoot = join(hermesRoot, 'skills')
const profileDir = '.hermes-profile'
// 全局多项目切换状态（记录所有已切换项目 + 首次切换前的原始禁用集），
// 多个项目同时切换时按 skill 并集去重，后切换的不会覆盖先切换的。
const globalSwitchFile = join(hermesRoot, '.project-skill-switches.json')

const send = (res, data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)) }
const readBody = req => new Promise((ok, bad) => { let text = ''; req.on('data', chunk => { text += chunk }); req.on('end', () => { try { ok(JSON.parse(text || '{}')) } catch { bad(new Error('invalid JSON body')) } }); req.on('error', bad) })
const projectRoot = dir => { if (!dir) return { error: 'dir is required' }; const root = resolve(dir); if (!existsSync(root) || !statSync(root).isDirectory()) return { error: 'project directory does not exist' }; return { root } }
const profileFile = root => join(root, profileDir, 'profile.json')
const readProfile = root => { try { const value = JSON.parse(readFileSync(profileFile(root), 'utf8')); return { ...value, skills: Array.isArray(value.skills) ? value.skills : [] } } catch { return { version: 1, name: '项目专属 Profile', skills: [] } } }
const writeProfile = (root, value) => { mkdirSync(join(root, profileDir), { recursive: true }); writeFileSync(profileFile(root), JSON.stringify({ ...value, updatedAt: new Date().toISOString() }, null, 2), 'utf8') }
function walk(dir, result = []) { if (!existsSync(dir)) return result; for (const entry of readdirSync(dir, { withFileTypes: true })) { if (entry.name.startsWith('.')) continue; const path = join(dir, entry.name); if (entry.isDirectory()) walk(path, result); else if (entry.name === 'SKILL.md') result.push(path) } return result }
function parseSkill(path) { const text = readFileSync(path, 'utf8'); const block = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/); const meta = {}; for (const line of (block?.[1] || '').split(/\r?\n/)) { const match = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/); if (match) meta[match[1]] = match[2].replace(/^['"]|['"]$/g, '') } const name = meta.name || relative(skillsRoot, path).replaceAll('\\', '/').replace(/\/SKILL\.md$/, ''); const description = (meta.description || text.match(/^#\s+(.+)$/m)?.[1] || '未提供说明').slice(0, 240); const category = meta.category || relative(skillsRoot, path).split(/[\\/]/)[0] || '其他'; return { name, description, category, sourcePath: path } }
const installed = () => walk(skillsRoot).map(parseSkill)
const safeName = value => typeof value === 'string' && value && !value.includes('..') && !/^[\\/]/.test(value) && !/^[A-Za-z]:/.test(value) ? value.replaceAll('\\', '/') : ''
const runHermes = args => { const result = spawnSync(process.env.HERMES_CLI || 'hermes', args, { encoding: 'utf8', windowsHide: true }); if (result.error || result.status !== 0) throw new Error((result.stderr || result.error?.message || `hermes exited with ${result.status}`).trim()) ; return result.stdout || '' }
const activeProfile = () => { try { const name = readFileSync(join(hermesRoot, 'active_profile'), 'utf8').trim(); return name || 'default' } catch { return 'default' } }
const readDisabledSkills = () => { const output = runHermes(['config', 'get', 'skills.disabled', '--json']).trim(); let value = JSON.parse(output); if (typeof value === 'string') value = JSON.parse(value); if (!Array.isArray(value)) throw new Error('Hermes Skill 禁用状态格式异常。'); return value.filter(value => typeof value === 'string') }
const writeDisabledSkills = names => {
  // Hermes skills_list truncates skill names to MAX_NAME_LENGTH=64. A name
  // longer than that never matches the full name stored in `disabled`, so
  // also emit the 64-char prefix for every long name — both the scan path
  // (truncated) and the full-name path then filter correctly.
  const expanded = new Set()
  for (const name of names) {
    if (typeof name !== 'string' || !name.trim()) continue
    expanded.add(name)
    if (name.length > 64) expanded.add(name.slice(0, 64))
  }
  const payload = JSON.stringify([...expanded].sort())
  const script = `import sys, json\nsys.path.insert(0, ${JSON.stringify(join(hermesRoot, 'hermes-agent'))})\nfrom hermes_cli.config import load_config\nfrom hermes_cli.skills_config import save_disabled_skills\nnames = json.loads(${JSON.stringify(payload)})\nconfig = load_config()\nsave_disabled_skills(config, set(names))\n`
  const result = spawnSync(process.env.PYTHON || 'python', ['-c', script], { encoding: 'utf8', windowsHide: true, env: { ...process.env, HERMES_HOME: hermesRoot } })
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.error?.message || `python exited with ${result.status}`).trim())
}
const readSwitchState = () => { try { return JSON.parse(readFileSync(globalSwitchFile, 'utf8')) } catch { return null } }
const writeSwitchState = state => { mkdirSync(dirname(globalSwitchFile), { recursive: true }); writeFileSync(globalSwitchFile, JSON.stringify(state, null, 2), 'utf8') }
const projectSkillNames = profile => profile.skills.map(item => item.name).filter(name => typeof name === 'string' && name.trim())
// 计算 disabled：所有项目技能的并集去重后，禁用其余全部（含 64 截断名）
const computeDisabled = (allNames, projectNames) => {
  const disabled = new Set()
  for (const name of allNames) {
    if (projectNames.has(name)) continue
    disabled.add(name)
    if (name.length > 64) disabled.add(name.slice(0, 64))
  }
  return disabled
}

export function createProjectSkillsApi() {
  return { name: 'hermes-project-skills-api', configureServer(server) { server.middlewares.use('/api/project', async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost'); const path = url.pathname.replace(/^\/api\/project/, '')
    if (!path.startsWith('/skills')) return next()
    try {
      let data = null
      if (req.method === 'POST') data = await readBody(req)
      // 环境检测与具体项目无关（检测的是 Hermes 全局安装目录与 CLI），须在任何 dir 校验之前处理
      if (path === '/skills/env' && req.method === 'GET') {
        const hermesInstalled = existsSync(skillsRoot)
        const hermesCli = process.env.HERMES_CLI || 'hermes'
        let cliOk = false
        if (hermesInstalled) {
          try { cliOk = spawnSync(hermesCli, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 5000 }).status === 0 } catch { cliOk = false }
        }
        const supported = hermesInstalled && cliOk
        return send(res, {
          supported,
          platform: supported ? 'hermes' : 'standard',
          hermesRoot,
          skillsRoot,
          cli: hermesCli,
          message: supported
            ? '检测到 Hermes 环境，项目 Skill 模式可用。'
            : '未检测到 Hermes 环境，项目 Skill 列表/模式切换已隐藏。当前以标准模式运行。'
        })
      }
      const checked = projectRoot(url.searchParams.get('dir') || data?.dir || ''); if (checked.error) return send(res, { error: checked.error }, 400); const root = checked.root; const profile = readProfile(root); const selected = new Set(profile.skills.map(item => item.name))

      if (path === '/skills' && req.method === 'GET') return send(res, { profileFile: profileFile(root), skills: profile.skills, available: installed().filter(item => !selected.has(item.name)) })
      if (path === '/skills/mode' && req.method === 'GET') { const state = readSwitchState(); const enabled = Boolean(state?.projects?.some(item => String(item.dir).toLowerCase() === root.toLowerCase())); return send(res, { activeProfile: activeProfile(), enabled, projectSkillCount: profile.skills.length, activeProjectCount: state?.projects?.length || 0 }) }
      if (path === '/skills/suggestions' && req.method === 'GET') { const words = `${url.searchParams.get('name') || ''} ${url.searchParams.get('description') || ''}`.toLowerCase().split(/[^\w\u4e00-\u9fff]+/).filter(word => word.length > 1); const suggestions = installed().filter(item => !selected.has(item.name)).map(item => ({ ...item, score: words.reduce((sum, word) => sum + (`${item.name} ${item.description} ${item.category}`.toLowerCase().includes(word) ? 1 : 0), 0) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.category.localeCompare(b.category)); return send(res, { suggestions }) }
      if (path === '/skills/import' && req.method === 'POST') { const source = new Map(installed().map(item => [item.name, item])); const imported = []; for (const raw of Array.isArray(data.skills) ? data.skills : []) { const name = safeName(raw); const item = source.get(name); if (!item || selected.has(name)) continue; const target = join(root, profileDir, 'skills', name, 'SKILL.md'); mkdirSync(dirname(target), { recursive: true }); copyFileSync(item.sourcePath, target); imported.push({ name: item.name, description: item.description, category: item.category, useCount: 0 }) } profile.name = data.profileName || profile.name; profile.skills.push(...imported); profile.skills.forEach((item, index) => { item.order = index }); writeProfile(root, profile); return send(res, { ok: true, imported, skills: profile.skills }) }
      if (path === '/skills/delete' && req.method === 'POST') { const name = safeName(data.name); if (!name) return send(res, { error: 'invalid skill name' }, 400); profile.skills = profile.skills.filter(item => item.name !== name); const target = join(root, profileDir, 'skills', name); const base = join(root, profileDir, 'skills'); const rel = relative(base, target); if (!rel.startsWith('..') && rel !== '..') rmSync(target, { recursive: true, force: true }); writeProfile(root, profile); return send(res, { ok: true, skills: profile.skills }) }
      if (path === '/skills/switch' && req.method === 'POST') {
        const allNames = new Set(installed().map(item => item.name))
        const projectNames = new Set(projectSkillNames(profile))
        const state = readSwitchState() || { projects: [], previousDisabled: [] }
        const exists = state.projects.some(item => String(item.dir).toLowerCase() === root.toLowerCase())
        // 首次切换时保存真实原始禁用集；后续项目切换沿用首次的原始集（恢复时一次还原）
        if (!state.projects.length) state.previousDisabled = readDisabledSkills()
        if (exists) state.projects = state.projects.map(item => String(item.dir).toLowerCase() === root.toLowerCase() ? { ...item, projectSkillNames: [...projectNames], updatedAt: new Date().toISOString() } : item)
        else state.projects.push({ dir: root, projectSkillNames: [...projectNames], updatedAt: new Date().toISOString() })
        // 多项目并集去重：所有已切换项目的技能合集
        const union = new Set()
        for (const item of state.projects) for (const name of item.projectSkillNames || []) union.add(name)
        const disabled = computeDisabled(allNames, union)
        writeSwitchState(state)
        writeDisabledSkills([...disabled])
        return send(res, { ok: true, activeProfile: activeProfile(), skillCount: union.size, disabledCount: disabled.size, activeProjectCount: state.projects.length, desktopReloadRequired: true })
      }
      if (path === '/skills/restore' && req.method === 'POST') { const state = readSwitchState(); if (!state?.projects?.length) return send(res, { ok: true, activeProfile: activeProfile(), restored: false }); state.projects = state.projects.filter(item => String(item.dir).toLowerCase() !== root.toLowerCase()); if (state.projects.length) { const allNames = new Set(installed().map(item => item.name)); const union = new Set(); for (const item of state.projects) for (const name of item.projectSkillNames || []) union.add(name); writeSwitchState(state); writeDisabledSkills([...computeDisabled(allNames, union)]); return send(res, { ok: true, activeProfile: activeProfile(), restored: true, activeProjectCount: state.projects.length, desktopReloadRequired: true }) } writeDisabledSkills(Array.isArray(state.previousDisabled) ? state.previousDisabled : []); rmSync(globalSwitchFile, { force: true }); return send(res, { ok: true, activeProfile: activeProfile(), restored: true, activeProjectCount: 0, desktopReloadRequired: true }) }
      return send(res, { error: 'not found' }, 404)
    } catch (error) { return send(res, { error: String(error.message || error) }, 500) }
  }) } }
}