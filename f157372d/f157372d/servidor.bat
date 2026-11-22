@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1" %*
if errorlevel 1 echo [erro] o servidor terminou com erro. Veja a mensagem acima.
echo.
pause
