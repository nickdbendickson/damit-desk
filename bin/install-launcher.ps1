# DamIT Desk Start-menu shortcuts, one per profile: "DamIT Desk" (United States) and "DamIT Desk (North Dakota)",
# each with the desk icon. Run from the repo: powershell -File bin\install-launcher.ps1
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
$Target = Join-Path $Here "damit-desk.cmd"
$Icon = Join-Path $Root "share\damit-desk.ico"
$Menu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path $Menu | Out-Null
$Shell = New-Object -ComObject WScript.Shell
foreach ($Entry in @(@("DamIT Desk", "us"), @("DamIT Desk (North Dakota)", "nd"))) {
    $Shortcut = Join-Path $Menu ($Entry[0] + ".lnk")
    $Link = $Shell.CreateShortcut($Shortcut)
    $Link.TargetPath = $Target
    $Link.Arguments = "--profile " + $Entry[1]
    $Link.WorkingDirectory = (Join-Path $Root "app\desktop")
    $Link.WindowStyle = 7
    $Link.IconLocation = $Icon + ",0"
    $Link.Description = $Entry[0] + ". QGIS stays in the background."
    $Link.Save()
    Write-Output "Installed $Shortcut"
}
Write-Output "Open DamIT Desk from the Start menu."
