// Git 相关接口：读取指定目录下的 git 提交记录与变更详情。
// 安全：所有操作限制在指定 dir 内（git -C dir 执行），不执行任何写操作。
import { execFile } from 'node:child_process'
import { resolve, isAbsolute } from 'node:path'
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const CONFIRM_FILE = '基础资料/.git-确认记录.json'

function readConfirmStatus(dir) {
  const filePath = join(dir, CONFIRM_FILE)
  if (!existsSync(filePath)) return {}
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    return data.commits || {}
  } catch { return {} }
}

function writeConfirmStatus(dir, commits) {
  const filePath = join(dir, CONFIRM_FILE)
  const abs = resolve(dir)
  // 安全校验：文件必须在 dir 内
  if (!resolve(filePath).startsWith(abs + '\\') && !resolve(filePath).startsWith(abs + '/')) return false
  mkdirSync(dirname(filePath), { recursive: true })
  const data = { updatedAt: new Date().toISOString(), commits }
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return true
}

function readBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let data = ''
    req.on('data', chunk => { data += chunk; if (data.length > 5_000_000) rejectBody(new Error('body too large')) })
    req.on('end', () => resolveBody(data))
    req.on('error', rejectBody)
  })
}

function runGit(cwd, args, timeoutMs = 10000) {
  return new Promise((resolveCmd, rejectCmd) => {
    const proc = execFile('git', args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024, // 5MB
      encoding: 'utf-8',
    }, (err, stdout, stderr) => {
      if (err) {
        // 如果目录不是 git 仓库，返回友好错误
        if (stderr && stderr.includes('not a git repository')) {
          return resolveCmd({ ok: false, notARepo: true, error: '该目录不是 Git 仓库' })
        }
        return rejectCmd(new Error(stderr?.trim?.() || err.message || 'git command failed'))
      }
      resolveCmd({ ok: true, stdout: stdout || '' })
    })
    proc.on('error', rejectCmd)
  })
}

// 安全校验：dir 必须是绝对路径且存在
function validateDir(dir) {
  if (!dir || !dir.trim()) return { error: 'dir is required' }
  if (!isAbsolute(dir)) return { error: 'dir must be absolute' }
  const abs = resolve(dir.trim())
  if (!existsSync(abs)) return { error: '目录不存在' }
  return { abs }
}

const SEP = '\x1e' // record separator，不常见的字符，用来分割字段
const COMMIT_SEP = '\x1f' // unit separator，分割每个 commit

// 通用 .gitignore（适用于大多数前端/Node 项目，少量且通用）
const DEFAULT_GITIGNORE = `node_modules/
dist/
.env
*.local
.DS_Store
`

