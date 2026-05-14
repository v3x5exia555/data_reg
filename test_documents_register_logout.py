"""Hypothesis: doLogin's localStorage fallback regenerates state.user.id
because datarex_users records have no id field, so logging out + back in
changes user.id and docMatchesScope filters out docs uploaded as the 'old' id."""
import os, tempfile
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8060", wait_until="networkidle")
    page.wait_for_timeout(2500)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(2500)

    # Wait for register page
    page.wait_for_function("typeof doRegister === 'function'", timeout=10000)

    # Plant a registered user via the same code path as the form
    page.evaluate("""
      (async () => {
        const pwHash = await hashPasswordForStorage('Password123!');
        const users = [{
          name: 'Test User', company: 'Test Co', email: 'tester@example.com',
          password_hash: pwHash, industry: 'Technology', size: '11-50', regNo: 'XYZ001'
        }];
        localStorage.setItem('datarex_users', JSON.stringify(users));
      })()
    """)
    page.wait_for_timeout(500)

    # Now log in via the real login form (uses doLogin - localStorage fallback)
    page.evaluate("goTo('screen-login')")
    page.wait_for_timeout(500)
    page.wait_for_selector("#login-email", timeout=10000, state="visible")
    page.fill("#login-email", "tester@example.com")
    page.fill("#login-password", "Password123!")
    page.evaluate("doLogin()")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_timeout(1000)
    uid_first = page.evaluate("state.user.id")
    print(f"[after first login] state.user.id = {uid_first}")
    print(f"  length = {len(uid_first)}")

    # Upload a doc
    page.evaluate("showPage('documents')")
    page.wait_for_timeout(800)
    with tempfile.NamedTemporaryFile(prefix="reg-", suffix=".pdf", delete=False) as f:
        f.write(b"%PDF-1.4 reg test\n"); tmp = f.name
    page.set_input_files("#file-input", tmp)
    page.wait_for_timeout(200)
    page.evaluate("handleFileUpload()")
    page.wait_for_timeout(2000)
    rows1 = page.query_selector_all("#documents-list table tbody tr")
    print(f"[after upload] rows={len(rows1)}")
    doc_userid = page.evaluate("(JSON.parse(localStorage.getItem('datarex_documents') || '[]')[0] || {}).userId")
    print(f"  uploaded doc.userId = {doc_userid}")

    # Logout
    page.evaluate("doLogout()")
    page.wait_for_timeout(1500)
    print(f"[after logout] state.isLoggedIn = {page.evaluate('state.isLoggedIn')}")

    # Wait for login screen, log back in
    page.evaluate("goTo('screen-login')")
    page.wait_for_timeout(500)
    page.wait_for_selector("#login-email", timeout=10000, state="visible")
    page.fill("#login-email", "tester@example.com")
    page.fill("#login-password", "Password123!")
    page.evaluate("doLogin()")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_timeout(1000)
    uid_second = page.evaluate("state.user.id")
    print(f"[after relogin] state.user.id = {uid_second}")
    print(f"  unstable? {uid_first != uid_second}")

    page.evaluate("showPage('documents')")
    page.wait_for_timeout(1500)
    rows2 = page.query_selector_all("#documents-list table tbody tr")
    print(f"[relogin documents] rows={len(rows2)}")
    if rows2:
        for r in rows2: print(f"  - {r.inner_text()[:120]}")
    else:
        empty = page.query_selector("#documents-list .empty-state")
        if empty: print(f"  empty: {empty.inner_text()[:80]}")

    # Now also reload to see if a fresh page load (which triggers loadState's
    # id-migration) changes the id again
    page.reload()
    page.wait_for_timeout(2500)
    if not page.evaluate("state.isLoggedIn === true"):
        print("  not logged in after reload — login screen visible")
    uid_third = page.evaluate("state.user.id")
    print(f"[after reload]  state.user.id = {uid_third}")
    if not page.evaluate("state.isLoggedIn === true"):
        page.evaluate("goTo('screen-login')")
        page.wait_for_timeout(500)
        page.wait_for_selector("#login-email", timeout=10000, state="visible")
        page.fill("#login-email", "tester@example.com")
        page.fill("#login-password", "Password123!")
        page.evaluate("doLogin()")
        page.wait_for_selector("#screen-app", timeout=10000)
        page.wait_for_timeout(1000)
        uid_third = page.evaluate("state.user.id")
        print(f"  after re-login: {uid_third}")

    page.evaluate("showPage('documents')")
    page.wait_for_timeout(1500)
    rows3 = page.query_selector_all("#documents-list table tbody tr")
    print(f"[after reload+login] rows={len(rows3)}")

    os.unlink(tmp)
    browser.close()
