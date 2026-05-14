const { chromium } = require('playwright');

const BASE_URL = process.env.APP_URL || 'http://localhost:8060';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function seedAndLogin(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  const email = `checklist-ext-${Date.now()}@example.com`;
  const password = 'Account123!';
  await page.evaluate(async ({ userEmail, userPassword }) => {
    const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
    users.push({
      id: `checklist-ext-${Date.now()}`,
      name: 'Checklist Extended User',
      company: 'ExtTest Sdn Bhd',
      email: userEmail,
      password_hash: await window.hashPasswordForStorage(userPassword),
      industry: 'Health / Healthcare',
      size: '11-50',
      companySize: '11-50',
      country: 'Malaysia',
      officialEmail: 'dpo@exttest.test',
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
  await page.evaluate(() => window.showPage('checklist', document.getElementById('nav-checklist')));
  await page.waitForURL(/#\/checklist$/, { timeout: 10000 });
  await page.waitForSelector('#page-checklist.active', { timeout: 10000 });
  await page.waitForSelector('#page-checklist.active .section-head h3', { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch();
  const pageErrors = [];

  try {
    // ── TEST 1: Concurrent render stability ────────────────────────────
    {
      const page = await browser.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await seedAndLogin(page);

      // Fire renderChecklist 5 times concurrently — body must end up with
      // exactly 15 section headings, not multiples (regression for duplicate-
      // sections bug caused by concurrent async renders).
      await page.evaluate(async () => {
        await Promise.all([
          window.renderChecklist(),
          window.renderChecklist(),
          window.renderChecklist(),
          window.renderChecklist(),
          window.renderChecklist()
        ]);
      });
      await page.waitForTimeout(500);

      const headingCount = await page.locator('#page-checklist .section-head h3').count();
      assert(headingCount === 15, `Concurrent renders produced ${headingCount} section headings instead of 15`);
      console.log('PASS concurrent render stability (15 sections)');
      await page.close();
    }

    // ── TEST 2: Checkbox → status-select sync ─────────────────────────
    {
      const page = await browser.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await seedAndLogin(page);

      const firstItem = page.locator('#page-checklist .check-item').first();
      const statusBefore = await firstItem.locator('.check-status-select').inputValue();
      assert(statusBefore === 'Not Started', `Expected 'Not Started' before toggle, got '${statusBefore}'`);

      await firstItem.locator('.checkbox').click();
      await page.waitForFunction(() => {
        const sel = document.querySelector('#page-checklist .check-item .check-status-select');
        return sel && sel.value === 'Done';
      }, { timeout: 5000 });

      const statusAfter = await firstItem.locator('.check-status-select').inputValue();
      assert(statusAfter === 'Done', `Status select should be 'Done' after checkbox click, got '${statusAfter}'`);
      console.log('PASS checkbox → status sync');
      await page.close();
    }

    // ── TEST 3: Not Applicable does not count as done ──────────────────
    {
      const page = await browser.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await seedAndLogin(page);

      const progBefore = await page.locator('#prog-label').innerText();
      const totalMatch = progBefore.match(/of (\d+) done/);
      assert(totalMatch, `Could not parse progress label: ${progBefore}`);
      const total = parseInt(totalMatch[1], 10);

      // Set first item to Not Applicable via dropdown
      const firstItem = page.locator('#page-checklist .check-item').first();
      await firstItem.locator('.check-status-select').selectOption('Not Applicable');
      await page.waitForTimeout(300);

      const progAfter = await page.locator('#prog-label').innerText();
      // Not Applicable should NOT increment the done count
      const doneMatch = progAfter.match(/^(\d+) of/);
      const doneCount = doneMatch ? parseInt(doneMatch[1], 10) : -1;
      assert(doneCount === 0, `Not Applicable should not increment done count, got ${doneCount}`);
      console.log('PASS not-applicable does not inflate done count');
      await page.close();
    }

    // ── TEST 4: All 30 checklist item IDs present in rendered DOM ─────
    {
      const page = await browser.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await seedAndLogin(page);

      const itemCount = await page.locator('#page-checklist .check-item').count();
      assert(itemCount === 30, `Expected 30 checklist items (15 sections × 2), got ${itemCount}`);
      console.log(`PASS all 30 checklist items rendered`);
      await page.close();
    }

    // ── TEST 5: Dashboard score updates after marking items done ───────
    {
      const page = await browser.newPage();
      page.on('pageerror', e => pageErrors.push(e.message));
      await seedAndLogin(page);

      // Navigate to dashboard first to see initial score
      await page.evaluate(() => window.showPage('dashboard', document.getElementById('nav-dashboard')));
      await page.waitForURL(/#\/dashboard$/, { timeout: 10000 });
      const scoreBefore = await page.locator('#score-display').innerText();

      // Go back to checklist and mark an item done
      await page.evaluate(() => window.showPage('checklist', document.getElementById('nav-checklist')));
      await page.waitForURL(/#\/checklist$/, { timeout: 10000 });
      await page.waitForSelector('#page-checklist .check-item', { timeout: 10000 });
      const firstItem = page.locator('#page-checklist .check-item').first();
      await firstItem.locator('.check-status-select').selectOption('Done');
      await page.waitForTimeout(300);

      // Check score display updated
      const scoreAfter = await page.locator('#score-display').innerText();
      const pctBefore = parseInt(scoreBefore, 10);
      const pctAfter = parseInt(scoreAfter, 10);
      assert(pctAfter > pctBefore, `Score should increase after marking item done: ${scoreBefore} → ${scoreAfter}`);
      console.log(`PASS dashboard score updates (${scoreBefore} → ${scoreAfter})`);
      await page.close();
    }

    assert(pageErrors.length === 0, `Browser errors: ${pageErrors.join(' | ')}`);
    console.log('ALL EXTENDED TESTS PASSED');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
