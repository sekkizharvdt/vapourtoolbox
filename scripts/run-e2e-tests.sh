#!/bin/bash

# Playwright E2E Test Runner
# Automates the E2E test execution process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Default values
TEST_FILE=""
PROJECT="chromium"
SKIP_CLEANUP=false
KILL_SERVERS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --test-file)
      TEST_FILE="$2"
      shift 2
      ;;
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --skip-cleanup)
      SKIP_CLEANUP=true
      shift
      ;;
    --kill-servers)
      KILL_SERVERS=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --test-file FILE    Specific test file to run (optional)"
      echo "  --project PROJECT   Playwright project (chromium, firefox, webkit)"
      echo "  --skip-cleanup      Skip cleaning up processes after tests"
      echo "  --kill-servers      Kill existing servers before starting new ones"
      echo "  -h, --help          Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0"
      echo "  $0 --test-file 06-accounting-chart-of-accounts --project chromium"
      echo "  $0 --kill-servers"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Helper functions
print_step() {
  echo -e "\n${BLUE}🔵 $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Check if port is in use
is_port_in_use() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Get process ID on port
get_process_on_port() {
  local port=$1
  lsof -ti:$port 2>/dev/null
}

# Kill process on port
kill_process_on_port() {
  local port=$1
  local service_name=$2

  local pid=$(get_process_on_port $port)
  if [ -n "$pid" ]; then
    print_warning "$service_name is running on port $port (PID: $pid). Stopping..."
    kill -9 $pid 2>/dev/null || true
    sleep 2

    # Verify it's stopped
    if is_port_in_use $port; then
      print_error "Failed to stop process on port $port"
      return 1
    fi
    print_success "Stopped $service_name on port $port"
    return 0
  fi
  return 0
}

# Cleanup function
cleanup() {
  if [ "$SKIP_CLEANUP" = false ]; then
    print_step "Cleaning up background jobs..."

    if [ -n "$EMULATOR_PID" ]; then
      print_warning "Stopping Firebase emulators (PID: $EMULATOR_PID)..."
      kill $EMULATOR_PID 2>/dev/null || true
      wait $EMULATOR_PID 2>/dev/null || true
    fi

    if [ -n "$DEV_SERVER_PID" ]; then
      print_warning "Stopping dev server (PID: $DEV_SERVER_PID)..."
      kill $DEV_SERVER_PID 2>/dev/null || true
      wait $DEV_SERVER_PID 2>/dev/null || true
    fi

    print_success "Cleanup complete"
  else
    print_warning "Skipping cleanup - servers are still running"
    echo "To stop servers manually:"
    echo "  - Firebase emulators: kill $EMULATOR_PID"
    echo "  - Dev server: kill $DEV_SERVER_PID"
  fi
}

# Set up trap for cleanup
trap cleanup EXIT

# Main execution
echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Playwright E2E Test Runner                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

# Step 1: Clean up stuck processes if requested
if [ "$KILL_SERVERS" = true ]; then
  print_step "Cleaning up existing processes..."

  kill_process_on_port 8080 "Firestore Emulator"
  kill_process_on_port 9099 "Auth Emulator"
  kill_process_on_port 3001 "Next.js Dev Server"

  print_success "Cleanup complete"
fi

# Step 2: Start Firebase emulators
print_step "Starting Firebase emulators (auth + firestore)..."

EMULATOR_PID=""
if is_port_in_use 9099; then
  print_success "Firebase Auth emulator already running on port 9099"
  EMULATOR_PID=$(get_process_on_port 9099)
else
  # Start emulators in background
  firebase emulators:start --only auth,firestore > /tmp/firebase-emulator.log 2>&1 &
  EMULATOR_PID=$!

  # Wait for emulators to start (max 30 seconds)
  timeout=30
  elapsed=0
  while [ $elapsed -lt $timeout ]; do
    sleep 1
    elapsed=$((elapsed + 1))

    if is_port_in_use 9099; then
      print_success "Firebase emulators started successfully (PID: $EMULATOR_PID)"
      break
    fi

    # Check if process is still running
    if ! kill -0 $EMULATOR_PID 2>/dev/null; then
      print_error "Firebase emulators failed to start"
      cat /tmp/firebase-emulator.log
      exit 1
    fi
  done

  if ! is_port_in_use 9099; then
    print_error "Timeout waiting for Firebase emulators to start"
    cat /tmp/firebase-emulator.log
    exit 1
  fi
fi

# Step 3: Start Next.js dev server
print_step "Starting Next.js dev server..."

DEV_SERVER_PID=""
if is_port_in_use 3001; then
  print_success "Next.js dev server already running on port 3001"
  DEV_SERVER_PID=$(get_process_on_port 3001)
else
  # Start dev server in background
  cd apps/web
  pnpm dev > /tmp/dev-server.log 2>&1 &
  DEV_SERVER_PID=$!
  cd ../..

  # Wait for dev server to start (max 60 seconds)
  timeout=60
  elapsed=0
  while [ $elapsed -lt $timeout ]; do
    sleep 2
    elapsed=$((elapsed + 2))

    if is_port_in_use 3001; then
      print_success "Next.js dev server started successfully (PID: $DEV_SERVER_PID)"
      break
    fi

    # Check if process is still running
    if ! kill -0 $DEV_SERVER_PID 2>/dev/null; then
      print_error "Dev server failed to start"
      cat /tmp/dev-server.log
      exit 1
    fi
  done

  if ! is_port_in_use 3001; then
    print_error "Timeout waiting for dev server to start"
    cat /tmp/dev-server.log
    exit 1
  fi
fi

# Step 4: Wait a bit for everything to stabilize
print_step "Waiting for services to stabilize..."
sleep 5

# Step 5: Run Playwright tests
print_step "Running Playwright E2E tests..."

cd apps/web

test_command="pnpm test:e2e"
if [ -n "$TEST_FILE" ]; then
  test_command="$test_command $TEST_FILE"
fi
test_command="$test_command --project=$PROJECT"

echo "Command: $test_command"

# Set environment variable to skip webServer (we've already started everything)
export SKIP_WEBSERVER=true

# Run tests
set +e
eval $test_command
TEST_EXIT_CODE=$?
set -e

# Remove environment variable
unset SKIP_WEBSERVER

cd ../..

# Step 6: Report results
echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Test Results                                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  print_success "All tests passed!"
else
  print_error "Some tests failed (exit code: $TEST_EXIT_CODE)"
fi

echo ""
exit $TEST_EXIT_CODE
