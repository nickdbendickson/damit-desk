# DamIT Desk Start-menu shortcut. Run from the repo: powershell -File bin\install-launcher.ps1
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
$Target = Join-Path $Here "damit-desk.cmd"
$Menu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path $Menu | Out-Null
$Shortcut = Join-Path $Menu "DamIT Desk.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Link = $Shell.CreateShortcut($Shortcut)
$Link.TargetPath = $Target
$Link.WorkingDirectory = (Join-Path $Root "app\desktop")
$Link.WindowStyle = 7
$Link.Description = "DamIT Desk. QGIS stays in the background."
$Link.Save()
Write-Output "Installed $Shortcut"
Write-Output "Open DamIT Desk from the Start menu."
