"""
DataRex PDPA Compliance Portal - Sample Data Module Test Suite
Verifies js/sample_data.js exposes the SAMPLE_DATA dictionary and the
13 seed*ToSupabase functions consumed by loadAllSampleData().
Run: pytest test_sample_data.py -v --tb=short
"""

import os
import re
import threading
import time
import pytest
from http.server import SimpleHTTPRequestHandler
import socketserver
from playwright.sync_api import sync_playwright


# ============================================================
# CONFIGURATION
# ============================================================
PORT = 8063
BASE_URL = f"http://localhost:{PORT}"
PROJECT_DIR = "/Users/tysonchua/Desktop/project/data-reg"
SAMPLE_DATA_JS = os.path.join(PROJECT_DIR, "js", "sample_data.js")
APP_JS = os.path.join(PROJECT_DIR, "js", "app.js")
INDEX_HTML = os.path.join(PROJECT_DIR, "index.html")

# Tables that get sample data populated (per-company / per-org).
EXPECTED_TABLES = [
    "data_records",
    "processing_activities",
    "data_requests",
    "breach_log",
    "dpia_assessments",
    "cross_border_transfers",
    "vendors",
    "training_records",
    "alerts",
    "cases",
    "team_members",
    "dpo",
    "documents",
]

# Each table must expose a window.seed<TableCamel>ToSupabase(companyId).
EXPECTED_SEED_FUNCTIONS = [
    "seedDataRecordsToSupabase",
    "seedProcessingActivitiesToSupabase",
    "seedDataRequestsToSupabase",
    "seedBreachLogToSupabase",
    "seedDPIAToSupabase",
    "seedCrossBorderToSupabase",
    "seedVendorsToSupabase",
    "seedTrainingToSupabase",
    "seedAlertsToSupabase",
    "seedCasesToSupabase",
    "seedTeamMembersToSupabase",
    "seedDPOToSupabase",
    "seedDocumentsToSupabase",
]


# ============================================================
# HTTP SERVER FIXTURE (mirrors test_datarex.py convention)
# ============================================================
class QuietHTTPHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_http_server(port=PORT, directory=PROJECT_DIR):
    os.chdir(directory)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), QuietHTTPHandler) as httpd:
        httpd.serve_forever()


@pytest.fixture(scope="session")
def http_server():
    print(f"\nStarting HTTP server on port {PORT}...")
    server_thread = threading.Thread(target=start_http_server, daemon=True)
    server_thread.start()
    time.sleep(2)
    print(f"HTTP server running at {BASE_URL}")
    yield


@pytest.fixture(scope="session")
def browser(http_server):
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()
        yield page
        context.close()
        browser.close()


@pytest.fixture
def fresh_page(browser):
    browser.goto(BASE_URL + "/index.html")
    browser.evaluate("localStorage.clear()")
    browser.reload()
    browser.wait_for_timeout(1500)
    yield browser


# ============================================================
# Helpers
# ============================================================
def read_file(path):
    with open(path, "r") as f:
        return f.read()


# ============================================================
# Test 1: js/sample_data.js exists
# ============================================================
def test_sample_data_module_file_exists():
    """js/sample_data.js must exist as a dedicated module file."""
    assert os.path.isfile(SAMPLE_DATA_JS), (
        "Expected js/sample_data.js to exist; got missing file"
    )
    print("Sample data module file exists")


# ============================================================
# Test 2: index.html loads sample_data.js
# ============================================================
def test_index_html_loads_sample_data_module():
    """index.html must <script src> sample_data.js so it's available globally."""
    html = read_file(INDEX_HTML)
    assert re.search(r'src=["\']js/sample_data\.js', html), (
        "index.html must include <script src=\"js/sample_data.js\">"
    )
    print("index.html loads sample_data.js")


# ============================================================
# Test 3: SAMPLE_DATA dictionary covers all expected tables
# ============================================================
def test_sample_data_dict_covers_all_tables(fresh_page):
    """window.SAMPLE_DATA must be defined and contain every expected table key."""
    page = fresh_page
    keys = page.evaluate(
        "() => window.SAMPLE_DATA ? Object.keys(window.SAMPLE_DATA) : null"
    )
    assert keys is not None, "window.SAMPLE_DATA must be defined"
    missing = [t for t in EXPECTED_TABLES if t not in keys]
    assert not missing, f"SAMPLE_DATA is missing tables: {missing}"
    print(f"SAMPLE_DATA covers all {len(EXPECTED_TABLES)} expected tables")


# ============================================================
# Test 4: each table has at least 2 sample rows
# ============================================================
def test_sample_data_each_table_has_rows(fresh_page):
    """Every table in SAMPLE_DATA must have at least 2 demo rows."""
    page = fresh_page
    counts = page.evaluate(
        """() => {
          if (!window.SAMPLE_DATA) return null;
          const result = {};
          for (const k of Object.keys(window.SAMPLE_DATA)) {
            const v = window.SAMPLE_DATA[k];
            result[k] = Array.isArray(v) ? v.length : -1;
          }
          return result;
        }"""
    )
    assert counts is not None, "SAMPLE_DATA must be defined"
    too_few = {k: n for k, n in counts.items() if n < 2}
    assert not too_few, f"Tables with fewer than 2 sample rows: {too_few}"
    print(f"All {len(counts)} tables have >=2 sample rows")


# ============================================================
# Test 5: every seed function is exposed on window
# ============================================================
def test_all_seed_functions_exposed_on_window(fresh_page):
    """Each expected seed function must be present on window as a function."""
    page = fresh_page
    missing = page.evaluate(
        f"""() => {{
          const expected = {EXPECTED_SEED_FUNCTIONS};
          return expected.filter(name => typeof window[name] !== 'function');
        }}"""
    )
    assert not missing, f"Missing seed functions on window: {missing}"
    print(f"All {len(EXPECTED_SEED_FUNCTIONS)} seed functions exposed on window")


# ============================================================
# Test 6: loadAllSampleData calls every seed function
# ============================================================
def test_loadAllSampleData_calls_every_seed_function():
    """loadAllSampleData in app.js must call each of the 13 seed functions."""
    source = read_file(APP_JS)
    match = re.search(
        r"async\s+function\s+loadAllSampleData\s*\([^)]*\)\s*\{(.*?)\n\}\s*\n",
        source,
        re.DOTALL,
    )
    assert match, "loadAllSampleData function must exist in app.js"
    body = match.group(1)
    missing = [name for name in EXPECTED_SEED_FUNCTIONS if name not in body]
    assert not missing, f"loadAllSampleData is missing calls to: {missing}"
    print("loadAllSampleData calls every seed function")
