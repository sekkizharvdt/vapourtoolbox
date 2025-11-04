#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run Playwright E2E tests with automated setup

.DESCRIPTION
    This script automates the E2E test execution process by:
    1. Cleaning up any stuck processes on required ports
    2. Starting Firebase emulators (if not running)
    3. Starting the Next.js dev server (if not running)
    4. Running Playwright E2E tests
    5. Optionally cleaning up processes after tests

.PARAMETER TestFile
    Specific test file to run (optional, runs all tests if not specified)

.PARAMETER Project
    Playwright project to run (chromium, firefox, webkit, etc.)

.PARAMETER SkipCleanup
    Skip cleaning up processes after tests complete

.PARAMETER KillServers
    Kill existing servers before starting new ones

.EXAMPLE
    .\scripts\run-e2e-tests.ps1
    Run all E2E tests with chromium

.EXAMPLE
    .\scripts\run-e2e-tests.ps1 -TestFile "06-accounting-chart-of-accounts" -Project "chromium"
    Run specific test file with chromium browser

.EXAMPLE
    .\scripts\run-e2e-tests.ps1 -KillServers
    Kill existing servers and start fresh
#>

param(
    [string]$TestFile = "",
    [string]$Project = "chromium",
    [switch]$SkipCleanup,
    [switch]$KillServers
)

$ErrorActionPreference = "Continue"

# Colors for output
function Write-Step {
    param([string]$Message)
    Write-Host "`n🔵 $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# Check if a port is in use
function Test-PortInUse {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Get process ID using a port
function Get-ProcessOnPort {
    param([int]$Port)

    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connection) {
        return $connection.OwningProcess
    }
    return $null
}

# Kill process on port
function Stop-ProcessOnPort {
    param([int]$Port, [string]$ServiceName)

    $pid = Get-ProcessOnPort -Port $Port
    if ($pid) {
        Write-Warning "$ServiceName is running on port $Port (PID: $pid). Stopping..."
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2

        # Verify it's stopped
        if (Test-PortInUse -Port $Port) {
            Write-Error "Failed to stop process on port $Port"
            return $false
        }
        Write-Success "Stopped $ServiceName on port $Port"
        return $true
    }
    return $false
}

# Start Firebase emulators in background
function Start-FirebaseEmulators {
    Write-Step "Starting Firebase emulators (auth + firestore)..."

    # Check if already running
    if (Test-PortInUse -Port 9099) {
        Write-Success "Firebase Auth emulator already running on port 9099"
        return $true
    }

    # Start emulators in background
    $job = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        firebase emulators:start --only auth,firestore 2>&1
    }

    # Wait for emulators to start (max 30 seconds)
    $timeout = 30
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++

        if (Test-PortInUse -Port 9099) {
            Write-Success "Firebase emulators started successfully"
            return $job
        }

        # Check if job failed
        if ($job.State -eq "Failed" -or $job.State -eq "Stopped") {
            Write-Error "Firebase emulators failed to start"
            Receive-Job -Job $job
            return $null
        }
    }

    Write-Error "Timeout waiting for Firebase emulators to start"
    Stop-Job -Job $job
    Remove-Job -Job $job
    return $null
}

# Start Next.js dev server in background
function Start-DevServer {
    Write-Step "Starting Next.js dev server..."

    # Check if already running
    if (Test-PortInUse -Port 3001) {
        Write-Success "Next.js dev server already running on port 3001"
        return $true
    }

    # Start dev server in background
    $job = Start-Job -ScriptBlock {
        Set-Location $using:PWD
        cd apps/web
        pnpm dev 2>&1
    }

    # Wait for dev server to start (max 60 seconds)
    $timeout = 60
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $elapsed += 2

        if (Test-PortInUse -Port 3001) {
            Write-Success "Next.js dev server started successfully"
            return $job
        }

        # Check if job failed
        if ($job.State -eq "Failed" -or $job.State -eq "Stopped") {
            Write-Error "Dev server failed to start"
            Receive-Job -Job $job
            return $null
        }
    }

    Write-Error "Timeout waiting for dev server to start"
    Stop-Job -Job $job
    Remove-Job -Job $job
    return $null
}

# Main execution
Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Playwright E2E Test Runner                              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Step 1: Clean up stuck processes if requested
if ($KillServers) {
    Write-Step "Cleaning up existing processes..."

    Stop-ProcessOnPort -Port 8080 -ServiceName "Firestore Emulator"
    Stop-ProcessOnPort -Port 9099 -ServiceName "Auth Emulator"
    Stop-ProcessOnPort -Port 3001 -ServiceName "Next.js Dev Server"

    Write-Success "Cleanup complete"
}

# Step 2: Start Firebase emulators
$emulatorJob = Start-FirebaseEmulators
if (-not $emulatorJob -and -not (Test-PortInUse -Port 9099)) {
    Write-Error "Failed to start Firebase emulators. Exiting."
    exit 1
}

# Step 3: Start Next.js dev server
$devServerJob = Start-DevServer
if (-not $devServerJob -and -not (Test-PortInUse -Port 3001)) {
    Write-Error "Failed to start dev server. Exiting."

    # Clean up emulator job
    if ($emulatorJob) {
        Stop-Job -Job $emulatorJob
        Remove-Job -Job $emulatorJob
    }
    exit 1
}

# Step 4: Wait a bit for everything to stabilize
Write-Step "Waiting for services to stabilize..."
Start-Sleep -Seconds 5

# Step 5: Run Playwright tests
Write-Step "Running Playwright E2E tests..."

cd apps/web

$testCommand = "pnpm test:e2e"
if ($TestFile) {
    $testCommand += " $TestFile"
}
$testCommand += " --project=$Project"

Write-Host "Command: $testCommand" -ForegroundColor Gray

# Set environment variable to skip webServer (we've already started everything)
$env:SKIP_WEBSERVER = "true"

# Run tests
Invoke-Expression $testCommand
$testExitCode = $LASTEXITCODE

# Remove environment variable
Remove-Item Env:SKIP_WEBSERVER -ErrorAction SilentlyContinue

cd ../..

# Step 6: Report results
Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Test Results                                            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

if ($testExitCode -eq 0) {
    Write-Success "All tests passed!"
} else {
    Write-Error "Some tests failed (exit code: $testExitCode)"
}

# Step 7: Cleanup (optional)
if (-not $SkipCleanup) {
    Write-Step "Cleaning up background jobs..."

    if ($emulatorJob -and $emulatorJob.GetType().Name -eq "PSRemotingJob") {
        Write-Host "Stopping Firebase emulators..."
        Stop-Job -Job $emulatorJob -ErrorAction SilentlyContinue
        Remove-Job -Job $emulatorJob -ErrorAction SilentlyContinue
    }

    if ($devServerJob -and $devServerJob.GetType().Name -eq "PSRemotingJob") {
        Write-Host "Stopping dev server..."
        Stop-Job -Job $devServerJob -ErrorAction SilentlyContinue
        Remove-Job -Job $devServerJob -ErrorAction SilentlyContinue
    }

    Write-Success "Cleanup complete"
} else {
    Write-Warning "Skipping cleanup - servers are still running"
    Write-Host "To stop servers manually:" -ForegroundColor Gray
    Write-Host "  - Firebase emulators on port 9099" -ForegroundColor Gray
    Write-Host "  - Dev server on port 3001" -ForegroundColor Gray
}

Write-Host ""
exit $testExitCode
