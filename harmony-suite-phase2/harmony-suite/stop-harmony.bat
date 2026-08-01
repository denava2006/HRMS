@echo off
REM ===================================================================
REM  Harmony Suite HRMS - stop everything
REM
REM  Stops the web app and the database. Your data is kept: starting
REM  again brings it all back exactly as you left it.
REM ===================================================================

setlocal
cd /d "%~dp0"

echo.
echo  Stopping Harmony Suite...
echo.

docker compose down
call npx --yes supabase stop

echo.
echo  Stopped. Your data is safe - run start-harmony.bat to come back.
echo.
timeout /t 5 >nul
endlocal
