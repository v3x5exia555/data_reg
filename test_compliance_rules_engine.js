const { chromium } = require('playwright');

const BASE_URL = process.env.APP_URL || 'http://localhost:8060';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.evaluate(async () => {
      localStorage.setItem('datarex_users', JSON.stringify([{
        id: 'rules-user',
        name: 'Rules User',
        company: 'Rules Health Sdn Bhd',
        email: 'rules@example.com',
        password_hash: await window.hashPasswordForStorage('Account123!'),
        industry: 'Health / Healthcare',
        size: '51-200',
        companySize: '51-200',
        country: 'Malaysia',
        officialEmail: 'privacy@rules.test',
        profileCompleted: true
      }]));
    });

    await page.getByRole('button', { name: /^Log in$/i }).click();
    await page.fill('#login-email', 'rules@example.com');
    await page.fill('#login-password', 'Account123!');
    await page.click('#login-btn');
    await page.waitForURL(/#\/dashboard$/, { timeout: 15000 });

    await page.evaluate(() => window.showPage('profile', document.getElementById('nav-profile')));
    await page.waitForSelector('#page-profile.active', { timeout: 10000 });
    await page.selectOption('#profile-processing-role', 'Both');
    await page.selectOption('#profile-sensitive-data', 'yes');
    await page.selectOption('#profile-cross-border', 'yes');
    await page.selectOption('#profile-vendors', 'yes');
    await page.selectOption('#profile-systematic-monitoring', 'yes');
    await page.selectOption('#profile-data-subject-volume', '20000+');
    await page.selectOption('#profile-sensitive-subject-volume', '10000+');
    await page.click('#profile-save-btn');
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem('dataRexState') || '{}');
      return saved.user?.processingRole === 'Both'
        && saved.user?.sensitiveData === 'yes'
        && saved.user?.crossBorderTransfer === 'yes'
        && saved.user?.usesVendors === 'yes'
        && saved.user?.systematicMonitoring === 'yes'
        && saved.user?.dataSubjectVolume === '20000+'
        && saved.user?.sensitiveSubjectVolume === '10000+';
    }, { timeout: 10000 });

    await page.evaluate(() => window.showPage('checklist', document.getElementById('nav-checklist')));
    await page.waitForSelector('#page-checklist.active', { timeout: 10000 });
    await page.click('#generate-checklist-btn');
    await page.waitForSelector('#generated-rule-summary .rule-chip', { timeout: 10000 });
    await page.waitForSelector('.check-rule-badge.critical', { timeout: 10000 });

    const rulesText = await page.locator('#generated-rule-summary').innerText();
    for (const expected of ['DPO required', 'Cross-border transfer', 'Vendor / processor use', 'Sensitive personal data', 'Regulated industry']) {
      assert(rulesText.includes(expected), `Generated rule summary missing ${expected}`);
    }

    const criticalCount = await page.locator('.check-rule-badge.critical').count();
    assert(criticalCount >= 3, 'Expected critical badges after checklist generation');

    const dpoItem = page.locator('.check-item[data-item-id="dpo-appointed"]');
    await dpoItem.locator('.check-status-select').selectOption('Done');
    await page.waitForTimeout(250);
    let dpoStatus = await dpoItem.locator('.check-status-select').inputValue();
    assert(dpoStatus !== 'Done', 'Critical evidence-required item should not become Done without evidence');

    await dpoItem.locator('.check-evidence-input').fill('DPO appointment letter.pdf');
    await dpoItem.locator('.check-status-select').selectOption('Done');
    await page.waitForTimeout(250);
    dpoStatus = await dpoItem.locator('.check-status-select').inputValue();
    assert(dpoStatus === 'Done', 'Critical item should become Done once evidence is provided');

    await page.evaluate(() => window.showPage('dashboard', document.getElementById('nav-dashboard')));
    await page.waitForSelector('#page-dashboard.active', { timeout: 10000 });
    const scoreText = await page.locator('#score-display').innerText();
    const score = Number(scoreText.replace('%', ''));
    assert(score > 0, 'Weighted dashboard score should increase after evidence-backed completion');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dataRexState') || '{}'));
    assert(saved.generatedChecklist?.rules?.length >= 5, 'Generated checklist rules were not persisted');
    assert(saved.generatedChecklist?.itemRules?.['dpo-appointed']?.evidenceRequired === true, 'DPO item rule was not persisted');

    console.log('PASS compliance rules engine');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
