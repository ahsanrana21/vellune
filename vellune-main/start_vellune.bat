@echo off
cd /d "%~dp0"
echo Starting Vellune local website...
start "Vellune Server" cmd /k "python -m http.server 8000"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/website.html"
