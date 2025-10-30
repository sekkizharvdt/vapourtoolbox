@echo off
echo ======================================
echo Deploying Cloud Functions
echo ======================================
echo.

echo [1/2] Building functions...
call pnpm --filter @vapour/functions build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Deploying to Firebase...
call firebase deploy --only functions

echo.
echo ======================================
echo Deployment complete!
echo ======================================
pause
