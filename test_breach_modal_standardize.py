"""
DataRex PDPA Compliance Portal - Breach Modal Standardization Test
Verifies modal-breach matches the new standard set by
modal-vendor / modal-training / modal-dpo (inline-styled card,
form-row layout for date + status, blue save button).
Run: pytest test_breach_modal_standardize.py -v --tb=short
"""

import os
import threading
import time
import pytest
from http.server import SimpleHTTPRequestHandler
import socketserver
from playwright.sync_api import sync_playwright


# ============================================================
# CONFIGURATION
# ============================================================
PORT = 8062
BASE_URL = f"http://localhost:{PORT}"
PROJECT_DIR = "/Users/tysonchua/Desktop/project/data-reg"


# ============================================================
# HTTP SERVER FIXTURE (mirrors test_datarex.py convention)
# ============================================================
class QuietHTTPHandler(SimpleHTTPRequestHandler):
    """Silent HTTP handler to reduce console noise."""
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
            args=['--disable-blink-features=AutomationControlled']
        )
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
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
# HELPER: demo login
# ============================================================
def demo_login(page):
    page.click("text=Log in")
    page.wait_for_timeout(500)
    page.click("#demo-btn")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_selector("#page-dashboard", timeout=5000)
    page.wait_for_timeout(800)


def open_breach_modal(page):
    page.click("#nav-breachlog")
    page.wait_for_selector("#page-breachlog", timeout=5000)
    page.wait_for_timeout(400)
    page.click("text=Record Breach")
    page.wait_for_selector("#modal-breach.open", timeout=5000)
    page.wait_for_timeout(300)


# ============================================================
# TEST 1: modal chrome uses the new self-contained card pattern
# ============================================================
def test_breach_modal_card_uses_standardized_chrome(fresh_page):
    """modal-breach card must have the same inline-styled chrome as modal-training."""
    page = fresh_page
    demo_login(page)
    open_breach_modal(page)

    # The card itself (the inner `.modal` div) should declare the standardized
    # max-width and rounded corners as inline style — matching modal-training.
    card_max_width = page.evaluate(
        "() => document.querySelector('#modal-breach .modal').style.maxWidth"
    )
    card_radius = page.evaluate(
        "() => document.querySelector('#modal-breach .modal').style.borderRadius"
    )
    assert card_max_width, "Breach modal card must set inline maxWidth (standardized chrome)"
    assert card_radius, "Breach modal card must set inline borderRadius (standardized chrome)"
    print("Breach modal card has standardized inline-styled chrome")


# ============================================================
# TEST 2: incident date + status are grouped in a form-row
# ============================================================
def test_breach_modal_groups_date_and_status_in_form_row(fresh_page):
    """Incident date and status must share a `.form-row` so they render side-by-side
    (matches modal-training's date/expiry pattern)."""
    page = fresh_page
    demo_login(page)
    open_breach_modal(page)

    grouped = page.evaluate(
        """
        () => {
          const date = document.getElementById('breach-incident-date');
          const status = document.getElementById('breach-status');
          if (!date || !status) return false;
          const dateRow = date.closest('.form-row');
          const statusRow = status.closest('.form-row');
          return !!(dateRow && statusRow && dateRow === statusRow);
        }
        """
    )
    assert grouped, (
        "breach-incident-date and breach-status must share a `.form-row` parent"
    )
    print("Breach modal groups incident date + status in a form-row")


# ============================================================
# TEST 3: Save button uses the standardized blue look
# ============================================================
def test_breach_modal_save_button_standardized(fresh_page):
    """The save button must use the standardized blue (#2563eb) and inline padding,
    matching modal-training's Save Record button."""
    page = fresh_page
    demo_login(page)
    open_breach_modal(page)

    btn = page.locator("#breach-save-btn")
    assert btn.is_visible(), "breach-save-btn must be visible"

    bg = page.evaluate(
        "() => getComputedStyle(document.getElementById('breach-save-btn')).backgroundColor"
    )
    # #2563eb = rgb(37, 99, 235)
    assert bg == "rgb(37, 99, 235)", (
        f"Save button must be blue rgb(37, 99, 235); got {bg}"
    )
    print("Breach modal save button uses standardized blue")


# ============================================================
# TEST 4: end-to-end save flow still works with new markup
# ============================================================
def test_breach_modal_save_appends_row(fresh_page):
    """Filling and saving the standardized breach modal must still append a row."""
    page = fresh_page
    demo_login(page)
    open_breach_modal(page)

    page.fill("#breach-type", "Unauthorized access")
    page.fill("#breach-description", "External actor accessed customer DB")
    page.fill("#breach-affected-count", "42")
    page.fill("#breach-incident-date", "2026-05-01")
    page.select_option("#breach-status", "Under Investigation")

    page.click("#breach-save-btn")
    page.wait_for_timeout(800)

    table_text = page.locator("#breachlog-body").inner_text()
    assert "Unauthorized access" in table_text, "Saved breach row must appear"
    assert "External actor" in table_text, "Description must appear in row"
    print("Breach modal save flow appends a row to the table")
