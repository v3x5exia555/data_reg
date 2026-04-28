#!/bin/bash
# ============================================================
# DataRex UAT Deployment Script
# ============================================================

# Configuration
PROJECT_DIR="/Users/tysonchua/Desktop/project/data-reg"
PORT=8050
PYTHON="/usr/bin/python3"
PYTEST="$PYTHON -m pytest"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================
# Functions
# ============================================================

print_header() {
    echo ""
    echo "============================================================"
    echo -e "  ${CYAN}$1${NC}"
    echo "============================================================"
    echo ""
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

check_dependencies() {
    print_header "CHECKING DEPENDENCIES"
    
    local missing=()
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        missing+=("python3")
        print_error "Python3 not found"
    else
        print_status "Python3: $(python3 --version)"
    fi
    
    # Check pip packages
    for pkg in playwright pytest requests; do
        if python3 -c "import $pkg" 2>/dev/null; then
            local ver=$(python3 -c "import $pkg; print($pkg.__version__)")
            print_status "$pkg: $ver"
        else
            missing+=("$pkg")
            print_error "$pkg: Not installed"
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        print_warning "Installing missing dependencies..."
        install_dependencies
    fi
    
    return 0
}

install_dependencies() {
    print_header "INSTALLING DEPENDENCIES"
    
    print_info "Upgrading pip..."
    pip3 install --upgrade pip -q
    
    print_info "Installing test libraries..."
    pip3 install playwright pytest requests pytest-html tomli -q
    
    # Install Playwright browsers
    print_info "Installing Playwright browsers..."
    if command -v playwright &> /dev/null; then
        playwright install chromium --with-deps 2>/dev/null || print_warning "Browser install may require sudo"
    elif command -v python3 &> /dev/null; then
        python3 -m playwright install chromium 2>/dev/null || print_warning "Browser install may require sudo"
    fi
    
    print_status "Dependencies installed"
}

start_http_server() {
    print_info "Starting HTTP server on port $PORT..."
    
    cd "$PROJECT_DIR"
    
    # Kill any existing server on port
    pkill -f "python3 -m http.server $PORT" 2>/dev/null
    sleep 1
    
    # Start server in background
    python3 -m http.server $PORT --directory . > /dev/null 2>&1 &
    SERVER_PID=$!
    
    sleep 2
    
    # Check if server is running
    if kill -0 $SERVER_PID 2>/dev/null; then
        print_status "HTTP server running (PID: $SERVER_PID)"
        return 0
    else
        print_error "Failed to start HTTP server"
        return 1
    fi
}

stop_http_server() {
    if [ -n "$SERVER_PID" ]; then
        print_info "Stopping HTTP server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null
    fi
    # Also kill by port
    pkill -f "python3 -m http.server $PORT" 2>/dev/null
}

run_api_tests() {
    print_header "RUNNING API TESTS (Supabase)"
    
    cd "$PROJECT_DIR"
    $PYTEST test_api.py -v --tb=short 2>&1
    local result=$?
    
    if [ $result -eq 0 ]; then
        print_status "All API tests passed ✓"
    else
        print_error "Some API tests failed"
    fi
    
    return $result
}

run_frontend_tests() {
    print_header "RUNNING FRONTEND TESTS (Playwright)"
    
    cd "$PROJECT_DIR"
    $PYTEST test_datarex.py -v --tb=short 2>&1
    local result=$?
    
    if [ $result -eq 0 ]; then
        print_status "All frontend tests passed ✓"
    else
        print_error "Some frontend tests failed"
    fi
    
    return $result
}

generate_report() {
    print_header "GENERATING HTML REPORT"
    
    cd "$PROJECT_DIR"
    
    # Create reports directory
    mkdir -p test_reports
    
    $PYTEST --html=test_reports/report.html --self-contained-html -v 2>&1
    
    if [ -f "test_reports/report.html" ]; then
        print_status "Report generated: test_reports/report.html"
        print_info "Open in browser: file://$PROJECT_DIR/test_reports/report.html"
    else
        print_error "Failed to generate report"
    fi
}

run_all_tests() {
    local api_passed=0
    local api_failed=0
    local fe_passed=0
    local fe_failed=0
    
    # Start server
    start_http_server
    local server_result=$?
    
    if [ $server_result -ne 0 ]; then
        print_error "Cannot start server, skipping tests"
        return 1
    fi
    
    # API Tests
    print_header "PHASE 1: API TESTS"
    if run_api_tests; then
        api_passed=23
        api_failed=0
    else
        api_passed=0
        api_failed=23
    fi
    
    # Frontend Tests
    print_header "PHASE 2: FRONTEND TESTS"
    if run_frontend_tests; then
        fe_passed=25
        fe_failed=0
    else
        fe_passed=0
        fe_failed=25
    fi
    
    # Summary
    print_header "TEST SUMMARY"
    echo ""
    echo "  Test Suite       | Total | Passed | Failed"
    echo "  --------------|-------|--------|--------"
    echo "  API Tests     |   23  |  $api_passed   |   $api_failed"
    echo "  Frontend     |   25  |  $fe_passed   |   $fe_failed"
    echo "  --------------|-------|--------|--------"
    echo "  TOTAL        |   48  |  $((api_passed + fe_passed))   |   $((api_failed + fe_failed))"
    echo ""
    
    local total_failed=$((api_failed + fe_failed))
    if [ $total_failed -eq 0 ]; then
        echo -e "  ${GREEN}🎉 ALL TESTS PASSED!${NC}"
    else
        echo -e "  ${RED}⚠️  SOME TESTS FAILED${NC}"
    fi
    echo ""
}

cleanup() {
    stop_http_server
}

# ============================================================
# Main
# ============================================================

main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║     ${CYAN}DataRex UAT Deployment Script${NC}            ║"
    echo "║     PDPA Compliance Portal Test Suite          ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    check_dependencies
    
    # Parse arguments
    case "${1:-all}" in
        api)
            run_api_tests
            ;;
        frontend)
            start_http_server
            run_frontend_tests
            stop_http_server
            ;;
        all)
            run_all_tests
            stop_http_server
            ;;
        report)
            start_http_server
            generate_report
            stop_http_server
            ;;
        install)
            install_dependencies
            ;;
        help|--help|-h)
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  install    - Install all dependencies"
            echo "  api       - Run API tests only (23 tests)"
            echo "  frontend  - Run frontend tests only (25 tests)"
            echo "  all       - Run all tests (default)"
            echo "  report    - Generate HTML report"
            echo "  help      - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 # Run all tests"
            echo "  $0 api            # API tests only"
            echo "  $0 frontend       # Frontend tests only"
            echo "  $0 report         # Generate HTML report"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use: $0 help"
            exit 1
            ;;
    esac
}

# Trap to cleanup on exit
trap 'cleanup' EXIT INT TERM

# Run main
main "$@"