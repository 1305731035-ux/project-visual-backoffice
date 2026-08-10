import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { homedir } from 'node:os'

const root = process.env.HERMES_HOME || join(homedir(), '.hermes')
const skillsRoot = join(root, 'skills')
const configPath = join(root, 'config.yaml')
const sourceRoot = join(root, 'hermes-agent')

function safeRead(path) {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

function walk(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, result)
    else if (entry.name === 'SKILL.md') result.push(path)
  }
  return result
}

function frontmatter(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  const values = {}
  if (!match) return values
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (item) values[item[1]] = item[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}

function description(text, meta) {
  if (meta.description) return meta.description
  const heading = text.match(/^#\s+(.+)$/m)
  return heading ? heading[1].trim() : '未提供说明'
}

function categoryFor(path, text, meta) {
  const category = meta.category || relative(skillsRoot, path).split(/[\\/]/)[0]
  if (category && category !== '.') return category
  const haystack = `${path}\n${text.slice(0, 2500)}`.toLowerCase()
  if (/browser|web|网页/.test(haystack)) return '浏览器与网页'
  if (/hermes|gateway|memory|profile|skill/.test(haystack)) return '平台管理'
  if (/code|debug|frontend|backend|development/.test(haystack)) return '代码开发'
  if (/data|xlsx|pdf|document/.test(haystack)) return '文件与数据'
  return '其他'
}

function usageMap() {
  try {
    const data = JSON.parse(safeRead(join(skillsRoot, '.usage.json')) || '{}')
    return new Map(Object.entries(data).map(([name, value]) => [name.toLowerCase(), value]))
  } catch { return new Map() }
}

function h1Title(text) {
  const m = text.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : ''
}

// 从 config.yaml 的 skills.disabled 读取真实禁用列表。
// 项目 Skill 模式切换时通过 save_disabled_skills 写入这里（而不是 .usage.json），
// 框架能力页必须读这里才能反映当前启用/禁用状态。
// 注意：Hermes 对超过 64 字符的 skill 名会同时写入完整名与 64 字符前缀，两边都要能匹配。
function readDisabledSkills() {
  const text = safeRead(configPath)
  if (!text) return new Set()
  const lines = text.split(/\u000d?\u000a/)
  const start = lines.findIndex(line => /^skills:\s*$/.test(line))
  if (start === -1) return new Set()
  const disabled = new Set()
  let inDisabled = false
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^[A-Za-z]/.test(line)) break // 顶层键，skills 块结束
    if (/^  [A-Za-z]/.test(line)) {
      // skills 下的二级键
      inDisabled = /^  disabled:\s*$/.test(line)
      continue
    }
    if (inDisabled) {
      const m = line.match(/^    - (.*)$/)
      if (m) disabled.add(m[1].trim())
      else if (line.trim()) inDisabled = false
    }
  }
  return disabled
}

const isSkillDisabled = (name, disabled) =>
  disabled.has(name) || (name.length > 64 && disabled.has(name.slice(0, 64)))

const hasCJK = (s) => /[\u4e00-\u9fa5]/.test(s || '')

function discoverSkills() {
  const usage = usageMap()
  const disabled = readDisabledSkills()
  const skills = walk(skillsRoot).map(path => {
    const text = safeRead(path)
    const meta = frontmatter(text)
    const name = meta.name || relative(skillsRoot, path).replaceAll('\\', '/').replace(/\/SKILL\.md$/, '')
    const stats = (() => { try { return statSync(path) } catch { return null } })()
    const history = usage.get(name.toLowerCase()) || {}
    const desc = description(text, meta).slice(0, 240)
    const h1 = h1Title(text)
    // 正文 H1 是中文、而 frontmatter 名称/说明是英文时，作为免费的原生中文名
    const nativeName = hasCJK(h1) && !hasCJK(name) ? h1 : ''
    return {
      id: `skill:${name}`,
      name,
      kind: 'Skill',
      source: '当前已安装技能',
      description: desc,
      category: categoryFor(path, text, meta),
      status: isSkillDisabled(name, disabled) ? '已禁用' : '已发现',
      version: meta.version || '未声明',
      location: relative(root, path).replaceAll('\\', '/'),
      updatedAt: stats?.mtime?.toISOString() || null,
      installedAt: history.created_at || null,
      lastUsedAt: history.last_used_at || null,
      useCount: Number(history.use_count || 0),
      viewCount: Number(history.view_count || 0),
      nativeName,
    }
  })
  // 同名去重：磁盘上可能存在同名 skill（不同目录，如复制后改名），保留最新修改的一份，
  // 避免 id 冲突导致前端 React key 冲突、排序错乱、统计重复。
  const byName = new Map()
  for (const s of skills) {
    const prev = byName.get(s.name)
    if (!prev || String(s.updatedAt || '') > String(prev.updatedAt || '')) byName.set(s.name, s)
  }
  return [...byName.values()]
}

