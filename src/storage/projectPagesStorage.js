// 项目页面的本地存储。
// 已实现：创建 / 列表 / 删除 / 更新基础信息（含工作目录）。
// 后续步骤会叠加 requiredReading（新AI必读）、Wiki、profile 等配置。

const STORAGE_KEY = 'hermes-visual-backoffice:project-pages:v1'

// 基础资料库位于项目工作目录下的子文件夹名；AI必读文件也保存在这里。
export const BASE_LIBRARY_DIR = '基础资料'
// AI必读文件在项目工作目录下的相对路径。
export const AI_REQUIRED_READ_PATH = BASE_LIBRARY_DIR + '/AI必读.md'

function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeAll(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

function normalize(page) {
  return {
    requiredReading: [],
    workingDir: '',
    wikiDir: '',
    ...page,
  }
}

export function listProjectPages() {
  return readAll().map(normalize).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export function getProjectPage(id) {
  const found = readAll().find(p => p.id === id)
  return found ? normalize(found) : null
}

export function createProjectPage({ name, description = '', workingDir = '', wikiDir = '' }) {
  const list = readAll()
  const now = Date.now()
  const page = normalize({
    id: 'proj_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8),
    name: (name || '').trim() || '未命名项目页面',
    description: (description || '').trim(),
    workingDir: (workingDir || '').trim(),
    wikiDir: (wikiDir || '').trim(),
    createdAt: now,
    updatedAt: now,
  })
  list.push(page)
  writeAll(list)
  return page
}

export function updateProjectPage(id, patch) {
  const list = readAll()
  const idx = list.findIndex(p => p.id === id)
  if (idx === -1) return null
  const updated = normalize({ ...list[idx], ...patch, id: list[idx].id, updatedAt: Date.now() })
  list[idx] = updated
  writeAll(list)
  return updated
}

export function deleteProjectPage(id) {
  const list = readAll().filter(p => p.id !== id)
  return writeAll(list)
}

// 纯函数：根据项目配置 + AI必读全文 生成"开场提示词"。跨 AI 通用，复制到任意新对话即可。
// 结构 = 标准化开头（项目名/目录/行动要求）+ AI必读区域全文。
// ========== 系统操作规范（固定，用户不修改） ==========
// AI 每次开启新对话都会先看一遍，作为工作底线
const SYSTEM_OPERATION_RULES = `
## 系统操作规范（必须遵守）

### 一、工作方式
1. 先读 AI必读，理解项目后再动手
2. 干完活主动汇报结果 + 验证证据，等用户反馈
3. 用户确认前不要擅自进行下一大步

### 二、知识库（Wiki）
两类内容：
- **产品预制**（红绿点含义、确认机制、Wiki规则等，不随项目变）：你主要维护。
- **用户内容**（项目资料）：只有用户明确吩咐才改。
Wiki 是按需检索的知识库，不是每次全读的 prompt。先读 AI必读+入口索引，再按任务只查相关文档。标记格式、蒸馏流程等详见 Wiki维护规则.md，用到再读。

### 二点五、项目指令的 Wiki 调用
（每次收到新的项目相关指令时，必须在回答、设计或执行前，主动查阅本次指令涉及的相关 Wiki 内容；不只查需求、规则、设计决策和历史结论，Wiki 中可能相关的其他内容也要一并查阅。）
（一次查阅应按入口和导航，把本次任务需要的相关需求、规则、模块文档、决策记录、开发日志、踩坑记录及其他资料统一查齐；不能只凭当前对话或 AI 记忆直接处理。）
（同一指令的连续追问可复用已经查阅的内容；只有任务范围、模块或规则体系发生变化时，才补充查阅新增的 Wiki 内容。）
（普通闲聊不必主动调用项目 Wiki；如果无法判断是否相关，优先查阅后再决定是否采用 Wiki 内容。）
（查阅后根据内容状态、来源证据和当前指令决定如何使用；发生冲突时主动说明双方依据，不能擅自选边、覆盖原文或直接执行冲突修改。）
（Git 确认体系与 Wiki 文档确认体系完全独立，必须分别遵守各自规则。）

### 三、Wiki 蒸馏（知识入库）
- 每条条目 = **结论 + 来源证据**（出处/时间/对话或文件）；用户的判断、解释也要录（这些最值钱），不能只留干规则。
- 按 hash 快照**增量**蒸馏：全量算 hash（廉价），只处理新增/变更/删除的文件；与标签无关，已确认的新文件照样收录。
- 录入打标记：🟡=纯新增知识（等用户确认）；🔴=AI删改了已有正文（无论原文原来什么颜色，动过就红，提醒用户过目）。AI 无权标🟢已确认，只能用户点。
- **例外**：AI 先问、用户明确说"改"后再改 → 标🟡不标🔴（用户已知情，无需再用红点吓他）。
- 对话中用户提到已记录节点，主动联想比对；用户当前发言优先于旧确认（确认是当时认可，非永恒真理，改口即更新）。
- 冲突可先问；用户没回也必须落盘：按最新说法改正文+标🟡+蒸馏。旧条目不删，只降级/归档保留演变时间线。
- 待确认照常执行：确认只管冲突时优先级，不是收录/执行开关。

### 四、用户态度三态判断法
每次交付后从用户下一次回复判断态度：
- ✅ **明确肯定**（验收通过/做得好/可以/没问题）→ 用户确认
- 🟡 **继续下一个**（没评价但直接让做下一步）→ 大概率行
- ❌ **让改/重做/不对** → 不行，继续调

### 五、Wiki 三档标记规则
- 🟡 \`[!NOTE] AI 新增 · 待用户确认\`：纯新增知识（含经用户确认后由AI改写的内容），等用户确认。
- 🔴 \`[!CAUTION] AI 疑议 · 待用户确认\`：AI 擅自删改了已有正文，或对旧内容存疑；原文/改动需用户过目。
- ✅ \`[!CONFIRMED]\`：用户已确认，只能用户本人点；AI 无权设置。
- 优先级：疑议 > 新增 > 已确认

### 六、Git 确认状态（双圆点，AI 只碰右圈）
- 左圈 = \`user\`：用户本人点击，**AI 禁写**（口头说通过也不写）。
- 右圈 = \`ai\`：由 **AI 在提交后、用户的下一条回复里**根据态度判断填写——提交当下绝不提前标：
  - 下条回复明确肯定（如"提交吧""可以"）→ \`userConfirmed\`（绿）；直接让做下一步（如"进行下一个项目"）→ \`aiConfirmed\`（橘）；挑毛病让改 → 不标（无色）。
- **AI 必须在下条回复里用一句话明说自己的判断**，例如："本次提交我判断为：绿色（用户明确确认）"或"橘色（用户让继续，未明说）"或"无色（用户要求修改，未通过）"，不能只默默打点。
- **AI 判断后必须落盘**：调用 \`POST /api/project/git/confirm\`，body \`{ dir, hash, status, kind: 'ai' }\`（status 取 \`userConfirmed\`/\`aiConfirmed\`/\`none\`），写入 基础资料/.git-确认记录.json。只口头说、不调接口 = 没标记。

### 七、绝对红线
1. 禁止伪造执行结果、谎报完成
2. 禁止直接修改已确认内容，要改先加疑议问用户
3. 禁止杀进程不看 PID，绝对不能 taskkill 所有 powershell
4. 所有改动必须构建通过 + 验证后再交付
5. 新建/下载 Skill 后必须立即导入当前项目（POST /api/project/skills/import），未登记 = 项目模式自动禁用，属失职
`

export function buildStartupPrompt(page, requiredReadContent = '') {
  const p = normalize(page)
  const dirLine = p.workingDir ? `项目工作目录：${p.workingDir}` : '项目工作目录：（暂未设置）'
  const body = (requiredReadContent || '').trim()

  return `【新项目会话 · ${p.name}】
我要开始开发项目「${p.name}」。
${dirLine}

开始前请严格遵守：
1. 第一步先完整阅读下面的【系统操作规范】和【AI必读】，不要急着写代码。
2. 读完后用两三句话确认你对项目的理解，列出你看到的关键约束。
3. 然后停下等待我的具体指令。在我明确确认之前，不要修改、删除或创建任何文件。

【系统操作规范】
${SYSTEM_OPERATION_RULES.trim()}

【AI必读】
${body || '（AI必读区域还没有内容，请先在项目页面填写并保存。）'}`
}

// AI必读内容的本地草稿持久化（当用户还没设置工作目录、或文件未同步时的兜底）。
function draftKey(id) { return `${STORAGE_KEY}:requiredReadDraft:${id}` }
export function loadRequiredReadDraft(id) {
  try { return window.localStorage.getItem(draftKey(id)) || '' } catch { return '' }
}
export function saveRequiredReadDraft(id, content) {
  try { window.localStorage.setItem(draftKey(id), content || ''); return true } catch { return false }
}
