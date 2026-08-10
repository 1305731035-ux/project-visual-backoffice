import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const CACHE_DIR = join(PROJECT_ROOT, 'storage')
const CACHE_PATH = join(CACHE_DIR, 'capability-translations.json')

const CONFIG_DIR = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
const ENV_PATH = join(CONFIG_DIR, 'hermes', '.env')

const hasCJK = (s) => /[\u4e00-\u9fa5]/.test(s || '')

// 读取 Hermes .env，不回显 key
function loadHermesEnv() {
  if (!existsSync(ENV_PATH)) return {}
  const env = {}
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return env
}

function readCache() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return { items: {} }
  }
}

function writeCache(data) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf8')
}

// 决定一个 skill 哪些字段需要翻译。nameZh 优先用正文原生中文 H1。
function needsFor(item) {
  const out = {}
  const nativeName = item.nativeName && hasCJK(item.nativeName) ? item.nativeName.trim() : ''
  if (!hasCJK(item.name)) {
    out.name = nativeName || item.name
    out.nameNative = !!nativeName // 原生中文，无需调 LLM
  }
  if (!hasCJK(item.description)) out.description = item.description
  return out
}

async function translateBatch(items, env, signal) {
  const key = env.HERMES_CUSTOM_AGENTPLAN_1_API_KEY || env.HERMES_CUSTOM_AGENTPLAN_2_API_KEY
  if (!key) throw new Error('未找到火山 API Key（HERMES_CUSTOM_AGENTPLAN_1_API_KEY）')
  const base = 'https://ark.cn-beijing.volces.com/api/plan/v3'
  const payload = {
    model: 'doubao-seed-evolving',
    messages: [
      {
        role: 'system',
        content: '你是技术翻译引擎。把用户给的 JSON 数组中每个技能的 name 和 description 从英文翻译成简体中文。'
          + '只返回 JSON 数组，不要 markdown、不要解释。每个元素保留 id，返回 nameZh 和 descZh。'
          + '专有名词（ComfyUI、Ren\'Py、React、API、Token、GPU 等）保留原文。描述要简洁专业。',
      },
      { role: 'user', content: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, description: i.description }))) },
    ],
    temperature: 0.2,
    max_tokens: 2500,
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new Error(`翻译接口返回 ${res.status}`)
  const data = await res.json()
  let content = data?.choices?.[0]?.message?.content || ''
  // 去掉可能的 ```json 包裹
  content = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(content)
  if (!Array.isArray(parsed)) throw new Error('翻译返回不是数组')
  return parsed
}

export function getTranslationStatus(capabilities) {
  const cache = readCache()
  const items = cache.items || {}
  let translated = 0, pending = 0, native = 0
  for (const c of capabilities) {
    if (c.kind !== 'Skill') continue
    const need = needsFor(c)
    const needName = !!need.name && !need.nameNative
    const needDesc = !!need.description
    if (need.nameNative) native++
    if (needName || needDesc) {
      const cached = items[c.id]
      const okName = !needName || (cached && cached.name && hasCJK(cached.name))
      const okDesc = !needDesc || (cached && cached.description && hasCJK(cached.description))
      if (okName && okDesc) translated++
      else pending++
    } else {
      translated++
    }
  }
  return { total: capabilities.filter(c => c.kind === 'Skill').length, translated, pending, native }
}

export function readTranslations() {
  return readCache().items || {}
}

// 翻译所有待处理技能。onProgress({done,total}) 用于进度反馈。
export async function translatePending(capabilities, { onProgress, batchSize = 20 } = {}) {
  const cache = readCache()
  cache.items = cache.items || {}
  const env = loadHermesEnv()

  // 先应用原生中文名，不需要调 LLM
  let appliedNative = 0
  for (const c of capabilities) {
    if (c.kind !== 'Skill') continue
    const need = needsFor(c)
    if (need.nameNative) {
      cache.items[c.id] = { ...(cache.items[c.id] || {}), name: need.name }
      appliedNative++
    }
  }
  if (appliedNative) writeCache(cache)

  const pending = []
  for (const c of capabilities) {
    if (c.kind !== 'Skill') continue
    const need = needsFor(c)
    const needName = !!need.name && !need.nameNative
    const needDesc = !!need.description
    if (!needName && !needDesc) continue
    const cached = cache.items[c.id]
    const okName = !needName || (cached?.name && hasCJK(cached.name))
    const okDesc = !needDesc || (cached?.description && hasCJK(cached.description))
    if (okName && okDesc) continue
    pending.push({ id: c.id, name: need.name || c.name, description: need.description || c.description })
  }

  let done = 0
  for (let i = 0; i < pending.length; i += batchSize) {
    const slice = pending.slice(i, i + batchSize)
    const results = await translateBatch(slice, env)
    for (const r of results) {
      if (!r || !r.id) continue
      const prev = cache.items[r.id] || {}
      cache.items[r.id] = {
        name: hasCJK(r.nameZh) ? r.nameZh.trim() : prev.name,
        description: hasCJK(r.descZh) ? r.descZh.trim().slice(0, 240) : prev.description,
      }
    }
    writeCache(cache)
    done += slice.length
    onProgress?.({ done, total: pending.length, batch: slice.length })
  }

  return { nativeApplied: appliedNative, translated: pending.length }
}
