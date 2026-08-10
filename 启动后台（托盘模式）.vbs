' ============================================================
'  项目后台 - 托盘模式启动器
'  作用：隐藏窗口调用 PowerShell 托盘脚本，无黑窗、无任务栏
'  用法：直接双击本文件，或通过桌面快捷方式启动
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
d = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & d & "\后台托盘启动器_v1.1.ps1""", 0, False
