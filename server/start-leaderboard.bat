@echo off
setlocal
cd /d "%~dp0"

echo Starting Mini Market leaderboard API on port 8788...
echo (KartBlitz can keep using 8787 at the same time.)
start "Mini Market API" cmd /k "python app.py"

timeout /t 2 /nobreak >nul

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo.
  echo cloudflared was not found on PATH.
  echo Try the full path, for example:
  echo   "C:\Users\663208\Downloads\Applications\cloudflared-windows-amd64.exe" tunnel --url http://localhost:8788
  echo.
  echo API is still running locally at http://localhost:8788/api/health
  pause
  exit /b 1
)

echo Starting Cloudflare quick tunnel to port 8788...
echo Copy the https://....trycloudflare.com URL into VITE_LB_API_BASE and redeploy Pages.
start "Mini Market Tunnel" cmd /k "cloudflared tunnel --url http://localhost:8788"

echo.
echo Both windows should stay open while people use the shared leaderboard.
echo Keep the laptop plugged in and awake.
pause