function yamlBlock(text, key) {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex(line => new RegExp(`^${key}:\\s*$`).test(line))
  if (start === -1) return ''
  const block = []
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[A-Za-z]/.test(lines[i])) break
    block.push(lines[i])
  }
  return block.join('\n')
}

function discoverProviders() {
  const text = safeRead(configPath)
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex(line => /^providers:\s*$/.test(line))
  if (start === -1) return []
  const providers = []
  let current = null
  let inModels = false
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^[A-Za-z]/.test(line)) break
    const providerMatch = line.match(/^  ([^:\s]+):\s*$/)
    if (providerMatch) {
      if (current) providers.push(current)
      current = { id: `provider:${providerMatch[1]}`, name: providerMatch[1], kind: 'Provider', source: '当前配置', category: '模型与 Provider', status: '已配置', baseUrl: '', models: [], providerKey: providerMatch[1] }
      inModels = false
      continue
    }
    if (!current) continue
    const nameMatch = line.match(/^    name:\s*(.+)$/)
    if (nameMatch) { current.name = nameMatch[1].trim(); continue }
    const urlMatch = line.match(/^    base_url:\s*(.+)$/)
    if (urlMatch) { current.baseUrl = urlMatch[1].trim().replace(/\/v1\/?$/, ''); continue }
    const modelMatch = line.match(/^    model:\s*(.+)$/)
    if (modelMatch) { current.models.push(modelMatch[1].trim()); inModels = false; continue }
    if (/^    models:\s*$/.test(line)) { inModels = true; continue }
    if (inModels) {
      const modelItem = line.match(/^      ([^:\s]+):/)
      if (modelItem) { current.models.push(modelItem[1]); continue }
      if (/^    [A-Za-z]/.test(line)) inModels = false
    }
  }
  if (current) providers.push(current)
  return providers.map(({ providerKey, ...rest }) => {
    rest.models = [...new Set(rest.models.filter(Boolean))]
    if (!rest.baseUrl) rest.status = '缺少地址'
    return rest
  })
}

function discoverTools() {
  const path = join(sourceRoot, 'toolsets.py')
  const text = safeRead(path)
  const match = text.match(/_HERMES_CORE_TOOLS\s*=\s*\[([\s\S]*?)\]/)
  if (!match) return []
  const names = [...match[1].matchAll(/"([a-zA-Z0-9_]+)"/g)].map(item => item[1])
  return [...new Set(names)].map(name => ({ id: `tool:${name}`, name, kind: '内置工具', source: '当前工具集', category: name.startsWith('browser_') ? '浏览器与网页' : name.startsWith('read_') || name.startsWith('write_') || name === 'patch' || name === 'search_files' ? '文件与数据' : name.startsWith('skill') ? 'Hermes 管理' : '通用工具', status: '已注册', description: '当前 Hermes 工具集中的可调用工具' }))
}

export function discoverCapabilities() {
  const skills = discoverSkills()
  const providers = discoverProviders()
  const tools = discoverTools()
  const capabilities = [...skills, ...providers, ...tools]
  const categories = [...new Set(capabilities.map(item => item.category).filter(Boolean))].sort()
  return { source: 'runtime environment', root: 'HERMES_HOME', generatedAt: new Date().toISOString(), summary: { total: capabilities.length, skills: skills.length, providers: providers.length, tools: tools.length, categories: categories.length }, categories, capabilities }
}
