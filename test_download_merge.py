"""Verify mergeDocuments() preserves dataUrl when a 'synced' supabase row
shares an id with a local doc that has dataUrl, so downloadDocument can
still use the fast (no-popup) anchor path."""
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
    page.wait_for_timeout(800)
    page.click("#nav-documents"); page.wait_for_timeout(800)

    # Plant a "local" doc with dataUrl AND simulate a "synced" supabase
    # response with the same id (no dataUrl), then run mergeDocuments.
    out = page.evaluate("""
      (() => {
        const local = [{
          id: 'doc-shared-1', uploader: 'X', name: 'shared.pdf',
          type: 'PDF', category: 'Privacy Policy', size: 100,
          uploadedAt: new Date().toISOString(),
          storagePath: '', accountId: '', userId: 'u1',
          source: 'local', uploadStatus: 'Local copy',
          dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK'
        }];
        const supabase = [{
          id: 'doc-shared-1', uploader: 'X', name: 'shared.pdf',
          type: 'PDF', category: 'Privacy Policy', size: 100,
          uploadedAt: new Date().toISOString(),
          storagePath: 'u1/shared.pdf', accountId: '', userId: 'u1',
          source: 'supabase', uploadStatus: 'Synced'
        }];
        const merged = mergeDocuments(supabase, local);
        return {
          count: merged.length,
          first: merged[0] ? {
            id: merged[0].id, source: merged[0].source,
            hasDataUrl: !!merged[0].dataUrl,
            storagePath: merged[0].storagePath
          } : null
        };
      })()
    """)
    print("merge result:", out)
    assert out['count'] == 1, "should dedupe to 1 row"
    assert out['first']['hasDataUrl'] is True, "merged row must keep dataUrl from local"
    assert out['first']['source'] == 'supabase', "primary metadata wins"
    assert out['first']['storagePath'] == 'u1/shared.pdf', "storagePath kept"
    print("\n✓ mergeDocuments preserves dataUrl from secondary")
    browser.close()
