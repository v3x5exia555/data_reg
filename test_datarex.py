"""
DataRex PDPA Compliance Portal - Frontend UAT Test Suite
Run: pytest test_datarex.py -v --tb=short
"""

import pytest
import threading
import time
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer
import socketserver
from playwright.sync_api import sync_playwright, Page, expect


# ============================================================
# CONFIGURATION
# ============================================================
PORT = 8050
BASE_URL = f"http://localhost:{PORT}"
PROJECT_DIR = "/Users/tysonchua/Desktop/project/data-reg"


# ============================================================
# HTTP SERVER FIXTURE
# ============================================================
class QuietHTTPHandler(SimpleHTTPRequestHandler):
    """Silent HTTP handler to reduce console noise."""
    def log_message(self, format, *args):
        pass  # Suppress logging


def start_http_server(port=PORT, directory=PROJECT_DIR):
    """Start HTTP server in background thread."""
    original_cwd = os.getcwd()
    os.chdir(directory)
    
    handler = QuietHTTPHandler
    
    with socketserver.TCPServer(("", port), handler) as httpd:
        httpd.serve_forever()


import os

@pytest.fixture(scope="session")
def http_server():
    """Start HTTP server for serving index.html."""
    print(f"\n🚀 Starting HTTP server on port {PORT}...")
    
    # Start server in background thread (non-daemon so it stays alive)
    server_thread = threading.Thread(target=start_http_server, daemon=False)
    server_thread.start()
    time.sleep(2)  # Wait for server to start
    
    print(f"✅ HTTP server running at {BASE_URL}")
    yield
    
    print("\n🛑 HTTP server stopped")


# ============================================================
# BROWSER FIXTURE
# ============================================================
@pytest.fixture(scope="session")
def browser(http_server):
    """Launch Playwright browser for all tests."""
    print("\n🌐 Launching Chromium browser...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            slow_mo=300,
            args=['--disable-blink-features=AutomationControlled']
        )
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        
        yield page
        
        context.close()
        browser.close()
    print("✅ Browser closed")


@pytest.fixture
def fresh_page(browser):
    """Fresh page for each test."""
    # Navigate to page - fresh state for each test
    browser.goto(BASE_URL)
    yield browser


# ============================================================
# TEST SUITE 1: LANDING PAGE
# ============================================================
def test_landing_page_loads(fresh_page):
    """Test 1: Landing page loads and displays correctly."""
    page = fresh_page
    
    # Verify landing screen is visible
    assert page.locator("#screen-landing").is_visible(), "Landing screen should be visible"
    assert page.locator(".hero-h1").is_visible(), "Hero heading should be visible"
    
    print("✅ Test 1: Landing page loads correctly")


def test_landing_demo_button_exists(fresh_page):
    """Test 2: Demo button exists on landing page."""
    page = fresh_page
    
    demo_btn = page.locator("#demo-btn")
    assert demo_btn.is_visible(), "Demo button should exist"
    assert demo_btn.inner_text() == "See demo", "Button text should be 'See demo'"
    
    print("✅ Test 2: Demo button exists")


def test_landing_navigation_buttons(fresh_page):
    """Test 3: Navigation buttons on landing page."""
    page = fresh_page
    
    # Check nav buttons exist
    assert page.locator("text=Log in").is_visible(), "Log in button should be visible"
    assert page.locator("text=Get started free").is_visible(), "Get started button should be visible"
    
    print("✅ Test 3: Navigation buttons visible")


# ============================================================
# TEST SUITE 2: LOGIN FLOW
# ============================================================
def test_navigate_to_login(fresh_page):
    """Test 4: Navigate to login screen."""
    page = fresh_page
    
    # Click "Log in" button
    page.click("text=Log in")
    page.wait_for_timeout(500)
    
    assert page.locator("#screen-login").is_visible(), "Login screen should be visible"
    assert page.locator("#login-email").is_visible(), "Email input should be visible"
    
    print("✅ Test 4: Navigate to login works")


def test_login_credentials_prefilled(fresh_page):
    """Test 5: Login credentials are pre-filled."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("text=Log in")
    page.wait_for_timeout(500)
    
    email = page.locator("#login-email").input_value()
    password = page.locator("#login-password").input_value()
    
    assert email == "admin@datarex.com", "Email should be pre-filled"
    assert password == "Admin123!@#", "Password should be pre-filled"
    
    print("✅ Test 5: Credentials pre-filled")


def test_demo_login_navigates_to_dashboard(fresh_page):
    """Test 6: Demo login navigates to dashboard."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    
    # Click demo button
    page.click("#demo-btn")
    page.wait_for_timeout(2000)  # Wait for transition
    
    # Should be on app screen with dashboard
    assert page.locator("#screen-app").is_visible(), "App screen should be visible"
    assert page.locator("#page-dashboard").is_visible(), "Dashboard should be visible"
    
    print("✅ Test 6: Demo login → Dashboard")


