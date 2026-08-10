---
name: project-visual-backoffice
description: "Cross-AI project visual backoffice: project documentation, Wiki knowledge base, Git commit confirmation, one-click new chat. Supports drag-and-drop layouts and multi-project switching."
version: 1.0.0
author: Guozi
license: AGPL-3.0
platforms: [windows, mac, linux]
requires:
  - node.js >= 18
metadata:
  hermes:
    tags: [project-management, wiki, git, documentation, productivity]
    category: software-development
---

# 项目后台可视化

跨 AI 框架通用的项目文档管理与新对话启动工具。让 AI 接手项目时有统一入口，Wiki 内容有可信度分级，Git 提交有用户认可标记，开启新对话不用重复介绍项目。

## 何时使用

- 用户开始一个新项目的开发，需要管理项目文档和 AI 协作
- AI 接手项目，需要快速了解项目背景和规则
- 需要对项目文档做可信度标记（AI新增 / AI疑议 / 用户已确认）
- 需要管理 Git 提交的确认状态
- 每次开新对话都要重复介绍项目，想一键生成标准化提示词

## 核心功能

- **多项目管理**：增删改查项目，侧边栏快速切换
- **双库架构**：基础资料（随项目）+ Wiki 知识库（独立路径）
- **Wiki 三档确认**：AI 新增 🟡 / AI 疑议 🔴 / 用户已确认 🟢，文件树一眼可见
- **Git 双确认**：用户确认 + AI 标注，知道哪些提交是用户认可的
- **开启新对话**：一键复制标准化提示词（系统规范 + AI必读），跨 AI 通用
- **拖拽布局**：项目详情页卡片可拖拽缩放，布局本地存储
- **项目 Skill 管理**：为项目配置专属 Skill 集，减少 token 消耗（Hermes 专属功能）

## 安装与启动

### 首次安装

安装后**必须立即启动后台并打开页面**，不要什么都不做就让用户自己找。

#### Windows（推荐）

双击项目根目录的 `安装.bat`，自动完成：
1. 创建桌面快捷方式「项目后台」
2. 启动后台服务（托盘模式，无黑窗）
3. 自动打开浏览器进入后台页面

如果安装.bat 没有自动弹出页面，手动双击桌面的「项目后台」快捷方式。

#### 手动启动

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 浏览器访问 http://127.0.0.1:5173
```

### 托盘模式说明

- 后台启动后会缩到系统托盘，不会有黑色命令行窗口
- 右键托盘图标：打开后台页面 / 创建桌面快捷方式 / 退出并停止后台
- 双击托盘图标也可以打开后台页面
- 单实例：重复启动只会打开页面，不会启动多个后台

### AI 安装后的标准动作

1. **立即检查后台是否已启动**（访问 http://127.0.0.1:5173）
2. 如果未启动，**主动启动后台服务**并打开页面
3. 引导用户进入项目设置页面，配置项目工作目录
4. 告知用户：以后双击桌面「项目后台」即可启动

## 使用说明

### 新建项目
在框架能力页面点击「新建项目」，填写项目名称和说明即可。

### 配置项目
进入项目详情页，在「项目设置」卡片中：
- 填写项目工作目录（本地项目的绝对路径）
- 填写 Wiki 知识库路径（可选，独立于项目目录的知识库位置）

### 编辑文档
- 基础资料：随项目走，存在项目目录下的「基础资料」文件夹
- Wiki 知识库：独立路径，长期保留不随项目删除
- 直接在页面内 Markdown 编辑，实时预览，自动同步到本地文件

### 开启新对话
点击右上角「开启新对话」按钮，自动生成标准化提示词（包含系统操作规范 + AI必读内容），一键复制即可粘贴到任何 AI 对话中。

## 技术栈

- 前端：React 19 + Vite 8 + lucide-react
- 后端：Vite 插件形式的 Node.js 中间件（无额外 server）
- 存储：localStorage + 本地文件系统
- UI：纯手写 CSS，无组件库

## 许可证

AGPL-3.0 © 果子

如果这个项目对你有帮助，欢迎打赏支持 ❤️

---

# 🇬🇧 English

# Project Visual Backoffice

A cross-AI project documentation manager and new-chat starter. Give AI a unified onboarding entry point for every project, add confidence levels to Wiki content, track user-approved Git commits, and stop repeating project introductions in every new conversation.

## When to use

- User starts a new project and needs to manage docs & AI collaboration
- AI onboards to a project and needs to quickly understand context & rules
- Need confidence markers on project docs (AI added / AI disputed / user confirmed)
- Need to track confirmation status of Git commits
- Tired of repeating project intro in every new chat — generate a standardized prompt in one click

## Core features

- **Multi-project management** — create/edit/delete projects, sidebar quick switch
- **Dual-library architecture** — Base Docs (with project) + Wiki Knowledge Base (independent path)
- **Wiki three-tier confirmation** — AI added 🟡 / AI disputed 🔴 / User confirmed 🟢, visible at a glance in file tree
- **Git dual confirmation** — user confirmation + AI annotation, know which commits are user-approved
- **Start new chat** — one-click copy of standardized prompt (system rules + AI must-read), works across all AI platforms
- **Drag-and-drop layout** — project detail cards are draggable & resizable, layout saved locally
- **Project Skill management** — configure project-specific skill set to reduce token consumption (Hermes-only feature)

## Installation & Launch

### First-time installation

**After installation, you MUST launch the backoffice and open the page immediately** — don't leave the user hanging.

#### Windows (recommended)

Double-click `安装.bat` (Install.bat) in the project root. It automatically:
1. Creates a desktop shortcut "项目后台" (Project Backoffice)
2. Starts the backoffice service (tray mode, no console window)
3. Opens the backoffice page in your browser

If the page doesn't open automatically, double-click the "项目后台" desktop shortcut.

#### Manual launch (all platforms)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://127.0.0.1:5173 in your browser
```

### Tray mode

- Backoffice runs in the system tray — no black console window
- Right-click the tray icon: Open backoffice / Create desktop shortcut / Quit & stop server
- Double-click the tray icon also opens the page
- Single instance: re-launching just opens the page, no duplicate servers

### Standard AI actions after installation

1. **Immediately check if the backoffice is running** (visit http://127.0.0.1:5173)
2. If not running, **start the backoffice service** and open the page
3. Guide the user to Project Settings to configure the working directory
4. Tell the user: from now on, just double-click "项目后台" on the desktop

## Tech stack

- Frontend: React 19 + Vite 8 + lucide-react
- Backend: Node.js middleware as a Vite plugin (no separate server)
- Storage: localStorage + local filesystem
- UI: hand-written CSS, no component library

## License

AGPL-3.0 © Guozi

If this project helps you, donations are appreciated ❤️
