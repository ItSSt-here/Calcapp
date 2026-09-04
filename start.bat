@echo off
cd /d "%~dp0"
start "calcapp-server" cmd /c npx --yes serve -l 5173 .
timeout /t 2 /nobreak >nul
start http://localhost:5173
