# 项目后台可视化

> 跨 AI 框架通用的项目文档管理与新对话启动工具

让 AI 接手项目时有统一入口，Wiki 内容有可信度分级，Git 提交有用户认可标记，开启新对话不用每次重复介绍项目。
本工具是轻量化 AI 编码知识库，专注 AI 开发任务管理，为各类 AI Agent 提供完整项目上下文，适配 Vibe Coding 开发流程。

**核心价值：把黑盒的后台变成可视化图形界面，内置强大的 Wiki 记忆索引系统，让你的每个决策、每个代码改动、每个项目方向，哪怕频繁新建对话窗口，AI 也都可以清楚记得，完整追溯。**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-purple.svg)](https://vitejs.dev/)

<img width="1844" height="999" alt="image" src="https://github.com/user-attachments/assets/d1011d62-ba3c-4bdc-834b-c6d3801df88f" />
---

## ✨ 特性

- 📁 **多项目管理** — 增删改查项目，侧边栏一键切换
- 📚 **双库架构** — 基础资料（随项目）+ Wiki 知识库（独立路径，长期保留）
- 🏷️ **Wiki 三档确认** — AI新增🟡 / AI疑议🔴 / 用户已确认🟢，文件树一眼可见哪些待确认
- 🔀 **Git 双确认** — 用户确认 + AI 标注，知道哪些提交是用户认可的
- 💬 **开启新对话** — 一键复制标准化提示词，跨 AI 通用（Hermes / Claude / Codex / 小龙虾 等）
- 🎯 **拖拽布局** — 项目详情页卡片自由拖拽缩放，布局本地存储
- ⚙️ **项目 Skill 管理** — 为项目配置专属 Skill 集，减少 token 消耗（Hermes 专属功能）
- 🖱️ **系统托盘启动** — 无黑窗、无任务栏，右键托盘图标退出，单实例防重复启动
- 🚀 **一键安装** — 双击安装.bat，自动创建桌面快捷方式并启动

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18

### Windows（推荐，零命令行）

1. 下载/解压本项目
2. 双击 **`安装.bat`**
3. 自动创建桌面快捷方式 + 启动后台 + 打开浏览器
4. 以后双击桌面的「**项目后台**」即可启动

### 手动启动（所有平台）

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 浏览器访问
# http://127.0.0.1:5173
```

### 构建生产版本

```bash
npm run build
# 产物在 dist/ 目录
```

---

## 📖 使用说明

### 新建项目

在「框架能力」页面点击「新建项目」，填写项目名称和说明即可。

### 配置项目

进入项目详情页，在「项目设置」卡片中：

- **项目工作目录**：填写本地项目的绝对路径（必填，Git/基础资料等功能依赖此路径）
- **Wiki 知识库路径**：填写独立的 Wiki 库文件夹绝对路径（可选，不随项目删除）

### 编辑文档

- **基础资料**：随项目走，保存在项目目录下的「基础资料」文件夹
- **Wiki 知识库**：独立路径，长期保留，不随项目删除
- 页面内直接 Markdown 编辑，实时预览，自动同步到本地文件

### Wiki 确认机制

| 标记 | 颜色 | 含义 |
|---|---|---|
| 🟡 AI新增 | 黄色 | AI 新增的知识，等待用户确认 |
| 🔴 AI疑议 | 红色 | AI 对已有内容有疑问或做了删改，提醒用户过目 |
| 🟢 已确认 | 绿色 | 用户已确认，可信度最高 |

- 修改内容后自动取消确认，重新确认次数 +1
- 确认次数 = 内容被用户认可的次数，越高越稳定
- 待确认内容照常使用，确认只决定冲突时的优先级

### Git 提交确认

- 左圈 = 用户确认（仅用户本人操作）
- 右圈 = AI 标注（AI 根据用户态度判断）
- 一眼看出哪些提交是用户认可的版本

### 开启新对话

点击右上角「开启新对话」按钮：
- 自动生成标准化提示词（系统操作规范 + AI必读内容）
- 一键复制，粘贴到任何 AI 对话中
- 跨 AI 框架通用，不限于 Hermes

---

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite 8 |
| 图标 | lucide-react |
| 后端 | Vite 插件形式的 Node.js 中间件（无额外 server） |
| 布局 | react-grid-layout 拖拽布局 |
| 存储 | localStorage + 本地文件系统 |
| UI | 纯手写 CSS，无组件库 |

---

## ❓ FAQ

**Q：需要联网吗？**
A：不需要。整个项目在本地运行，所有数据存在你自己的电脑上。

**Q：支持 Mac / Linux 吗？**
A：核心功能支持（npm run dev 即可）。托盘启动和一键安装.bat 是 Windows 专属的，Mac/Linux 用户直接用命令行启动。

**Q：支持哪些 AI 平台？**
A：所有平台都能用。「开启新对话」生成的提示词是纯文本，复制粘贴到任何 AI 对话里都行。项目 Skill 管理是 Hermes 专属功能，其他平台会自动隐藏。

**Q：Wiki 和基础资料有什么区别？**
A：基础资料随项目走（在项目目录下），适合放项目相关文档；Wiki 知识库是独立路径，适合放跨项目的通用知识，项目删了 Wiki 还在。

**Q：数据安全吗？**
A：所有文件都在你本地，不上传任何服务器。路径操作有三重穿越防护，限制在指定目录内。

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

---

## 💝 支持

如果这个项目对你有帮助，欢迎打赏支持 ❤️

你的支持是持续更新的动力。

---

## 📄 许可证

[GNU AGPL-3.0](LICENSE) © 果子

> 你可以自由使用、修改、分发本软件，但如果你通过网络向用户提供本软件的服务，必须向用户提供修改后的源代码。

---

# 🇬🇧 English

# Project Visual Backoffice

> Cross-AI project documentation manager & new-chat starter

Give every AI a unified onboarding entry point for your projects. Wiki content with confidence levels. Git commits with user approval tracking. Stop repeating project introductions in every new conversation.

Lightweight AI coding knowledge base, dev task manager, supply full project context for AI agents, aggregate Wiki docs and Git commits

**Core value: turn the black-box backoffice into a visual graphical interface, with a powerful Wiki memory indexing system built in. Every decision you make, every code change, every project direction — even if you create new chat windows constantly — AI can remember it all and trace it back completely.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-purple.svg)](https://vitejs.dev/)

---

## ✨ Features

- 📁 **Multi-project management** — create/edit/delete projects, sidebar one-click switch
- 📚 **Dual-library architecture** — Base Docs (with project) + Wiki Knowledge Base (independent path, long-term preservation)
- 🏷️ **Wiki three-tier confirmation** — AI added 🟡 / AI disputed 🔴 / User confirmed 🟢, see at a glance in file tree
- 🔀 **Git dual confirmation** — user confirmation + AI annotation, know which commits are user-approved
- 💬 **Start new chat** — one-click copy of standardized prompt, works across all AI platforms
- 🎯 **Drag-and-drop layout** — project detail cards freely draggable & resizable, layout saved locally
- ⚙️ **Project Skill management** — configure project-specific skill set to reduce token consumption (Hermes-only)
- 🖱️ **System tray launcher** — no console window, no taskbar entry, right-click to quit, single-instance protection
- 🚀 **One-click installer** — double-click Install.bat, auto-creates desktop shortcut & launches

---

## 🚀 Quick Start

### Requirements

- Node.js >= 18

### Windows (recommended, zero command-line)

1. Download / unzip this project
2. Double-click **`安装.bat`** (Install.bat)
3. Desktop shortcut is created + backoffice starts + browser opens automatically
4. From now on, just double-click **"项目后台"** on your desktop

### Manual launch (all platforms)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open in browser
# http://127.0.0.1:5173
```

### Build for production

```bash
npm run build
# Output in dist/
```

---

## 📖 Usage

### Create a project
On the Framework Capabilities page, click "New Project", enter name and description.

### Configure a project
Go to the project detail page, in the "Project Settings" card:
- **Working directory**: absolute path to your local project (required for Git / Base Docs features)
- **Wiki library path**: absolute path to an independent Wiki folder (optional, survives project deletion)

### Edit docs
- **Base Docs**: lives with the project, in `基础资料/` folder under project directory
- **Wiki Knowledge Base**: independent path, long-term preservation, survives project deletion
- In-page Markdown editor with live preview, auto-syncs to local files

### Wiki confirmation system

| Marker | Color | Meaning |
|---|---|---|
| 🟡 AI Added | Yellow | AI-added knowledge, waiting for user confirmation |
| 🔴 AI Disputed | Red | AI questions or modified existing content, user review needed |
| 🟢 Confirmed | Green | User confirmed, highest confidence |

- Editing content auto-removes confirmation, re-confirm increments counter
- Confirmation count = how many times the user has endorsed the content
- Unconfirmed content is still used normally — confirmation only affects conflict resolution priority

### Git commit confirmation
- Left dot = user confirmation (user only)
- Right dot = AI annotation (AI judges based on user attitude)
- See at a glance which commits are user-approved versions

### Start new chat
Click the "Start new chat" button in the top right:
- Auto-generates standardized prompt (system operation rules + AI must-read)
- One-click copy, paste into any AI conversation
- Works across all AI platforms, not just Hermes

---

## 🏗️ Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 |
| Icons | lucide-react |
| Backend | Node.js middleware as Vite plugin (no separate server) |
| Layout | react-grid-layout drag & drop |
| Storage | localStorage + local filesystem |
| UI | hand-written CSS, no component library |

---

## ❓ FAQ

**Q: Does it need internet?**
A: No. Everything runs locally. All data stays on your computer.

**Q: Mac / Linux support?**
A: Core features work on all platforms (`npm run dev`). Tray launcher & one-click installer are Windows-only. Mac/Linux users use the command line.

**Q: Which AI platforms are supported?**
A: All platforms. The "Start new chat" prompt is pure text — copy-paste into any AI. Project Skill management is Hermes-only; other platforms hide it automatically.

**Q: What's the difference between Wiki and Base Docs?**
A: Base Docs travel with the project (inside project directory), good for project-specific docs. Wiki Knowledge Base is an independent path for cross-project general knowledge — delete a project and the Wiki stays.

**Q: Is my data safe?**
A: All files stay on your machine. Nothing is uploaded. Path operations have triple traversal protection, limited to configured directories.

---

## 🤝 Contributing

Issues and PRs are welcome!

---

## 💝 Support

If this project helps you, donations are appreciated ❤️

Your support is what keeps the updates coming.

---

## 📄 License

[GNU AGPL-3.0](LICENSE) © Guozi

> You are free to use, modify, and distribute this software. But if you provide access to this software over a network to users, you must make the modified source code available to those users.
>
## 💖支持本项目
如果你觉得本项目对你有帮助，可以前往爱发电赞助支持：
https://afdian.com/a/333123guozi
