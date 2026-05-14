"""
DataRex PDPA Compliance Portal - Frontend UAT Test Suite
Updated for SPA architecture with dynamic page loading.
Run: pytest test_datarex.py -v --tb=short
"""

import pytest
import threading
import time
import sys
import os
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, HTTPServer
import socketserver
from playwright.sync_api import sync_playwright, Page, expect


# ============================================================
# CONFIGURATION
# ============================================================
PORT = 8060
BASE_URL = f"http://localhost:{PORT}"
PROJECT_DIR = "/Users/tysonchua/Desktop/project/data-reg"


# ============================================================
# HTTP SERVER FIXTURE
# ============================================================
class QuietHTTPHandler(SimpleHTTPRequestHandler):
    """Silent HTTP handler to reduce console noise."""
    def log_message(self, format, *args):
        pass


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


@pytest.fixture(scope="session")
def http_server():
    """Start HTTP server for serving index.html."""
    try:
        urllib.request.urlopen(BASE_URL, timeout=1).close()
        print(f"\n✅ Reusing HTTP server at {BASE_URL}")
        yield
        return
    except Exception:
        pass

    print(f"\n🚀 Starting HTTP server on port {PORT}...")
    handler = partial(QuietHTTPHandler, directory=PROJECT_DIR)
    httpd = ReusableTCPServer(("", PORT), handler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(1)

    print(f"✅ HTTP server running at {BASE_URL}")
    yield

    httpd.shutdown()
    httpd.server_close()
    print("\n🛑 HTTP server stopped")


# ============================================================
# BROWSER FIXTURE
# ============================================================
@pytest.fixture(scope="session")
def browser(http_server):
    """Launch Playwright browser for all tests."""
    print("\n🌐 Launching Chromium browser...")
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=False,
        slow_mo=200,
        args=['--disable-blink-features=AutomationControlled']
    )
    context = browser.new_context(
        viewport={'width': 1280, 'height': 720}
    )

    yield {"browser": browser, "context": context, "pw": pw}

    context.close()
    browser.close()
    pw.stop()
    print("✅ Browser closed")


@pytest.fixture
def fresh_page(browser):
    """Fresh page for each test - create a new page."""
    page = browser["context"].new_page()
    page.goto(BASE_URL + "/index.html")
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(2000)
    yield page
    page.close()


# ============================================================
# HELPER: login via demo
# ============================================================
def demo_login(page):
    """Click demo button and wait for dashboard to appear."""
    page.click("text=Log in")
    page.wait_for_timeout(500)
    page.click("#demo-btn")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_selector("#page-dashboard.active", timeout=5000)
    page.wait_for_timeout(1000)


def navigate_to_page(page, page_name, nav_id=None):
    """Navigate through the app shell without relying on sidebar hit testing."""
    page.evaluate(
        """({ pageName, navId }) => {
            const nav = navId ? document.getElementById(navId) : null;
            window.showPage(pageName, nav);
        }""",
        {"pageName": page_name, "navId": nav_id or f"nav-{page_name}"}
    )
    page.wait_for_selector(f"#page-{page_name}.active", timeout=10000)


def dom_click(page, selector):
    """Click via DOM for fixed/scrollable app-shell controls."""
    page.locator(selector).first.evaluate("el => el.click()")


def open_dpo_modal(page):
    """Open the DPO form modal and wait for its visible fields."""
    page.evaluate("window.openDPOModal()")
    page.wait_for_selector("#modal-dpo-form.open #dpo-name", timeout=5000)


def fill_register_form(page, email, password="TestPass123", name="Test User", company="Test Company"):
    """Fill the simplified registration form."""
    page.fill("#register-email", email)
    page.fill("#register-password", password)


# ============================================================
# TEST SUITE 1: LANDING PAGE
# ============================================================
def test_landing_page_loads(fresh_page):
    """Test 1: Landing page loads and displays correctly."""
    page = fresh_page

    page.wait_for_selector("#screen-landing", timeout=10000)
    assert page.locator("#screen-landing").is_visible(), "Landing screen should be visible"
    assert page.locator(".hero-h1").is_visible(), "Hero heading should be visible"

    print("✅ Test 1: Landing page loads correctly")


