# ============================================================
#  项目后台 - 系统托盘启动器 v1.1
#  功能：后台启动 vite 服务 -> 自动开浏览器 -> 缩到系统托盘
#        无黑窗、无任务栏条目；右键托盘图标可「打开后台」/「退出」
#        v1.1 新增：首次运行自动创建桌面快捷方式
#  说明：由「启动后台（托盘模式）.vbs」隐藏窗口方式调用，请勿直接双击
# ============================================================

$ErrorActionPreference = 'SilentlyContinue'
$Port = 5173
$Url  = "http://127.0.0.1:$Port/"
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VbsPath = Join-Path $AppDir "启动后台（托盘模式）.vbs"
$LnkPath = "$env:USERPROFILE\Desktop\项目后台.lnk"
$MutexName = 'Global\HermesVisualBackofficeTray_v1'

# ---------- 单实例：防止重复启动多个托盘图标 ----------
$Mutex = New-Object System.Threading.Mutex($false, $MutexName)
if (-not $Mutex.WaitOne(0, $false)) {
    # 已在运行 → 直接打开页面然后退出
    Start-Process $Url
    exit 0
}

# ---------- 首次运行：自动创建桌面快捷方式 ----------
function Install-DesktopShortcut {
    if (Test-Path $LnkPath) { return }  # 已有就不重复创建
    if (-not (Test-Path $VbsPath)) { return }
    try {
        $shell = New-Object -ComObject WScript.Shell
        $s = $shell.CreateShortcut($LnkPath)
        $s.TargetPath = "$env:SystemRoot\System32\wscript.exe"
        $s.Arguments = "`"$VbsPath`""
        $s.WorkingDirectory = $AppDir
        $s.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
        $s.Description = "一键启动项目后台（托盘无窗模式）"
        $s.Save()
    } catch {}
}
Install-DesktopShortcut

# ---------- WinForms / 托盘图标 ----------
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.Text = '项目后台（点击退出菜单可停止）'
$notify.Visible = $true

$menuOpen = New-Object System.Windows.Forms.MenuItem('打开后台页面')
$menuCreateLnk = New-Object System.Windows.Forms.MenuItem('创建桌面快捷方式')
$menuStop = New-Object System.Windows.Forms.MenuItem('退出并停止后台')
$menu = New-Object System.Windows.Forms.ContextMenu
[void]$menu.MenuItems.Add($menuOpen)
[void]$menu.MenuItems.Add($menuCreateLnk)
[void]$menu.MenuItems.Add('-')
[void]$menu.MenuItems.Add($menuStop)
$notify.ContextMenu = $menu

$script:child = $null       # 启动的 npm/node 进程
$script:startedByUs = $false

# ---------- 工具函数 ----------
function Test-Port($p) {
    try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', $p); $c.Close(); return $true
    } catch { return $false }
}

function Open-Browser { Start-Process $Url }

function Stop-Server {
    if ($script:child -and -not $script:child.HasExited) {
        # 杀进程树：npm.cmd 会派生 node 子进程
        taskkill /PID $script:child.Id /T /F | Out-Null
    }
    $script:child = $null
}

function New-DesktopShortcut {
    try {
        $shell = New-Object -ComObject WScript.Shell
        $s = $shell.CreateShortcut($LnkPath)
        $s.TargetPath = "$env:SystemRoot\System32\wscript.exe"
        $s.Arguments = "`"$VbsPath`""
        $s.WorkingDirectory = $AppDir
        $s.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
        $s.Description = "一键启动项目后台（托盘无窗模式）"
        $s.Save()
        $notify.ShowBalloonTip(2000, '项目后台', '桌面快捷方式已创建。', 'Info')
    } catch {
        $notify.ShowBalloonTip(3000, '项目后台', '创建快捷方式失败。', 'Error')
    }
}

# ---------- 启动服务 ----------
if (Test-Port $Port) {
    # 端口已被占用（可能是另一个实例或手动启动的），直接开页面，不再重复启动
    Open-Browser
} else {
    # 检查 node 是否存在
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        $notify.ShowBalloonTip(4000, '项目后台', '未检测到 Node.js，请先安装 Node.js LTS 版。', 'Error')
        Start-Process 'https://nodejs.org/'
        $notify.Visible = $false
        $Mutex.ReleaseMutex(); exit 1
    }
    # 首次自动装依赖
    if (-not (Test-Path (Join-Path $AppDir 'node_modules'))) {
        $p = Start-Process -FilePath 'npm.cmd' -ArgumentList 'install' -WorkingDirectory $AppDir -PassThru -WindowStyle Hidden
        $p.WaitForExit()
    }
    # 隐藏窗口启动 vite（--strictPort 保证端口被占时直接失败而不是换端口）
    $script:child = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList 'run','dev','--','--port',"$Port",'--strictPort' `
        -WorkingDirectory $AppDir -PassThru -WindowStyle Hidden
    $script:startedByUs = $true

    # 等待端口就绪（最多 30 秒）
    $tries = 0
    while (-not (Test-Port $Port) -and $tries -lt 30) {
        Start-Sleep -Seconds 1; $tries++
    }
    if (Test-Port $Port) { Open-Browser }
}

# ---------- 菜单事件 ----------
$menuOpen.add_Click({ Open-Browser })
$menuCreateLnk.add_Click({ New-DesktopShortcut })
$menuStop.add_Click({
    Stop-Server
    $notify.Visible = $false
    $Mutex.ReleaseMutex()
    [System.Windows.Forms.Application]::Exit()
})
# 双击托盘图标也打开页面
$notify.add_DoubleClick({ Open-Browser })

# 气泡提示已在运行
$notify.BalloonTipTitle = '项目后台已启动'
$notify.BalloonTipText  = '后台运行中，右键图标可打开页面或退出。'
$notify.ShowBalloonTip(2000)

# ---------- 常驻消息循环 ----------
[System.Windows.Forms.Application]::Run()

# 退出清理（保险）
Stop-Server
$notify.Visible = $false
try { $Mutex.ReleaseMutex() } catch {}
