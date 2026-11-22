@echo off
chcp 65001 >nul
net session >nul 2>&1
if errorlevel 1 (
  echo Pedindo permissao de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall add rule name="FLORESTA 8787" dir=in action=allow protocol=TCP localport=8787 profile=private,domain
if errorlevel 1 (
  echo.
  echo Nao consegui criar a regra. Talvez ela ja exista.
  echo Se o amigo ainda nao conseguir abrir, veja se a rede do Windows esta como "Privada".
) else (
  echo.
  echo Porta 8787 liberada para redes privadas. Pode fechar esta janela.
)
pause