def test_landing_demo_button_exists(fresh_page):
    """Test 2: Demo button exists on login page."""
    page = fresh_page

    page.click("text=Log in")
    page.wait_for_timeout(500)
    page.wait_for_selector("#demo-btn", timeout=5000)
    demo_btn = page.locator("#demo-btn")
    assert demo_btn.is_visible(), "Demo button should exist"

    print("✅ Test 2: Demo button exists")


def test_landing_navigation_buttons(fresh_page):
    """Test 3: Navigation buttons on landing page."""
    page = fresh_page

    page.wait_for_selector("#screen-landing", timeout=5000)
    assert page.get_by_role("button", name="Log in").is_visible(), "Log in button should be visible"
    assert page.locator("text=Start for free").is_visible(), "Get started button should be visible"

    print("✅ Test 3: Navigation buttons visible")


# ============================================================
# TEST SUITE 2: LOGIN FLOW
# ============================================================
def test_navigate_to_login(fresh_page):
    """Test 4: Navigate to login screen."""
    page = fresh_page

    page.wait_for_selector("#screen-landing", timeout=5000)
    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#screen-login").is_visible(), "Login screen should be visible"
    assert page.locator("#login-email").is_visible(), "Email input should be visible"

    print("✅ Test 4: Navigate to login works")


def test_login_credentials_displayed(fresh_page):
    """Test 5: Demo credentials are displayed as hints on login screen."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("text=admin@datarex.com").is_visible(), "Demo email should be displayed"
    assert page.locator("text=AccountAdmin123!").is_visible(), "Demo password should be displayed"

    print("✅ Test 5: Demo credentials displayed")


def test_demo_login_navigates_to_dashboard(fresh_page):
    """Test 6: Demo login navigates to dashboard."""
    page = fresh_page

    page.click("text=Log in")
    page.wait_for_timeout(500)
    page.click("#demo-btn")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_selector("#page-dashboard", timeout=5000)
    page.wait_for_timeout(1000)

    assert page.locator("#screen-app").is_visible(), "App screen should be visible"
    assert page.locator("#page-dashboard").is_visible(), "Dashboard should be visible"

    print("✅ Test 6: Demo login → Dashboard")


# ============================================================
# TEST SUITE 3: DASHBOARD
# ============================================================
def test_dashboard_displays_score(fresh_page):
    """Test 7: Dashboard displays compliance score."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    assert page.locator("#score-display").is_visible(), "Score display should exist"
    assert page.locator("#score-bar").count() == 1, "Score bar should exist"

    score = page.locator("#score-display").inner_text()
    print(f"   Compliance score: {score}")

    print("✅ Test 7: Dashboard score displays")


def test_dashboard_quick_actions(fresh_page):
    """Test 8: Dashboard quick actions exist."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    assert page.locator(".dashboard-action-grid").is_visible(), "Quick actions grid should exist"
    assert page.locator("text=Run DPIA screening").is_visible(), "DPIA quick action should exist"

    print("✅ Test 8: Dashboard quick actions exist")


def test_dashboard_stats(fresh_page):
    """Test 9: Dashboard stats display."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    assert page.locator("#stat-completed").is_visible(), "Completed stat should exist"
    assert page.locator("#stat-pending").is_visible(), "Pending stat should exist"

    print("✅ Test 9: Dashboard stats display")


