@echo off
chcp 936 >nul
setlocal
title 项目后台 - 安装程序 v1.1

rem ============================================================
rem  项目后台一键安装
rem  1. 创建桌面快捷方式
rem  2. 首次启动（托盘模式，无黑窗）
rem ============================================================

cd /d "%~dp0"

set "VBS=%~dp0启动后台（托盘模式）.vbs"
set "LNK=%USERPROFILE%\Desktop\项目后台.lnk"

echo.
echo ========================================
echo    项目后台 - 正在安装
echo ========================================
echo.

if not exist "%VBS%" (
  echo [错误] 找不到启动后台（托盘模式）.vbs，安装失败。
  echo 请确认所有文件在同一目录下。
  goto :end
)

echo [1/2] 正在创建桌面快捷方式...
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');$s.TargetPath='%SystemRoot%\System32\wscript.exe';$s.Arguments='"%VBS%"';$s.WorkingDirectory='%~dp0';$s.IconLocation='%SystemRoot%\System32\shell32.dll,220';$s.Description='一键启动项目后台（托盘无窗模式）';$s.Save()"

if exist "%LNK%" (
  echo [成功] 桌面快捷方式已创建：项目后台.lnk
) else (
  echo [警告] 快捷方式创建失败，但不影响使用，可手动创建。
)

echo.
echo [2/2] 正在启动项目后台（托盘模式）...
echo 后台将在系统托盘运行，浏览器会自动打开。
echo 以后双击桌面的「项目后台」即可启动。
echo.

start "" "%VBS%"

echo [完成] 安装成功！
echo 提示：右键托盘图标可退出后台。

:end
endlocal
