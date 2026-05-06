"""
DataRex PDPA Compliance Portal - Critical Security Test Suite
Verifies the 6 Critical fixes from the code review on the
feature/modular-shift-restoration branch.
Run: pytest test_security_critical.py -v --tb=short
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
PORT = 8061
BASE_URL = f"http://localhost:{PORT}"
PROJECT_DIR = "/Users/tysonchua/Desktop/project/data-reg"
APP_JS_PATH = os.path.join(PROJECT_DIR, "js", "app.js")
ENV_JS_PATH = os.path.join(PROJECT_DIR, "js", "env.js")
APP_CREDENTIALS_MIGRATION = os.path.join(
    PROJECT_DIR, "supabase", "migrations", "20260427000004_app_credentials.sql"
)


# ============================================================
# HTTP SERVER FIXTURE (mirrors test_datarex.py convention)
# ============================================================
class QuietHTTPHandler(SimpleHTTPRequestHandler):
    """Silent HTTP handler to reduce console noise."""
    def log_message(self, format, *args):
        pass


def start_http_server(port=PORT, directory=PROJECT_DIR):
    """Start HTTP server in background thread."""
    os.chdir(directory)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), QuietHTTPHandler) as httpd:
        httpd.serve_forever()


@pytest.fixture(scope="session")
def http_server():
    """Start HTTP server for serving index.html."""
    print(f"\nStarting HTTP server on port {PORT}...")
    server_thread = threading.Thread(target=start_http_server, daemon=True)
    server_thread.start()
    time.sleep(2)
    print(f"HTTP server running at {BASE_URL}")
    yield


@pytest.fixture(scope="session")
def browser(http_server):
    """Launch Playwright browser for all tests."""
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled']
        )
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()
        yield page
        context.close()
        browser.close()


@pytest.fixture
def fresh_page(browser):
    """Fresh page for each test - clear state and reload."""
    browser.goto(BASE_URL + "/index.html")
    browser.evaluate("localStorage.clear()")
    browser.reload()
    browser.wait_for_timeout(1500)
    yield browser


# ============================================================
# HELPER: read source files
# ============================================================
def read_file(path):
    with open(path, "r") as f:
        return f.read()


def strip_line_comments(source):
    """Remove `// ...` line comments to avoid false positives in static checks."""
    out = []
    for line in source.split("\n"):
        if line.strip().startswith("//"):
            continue
        # Strip trailing line comments — naive but adequate for these checks
        idx = line.find("//")
        if idx >= 0:
            # Skip lines where the // is inside a string literal
            before = line[:idx]
            if before.count("'") % 2 == 0 and before.count('"') % 2 == 0:
                line = line[:idx]
        out.append(line)
    return "\n".join(out)


# ============================================================
# CRITICAL 1: Passwords must not be stored as plaintext
# ============================================================
def test_critical_1_register_does_not_store_plaintext_password_literal():
    """Critical 1a: doRegister source must not push `password: pw` raw."""
    source = read_file(APP_JS_PATH)
    code = strip_line_comments(source)

    # The original line was: users.push({ name, company, email, password: pw, industry, size, regNo });
    # After fix it must use a hashed value (e.g. password: pwHash) — never `password: pw`.
    bad = re.search(r"users\.push\s*\(\s*\{[^}]*\bpassword\s*:\s*pw\b", code)
    assert bad is None, (
        "doRegister must NOT store raw `password: pw` in localStorage. "
        "Hash the password before persisting."
    )
    print("Critical 1a: doRegister no longer stores raw password literal")


def test_critical_1_login_localstorage_fallback_does_not_compare_raw_password():
    """Critical 1b: doLogin localStorage fallback must not compare `u.password === pw` raw."""
    source = read_file(APP_JS_PATH)
    code = strip_line_comments(source)

    bad = re.search(r"u\.password\s*===\s*pw\b", code)
    assert bad is None, (
        "doLogin localStorage fallback must NOT compare raw passwords. "
        "Hash the input and compare against the stored hash."
    )
    print("Critical 1b: doLogin no longer compares raw passwords")


def test_critical_1_hash_helper_available_in_browser(fresh_page):
    """Critical 1c: window.hashPasswordForStorage must exist and return SHA-256 hex."""
    page = fresh_page
    result = page.evaluate(
        "async () => {"
        "  if (typeof window.hashPasswordForStorage !== 'function') return null;"
        "  return await window.hashPasswordForStorage('TestPass123!@#');"
        "}"
    )
    assert result is not None, "window.hashPasswordForStorage must be defined"
    assert result != "TestPass123!@#", "Hash output must differ from input"
    assert re.fullmatch(r"[0-9a-f]{64}", result), (
        f"Hash output must be 64-char SHA-256 hex; got {result!r}"
    )
    print("Critical 1c: hashPasswordForStorage returns SHA-256 hex")


# ============================================================
# CRITICAL 2: No hardcoded Supabase anon key in application code
# ============================================================
def test_critical_2_no_hardcoded_supabase_key_in_app_js():
    """Critical 2: app.js must not contain a literal Supabase anon key."""
    source = read_file(APP_JS_PATH)
    leaks = re.findall(r"sb_publishable_[A-Za-z0-9_]+", source)
    assert not leaks, (
        f"app.js must not contain hardcoded Supabase anon key. Found: {leaks}"
    )
    print("Critical 2: No hardcoded Supabase anon key in app.js")


# ============================================================
# CRITICAL 3: app_credentials must not expose passwords via public RLS
# ============================================================
def test_critical_3_app_credentials_no_public_select_policy():
    """Critical 3a: Migration must not CREATE a public SELECT policy on app_credentials."""
    sql = read_file(APP_CREDENTIALS_MIGRATION)
    # Reject any CREATE POLICY statement that grants SELECT without a tenant
    # predicate. DROP POLICY references are fine (they remove legacy policies).
    create_public_read = re.search(
        r"CREATE\s+POLICY\s+[^\n;]*\"Public read active credentials\"",
        sql,
        re.IGNORECASE,
    )
    assert create_public_read is None, (
        "Migration must NOT CREATE `Public read active credentials` policy"
    )
    assert not re.search(
        r"FOR\s+SELECT\s+USING\s*\(\s*is_active",
        sql,
        re.IGNORECASE,
    ), "Permissive `FOR SELECT USING (is_active = TRUE)` policy must not be created"
    print("Critical 3a: app_credentials has no public SELECT policy")


def test_critical_3_app_credentials_no_plaintext_seed():
    """Critical 3b: Migration must not seed plaintext password 'Admin123!@#'."""
    sql = read_file(APP_CREDENTIALS_MIGRATION)
    assert "Admin123!@#" not in sql, (
        "Migration must NOT seed plaintext password 'Admin123!@#'"
    )
    print("Critical 3b: No plaintext password seeded in migration")


# ============================================================
# CRITICAL 4: eval() must not be used to execute fetched scripts
# ============================================================
def test_critical_4_no_eval_in_app_js():
    """Critical 4: app.js must not call eval()."""
    source = read_file(APP_JS_PATH)
    code = strip_line_comments(source)
    assert "eval(" not in code, (
        "app.js must not call eval(). Use a named init-function lookup instead."
    )
    print("Critical 4: No eval() in app.js")


# ============================================================
# CRITICAL 5: switchOrg must reload all org-scoped data
# ============================================================
def test_critical_5_switchorg_reloads_all_org_scoped_modules():
    """Critical 5: switchOrg body must call DPO, Vendor, Training, Activities loaders."""
    source = read_file(APP_JS_PATH)

    match = re.search(
        r"function\s+switchOrg\s*\([^)]*\)\s*\{(.*?)\n\}\s*\n",
        source,
        re.DOTALL,
    )
    assert match, "switchOrg function must exist in app.js"
    body = match.group(1)

    required = [
        "loadDPOFromSupabase",
        "loadVendorsFromSupabase",
        "loadTrainingFromSupabase",
        "loadActivitiesFromSupabase",
    ]
    missing = [name for name in required if name not in body]
    assert not missing, f"switchOrg is missing reload calls: {missing}"
    print("Critical 5: switchOrg reloads all org-scoped modules")


# ============================================================
# CRITICAL 6: data_records must use the real user_id, not a hardcoded UUID
# ============================================================
def test_critical_6_no_hardcoded_demo_uuid_for_data_records():
    """Critical 6: app.js must not assign hardcoded demoUserId for data_records ops."""
    source = read_file(APP_JS_PATH)
    pattern = re.compile(
        r"const\s+demoUserId\s*=\s*['\"]00000000-0000-0000-0000-000000000001['\"]"
    )
    matches = pattern.findall(source)
    assert not matches, (
        f"app.js must not assign hardcoded demoUserId for data_records. "
        f"Found {len(matches)} occurrence(s)."
    )
    print("Critical 6: No hardcoded demoUserId assignments in app.js")
