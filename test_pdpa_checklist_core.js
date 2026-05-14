const { chromium } = require('playwright');

const BASE_URL = process.env.APP_URL || 'http://localhost:8060';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageErrors = [];
  const consoleMessages = [];

  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.log('BROWSER PAGE ERROR:', error.message);
  });
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (msg.type() === 'error') console.log('BROWSER CONSOLE ERROR:', text);
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const email = `checklist-${Date.now()}@example.com`;
    const password = 'Account123!';
    await page.evaluate(async ({ userEmail, userPassword }) => {
      const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
      users.push({
        id: `checklist-user-${Date.now()}`,
        name: 'Checklist User',
        company: 'Checklist Sdn Bhd',
        email: userEmail,
        password_hash: await window.hashPasswordForStorage(userPassword),
        industry: 'Health / Healthcare',
        size: '11-50',
        companySize: '11-50',
        country: 'Malaysia',
        officialEmail: 'privacy@checklist.test',
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
    await page.waitForSelector('.section-head h3', { timeout: 15000 });

    const sectionHeadings = [
      'Company Profile & Applicability',
      'DPO Appointment',
      'Privacy Notice',
      'Consent Management',
      'Personal Data Inventory / Data Register',
      'Data Subject Rights',
      'Data Breach Notification',
      'DPIA / Risk Assessment',
      'Data Protection by Design',
      'Cross-Border Transfer',
      'Vendor / Data Processor Management',
      'Retention & Disposal',
      'Security Safeguards',
      'Training & Awareness',
      'Audit Evidence & Management Reporting'
    ];
    const renderedHeadings = await page.locator('.section-head h3').evaluateAll(els => els.map(el => el.textContent.trim()));
    for (const heading of sectionHeadings) {
      assert(renderedHeadings.includes(heading), `Missing checklist section: ${heading}`);
    }

    const firstItem = page.locator('.check-item').first();
    await firstItem.waitFor({ timeout: 10000 });
    await firstItem.locator('.check-status-select').waitFor({ timeout: 10000 });
    await firstItem.locator('.check-owner-input').waitFor({ timeout: 10000 });
    await firstItem.locator('.check-due-date-input').waitFor({ timeout: 10000 });
    await firstItem.locator('.check-notes-input').waitFor({ timeout: 10000 });
    await firstItem.locator('.check-evidence-input').waitFor({ timeout: 10000 });
    await firstItem.locator('.check-reviewed-date-input').waitFor({ timeout: 10000 });

    await firstItem.locator('.check-status-select').selectOption('In Progress');
    await firstItem.locator('.check-owner-input').fill('DPO Owner');
    await firstItem.locator('.check-due-date-input').fill('2026-06-30');
    await firstItem.locator('.check-notes-input').fill('Need final management confirmation.');
    await firstItem.locator('.check-evidence-input').fill('https://evidence.test/profile');
    await firstItem.locator('.check-reviewed-date-input').fill('2026-05-14');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#page-checklist.active', { timeout: 10000 });
    const reloadedFirstItem = page.locator('.check-item').first();
    assert(await reloadedFirstItem.locator('.check-status-select').inputValue() === 'In Progress', 'Checklist status did not persist');
    assert(await reloadedFirstItem.locator('.check-owner-input').inputValue() === 'DPO Owner', 'Checklist owner did not persist');
    assert(await reloadedFirstItem.locator('.check-due-date-input').inputValue() === '2026-06-30', 'Checklist due date did not persist');
    assert(await reloadedFirstItem.locator('.check-notes-input').inputValue() === 'Need final management confirmation.', 'Checklist notes did not persist');
    assert(await reloadedFirstItem.locator('.check-evidence-input').inputValue() === 'https://evidence.test/profile', 'Checklist evidence did not persist');
    assert(await reloadedFirstItem.locator('.check-reviewed-date-input').inputValue() === '2026-05-14', 'Checklist reviewed date did not persist');

    const beforeProgress = await page.locator('#prog-label').innerText();
    assert(/^0 of \d+ done$/.test(beforeProgress), `Initial progress label should start at 0, got ${beforeProgress}`);
    await reloadedFirstItem.locator('.checkbox').click();
    await page.waitForFunction(() => document.getElementById('prog-label')?.textContent?.startsWith('1 of '));
    const afterProgress = await page.locator('#prog-label').innerText();
    assert(/^1 of \d+ done$/.test(afterProgress), `Progress label did not update after marking done: ${afterProgress}`);

    assert(pageErrors.length === 0, `Browser page errors occurred: ${pageErrors.join(' | ')}`);
    console.log('PASS PDPA checklist core');
  } finally {
    if (consoleMessages.some(msg => /GLOBAL ERROR|TypeError|ReferenceError/i.test(msg))) {
      console.log('BROWSER WARNINGS:', consoleMessages.filter(msg => /GLOBAL ERROR|TypeError|ReferenceError/i.test(msg)).join(' | '));
    }
    await browser.close();
  }
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