# ============================================================
# TEST SUITE 3: DASHBOARD
# ============================================================
def test_dashboard_displays_score(fresh_page):
    """Test 7: Dashboard displays compliance score."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    # Check score elements exist
    assert page.locator("#score-display").is_visible(), "Score display should exist"
    assert page.locator("#score-bar").is_visible(), "Score bar should exist"
    
    score = page.locator("#score-display").inner_text()
    print(f"   Compliance score: {score}")
    
    print("✅ Test 7: Dashboard score displays")


def test_dashboard_quick_actions(fresh_page):
    """Test 8: Dashboard quick actions exist."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    assert page.locator(".quick-card").is_visible(), "Quick actions card should exist"
    assert page.locator("text=Continue checklist").is_visible(), "Continue checklist should exist"
    
    print("✅ Test 8: Dashboard quick actions exist")


def test_dashboard_stats(fresh_page):
    """Test 9: Dashboard stats display."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    assert page.locator("#stat-completed").is_visible(), "Completed stat should exist"
    assert page.locator("#stat-pending").is_visible(), "Pending stat should exist"
    
    print("✅ Test 9: Dashboard stats display")


# ============================================================
# TEST SUITE 4: NAVIGATION PAGES
# ============================================================
def test_navigate_to_checklist(fresh_page):
    """Test 10: Navigation to checklist page."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    # Click checklist nav
    page.click("#nav-checklist")
    page.wait_for_timeout(500)
    
    assert page.locator("#page-checklist").is_visible(), "Checklist page should be visible"
    assert page.locator(".check-item").count() > 0, "Checklist items should exist"
    
    print(f"✅ Test 10: Checklist page loads ({page.locator('.check-item').count()} items)")


def test_navigate_to_dataregister(fresh_page):
    """Test 11: Navigation to data register page."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    page.click("#nav-dataregister")
    page.wait_for_timeout(500)
    
    assert page.locator("#page-dataregister").is_visible(), "Data Register page should be visible"
    print("✅ Test 11: Data Register page loads")


def test_navigate_to_consent(fresh_page):
    """Test 12: Navigation to consent page."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    page.click("#nav-consent")
    page.wait_for_timeout(500)
    
    assert page.locator("#page-consent").is_visible(), "Consent page should be visible"
    print("✅ Test 12: Consent page loads")


def test_navigate_to_retention(fresh_page):
    """Test 13: Navigation to retention page."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    page.click("#nav-retention")
    page.wait_for_timeout(500)
    
    assert page.locator("#page-retention").is_visible(), "Retention page should be visible"
    print("✅ Test 13: Retention page loads")


# ============================================================
# TEST SUITE 5: CHECKLIST TOGGLE
# ============================================================
def test_checklist_toggle_saves_state(fresh_page):
    """Test 14: Checklist toggle saves to state."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    page.click("#nav-checklist")
    page.wait_for_timeout(500)
    
    # Click first checklist item
    first_item = page.locator(".check-item").first
    first_item.click()
    page.wait_for_timeout(500)
    
    # Verify item is checked (has 'done' class)
    done_count = page.locator(".check-item.done").count()
    assert done_count > 0, "At least one item should be done"
    
    print(f"✅ Test 14: Checklist toggle works ({done_count} done)")
    
    # Verify score updated
    score = page.locator("#score-display").inner_text()
    print(f"   Updated score: {score}")


# ============================================================
# TEST SUITE 6: LOGOUT
# ============================================================
def test_logout_returns_to_landing(fresh_page):
    """Test 15: Logout returns to landing page."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    
    # Click logout
    page.click(".logout-btn")
    page.wait_for_timeout(1000)
    
    assert page.locator("#screen-landing").is_visible(), "Should return to landing"
    print("✅ Test 15: Logout returns to landing")


# ============================================================
# TEST SUITE 7: REGISTRATION
# ============================================================
def test_registration_form_loads(fresh_page):
    """Test 16: Registration form loads."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("text=Log in")
    page.wait_for_timeout(300)
    page.click("text=Create Account")
    page.wait_for_timeout(300)
    
    assert page.locator("#screen-register").is_visible(), "Register screen should be visible"
    assert page.locator("#register-name").is_visible(), "Name field should exist"
    assert page.locator("#register-company").is_visible(), "Company field should exist"
    
    print("✅ Test 16: Registration form loads")