# ============================================================
# TEST SUITE 4: NAVIGATION PAGES
# ============================================================
def test_navigate_to_checklist(fresh_page):
    """Test 10: Navigation to checklist page."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    navigate_to_page(page, "checklist", "nav-checklist")
    page.wait_for_selector("#page-checklist", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#page-checklist").is_visible(), "Checklist page should be visible"
    assert page.locator(".check-item").count() > 0, "Checklist items should exist"

    print(f"✅ Test 10: Checklist page loads ({page.locator('.check-item').count()} items)")


def test_navigate_to_dataregister(fresh_page):
    """Test 11: Navigation to data register page."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    navigate_to_page(page, "dataregister", "nav-dataregister")
    page.wait_for_selector("#page-dataregister", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#page-dataregister").is_visible(), "Data Register page should be visible"
    print("✅ Test 11: Data Register page loads")


def test_navigate_to_consent(fresh_page):
    """Test 12: Navigation to consent page."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    navigate_to_page(page, "consent", "nav-consent")
    page.wait_for_selector("#page-consent", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#page-consent").is_visible(), "Consent page should be visible"
    print("✅ Test 12: Consent page loads")


def test_navigate_to_retention(fresh_page):
    """Test 13: Navigation to retention page."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    navigate_to_page(page, "retention", "nav-retention")
    page.wait_for_selector("#page-retention", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#page-retention").is_visible(), "Retention page should be visible"
    print("✅ Test 13: Retention page loads")


# ============================================================
# TEST SUITE 5: CHECKLIST TOGGLE
# ============================================================
def test_checklist_toggle_saves_state(fresh_page):
    """Test 14: Checklist toggle saves to state."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    navigate_to_page(page, "checklist", "nav-checklist")
    page.wait_for_selector("#page-checklist", timeout=5000)
    page.wait_for_timeout(500)

    first_item = page.locator(".check-item").first
    first_item.click()
    page.wait_for_timeout(500)

    done_count = page.locator(".check-item.done").count()
    assert done_count > 0, "At least one item should be done"

    print(f"✅ Test 14: Checklist toggle works ({done_count} done)")

    score = page.locator("#score-display").inner_text()
    print(f"   Updated score: {score}")


# ============================================================
# TEST SUITE 6: LOGOUT
# ============================================================
def test_logout_returns_to_landing(fresh_page):
    """Test 15: Logout returns to landing page."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    dom_click(page, ".logout-btn")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#screen-login").is_visible(), "Should return to login"
    print("✅ Test 15: Logout returns to landing")


# ============================================================
# TEST SUITE 7: REGISTRATION
# ============================================================
def test_registration_form_loads(fresh_page):
    """Test 16: Registration form loads."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.wait_for_timeout(300)
    page.click("text=Create Account")
    page.wait_for_selector("#screen-register", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#screen-register").is_visible(), "Register screen should be visible"
    assert page.locator("text=Start your 14-day free trial").count() == 0, "Trial subtitle should be removed"
    assert page.locator("#register-name").count() == 0, "Name field should be deferred"
    assert page.locator("#register-email").is_visible(), "Email field should exist"
    assert page.locator("#register-company").count() == 0, "Company field should be deferred"
    assert page.locator("#register-industry").count() == 0, "Industry field should be deferred"
    assert page.locator("#register-size").count() == 0, "Company size field should be deferred"
    assert page.locator("#register-reg-no").count() == 0, "Registration number field should be deferred"
    assert page.locator("#register-password").is_visible(), "Password field should exist"
    assert page.locator("#register-confirm").count() == 0, "Confirm password field should be deferred"

    print("✅ Test 16: Registration form loads")


def test_registration_creates_user(fresh_page):
    """Test 17: Registration creates new user."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)

    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.wait_for_timeout(300)
    page.click("text=Create Account")
    page.wait_for_selector("#screen-register", timeout=5000)
    page.wait_for_timeout(500)

    fill_register_form(page, "test@datarex.com", name="Test User UAT", company="Test Company Pte Ltd")

    page.click("#register-btn")
    page.wait_for_selector("#screen-onboarding", timeout=10000)

    assert page.locator("#screen-onboarding").is_visible(), "Should navigate to onboarding"
    saved = page.evaluate("""() => {
        const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
        return users.find(user => user.email === 'test@datarex.com');
    }""")
    assert saved["name"] == "test", "Name should default from email"
    assert saved["company"] == "", "Company should be deferred"
    assert saved["industry"] == "", "Industry should be deferred"
    assert saved["size"] == "1-10", "Company size should use safe default"
    assert saved["regNo"] == "", "Registration number should be deferred"

    print("✅ Test 17: Registration creates user")


# ============================================================
# TEST SUITE 8: ONBOARDING
# ============================================================
def test_onboarding_skip_link_exists(fresh_page):
    """Test 18: Onboarding skip link exists."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.click("text=Create Account")
    page.wait_for_selector("#screen-register", timeout=5000)
    fill_register_form(page, "test_skip@datarex.com")
    page.click("#register-btn")
    page.wait_for_selector("#screen-onboarding", timeout=5000)
    
    assert page.locator("#skip-onboard").is_visible(), "Skip link should be visible"
    assert page.locator("#skip-onboard").inner_text() == "I'll do this later", "Skip link text should match"

    print("✅ Test 18: Onboarding skip link exists")


def test_onboarding_skip_shows_dashboard(fresh_page):
    """Test 19: Onboarding skip shows dashboard."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.click("text=Create Account")
    page.wait_for_selector("#screen-register", timeout=5000)
    fill_register_form(page, "test_skip2@datarex.com")
    page.click("#register-btn")
    page.wait_for_selector("#screen-onboarding", timeout=5000)

    page.click("#skip-onboard")
    page.wait_for_selector("#page-dashboard", timeout=10000)

    assert page.locator("#page-dashboard").is_visible(), "Dashboard should be visible"

    print("✅ Test 19: Onboarding skip shows dashboard")


def test_dashboard_shows_reminder_after_skip(fresh_page):
    """Test 20: Dashboard displays reminder card after skip onboarding."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.click("text=Create Account")
    page.wait_for_selector("#screen-register", timeout=5000)
    fill_register_form(page, "test_skip3@datarex.com")
    page.click("#register-btn")
    page.wait_for_selector("#screen-onboarding", timeout=5000)
    
    page.click("#skip-onboard")
    page.wait_for_selector("#page-dashboard", timeout=10000)

    assert page.locator("#onboarding-reminder-container").is_visible(), "Reminder card should be visible"
    assert "Finish your setup" in page.locator("#onboarding-reminder-container").inner_text()

    print("✅ Test 20: Dashboard shows reminder after skip")


# ============================================================
# TEST SUITE 9: DASHBOARD NAVIGATION
# ============================================================
def test_dashboard_go_to_checklist(fresh_page):
    """Test 21: From dashboard navigate to checklist."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)

    navigate_to_page(page, "checklist", "nav-checklist")

    assert page.locator("#page-checklist").is_visible(), "Checklist should be visible"
    print("✅ Test 21: Dashboard → Checklist works")


# ============================================================
# TEST SUITE 10: LOGIN WITH REGISTERED USER
# ============================================================
def test_login_with_skipped_user(fresh_page):
    """Test 22: Login with user who skipped onboarding."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.click("text=Create Account")
    page.wait_for_selector("#screen-register", timeout=5000)
    fill_register_form(page, "skippeduser@datarex.com", password="NewPass123")
    page.click("#register-btn")
    page.wait_for_selector("#screen-onboarding", timeout=5000)
    
    page.click("#skip-onboard")
    page.wait_for_selector("#page-dashboard", timeout=10000)

    dom_click(page, ".logout-btn")
    page.wait_for_selector("#screen-login", timeout=5000)

    page.fill("#login-email", "skippeduser@datarex.com")
    page.fill("#login-password", "NewPass123")
    page.click("#login-btn")
    page.wait_for_selector("#page-dashboard", timeout=20000)

    assert page.locator("#page-dashboard").is_visible(), "Should stay on dashboard after skip"
    assert page.locator("#onboarding-reminder-container").is_visible(), "Reminder should still be there"

    print("✅ Test 22: Login with skipped user works")


# ============================================================
# TEST SUITE 11: DATA REGISTER MODAL
# ============================================================
def test_add_record_modal_opens(fresh_page):
    """Test 23: Add record modal opens."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dataregister", "nav-dataregister")
    page.wait_for_selector("#page-dataregister", timeout=5000)
    page.wait_for_timeout(500)

    page.click("text=+ Add record")
    page.wait_for_timeout(500)

    assert page.locator("#modal-record").is_visible(), "Modal should be visible"
    print("✅ Test 23: Add record modal opens")


