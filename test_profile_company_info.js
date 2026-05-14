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

    const email = `profile-${Date.now()}@example.com`;
    const password = 'Account123!';
    await page.evaluate(async ({ userEmail, userPassword }) => {
      const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
      users.push({
        id: `legacy-profile-${Date.now()}`,
        name: userEmail.split('@')[0],
        company: '',
        email: userEmail,
        password_hash: await window.hashPasswordForStorage(userPassword),
        industry: '',
        size: '1-10',
        regNo: ''
      });
      localStorage.setItem('datarex_users', JSON.stringify(users));
    }, { userEmail: email, userPassword: password });

    await page.getByRole('button', { name: /^Log in$/i }).click();
    await page.waitForSelector('#screen-login.screen.active', { timeout: 5000 });
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('#login-btn');
    await page.waitForURL(/#\/profile$/, { timeout: 10000 });
    await page.waitForSelector('#page-profile.active', { timeout: 10000 });
    await page.waitForSelector('#profile-company', { timeout: 10000 });
    await page.waitForSelector('#profile-country', { timeout: 10000 });
    await page.waitForSelector('#profile-official-email', { timeout: 10000 });

    await page.fill('#profile-company', 'Regulated Test Sdn Bhd');
    await page.selectOption('#profile-industry', 'Money Services Business');
    await page.selectOption('#profile-company-size', '51-200');
    const sizeValue = await page.locator('#profile-company-size').inputValue();
    assert(sizeValue === '51-200', 'Profile company size should allow user selection');
    await page.click('#profile-save-btn');
    await page.waitForSelector('#profile-save-status.profile-save-status.error', { timeout: 10000 });
    await page.fill('#profile-country', 'Malaysia');
    await page.fill('#profile-official-email', 'compliance@regulated.test');
    await page.fill('#profile-ssm-number', '202401000001');
    await page.fill('#profile-website', 'https://regulated.test');
    await page.fill('#profile-contact-number', '+60312345678');
    await page.fill('#profile-business-address', 'Level 1, Compliance Tower, Kuala Lumpur');
    await page.click('#profile-save-btn');
    await page.waitForSelector('#profile-save-status.profile-save-status.success', { timeout: 10000 });

    const saved = await page.evaluate(userEmail => {
      const state = JSON.parse(localStorage.getItem('dataRexState') || '{}');
      const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
      return {
        stateUser: state.user,
        savedUser: users.find(user => user.email === userEmail),
        sidebarOrg: document.getElementById('sidebar-org')?.textContent || '',
      };
    }, email);

    assert(saved.stateUser?.company === 'Regulated Test Sdn Bhd', 'State company was not updated');
    assert(saved.stateUser?.industry === 'Money Services Business', 'State industry was not updated');
    assert(saved.stateUser?.companySize === '51-200', 'State company size selection was not saved');
    assert(saved.stateUser?.country === 'Malaysia', 'State country was not saved');
    assert(saved.stateUser?.officialEmail === 'compliance@regulated.test', 'State official email was not saved');
    assert(saved.stateUser?.ssmNumber === '202401000001', 'State SSM number was not saved');
    assert(saved.stateUser?.website === 'https://regulated.test', 'State website was not saved');
    assert(saved.stateUser?.contactNumber === '+60312345678', 'State contact number was not saved');
    assert(saved.stateUser?.businessAddress === 'Level 1, Compliance Tower, Kuala Lumpur', 'State business address was not saved');
    assert(saved.savedUser?.company === 'Regulated Test Sdn Bhd', 'Local user company was not updated');
    assert(saved.savedUser?.industry === 'Money Services Business', 'Local user industry was not updated');
    assert(saved.savedUser?.size === '51-200', 'Local user size selection was not saved');
    assert(saved.savedUser?.country === 'Malaysia', 'Local user country was not saved');
    assert(saved.savedUser?.officialEmail === 'compliance@regulated.test', 'Local user official email was not saved');
    assert(saved.sidebarOrg === 'Regulated Test Sdn Bhd', 'Sidebar company did not update after profile save');

    await page.getByRole('button', { name: /^Back to dashboard$/i }).first().click();
    await page.waitForURL(/#\/dashboard$/, { timeout: 10000 });
    await page.waitForSelector('#page-dashboard.active', { timeout: 10000 });
    const promptCount = await page.locator('#dashboard-profile-prompt').count();
    assert(promptCount === 0, 'Dashboard profile prompt should disappear after profile completion');
    const dashboardCompany = await page.locator('#dash-company-title').innerText();
    assert(dashboardCompany === 'Regulated Test Sdn Bhd', 'Dashboard company title did not update');

    await page.evaluate(() => window.doLogout());
    await page.waitForSelector('#screen-login.screen.active', { timeout: 10000 });
    await page.fill('#login-email', email);
    await page.fill('#login-password', password);
    await page.click('#login-btn');
    await page.waitForFunction(
      () => location.hash === '#/dashboard' && document.querySelector('#screen-app.active'),
      null,
      { timeout: 30000, polling: 200 }
    );
    const secondLoginPromptCount = await page.locator('#dashboard-profile-prompt').count();
    assert(secondLoginPromptCount === 0, 'Second login with completed profile should go to dashboard without profile prompt');

    assert(pageErrors.length === 0, `Browser page errors occurred: ${pageErrors.join(' | ')}`);
    console.log('PASS profile company info flow');
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