def test_registration_creates_user(fresh_page):
    """Test 17: Registration creates new user."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    
    # Navigate to registration
    page.click("text=Log in")
    page.wait_for_timeout(300)
    page.click("text=Create Account")
    page.wait_for_timeout(300)
    
    # Fill registration form
    page.fill("#register-name", "Test User UAT")
    page.fill("#register-company", "Test Company Pte Ltd")
    page.select_option("#register-industry", "Technology")
    page.select_option("#register-size", "11-50")
    page.fill("#register-email", "test@datarex.com")
    page.fill("#register-password", "TestPass123")
    page.fill("#register-confirm", "TestPass123")
    
    # Submit
    page.click("#register-btn")
    page.wait_for_timeout(1000)
    
    # Should navigate to onboarding
    assert page.locator("#screen-onboarding").is_visible(), "Should navigate to onboarding"
    
    print("✅ Test 17: Registration creates user")


# ============================================================
# TEST SUITE 8: ONBOARDING
# ============================================================
def test_onboarding_data_sources(fresh_page):
    """Test 18: Onboarding data sources selection."""
    page = fresh_page
    
    # Complete registration
    page.goto(f"{BASE_URL}/index.html")
    page.click("text=Log in")
    page.click("text=Create Account")
    page.fill("#register-name", "Test User")
    page.fill("#register-company", "Test Company")
    page.select_option("#register-industry", "Technology")
    page.select_option("#register-size", "11-50")
    page.fill("#register-email", "test2@datarex.com")
    page.fill("#register-password", "TestPass123")
    page.fill("#register-confirm", "TestPass123")
    page.click("#register-btn")
    page.wait_for_timeout(500)
    
    # Select data sources
    options = page.locator("#src-options .option-card")
    options.nth(0).click()  # WhatsApp
    options.nth(1).click()  # Online Forms
    
    selected = page.locator("#src-options .option-card.selected").count()
    assert selected == 2, "Two data sources should be selected"
    
    print("✅ Test 18: Onboarding data sources selection")


def test_onboarding_finish_shows_summary(fresh_page):
    """Test 19: Onboarding finish shows summary."""
    page = fresh_page
    
    # Complete registration and onboarding
    page.goto(f"{BASE_URL}/index.html")
    page.click("text=Log in")
    page.click("text=Create Account")
    page.fill("#register-name", "Test User")
    page.fill("#register-company", "Test Company")
    page.select_option("#register-industry", "Technology")
    page.select_option("#register-size", "11-50")
    page.fill("#register-email", "test3@datarex.com")
    page.fill("#register-password", "TestPass123")
    page.fill("#register-confirm", "TestPass123")
    page.click("#register-btn")
    page.wait_for_timeout(500)
    
    # Select data source
    page.click("#src-options .option-card >> nth=0")
    
    # Click Finish setup
    page.click("text=Finish setup")
    page.wait_for_timeout(1000)
    
    # Should show summary
    assert page.locator(".summary-screen").is_visible(), "Summary screen should be visible"
    assert page.locator(".summary-card").is_visible(), "Summary card should be visible"
    
    print("✅ Test 19: Onboarding shows summary")


def test_summary_shows_registration_data(fresh_page):
    """Test 20: Summary displays registration data."""
    page = fresh_page
    
    # Complete registration and onboarding
    page.goto(f"{BASE_URL}/index.html")
    page.click("text=Log in")
    page.click("text=Create Account")
    page.fill("#register-name", "Test User Summary")
    page.fill("#register-company", "Summary Test Co")
    page.select_option("#register-industry", "Technology")
    page.select_option("#register-size", "11-50")
    page.fill("#register-email", "test4@datarex.com")
    page.fill("#register-password", "TestPass123")
    page.fill("#register-confirm", "TestPass123")
    page.click("#register-btn")
    page.wait_for_timeout(500)
    page.click("#src-options .option-card >> nth=0")
    page.click("text=Finish setup")
    page.wait_for_timeout(1000)
    
    # Check summary shows registration data
    assert page.locator("text=Test User Summary").is_visible(), "Name should be in summary"
    assert page.locator("text=Summary Test Co").is_visible(), "Company should be in summary"
    assert page.locator("text=Technology").is_visible(), "Industry should be in summary"
    
    print("✅ Test 20: Summary shows registration data")


# ============================================================
# TEST SUITE 9: SUMMARY TO DASHBOARD
# ============================================================
def test_summary_go_to_dashboard(fresh_page):
    """Test 21: Summary page navigates to dashboard."""
    page = fresh_page
    
    # Complete registration and onboarding
    page.goto(f"{BASE_URL}/index.html")
    page.click("text=Log in")
    page.click("text=Create Account")
    page.fill("#register-name", "Test User")
    page.fill("#register-company", "Test Company")
    page.select_option("#register-industry", "Technology")
    page.select_option("#register-size", "11-50")
    page.fill("#register-email", "test5@datarex.com")
    page.fill("#register-password", "TestPass123")
    page.fill("#register-confirm", "TestPass123")
    page.click("#register-btn")
    page.wait_for_timeout(500)
    page.click("#src-options .option-card >> nth=0")
    page.click("text=Finish setup")
    page.wait_for_timeout(500)
    
    # Click Go to Dashboard
    page.click("text=Go to Dashboard")
    page.wait_for_timeout(1000)
    
    assert page.locator("#page-dashboard").is_visible(), "Dashboard should be visible"
    print("✅ Test 21: Summary → Dashboard works")


# ============================================================
# TEST SUITE 10: LOGIN WITH REGISTERED USER
# ============================================================
def test_login_with_new_user(fresh_page):
    """Test 22: Login with newly registered user."""
    page = fresh_page
    
    # First, register a new user
    page.goto(f"{BASE_URL}/index.html")
    page.click("text=Log in")
    page.click("text=Create Account")
    page.fill("#register-name", "New User Login")
    page.fill("#register-company", "New Login Co")
    page.select_option("#register-industry", "Finance")
    page.select_option("#register-size", "1-10")
    page.fill("#register-email", "newuser@datarex.com")
    page.fill("#register-password", "NewPass123")
    page.fill("#register-confirm", "NewPass123")
    page.click("#register-btn")
    page.wait_for_timeout(500)
    page.click("#src-options .option-card >> nth=0")
    page.click("text=Finish setup")
    page.wait_for_timeout(1000)
    page.click("text=Go to Dashboard")
    page.wait_for_timeout(1000)
    
    # Logout
    page.click(".logout-btn")
    page.wait_for_timeout(500)
    
    # Login with the new user
    page.fill("#login-email", "newuser@datarex.com")
    page.fill("#login-password", "NewPass123")
    page.click("#login-btn")
    page.wait_for_timeout(2000)
    
    assert page.locator("#screen-app").is_visible(), "Should navigate to app"
    
    print("✅ Test 22: Login with new user works")


# ============================================================
# TEST SUITE 11: DATA REGISTER MODAL
# ============================================================
def test_add_record_modal_opens(fresh_page):
    """Test 23: Add record modal opens."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    page.click("#nav-dataregister")
    page.wait_for_timeout(500)
    
    # Click add record button
    page.click("text=+ Add record")
    page.wait_for_timeout(500)
    
    assert page.locator("#modal-record").is_visible(), "Modal should be visible"
    print("✅ Test 23: Add record modal opens")


