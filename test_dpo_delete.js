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

async function loginOnly(page) {
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
  await page.waitForURL(/#\/dashboard$/, { timeout: 15000 });
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
      const page = await browser.newPage();
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
    }

    // ── TEST 2: Delete clears all localStorage sources ────────────────
    {
      const page = await browser.newPage();
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
    }

    // ── TEST 3: Delete persists across page navigation (regression) ───
    // Core bug: deleteDPOLocal cleared dpo_data but left datarex_dpo intact.
    // On next showPage('dpo'), loadDPOFromSupabase() re-reads datarex_dpo and
    // the record reappears.
    {
      const page = await browser.newPage();
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
