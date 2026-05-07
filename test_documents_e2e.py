"""Final end-to-end check of the Documents page after all fixes.
Covers: fresh upload, large upload (>quota of dataRexState), download,
delete, reload persistence, and legacy-store recovery."""
import json, os, tempfile
from playwright.sync_api import sync_playwright

LEGACY_DOC = {
    "id": "legacy-archived-1",
    "uploader": "Legacy User",
    "name": "old-privacy-policy.pdf",
    "type": "PDF",
    "category": "Privacy Policy",
    "size": 12345,
    "uploadedAt": "2026-04-01T10:00:00Z",
    "storagePath": "",
    "accountId": "",
    "userId": "00000000-0000-0000-0000-000000000001",
    "source": "local",
    "uploadStatus": "Local copy",
    "dataUrl": "data:application/pdf;base64,JVBERi0xLjQK",
}

def rows(page):
    return page.query_selector_all("#documents-list table tbody tr")

def names(page):
    return [r.query_selector("td:first-child .table-avatar-name").text_content().strip()
            for r in rows(page) if r.query_selector("td:first-child .table-avatar-name")]

def asset_version(page):
    return page.evaluate("document.querySelector('script[src*=\"app.js\"]').src.match(/v=(\\d+)/)[1]")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    page.goto("http://localhost:8060", wait_until="networkidle")
    page.wait_for_timeout(2500)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(2500)
    page.wait_for_selector("#demo-btn", timeout=15000, state="attached")
    page.evaluate("demoLogin()")
    page.wait_for_selector("#screen-app", timeout=10000)
    page.wait_for_timeout(800)
    print(f"app.js version loaded: v={asset_version(page)}")

    # ── 1. Plant a legacy doc to simulate a returning user with old data
    page.evaluate(f"""
      const ss = JSON.parse(localStorage.getItem('dataRexState') || '{{}}');
      ss.documents = [{json.dumps(LEGACY_DOC)}];
      localStorage.setItem('dataRexState', JSON.stringify(ss));
      localStorage.removeItem('datarex_documents');
    """)

    page.click("#nav-documents"); page.wait_for_timeout(1200)
    print(f"\n[1] Legacy recovery: rows={len(rows(page))}, names={names(page)}")
    assert "old-privacy-policy.pdf" in names(page), "legacy doc must be recovered"

    # ── 2. Upload small file
    with tempfile.NamedTemporaryFile(prefix="small-", suffix=".pdf", delete=False) as f:
        f.write(b"%PDF-1.4 small\n"); small = f.name
    page.set_input_files("#file-input", small); page.wait_for_timeout(200)
    page.evaluate("handleFileUpload()"); page.wait_for_timeout(2000)
    print(f"[2] After small upload: rows={len(rows(page))}, names={names(page)}")
    assert os.path.basename(small) in names(page)

    # ── 3. Upload a large 3MB file (would have blown localStorage quota pre-fix)
    with tempfile.NamedTemporaryFile(prefix="big-", suffix=".pdf", delete=False) as f:
        f.write(b"X" * (3 * 1024 * 1024)); big = f.name
    page.set_input_files("#file-input", big); page.wait_for_timeout(200)
    page.evaluate("handleFileUpload()"); page.wait_for_timeout(3000)
    print(f"[3] After 3MB upload:    rows={len(rows(page))}, names={names(page)}")
    assert os.path.basename(big) in names(page)

    # ── 4. Download the small file
    btns = page.query_selector_all("button:has-text('Download')")
    target = None
    for b in btns:
        row = b.evaluate("e => e.closest('tr').querySelector('.table-avatar-name').textContent.trim()")
        if row == os.path.basename(small):
            target = b; break
    assert target, "download button for small file not found"
    with page.expect_download(timeout=5000) as dl_info:
        target.click()
    print(f"[4] Download triggered:   {dl_info.value.suggested_filename}")

    # ── 5. Reload and confirm persistence
    page.reload(); page.wait_for_timeout(2500)
    if not page.evaluate("state.isLoggedIn === true"):
        page.wait_for_selector("#demo-btn", timeout=10000, state="attached")
        page.evaluate("demoLogin()"); page.wait_for_timeout(800)
    page.click("#nav-documents"); page.wait_for_timeout(1500)
    after = names(page)
    print(f"[5] After reload:         rows={len(rows(page))}, names={after}")
    assert "old-privacy-policy.pdf" in after
    assert os.path.basename(small) in after
    assert os.path.basename(big) in after

    # ── 6. Delete the legacy one
    page.evaluate("""
      window.confirm = () => true;
      const tr = Array.from(document.querySelectorAll('#documents-list table tbody tr'))
        .find(r => r.querySelector('.table-avatar-name')?.textContent.trim() === 'old-privacy-policy.pdf');
      tr?.querySelector('.btn-delete')?.click();
    """)
    page.wait_for_timeout(1500)
    print(f"[6] After delete legacy:  rows={len(rows(page))}, names={names(page)}")
    assert "old-privacy-policy.pdf" not in names(page)

    # ── 7. Confirm dataRexState no longer carries documents (no quota risk)
    has_docs_in_state = page.evaluate("'documents' in JSON.parse(localStorage.getItem('dataRexState') || '{}')")
    print(f"[7] dataRexState has documents key? {has_docs_in_state}  (must be False)")
    assert has_docs_in_state is False

    if console_errors:
        non_supabase = [e for e in console_errors
                        if "Bucket not found" not in e
                        and "row-level security" not in e
                        and "400" not in e]
        if non_supabase:
            print("\nUnexpected console errors:")
            for e in non_supabase[:5]: print(f"  {e[:200]}")

    print("\n✓ all assertions passed")
    os.unlink(small); os.unlink(big)
    browser.close()
