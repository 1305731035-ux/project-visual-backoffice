// 项目资料库文件读写接口（仅供本项目网页使用）。
// 安全约束：所有文件操作都被限制在用户设置的"项目工作目录"内，禁止路径穿越。
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, sep, relative, join } from 'node:path'
import { BASE_LIB_SKELETON, BASE_LIB_DIR } from './baseLibrarySkeleton.js'

const WIKI_STATUS_FILE = `${BASE_LIB_DIR}/.wiki-确认状态.json`

function readWikiStatus(dir) {
  const fp = join(dir, WIKI_STATUS_FILE)
  if (!existsSync(fp)) return {}
  try {
    const raw = JSON.parse(readFileSync(fp, 'utf-8'))
    return raw.files || {}
  } catch { return {} }
}

function writeWikiStatus(dir, statusMap) {
  const fp = join(dir, WIKI_STATUS_FILE)
  mkdirSync(dirname(fp), { recursive: true })
  const data = { updatedAt: new Date().toISOString(), files: statusMap }
  writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8')
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let data = ''
    req.on('data', chunk => { data += chunk; if (data.length > 5_000_000) rejectBody(new Error('body too large')) })
    req.on('end', () => resolveBody(data))
    req.on('error', rejectBody)
  })
}

// 把 baseDir + 相对路径解析为绝对路径，并确保结果仍在 baseDir 内。
function safeResolve(baseDir, relPath) {
  if (!baseDir || typeof baseDir !== 'string') return { error: 'working directory is required' }
  const base = resolve(baseDir)
  if (!existsSync(base)) return { error: 'working directory does not exist: ' + base }
  const cleanRel = (relPath || '').replace(/^[\\/]+/, '')
  if (/^[a-zA-Z]:/.test(cleanRel)) return { error: 'absolute path not allowed' }
  const target = resolve(base, cleanRel)
  const rel = relative(base, target)
  if (rel.startsWith('..') || rel === '..') return { error: 'path escapes working directory' }
  return { base, target, rel }
}

// 列出某目录下的条目（仅一层），返回文件夹与文件。
function listDir(baseDir, relPath) {
  const r = safeResolve(baseDir, relPath)
  if (r.error) return { error: r.error, status: 400 }
  try {
    if (!existsSync(r.target)) return { entries: [], path: r.rel }
    const st = statSync(r.target)
    if (!st.isDirectory()) return { error: 'not a directory', status: 400 }
    const names = readdirSync(r.target)
    const entries = names.map(name => {
      const full = join(r.target, name)
      const s = statSync(full)
      return {
        name,
        type: s.isDirectory() ? 'dir' : 'file',
        size: s.size,
        mtime: s.mtimeMs,
      }
    }).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-Hans-CN')
    })
    return { entries, path: r.rel }
  } catch (e) {
    return { error: String(e.message || e), status: 500 }
  }
}

