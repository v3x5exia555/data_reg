const { chromium } = require('playwright');

const BASE_URL = process.env.APP_URL || 'http://localhost:8060';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Intercept Supabase DPO REST calls so all in-flight reads return [] immediately.
// This prevents loadDPOFromSupabase() Supabase fetches from racing with our
// seeded test data renders.
async function blockDpoSupabase(page) {
  await page.route(/supabase\.co.*\/rest\/v1\/dpo/, (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

// Force-fail the Supabase auth call so login falls through to the localStorage
// fallback path immediately. Without this, every test makes a real network
// round-trip to the Supabase auth server which is rate-limited / flaky after
// many test logins and causes the post-click waitForFunction to time out.
// Also stub out the post-login user_profiles/accounts queries so the
// async chain in loginHandler resolves instantly.
async function stubSupabaseAuth(page) {
  await page.route(/supabase\.co\/auth\/v1\//, (route) => {
    // Return 400 like a real bad-credentials response so app falls back to local users.
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'stubbed for tests' })
    });
  });
  await page.route(/supabase\.co\/rest\/v1\/(user_profiles|accounts|app_credentials)/, (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function loginOnly(page) {
  // Ensure Supabase auth/profile/accounts endpoints are stubbed before any login attempt.
  // Idempotent — page.route silently accepts duplicate handlers and uses the first match.
  await stubSupabaseAuth(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  const email = `dpo-delete-${Date.now()}@example.com`;
  const password = 'Account123!';
  await page.evaluate(async ({ userEmail, userPassword }) => {
    const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
    users.push({
      id: `dpo-del-${Date.now()}`,
      name: 'DPO Delete Tester',
      company: 'DelTest Sdn Bhd',
      email: userEmail,
      password_hash: await window.hashPasswordForStorage(userPassword),
      industry: 'Technology',
      size: '11-50',
      companySize: '11-50',
      country: 'Malaysia',
      officialEmail: 'dpo@deltest.test',
      profileCompleted: true
    });
    localStorage.setItem('datarex_users', JSON.stringify(users));
  }, { userEmail: email, userPassword: password });

  await page.getByRole('button', { name: /^Log in$/i }).click();
  await page.waitForSelector('#screen-login.screen.active', { timeout: 5000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-btn');
  await page.waitForFunction(
    () => location.hash === '#/dashboard' && document.querySelector('#screen-app.active'),
    null,
    { timeout: 30000, polling: 200 }
  );
}

// Navigate to DPO, seed test data into localStorage, and render it.
// Supabase DPO calls are blocked by network interception (all return []).
async function goToDPOWithRecord(page, record) {
  await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
  await page.waitForURL(/#\/dpo$/, { timeout: 10000 });
  await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
  await page.waitForTimeout(500);

  // Seed test data and re-render (Supabase already blocked via network route)
  await page.evaluate((dpoRecord) => {
    localStorage.setItem('dpo_data', JSON.stringify([dpoRecord]));
    localStorage.setItem('datarex_dpo', JSON.stringify(dpoRecord));
    window.confirm = () => true;
  }, record);

  await page.evaluate(() => window.loadDPOFromSupabase());

  await page.waitForFunction(
    (name) => document.getElementById('dpo-table-body')?.innerText?.includes(name),
    record.name,
    { timeout: 10000 }
  );
}

(async () => {
  const browser = await chromium.launch();
  const pageErrors = [];

  try {
    // ── TEST 1: Delete removes record from table immediately ──────────
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await blockDpoSupabase(page);
      await loginOnly(page);

      const record = {
        id: 'test-dpo-del-001',
        name: 'Delete Me DPO',
        email: 'deleteme@dpo.test',
        phone: '+60111111111',
        nationality: 'Malaysian',
        appointment_date: '2026-01-15',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      await goToDPOWithRecord(page, record);

      const tableTextBefore = await page.locator('#dpo-table-body').innerText();
      assert(tableTextBefore.includes('Delete Me DPO'), `Record not visible: "${tableTextBefore}"`);
      console.log('PASS record visible before delete');

      await page.locator('#dpo-table-body .btn-edit').first().click();
      await page.waitForTimeout(500);

      const tableTextAfter = await page.locator('#dpo-table-body').innerText();
      assert(!tableTextAfter.includes('Delete Me DPO'), `Record still visible after delete: "${tableTextAfter}"`);
      console.log('PASS record removed from table immediately after delete');

      await page.close();
      await context.close();
    }

    // ── TEST 2: Delete clears all localStorage sources ────────────────
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await blockDpoSupabase(page);
      await loginOnly(page);

      const record = {
        id: 'test-dpo-del-002',
        name: 'Cleanup DPO',
        email: 'cleanup@dpo.test',
        appointment_date: '2026-02-01',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      await goToDPOWithRecord(page, record);

      await page.locator('#dpo-table-body .btn-edit').first().click();
      await page.waitForTimeout(500);

      const storageState = await page.evaluate(() => ({
        dpoData: JSON.parse(localStorage.getItem('dpo_data') || '[]'),
        legacyDpo: localStorage.getItem('datarex_dpo')
      }));

      assert(
        storageState.dpoData.length === 0,
        `dpo_data should be empty after delete, got ${storageState.dpoData.length}: ${JSON.stringify(storageState.dpoData)}`
      );
      assert(
        !storageState.legacyDpo,
        `datarex_dpo should be cleared after delete (still contains: ${storageState.legacyDpo})`
      );
      console.log('PASS all localStorage sources cleared after delete');

      await page.close();
      await context.close();
    }

    // ── TEST 3: Delete persists across page navigation (regression) ───
    // Core bug: deleteDPOLocal cleared dpo_data but left datarex_dpo intact.
    // On next showPage('dpo'), loadDPOFromSupabase() re-reads datarex_dpo and
    // the record reappears.
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await blockDpoSupabase(page);
      await loginOnly(page);

      const record = {
        id: 'test-dpo-del-003',
        name: 'Persist Check DPO',
        email: 'persist@dpo.test',
        appointment_date: '2026-03-10',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      await goToDPOWithRecord(page, record);

      // Delete the record via button click
      await page.locator('#dpo-table-body .btn-edit').first().click();
      await page.waitForTimeout(500);

      // Navigate away then back — triggers loadDPOFromSupabase() which re-reads all sources
      await page.evaluate(() => window.showPage('dashboard', document.getElementById('nav-dashboard')));
      await page.waitForURL(/#\/dashboard$/, { timeout: 10000 });

      await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
      await page.waitForURL(/#\/dpo$/, { timeout: 10000 });
      await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
      await page.waitForTimeout(1000); // let loadDPOFromSupabase() complete

      const tableTextAfterNav = await page.locator('#dpo-table-body').innerText();
      assert(
        !tableTextAfterNav.includes('Persist Check DPO'),
        `DPO record reappeared after navigate-away-and-back — datarex_dpo was not cleared.\nTable: "${tableTextAfterNav}"`
      );
      console.log('PASS DPO delete persists across page navigation');

      await page.close();
      await context.close();
    }

    // ── TEST 4: Tombstone survives Supabase returning the deleted record ───
    // Real-world bug: Supabase DELETE silently fails (e.g. RLS blocks it).
    // Next loadDPOFromSupabase() fetches the record again and re-caches it.
    // Tombstone mechanism must filter it out client-side.
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));

      // Simulate Supabase returning the record (DELETE silently failed)
      const ghostRecord = {
        id: 'ghost-supabase-record-001',
        user_id: 'dpo-del-test',
        company_id: 'DelTest Sdn Bhd',
        name: 'Ghost DPO',
        email: 'ghost@dpo.test',
        appointment_date: '2026-04-01',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      await page.route(/supabase\.co.*\/rest\/v1\/dpo/, (route) => {
        const url = route.request().url();
        const method = route.request().method();
        // GET requests: return the ghost record (simulates RLS-blocked DELETE)
        if (method === 'GET' || (method === 'POST' && url.includes('select'))) {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ghostRecord]) });
        } else {
          route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
      });

      await loginOnly(page);

      await page.evaluate((rec) => {
        localStorage.setItem('dpo_data', JSON.stringify([rec]));
        localStorage.setItem('datarex_dpo', JSON.stringify(rec));
        window.confirm = () => true;
      }, ghostRecord);

      await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
      await page.waitForURL(/#\/dpo$/, { timeout: 10000 });
      await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
      await page.waitForFunction(
        (name) => document.getElementById('dpo-table-body')?.innerText?.includes(name),
        ghostRecord.name,
        { timeout: 10000 }
      );

      // Delete the record
      await page.locator('#dpo-table-body .btn-edit').first().click();
      await page.waitForTimeout(500);

      // Navigate away and back — Supabase will still return the ghost record,
      // but the tombstone should filter it out
      await page.evaluate(() => window.showPage('dashboard', document.getElementById('nav-dashboard')));
      await page.waitForURL(/#\/dashboard$/, { timeout: 10000 });

      await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
      await page.waitForURL(/#\/dpo$/, { timeout: 10000 });
      await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
      await page.waitForTimeout(2000); // let loadDPOFromSupabase fetch + render

      const tableTextAfterNav = await page.locator('#dpo-table-body').innerText();
      assert(
        !tableTextAfterNav.includes('Ghost DPO'),
        `Ghost DPO record reappeared from Supabase after delete + nav — tombstone did not filter it.\nTable: "${tableTextAfterNav}"`
      );

      // Verify tombstone was recorded
      const tombstones = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('dpo_deleted_ids') || '[]')
      );
      assert(
        tombstones.includes('ghost-supabase-record-001'),
        `Tombstone list should contain deleted ID, got: ${JSON.stringify(tombstones)}`
      );
      console.log('PASS tombstone prevents record resurrection from Supabase');

      await page.close();
      await context.close();
    }

    // ── TEST 5: Tombstone survives logout + login on same browser ─────
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await blockDpoSupabase(page);
      await loginOnly(page);

      // Capture the seeded user's credentials for re-login
      const credentials = await page.evaluate(() => {
        const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
        const u = users[users.length - 1];
        return { email: u?.email, password: 'Account123!' };
      });

      const record = {
        id: 'test-dpo-del-005',
        name: 'Logout Persist DPO',
        email: 'logout@dpo.test',
        appointment_date: '2026-05-01',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      await goToDPOWithRecord(page, record);

      // Delete the record
      await page.locator('#dpo-table-body .btn-edit').first().click();
      await page.waitForTimeout(500);

      // Logout (clear session-only state)
      await page.evaluate(() => {
        if (typeof window.doLogout === 'function') window.doLogout();
        else { sessionStorage.clear(); location.hash = '#/'; }
      });
      await page.waitForSelector('#screen-landing.screen.active, #screen-login.screen.active', { timeout: 10000 });

      // Log back in as the same user
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
      await page.getByRole('button', { name: /^Log in$/i }).click();
      await page.waitForSelector('#screen-login.screen.active', { timeout: 5000 });
      await page.fill('#login-email', credentials.email);
      await page.fill('#login-password', credentials.password);
      await page.click('#login-btn');
      await page.waitForFunction(
        () => location.hash === '#/dashboard' && document.querySelector('#screen-app.active'),
        null,
        { timeout: 30000, polling: 200 }
      );

      // Navigate to DPO page
      await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
      await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
      await page.waitForTimeout(1500); // let loadDPOFromSupabase finish

      const tableText = await page.locator('#dpo-table-body').innerText();
      assert(
        !tableText.includes('Logout Persist DPO'),
        `Tombstone did not persist across logout/login: "${tableText}"`
      );
      console.log('PASS tombstone persists across logout + login');

      await page.close();
      await context.close();
    }

    // ── TEST 6: G1 — warning toast appears when Supabase delete returns 0 rows ─
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));

      // Intercept Supabase: GET returns the record, DELETE returns [] (RLS-blocked)
      await page.route(/supabase\.co.*\/rest\/v1\/dpo/, (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await loginOnly(page);

      const record = {
        id: 'test-dpo-del-006-server-id',  // non-local prefix triggers Supabase delete path
        name: 'RLS Warn DPO',
        email: 'rlswarn@dpo.test',
        appointment_date: '2026-06-01',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };

      await page.evaluate((rec) => {
        localStorage.setItem('dpo_data', JSON.stringify([rec]));
        window.confirm = () => true;
      }, record);

      await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
      await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
      await page.waitForFunction(
        (name) => document.getElementById('dpo-table-body')?.innerText?.includes(name),
        record.name,
        { timeout: 10000 }
      );

      // Click delete — Supabase DELETE will return [] (simulated RLS denial)
      await page.locator('#dpo-table-body .btn-edit').first().click();

      // Wait for the warning toast (auto-dismisses after 4s)
      const toast = await page.waitForSelector('#toast-container.toast-warning', { timeout: 5000 }).catch(() => null);
      assert(toast, 'Expected warning toast when Supabase delete returns 0 rows');

      const toastText = await page.locator('#toast-container .toast-message').innerText();
      assert(
        /server delete failed|contact support/i.test(toastText),
        `Toast text did not mention server failure or support: "${toastText}"`
      );
      console.log('PASS RLS-denial warning toast appears');

      await page.close();
      await context.close();
    }

    // ── TEST 7: Happy path — Supabase delete succeeds, success toast (no warn) ─
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));

      // Intercept Supabase: DELETE returns the deleted row (real success)
      const happyRecord = {
        id: 'test-dpo-del-007-server-id',
        user_id: 'happy-user',
        company_id: 'Happy Co',
        name: 'Happy Delete DPO',
        email: 'happy@dpo.test',
        appointment_date: '2026-07-01',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      await page.route(/supabase\.co.*\/rest\/v1\/dpo/, (route) => {
        const method = route.request().method();
        if (method === 'DELETE') {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([happyRecord]) });
        } else {
          route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
      });

      await loginOnly(page);

      await page.evaluate((rec) => {
        localStorage.setItem('dpo_data', JSON.stringify([rec]));
        window.confirm = () => true;
      }, happyRecord);

      await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
      await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
      await page.waitForFunction(
        (name) => document.getElementById('dpo-table-body')?.innerText?.includes(name),
        happyRecord.name,
        { timeout: 10000 }
      );

      await page.locator('#dpo-table-body .btn-edit').first().click();

      // Wait for success toast (not warning)
      const toast = await page.waitForSelector('#toast-container.toast-success', { timeout: 5000 }).catch(() => null);
      assert(toast, 'Expected success toast when Supabase delete returns the row');

      // Confirm NO warning toast appears
      const warnToast = await page.locator('#toast-container.toast-warning').count();
      assert(warnToast === 0, 'Should not show warning toast on successful delete');
      console.log('PASS happy-path Supabase delete shows success toast');

      await page.close();
      await context.close();
    }

    // ── TEST 8: Cancel confirm — record stays, no tombstone added ────
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await blockDpoSupabase(page);
      await loginOnly(page);

      const record = {
        id: 'test-dpo-del-008',
        name: 'Stay Put DPO',
        email: 'stay@dpo.test',
        appointment_date: '2026-08-01',
        training_status: 'pending',
        status: 'Active',
        created_at: new Date().toISOString()
      };

      await page.evaluate((rec) => {
        localStorage.setItem('dpo_data', JSON.stringify([rec]));
        window.confirm = () => false;  // user clicks Cancel
      }, record);

      await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
      await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
      await page.waitForFunction(
        (name) => document.getElementById('dpo-table-body')?.innerText?.includes(name),
        record.name,
        { timeout: 10000 }
      );

      await page.locator('#dpo-table-body .btn-edit').first().click();
      await page.waitForTimeout(500);

      // Record must still be visible
      const tableText = await page.locator('#dpo-table-body').innerText();
      assert(
        tableText.includes('Stay Put DPO'),
        `Cancel-confirm should not delete the record: "${tableText}"`
      );

      // Tombstone must NOT contain this ID
      const tombstones = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('dpo_deleted_ids') || '[]')
      );
      assert(
        !tombstones.includes('test-dpo-del-008'),
        `Cancel-confirm should not add tombstone, got: ${JSON.stringify(tombstones)}`
      );
      console.log('PASS cancel-confirm leaves record + no tombstone');

      await page.close();
      await context.close();
    }

    assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(' | ')}`);
    console.log('ALL DPO DELETE TESTS PASSED');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
