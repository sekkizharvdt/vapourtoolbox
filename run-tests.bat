@echo off
REM Simple E2E Test Runner for Windows
REM Assumes Firebase emulators and dev server are already running

cd apps\web
set SKIP_WEBSERVER=true
pnpm test:e2e %*
cd ..\..