// 规范化"资料文件名"：禁止空名/路径分隔符/保留设备名。
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
function validateName(name) {
  const n = (name || '').trim()
  if (!n) return '名称不能为空'
  if (/[\\/]/.test(n)) return '名称不能包含路径分隔符'
  if (RESERVED.test(n)) return '该名称是系统保留名'
  if (/[<>:"|?*\x00-\x1f]/.test(n)) return '名称包含非法字符'
  return ''
}

export function createProjectFilesApi() {
  return {
    name: 'hermes-project-files-api',
    configureServer(server) {
      server.middlewares.use('/api/project', async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const path = url.pathname.replace(/^\/api\/project/, '')

        // GET /api/project/read?dir=...&path=...
        if (path === '/read' && req.method === 'GET') {
          const dir = url.searchParams.get('dir') || ''
          const relPath = url.searchParams.get('path') || ''
          const r = safeResolve(dir, relPath)
          if (r.error) return sendJson(res, { error: r.error }, 400)
          if (!existsSync(r.target)) return sendJson(res, { exists: false, content: '', path: r.rel })
          try {
            if (statSync(r.target).isDirectory()) return sendJson(res, { error: 'target is a directory' }, 400)
            const content = readFileSync(r.target, 'utf8')
            return sendJson(res, { exists: true, content, path: r.rel })
          } catch (e) {
            return sendJson(res, { error: String(e.message || e) }, 500)
          }
        }

        // GET /api/project/list?dir=...&path=...
        if (path === '/list' && req.method === 'GET') {
          const dir = url.searchParams.get('dir') || ''
          const relPath = url.searchParams.get('path') || ''
          const result = listDir(dir, relPath)
          return sendJson(res, result, result.status || 200)
        }

        // POST /api/project/write  body: { dir, path, content }
        if (path === '/write' && req.method === 'POST') {
          let body
          try { body = JSON.parse(await readBody(req) || '{}') } catch {
            return sendJson(res, { error: 'invalid JSON body' }, 400)
          }
          const r = safeResolve(body.dir, body.path)
          if (r.error) return sendJson(res, { error: r.error }, 400)
          try {
            mkdirSync(dirname(r.target), { recursive: true })
            writeFileSync(r.target, typeof body.content === 'string' ? body.content : '', 'utf8')
            return sendJson(res, { ok: true, path: r.rel })
          } catch (e) {
            return sendJson(res, { error: String(e.message || e) }, 500)
          }
        }

        // POST /api/project/mkdir  body: { dir, path }
        if (path === '/mkdir' && req.method === 'POST') {
          let body
          try { body = JSON.parse(await readBody(req) || '{}') } catch {
            return sendJson(res, { error: 'invalid JSON body' }, 400)
          }
          const r = safeResolve(body.dir, body.path)
          if (r.error) return sendJson(res, { error: r.error }, 400)
          try {
            mkdirSync(r.target, { recursive: true })
            return sendJson(res, { ok: true, path: r.rel })
          } catch (e) {
            return sendJson(res, { error: String(e.message || e) }, 500)
          }
        }

        // POST /api/project/delete  body: { dir, path }
        if (path === '/delete' && req.method === 'POST') {
          let body
          try { body = JSON.parse(await readBody(req) || '{}') } catch {
            return sendJson(res, { error: 'invalid JSON body' }, 400)
          }
          // 不允许删除项目根目录本身（path 为空即根）
          if (!(body.path || '').trim()) return sendJson(res, { error: '不能删除项目根目录' }, 400)
          const r = safeResolve(body.dir, body.path)
          if (r.error) return sendJson(res, { error: r.error }, 400)
          try {
            if (!existsSync(r.target)) return sendJson(res, { ok: true, missing: true })
            rmSync(r.target, { recursive: true, force: true })
            return sendJson(res, { ok: true })
          } catch (e) {
            return sendJson(res, { error: String(e.message || e) }, 500)
          }
        }

        // POST /api/project/init-base  body: { dir }
        // 初始化基础资料骨架。如果目录已存在且非空，则跳过，返回 skipped:true。幂等。
        if (path === '/init-base' && req.method === 'POST') {
          let body
          try { body = JSON.parse(await readBody(req) || '{}') } catch {
            return sendJson(res, { error: 'invalid JSON body' }, 400)
          }
          if (!body.dir || !body.dir.trim()) {
            return sendJson(res, { error: 'dir is required' }, 400)
          }
          const basePath = join(body.dir.trim(), BASE_LIB_DIR)
          // 安全校验：basePath 必须在 dir 之内
          const absBase = resolve(basePath)
          const absDir = resolve(body.dir.trim())
          if (!absBase.startsWith(absDir + sep) && absBase !== absDir) {
            return sendJson(res, { error: 'invalid path' }, 400)
          }
          try {
            // 已存在且非空 → 跳过（避免覆盖用户内容）
            if (existsSync(absBase)) {
              const files = readdirSync(absBase)
              if (files.length > 0) {
                return sendJson(res, { ok: true, skipped: true, reason: 'already populated', files: files.length })
              }
            } else {
              mkdirSync(absBase, { recursive: true })
            }
            let written = 0
            for (const [relPath, content] of Object.entries(BASE_LIB_SKELETON)) {
              const fullPath = join(absBase, relPath)
              // 再次安全校验：每个文件路径都必须在 absBase 内
              if (!resolve(fullPath).startsWith(absBase + sep) && resolve(fullPath) !== absBase) continue
              // 已存在的文件不覆盖
              if (existsSync(fullPath)) continue
              mkdirSync(dirname(fullPath), { recursive: true })
              writeFileSync(fullPath, content, 'utf-8')
              written++
            }
            return sendJson(res, { ok: true, written, skipped: false, baseDir: BASE_LIB_DIR })
          } catch (e) {
            return sendJson(res, { error: String(e.message || e) }, 500)
          }
        }

        // GET /wiki-status?dir=...
        // 读取所有 Wiki 文件的确认状态（从 .wiki-确认状态.json）
        if (path === '/wiki-status' && req.method === 'GET') {
          const dir = url.searchParams.get('dir') || ''
          const r = safeResolve(dir, '.')
          if (r.error) return sendJson(res, { error: r.error }, 400)
          try {
            const statusMap = readWikiStatus(r.base)
            return sendJson(res, { ok: true, status: statusMap })
          } catch (e) {
            return sendJson(res, { error: String(e.message || e) }, 500)
          }
        }

        // POST /wiki-confirm
        // 设置某个 Wiki 文件的确认状态。body: { dir, path, confirmed: bool, contentHash?: string }
        // 规则：内容 hash 没变且已确认 → 不增加次数；新确认 → 次数+1；取消 → confirmed=false, 次数不变
        if (path === '/wiki-confirm' && req.method === 'POST') {
          let body
          try { body = JSON.parse(await readBody(req) || '{}') } catch {
            return sendJson(res, { error: 'invalid JSON body' }, 400)
          }
          const dir = (body.dir || '').trim()
          const relPath = (body.path || '').trim()
          const confirmed = !!body.confirmed
          const contentHash = body.contentHash || null
          const keepCount = !!body.keepCount // 取消确认时保持次数不变（如：修改内容后自动取消确认）
          const r = safeResolve(dir, relPath)
          if (r.error) return sendJson(res, { error: r.error }, 400)
          if (!relPath) return sendJson(res, { error: 'path is required' }, 400)
          // 仅限基础资料目录内的 md 文件
          const baseDir = resolve(join(r.base, BASE_LIB_DIR))
          if (!r.target.startsWith(baseDir + sep) && r.target !== baseDir) {
            return sendJson(res, { error: 'path not in base library' }, 400)
          }
          try {
            const all = readWikiStatus(r.base)
            const key = r.rel.replace(/\\/g, '/')
            const cur = all[key] || { confirmed: false, count: 0, contentHash: null, lastConfirmedAt: null }
            let newCount = cur.count
            if (confirmed) {
              if (!cur.confirmed || cur.contentHash !== contentHash) {
                // 新确认 or 内容变了重新确认 → 次数+1
                newCount = cur.count + 1
              }
              // 否则内容没变又点确认 → 次数不变
              all[key] = {
                confirmed: true,
                count: newCount,
                contentHash: contentHash || cur.contentHash,
                lastConfirmedAt: new Date().toISOString(),
              }
            } else {
              // 取消确认：confirmed 变 false
              const newCount = keepCount
                ? (cur.count || 0)
                : Math.max(0, (cur.count || 0) - 1)
              all[key] = {
                ...cur,
                confirmed: false,
                count: newCount,
              }
              if (newCount === 0 && !cur.contentHash) {
                delete all[key]
              }
            }
            writeWikiStatus(r.base, all)
            return sendJson(res, { ok: true, path: key, confirmed, count: all[key].count })
          } catch (e) {
            return sendJson(res, { error: String(e.message || e) }, 500)
          }
        }

        return next && next()
      })
    },
  }
}
