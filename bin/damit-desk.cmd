@echo off
setlocal
rem --profile nd opens the desk in the North Dakota profile; --profile us in the United States one.
if /i "%~1"=="--profile" if not "%~2"=="" set "DAMIT_DESK_PROFILE=%~2"
set "APP=%~dp0..\app\desktop"
if not exist "%APP%\.venv\Scripts\python.exe" (
  py -3 -m venv "%APP%\.venv"
)
"%APP%\.venv\Scripts\python.exe" -m pip install -q "pywebview>=5.0,<7"
cd /d "%APP%"
"%APP%\.venv\Scripts\python.exe" run.py
