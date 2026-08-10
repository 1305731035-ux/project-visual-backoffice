@echo off
chcp 936 >nul
setlocal enabledelayedexpansion
title 项目后台启动器 v1.0

rem ============================================================
rem  项目后台一键启动器 v1.0
rem  双击即可：检测环境 -> 首次自动装依赖 -> 启动后台 -> 打开浏览器
rem  已在运行则直接打开页面（幂等，不会重复启动）
rem ============================================================

cd /d "%~dp0"

set "URL=http://127.0.0.1:5173/"
set "PORT=5173"

echo [1/4] 正在检查运行环境...

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 未检测到 Node.js，无法启动。
  echo 请先安装 Node.js LTS 版：https://nodejs.org/
  echo 安装完成后重新双击本脚本即可。
  start "" "https://nodejs.org/"
  goto :end
)

call :CHECK_PORT
if "!PORT_OPEN!"=="1" (
  echo [信息] 后台已在运行，直接为你打开页面。
  start "" "%URL%"
  goto :end
)

if not exist "node_modules" (
  echo [2/4] 首次运行，正在安装依赖，可能需要几分钟...
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试。
    goto :end
  )
) else (
  echo [2/4] 依赖已就绪，跳过安装。
)

echo [3/4] 正在启动后台服务...
start "项目后台服务（关闭此窗口即停止）" /min cmd /c "npm run dev -- --port %PORT% --strictPort"

echo [4/4] 等待服务就绪...
set /a TRIES=0
:WAIT
timeout /t 1 /nobreak >nul
call :CHECK_PORT
if "!PORT_OPEN!"=="1" goto :READY
set /a TRIES+=1
if !TRIES! GEQ 30 (
  echo [错误] 服务启动超时，请检查最小化窗口里的报错。
  goto :end
)
goto :WAIT

:READY
start "" "%URL%"
echo [完成] 后台已启动，页面应已在浏览器打开。
echo 提示：关闭最小化的服务窗口即可停止后台。
goto :end

:CHECK_PORT
set "PORT_OPEN=0"
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',%PORT%);$c.Close()}catch{exit 1}" >nul 2>nul
if not errorlevel 1 set "PORT_OPEN=1"
goto :eof

:end
echo.
timeout /t 3 /nobreak >nul
endlocal
