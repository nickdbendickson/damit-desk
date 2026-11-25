@echo off
setlocal
rem --profile nd opens the desk in the North Dakota profile; --profile us in the United States one.
if /i "%~1"=="--profile" if not "%~2"=="" set "DAMIT_DESK_PROFILE=%~2"
set "APP=%~dp0..\app\desktop"
if not exist "%APP%\.venv\Scripts\python.exe" (
  py -3 -m venv "%APP%\.venv"
)
rem Install pywebview only when it is not already there, so a normal launch is fast and works offline.
"%APP%\.venv\Scripts\python.exe" -c "import webview" 2>nul || "%APP%\.venv\Scripts\python.exe" -m pip install -q "pywebview>=5.0,<7"
cd /d "%APP%"
"%APP%\.venv\Scripts\python.exe" run.py
