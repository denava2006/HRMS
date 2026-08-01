@echo off
REM ===================================================================
REM  Harmony Suite HRMS - start everything
REM
REM  Double-click this file. It starts the database and the web app in
REM  Docker and opens the browser. No editor and no npm needed - Docker
REM  does the build itself.
REM ===================================================================

setlocal
cd /d "%~dp0"

echo.
echo  Harmony Suite HRMS
echo  ==================
echo.

REM --- Docker has to be running before anything else works ---
docker info >nul 2>&1
if errorlevel 1 (
  echo  [X] Docker Desktop is not running.
  echo.
  echo      Open Docker Desktop, wait until it says "Engine running",
  echo      then double-click this file again.
  echo.
  pause
  exit /b 1
)
echo  [1/3] Docker is running.

REM --- Database, auth, storage, edge functions ---
echo  [2/3] Starting the database... (first run takes a few minutes)
call npx --yes supabase start >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [X] The database did not start. Run this to see why:
  echo        npx supabase start
  echo.
  pause
  exit /b 1
)

REM --- The web app itself ---
echo  [3/3] Building and starting the web app...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo  [X] The web app failed to build. The error is above.
  echo.
  pause
  exit /b 1
)

echo.
echo  Ready.
echo.
echo    Harmony Suite   http://localhost:8080
echo    Database admin  http://localhost:55323
echo.
echo  Leave this window closed or open, it makes no difference - everything
echo  runs in the background. Use stop-harmony.bat when you are finished.
echo.

start "" "http://localhost:8080"

timeout /t 8 >nul
endlocal
