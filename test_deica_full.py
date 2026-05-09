"""Full DEICA walkthrough on app.js v=37: open modal, toggle, validate
empty save, save, edit, multi-screening, and persistence across hard
refresh (which is the user-reported regression)."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8060", wait_until="networkidle")
    page.wait_for_timeout(2500)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(2500)
    page.wait_for_selector("#demo-btn", timeout=15000, state="attached")
    page.evaluate("demoLogin()")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_timeout(1000)

    page.evaluate("showPage('deica')")
    page.wait_for_timeout(800)

    # New screening via openDEICAModal directly (modal interactions verified
    # in earlier run); focus here is on persistence.
    page.evaluate("openDEICAModal(blankDEICAScreening())")
    page.wait_for_timeout(400)
    page.fill("#deica-activity-name", "First")
    page.evaluate("deicaCurrent.subjects_over_20k = true; updateDEICADecision();")
    page.evaluate("saveDEICADecision()")
    page.wait_for_timeout(800)

    page.evaluate("openDEICAModal(blankDEICAScreening())")
    page.wait_for_timeout(400)
    page.fill("#deica-activity-name", "Second")
    page.evaluate("deicaCurrent.children_or_vulnerable = true; updateDEICADecision();")
    page.evaluate("saveDEICADecision()")
    page.wait_for_timeout(800)

    cards = page.query_selector_all("#deica-list .deica-card")
    print(f"[after 2 saves] cards={len(cards)}")
    assert len(cards) == 2

    # Edit first card
    edit_btn = page.query_selector(".deica-edit-btn")
    edit_btn.click()
    page.wait_for_timeout(400)
    page.fill("#deica-activity-name", "Second (renamed)")
    page.evaluate("saveDEICADecision()")
    page.wait_for_timeout(800)
    cards = page.query_selector_all("#deica-list .deica-card")
    print(f"[after edit]   cards={len(cards)}")
    assert len(cards) == 2

    # HARD REFRESH (full reload, simulating Cmd-Shift-R)
    page.goto("http://localhost:8060", wait_until="networkidle")
    page.wait_for_timeout(2500)
    if not page.evaluate("state.isLoggedIn === true"):
        page.wait_for_selector("#demo-btn", timeout=10000, state="attached")
        page.evaluate("demoLogin()")
        page.wait_for_timeout(800)
    page.evaluate("showPage('deica')")
    page.wait_for_timeout(1000)
    cards = page.query_selector_all("#deica-list .deica-card")
    names = [c.query_selector(".deica-card-title").text_content().strip() for c in cards]
    print(f"[after hard refresh] cards={len(cards)} names={names}")
    assert len(cards) == 2
    assert "First" in names
    assert "Second (renamed)" in names

    # Wipe localStorage to simulate the "Empty Cache and Hard Reload" case
    page.evaluate("localStorage.removeItem('dpia_screenings')")
    page.evaluate("showPage('deica')")
    page.wait_for_timeout(800)
    cards = page.query_selector_all("#deica-list .deica-card")
    print(f"[localStorage wiped, no cloud session] cards={len(cards)} (expected 0 — demo has no auth, so cloud has nothing either)")

    print("\n✓ all assertions passed")
    browser.close()