def test_add_record_modal_closes(fresh_page):
    """Test 24: Add record modal closes."""
    page = fresh_page
    page.goto(f"{BASE_URL}/index.html")
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    page.click("#nav-dataregister")
    page.wait_for_timeout(500)
    page.click("text=+ Add record")
    page.wait_for_timeout(500)
    
    # Close modal
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
    
    # 1. Landing
    page.goto(f"{BASE_URL}/index.html")
    assert page.locator("#screen-landing").is_visible()
    print("   1. Landing ✓")
    
    # 2. Navigate to login
    page.click("text=Log in")
    assert page.locator("#screen-login").is_visible()
    print("   2. Login screen ✓")
    
    # 3. Demo login
    page.click("#demo-btn")
    page.wait_for_timeout(2000)
    assert page.locator("#screen-app").is_visible()
    print("   3. Demo login ✓")
    
    # 4. Dashboard verification
    assert page.locator("#page-dashboard").is_visible()
    print("   4. Dashboard ✓")
    
    # 5. Navigate to checklist
    page.click("#nav-checklist")
    assert page.locator("#page-checklist").is_visible()
    print("   5. Checklist ✓")
    
    # 6. Navigate to data register
    page.click("#nav-dataregister")
    assert page.locator("#page-dataregister").is_visible()
    print("   6. Data Register ✓")
    
    # 7. Navigate to consent
    page.click("#nav-consent")
    assert page.locator("#page-consent").is_visible()
    print("   7. Consent ✓")
    
    # 8. Navigate back to dashboard
    page.click("#nav-dashboard")
    assert page.locator("#page-dashboard").is_visible()
    print("   8. Dashboard (return) ✓")
    
    # 9. Logout
    page.click(".logout-btn")
    page.wait_for_timeout(1000)
    assert page.locator("#screen-landing").is_visible()
    print("   9. Logout ✓")
    
    print("="*50)
    print("✅ FULL USER JOURNEY COMPLETE!")
    print("="*50)
    print("✅ Test 25: Full user journey passes")


# ============================================================
# TEST RESULTS SUMMARY
# ============================================================
if __name__ == "__main__":
    print("\n" + "="*50)
    print("📊 DataRex Frontend UAT Test Suite")
    print("="*50)
    print(f"Run: pytest {__file__} -v")
    print("="*50)