@echo off
setlocal
set "APP=%~dp0..\app\desktop"
if not exist "%APP%\.venv\Scripts\python.exe" (
  py -3 -m venv "%APP%\.venv"
)
"%APP%\.venv\Scripts\python.exe" -m pip install -q "pywebview>=5.0,<7"
cd /d "%APP%"
"%APP%\.venv\Scripts\python.exe" run.py