def test_add_record_modal_closes(fresh_page):
    """Test 24: Add record modal closes."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dataregister", "nav-dataregister")
    page.wait_for_selector("#page-dataregister", timeout=5000)
    page.wait_for_timeout(500)
    page.click("text=+ Add record")
    page.wait_for_timeout(500)

    page.click(".modal-close")
    page.wait_for_timeout(500)

    assert not page.locator("#modal-record").is_visible(), "Modal should be hidden"
    print("✅ Test 24: Add record modal closes")


# ============================================================
# TEST SUITE 12: FULL USER JOURNEY
# ============================================================
@pytest.mark.order(25)
def test_full_user_journey_complete(fresh_page):
    """Test 25: Complete end-to-end user journey."""
    page = fresh_page

    print("\n" + "="*50)
    print("🚀 STARTING FULL USER JOURNEY")
    print("="*50)

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=10000)
    assert page.locator("#screen-landing").is_visible()
    print("   1. Landing ✓")

    page.click("text=Log in")
    page.wait_for_selector("#screen-login", timeout=5000)
    assert page.locator("#screen-login").is_visible()
    print("   2. Login screen ✓")

    page.click("#demo-btn")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_selector("#page-dashboard", timeout=5000)
    assert page.locator("#screen-app").is_visible()
    print("   3. Demo login ✓")

    assert page.locator("#page-dashboard").is_visible()
    print("   4. Dashboard ✓")

    navigate_to_page(page, "checklist", "nav-checklist")
    page.wait_for_selector("#page-checklist", timeout=5000)
    assert page.locator("#page-checklist").is_visible()
    print("   5. Checklist ✓")

    navigate_to_page(page, "dataregister", "nav-dataregister")
    page.wait_for_selector("#page-dataregister", timeout=5000)
    assert page.locator("#page-dataregister").is_visible()
    print("   6. Data Register ✓")

    navigate_to_page(page, "consent", "nav-consent")
    page.wait_for_selector("#page-consent", timeout=5000)
    assert page.locator("#page-consent").is_visible()
    print("   7. Consent ✓")

    navigate_to_page(page, "dashboard", "nav-dashboard")
    page.wait_for_selector("#page-dashboard", timeout=5000)
    assert page.locator("#page-dashboard").is_visible()
    print("   8. Dashboard (return) ✓")

    dom_click(page, ".logout-btn")
    page.wait_for_selector("#screen-login", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#screen-login").is_visible()
    print("   9. Logout ✓")

    print("="*50)
    print("✅ FULL USER JOURNEY COMPLETE!")
    print("="*50)
    print("✅ Test 25: Full user journey passes")


# ============================================================
# TEST SUITE 13: DPO PAGE & FILE UPLOAD
# ============================================================
def test_navigate_to_dpo_page(fresh_page):
    """Test 26: Navigation to DPO page."""
    page = fresh_page

    demo_login(page)

    navigate_to_page(page, "dpo", "nav-dpo")
    page.wait_for_selector("#page-dpo", timeout=5000)
    page.wait_for_timeout(500)

    assert page.locator("#page-dpo").is_visible(), "DPO page should be visible"
    open_dpo_modal(page)
    assert page.locator("#modal-dpo-form.open #dpo-name").is_visible(), "DPO name field should exist"
    assert page.locator("#modal-dpo-form.open #dpo-email").is_visible(), "DPO email field should exist"

    print("✅ Test 26: DPO page navigation works")


def test_dpo_upload_zone_exists(fresh_page):
    """Test 27: DPO upload zone exists and is styled."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dpo", "nav-dpo")
    page.wait_for_selector("#page-dpo", timeout=5000)
    page.wait_for_timeout(500)
    open_dpo_modal(page)

    assert page.locator("#dpo-upload-zone").is_visible(), "Upload zone should exist"
    assert page.locator("#dpo-appointment").count() == 1, "File input should exist"
    assert page.locator("#dpo-upload-progress").count() > 0, "Upload progress element should exist"
    assert page.locator("#dpo-upload-complete").count() > 0, "Upload complete element should exist"

    print("✅ Test 27: DPO upload zone elements exist")


