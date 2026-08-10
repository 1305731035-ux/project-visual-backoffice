// 技能分类目录名（英文 slug）到中文显示名的映射。
// 分类来自 skill 目录名 / frontmatter category，是数据的一部分，不改动原始值，
// 只在展示层做 label 转换：
//   zh  -> 中文名（已是中文的原样返回）
//   en  -> 原始英文 slug
// 未登记的 slug 走 humanize 兜底（连字符转空格、首字母大写）。

const categoryZh = {
  'ai-tools': 'AI 工具',
  'apple': '苹果生态',
  'autonomous-ai-agents': '自主 AI 代理',
  'backend': '后端开发',
  'bottleneck-hunter': '性能瓶颈排查',
  'content-creation': '内容创作',
  'content-generation': '内容生成',
  'content-processing': '内容处理',
  'creative': '创意创作',
  'data-science': '数据科学',
  'data_backup': '数据备份',
  'design': '设计',
  'development': '开发',
  'devops': '运维 DevOps',
  'email': '邮件',
  'evaluation': '评估评测',
  'frontend-development': '前端开发',
  'fullstack': '全栈开发',
  'game-design': '游戏设计',
  'game-dev': '游戏开发',
  'game-development': '游戏开发',
  'gamedev': '游戏开发',
  'gamedevelopment': '游戏开发',
  'gaming': '游戏',
  'general': '通用',
  'github': 'GitHub',
  'hermes': 'Hermes',
  'hermes-agent': 'Hermes 代理',
  'hermes-memory-unification-and-auto-backup': 'Hermes 记忆统一与自动备份',
  'interaction': '交互',
  'mcp': 'MCP',
  'media': '媒体',
  'media_processing': '媒体处理',
  'mlops': '机器学习运维',
  'note-taking': '笔记',
  'productivity': '效率工具',
  'red-teaming': '红队测试',
  'renpy': "Ren'Py",
  'research': '研究',
  'reverse-engineering': '逆向工程',
  'search-chat-history': '聊天记录搜索',
  'serenity': 'Serenity',
  'smart-home': '智能家居',
  'social-media': '社交媒体',
  'software-development': '软件开发',
  'system-tools': '系统工具',
  'system_tools': '系统工具',
  'troubleshooting': '故障排查',
  'user-interaction': '用户交互',
  'user-manually-modified-document-formatting': '用户手动修改文档处理',
  'windows': 'Windows',
  'windows-scripts': 'Windows 脚本',
  'writing': '写作',
}

function humanize(slug) {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function categoryLabel(category, lang = 'zh') {
  if (!category) return ''
  if (lang === 'en') return category
  if (/[\u4e00-\u9fa5]/.test(category)) return category // 已是中文
  return categoryZh[category] || humanize(category)
}
