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

REM  %~dp0 keeps a trailing backslash, which robocopy will not accept.
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

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
REM  This project lives inside OneDrive, which stores files as Files
REM  On-Demand placeholders rather than ordinary files. Docker cannot read a
REM  placeholder: it gives up loading the build context with "invalid file
REM  request src/App.tsx". Copying the sources to a plain folder outside the
REM  sync root turns them back into ordinary files, and OneDrive never
REM  touches that copy. The copy is refreshed on every run, so it always
REM  matches what is in this folder.
echo  [3/3] Building and starting the web app...

set "HARMONY_BUILD_CONTEXT=%LOCALAPPDATA%\HarmonySuite\build-context"

robocopy "%PROJECT_DIR%" "%HARMONY_BUILD_CONTEXT%" /MIR /NFL /NDL /NJH /NJS /NP /XD node_modules dist dist-ssr .git .branches .temp /XF .env .env.local *.log >nul
REM  robocopy uses 0-7 for success and 8+ for failure, unlike every other tool.
if errorlevel 8 (
  echo.
  echo  [X] Could not prepare the build folder:
  echo        %HARMONY_BUILD_CONTEXT%
  echo.
  pause
  exit /b 1
)

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