export function createGitApi() {
  return {
    name: 'hermes-git-api',
    configureServer(server) {
      server.middlewares.use('/api/project/git', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const path = url.pathname.replace(/^\/api\/project\/git/, '')

    // GET /git-log?dir=...&n=30
    if (path === '/log' && req.method === 'GET') {
      const dir = url.searchParams.get('dir')
      const n = Math.min(parseInt(url.searchParams.get('n') || '30', 10), 200)
      const v = validateDir(dir)
      if (v.error) {
        res.statusCode = 400
        return res.end(JSON.stringify({ error: v.error }))
      }
      try {
        const format = ['%H','%h','%an','%ae','%at','%s','%b'].join(SEP)
        const result = await runGit(v.abs, [
          'log',
          `--pretty=format:${format}${COMMIT_SEP}`,
          `-${n}`,
          '--date=unix',
        ])
        if (!result.ok) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          return res.end(JSON.stringify({ ok: true, commits: [], notARepo: result.notARepo, error: result.error }))
        }
        const raw = result.stdout.trim()
        const commits = raw
          .split(COMMIT_SEP)
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const [hash, shortHash, authorName, authorEmail, ts, subject, body] = line.split(SEP)
            return {
              hash,
              shortHash,
              author: authorName,
              authorEmail,
              timestamp: parseInt(ts, 10),
              subject: subject || '',
              body: (body || '').trim(),
            }
          })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        return res.end(JSON.stringify({ ok: true, commits }))
      } catch (e) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: String(e.message || e) }))
      }
    }

    // GET /git-show?dir=...&hash=...
    if (path === '/show' && req.method === 'GET') {
      const dir = url.searchParams.get('dir')
      const hash = url.searchParams.get('hash')
      const v = validateDir(dir)
      if (v.error) {
        res.statusCode = 400
        return res.end(JSON.stringify({ error: v.error }))
      }
      if (!hash || !/^[0-9a-f]{4,40}$/i.test(hash)) {
        res.statusCode = 400
        return res.end(JSON.stringify({ error: 'invalid hash' }))
      }
      try {
        const result = await runGit(v.abs, ['show', '--stat', '--no-color', hash])
        if (!result.ok) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          return res.end(JSON.stringify({ error: result.error || 'not found' }))
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        return res.end(JSON.stringify({ ok: true, content: result.stdout }))
      } catch (e) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: String(e.message || e) }))
      }
    }

    // POST /init  body: { dir }
    // 初始化 git 仓库：git init + 写 .gitignore + 首次提交。已存在仓库则跳过。
    if (path === '/init' && req.method === 'POST') {
      let body
      try { body = JSON.parse(await readBody(req) || '{}') } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: 'invalid JSON body' }))
      }
      const v = validateDir(body.dir)
      if (v.error) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: v.error }))
      }
      try {
        // 先查是不是已经是仓库了
        const check = await runGit(v.abs, ['rev-parse', '--is-inside-work-tree'])
        if (check.ok) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          return res.end(JSON.stringify({ ok: true, skipped: true, reason: 'already a git repo' }))
        }
      } catch {
        // 不是仓库，继续初始化
      }
      // git init
      const initRes = await runGit(v.abs, ['init'])
      if (!initRes.ok) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: initRes.error || 'git init failed' }))
      }
      // 写 .gitignore（如果不存在）
      const giPath = join(v.abs, '.gitignore')
      if (!existsSync(giPath)) {
        writeFileSync(giPath, DEFAULT_GITIGNORE, 'utf-8')
      }
      // 首次提交
      try {
        await runGit(v.abs, ['add', '.gitignore'])
        await runGit(v.abs, ['-c', 'user.name=Project', '-c', 'user.email=project@localhost',
          'commit', '-m', 'Initial commit', '--allow-empty'])
      } catch {
        // 提交失败不影响初始化结果
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(JSON.stringify({ ok: true, initialized: true }))
    }

    // GET /confirm-status?dir=...
    // 读取所有提交的用户确认状态
    if (path === '/confirm-status' && req.method === 'GET') {
      const dir = url.searchParams.get('dir') || ''
      const v = validateDir(dir)
      if (v.error) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: v.error }))
      }
      try {
        const status = readConfirmStatus(v.abs)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        return res.end(JSON.stringify({ ok: true, status }))
      } catch (e) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: String(e.message || e) }))
      }
    }

    // POST /confirm  body: { dir, hash, status }
    // 设置某个提交的用户确认状态：approved / rejected / none
    if (path === '/confirm' && req.method === 'POST') {
      let body
      try { body = JSON.parse(await readBody(req) || '{}') } catch {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: 'invalid JSON body' }))
      }
      const v = validateDir(body.dir)
      if (v.error) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: v.error }))
      }
      const hash = (body.hash || '').trim()
      const status = String(body.status || 'none')
      const kind = String(body.kind || 'user') // 'user' or 'ai'
      if (!hash) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: 'hash is required' }))
      }
      if (!['user', 'ai'].includes(kind)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: 'invalid kind' }))
      }
      const validStatuses = kind === 'user'
        ? ['approved', 'rejected', 'none']
        : ['userConfirmed', 'aiConfirmed', 'none']
      if (!validStatuses.includes(status)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: 'invalid status' }))
      }
      try {
        const all = readConfirmStatus(v.abs)
        const cur = all[hash] || {}
        if (status === 'none') {
          if (kind === 'user') {
            delete cur.user
          } else {
            delete cur.ai
          }
          // 如果两个都没了，整条删掉
          if (!cur.user && !cur.ai) {
            delete all[hash]
          } else {
            cur.updatedAt = new Date().toISOString()
            all[hash] = cur
          }
        } else {
          cur[kind] = status
          cur.updatedAt = new Date().toISOString()
          all[hash] = cur
        }
        writeConfirmStatus(v.abs, all)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        return res.end(JSON.stringify({ ok: true, hash, kind, status }))
      } catch (e) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: String(e.message || e) }))
      }
    }

    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'unknown git endpoint', path }))
      })
    },
  }
}
