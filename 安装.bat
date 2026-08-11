@echo off
chcp 936 >nul
setlocal
title 项目后台 - 安装程序 v1.2

rem ============================================================
rem  项目后台一键安装 v1.2
rem  1. 首次自动安装依赖（npm install）
rem  2. 创建桌面快捷方式
rem  3. 首次启动（托盘模式，无黑窗）
rem  v1.2 新增：首次安装自动检测并安装 node 依赖，普通用户下载后
rem        双击即可完成全部安装，无需手动打开命令行。
rem ============================================================

cd /d "%~dp0"

set "VBS=%~dp0启动后台（托盘模式）.vbs"
set "LNK=%USERPROFILE%\Desktop\项目后台.lnk"

echo.
echo ========================================
echo    项目后台 - 正在安装
echo ========================================
echo.

rem ---------- 首次安装：自动安装依赖 ----------
if not exist "%~dp0node_modules" (
  echo [1/3] 首次安装，正在安装依赖（约1-2分钟，需联网）...
  echo 如果长时间无反应，请先安装 Node.js：https://nodejs.org
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败！请确认已安装 Node.js 后重试。
    goto :end
  )
  echo [成功] 依赖安装完成。
) else (
  echo [1/3] 依赖已存在，跳过安装。
)

if not exist "%VBS%" (
  echo [错误] 找不到启动后台（托盘模式）.vbs，安装失败。
  echo 请确认所有文件在同一目录下。
  goto :end
)

echo [2/3] 正在创建桌面快捷方式...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');$s.TargetPath='%SystemRoot%\System32\wscript.exe';$s.Arguments='"%VBS%"';$s.WorkingDirectory='%~dp0';$s.IconLocation='%SystemRoot%\System32\shell32.dll,220';$s.Description='一键启动项目后台（托盘无窗模式）';$s.Save()"

if exist "%LNK%" (
  echo [成功] 桌面快捷方式已创建：项目后台.lnk
) else (
  echo [警告] 快捷方式创建失败，但不影响使用，可手动创建。
)

echo.
echo [3/3] 正在启动项目后台（托盘模式）...
echo 后台将在系统托盘运行，浏览器会自动打开。
echo 以后双击桌面的「项目后台」即可启动。
echo.

start "" "%VBS%"

echo [完成] 安装成功！
echo 提示：右键托盘图标可退出后台。

:end
endlocal