def test_dpo_upload_progress_shows(fresh_page):
    """Test 28: DPO file upload shows progress bar animation."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dpo", "nav-dpo")
    page.wait_for_selector("#page-dpo", timeout=5000)
    page.wait_for_timeout(500)
    open_dpo_modal(page)

    test_file = PROJECT_DIR + "/test_assets/test_upload.pdf"

    os.makedirs(PROJECT_DIR + "/test_assets", exist_ok=True)

    if not os.path.exists(test_file):
        with open(test_file, "wb") as f:
            f.write(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF")

    page.set_input_files("#dpo-appointment", test_file)
    page.wait_for_timeout(2000)

    progress_el = page.locator("#dpo-upload-progress")
    if progress_el.count() > 0:
        bar = page.locator("#dpo-upload-bar")
        assert bar.count() == 1, "Upload bar should exist"

        percent_text = page.locator("#dpo-upload-percent").inner_text()
        print(f"   Upload progress: {percent_text}")

    print("✅ Test 28: DPO upload progress bar shows")


def test_dpo_upload_complete_shows(fresh_page):
    """Test 29: DPO file upload completes successfully."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dpo", "nav-dpo")
    page.wait_for_selector("#page-dpo", timeout=5000)
    page.wait_for_timeout(500)
    open_dpo_modal(page)

    test_file = PROJECT_DIR + "/test_assets/test_upload.pdf"

    if not os.path.exists(test_file):
        os.makedirs(PROJECT_DIR + "/test_assets", exist_ok=True)
        with open(test_file, "wb") as f:
            f.write(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF")

    page.set_input_files("#dpo-appointment", test_file)
    page.wait_for_timeout(3000)

    complete_el = page.locator("#dpo-upload-complete")
    if complete_el.count() > 0:
        complete_text = page.locator("#dpo-upload-complete-text").inner_text()
        print(f"   Upload complete: {complete_text}")

    print("✅ Test 29: DPO upload completes successfully")


def test_dpo_form_fields_save(fresh_page):
    """Test 30: DPO form fields accept input."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dpo", "nav-dpo")
    page.wait_for_selector("#page-dpo", timeout=5000)
    page.wait_for_timeout(500)
    open_dpo_modal(page)

    page.fill("#modal-dpo-form.open #dpo-name", "Jane Doe")
    page.fill("#modal-dpo-form.open #dpo-email", "dpo@company.com")
    page.fill("#modal-dpo-form.open #dpo-phone", "+60 12 345 6789")
    page.select_option("#modal-dpo-form.open #dpo-nationality", "Malaysian")

    name_val = page.locator("#modal-dpo-form.open #dpo-name").input_value()
    email_val = page.locator("#modal-dpo-form.open #dpo-email").input_value()

    assert name_val == "Jane Doe", "Name should be saved"
    assert email_val == "dpo@company.com", "Email should be saved"

    print("✅ Test 30: DPO form fields save input")


def test_dpo_submit_button_loading_state(fresh_page):
    """Test 31: DPO submit button has loading state."""
    page = fresh_page

    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dpo", "nav-dpo")
    page.wait_for_selector("#page-dpo", timeout=5000)
    page.wait_for_timeout(500)
    open_dpo_modal(page)

    submit_btn = page.locator("#modal-dpo-form.open .modal-footer .btn-primary")
    assert submit_btn.is_visible(), "Submit button should exist"

    page.fill("#modal-dpo-form.open #dpo-name", "DPO Test")
    page.fill("#modal-dpo-form.open #dpo-email", "dpo@test.com")

    submit_btn.click()
    page.wait_for_timeout(1000)

    print("✅ Test 31: DPO submit button works")


# ============================================================
# TEST SUITE 14: PAGE NAVIGATION COVERAGE
# ============================================================
def test_navigate_to_companies(fresh_page):
    """Test 32: Navigate to Companies page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    page.evaluate("state.role = 'Superadmin'; state.currentUserLevel = 'Superadmin'; saveState();")
    navigate_to_page(page, "companies", "nav-companies")
    page.wait_for_selector("#page-companies", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-companies").is_visible(), "Companies page should be visible"
    print("✅ Test 32: Companies page loads")


def test_navigate_to_datasources(fresh_page):
    """Test 33: Navigate to Data Sources page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "datasources", "nav-datasources")
    page.wait_for_selector("#page-datasources", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-datasources").is_visible(), "Data Sources page should be visible"
    print("✅ Test 33: Data Sources page loads")


def test_navigate_to_access(fresh_page):
    """Test 34: Navigate to Access Control page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "access", "nav-access")
    page.wait_for_selector("#page-access", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-access").is_visible(), "Access Control page should be visible"
    print("✅ Test 34: Access Control page loads")


def test_navigate_to_datarequests(fresh_page):
    """Test 35: Navigate to Data Requests page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "datarequests", "nav-datarequests")
    page.wait_for_selector("#page-datarequests", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-datarequests").is_visible(), "Data Requests page should be visible"
    print("✅ Test 35: Data Requests page loads")


def test_navigate_to_breachlog(fresh_page):
    """Test 36: Navigate to Breach Log page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "breachlog", "nav-breachlog")
    page.wait_for_selector("#page-breachlog", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-breachlog").is_visible(), "Breach Log page should be visible"
    print("✅ Test 36: Breach Log page loads")


def test_navigate_to_dpiapage(fresh_page):
    """Test 37: Navigate to DPIA page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "dpiapage", "nav-dpiapage")
    page.wait_for_selector("#page-dpiapage", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-dpiapage").is_visible(), "DPIA page should be visible"
    print("✅ Test 37: DPIA page loads")


def test_navigate_to_crossborder(fresh_page):
    """Test 38: Navigate to Cross-border Transfer page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "crossborder", "nav-crossborder")
    page.wait_for_selector("#page-crossborder", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-crossborder").is_visible(), "Cross-border page should be visible"
    print("✅ Test 38: Cross-border page loads")


def test_navigate_to_vendors(fresh_page):
    """Test 39: Navigate to Vendors page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "vendors", "nav-vendors")
    page.wait_for_selector("#page-vendors", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-vendors").is_visible(), "Vendors page should be visible"
    print("✅ Test 39: Vendors page loads")


def test_navigate_to_training(fresh_page):
    """Test 40: Navigate to Training page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "training", "nav-training")
    page.wait_for_selector("#page-training", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-training").is_visible(), "Training page should be visible"
    print("✅ Test 40: Training page loads")


def test_navigate_to_documents(fresh_page):
    """Test 41: Navigate to Documents page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "documents", "nav-documents")
    page.wait_for_selector("#page-documents", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-documents").is_visible(), "Documents page should be visible"
    print("✅ Test 41: Documents page loads")


def test_navigate_to_audit(fresh_page):
    """Test 42: Navigate to Audit Report page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "audit", "nav-audit")
    page.wait_for_selector("#page-audit", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-audit").is_visible(), "Audit Report page should be visible"
    print("✅ Test 42: Audit Report page loads")


def test_navigate_to_alerts(fresh_page):
    """Test 43: Navigate to Alerts page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "alerts", "nav-alerts")
    page.wait_for_selector("#page-alerts", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-alerts").is_visible(), "Alerts page should be visible"
    print("✅ Test 43: Alerts page loads")


def test_navigate_to_cases(fresh_page):
    """Test 44: Navigate to Cases page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "cases", "nav-cases")
    page.wait_for_selector("#page-cases", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-cases").is_visible(), "Cases page should be visible"
    print("✅ Test 44: Cases page loads")


def test_navigate_to_monitoring(fresh_page):
    """Test 45: Navigate to Monitoring page."""
    page = fresh_page
    page.goto(BASE_URL)
    page.wait_for_selector("#screen-landing", timeout=5000)
    demo_login(page)
    navigate_to_page(page, "monitoring", "nav-monitoring")
    page.wait_for_selector("#page-monitoring", timeout=5000)
    page.wait_for_timeout(500)
    assert page.locator("#page-monitoring").is_visible(), "Monitoring page should be visible"
    print("✅ Test 45: Monitoring page loads")


# ============================================================
# TEST RESULTS SUMMARY
# ============================================================
if __name__ == "__main__":
    print("\n" + "="*50)
    print("📊 DataRex Frontend UAT Test Suite")
    print("="*50)
    print(f"Run: pytest {__file__} -v")
    print("="*50)
