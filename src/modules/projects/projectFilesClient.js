// 项目资料库文件操作的前端封装。所有操作都走 Vite 后端 /api/project/*，
// 后端会把路径限制在工作目录内。资料库根目录固定为 项目Wiki/。

// 基础资料库根目录（在项目工作目录下）。Wiki 库使用独立的绝对路径，不走此常量。
export const LIBRARY_ROOT = '基础资料'

function joinPath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/')
}

async function json(url, options) {
  const r = await fetch(url, options)
  const data = await r.json().catch(() => ({}))
  if (!r.ok || data.error) throw new Error(data.error || ('HTTP ' + r.status))
  return data
}

export const projectFiles = {
  list(dir, relPath = LIBRARY_ROOT) {
    const q = new URLSearchParams({ dir, path: relPath })
    return json('/api/project/list?' + q.toString())
  },
  read(dir, relPath) {
    const q = new URLSearchParams({ dir, path: relPath })
    return json('/api/project/read?' + q.toString())
  },
  write(dir, relPath, content) {
    return json('/api/project/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, path: relPath, content }),
    })
  },
  mkdir(dir, relPath) {
    return json('/api/project/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, path: relPath }),
    })
  },
  delete(dir, relPath) {
    return json('/api/project/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, path: relPath }),
    })
  },
  // 初始化基础资料骨架（新项目填目录后自动调用）。幂等。
  initBase(dir) {
    return json('/api/project/init-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir }),
    })
  },
  // Git 提交记录
  gitLog(dir, n = 30) {
    const q = new URLSearchParams({ dir, n: String(n) })
    return json('/api/project/git/log?' + q.toString())
  },
  gitShow(dir, hash) {
    const q = new URLSearchParams({ dir, hash })
    return json('/api/project/git/show?' + q.toString())
  },
  // Git 提交确认状态
  gitConfirmStatus(dir) {
    const q = new URLSearchParams({ dir })
    return json('/api/project/git/confirm-status?' + q.toString())
  },
  gitConfirm(dir, hash, status, kind = 'user') {
    return json('/api/project/git/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, hash, status, kind }),
    })
  },
  // 初始化 git 仓库
  gitInit(dir) {
    return json('/api/project/git/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir }),
    })
  },

  // Wiki 文件确认状态
  wikiStatus(dir) {
    const q = new URLSearchParams({ dir })
    return json('/api/project/wiki-status?' + q.toString())
  },
  wikiConfirm(dir, path, confirmed, contentHash, keepCount) {
    return json('/api/project/wiki-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, path, confirmed, contentHash, keepCount }),
    })
  },
  projectSkills(dir) {
    return json('/api/project/skills?dir=' + encodeURIComponent(dir))
  },
  skillsEnv(dir) {
    return json('/api/project/skills/env?dir=' + encodeURIComponent(dir || ''))
  },
  skillSuggestions(dir, name, description) {
    return json('/api/project/skills/suggestions?' + new URLSearchParams({ dir, name, description }).toString())
  },
  importProjectSkills(dir, skills, profileName) {
    return json('/api/project/skills/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir, skills, profileName }) })
  },
  skillMode(dir) {
    return json('/api/project/skills/mode?dir=' + encodeURIComponent(dir))
  },
  switchProjectSkills(dir) {
    return json('/api/project/skills/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) })
  },
  restoreGlobalSkills(dir) {
    return json('/api/project/skills/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir }) })
  },
  deleteProjectSkill(dir, name) {
    return json('/api/project/skills/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dir, name }) })
  },
  join: joinPath,
}
