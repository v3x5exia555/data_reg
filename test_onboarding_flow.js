const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = process.env.APP_URL || 'http://localhost:8060';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function activeScreen(page) {
  return page.evaluate(() => document.querySelector('.screen.active')?.id || null);
}

async function visibleFieldIds(page) {
  return page.$$eval('#screen-register input, #screen-register select', fields =>
    fields
      .filter(field => {
        const style = window.getComputedStyle(field);
        const rect = field.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .map(field => field.id)
  );
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (msg.type() === 'error') console.log('BROWSER CONSOLE ERROR:', text);
  });
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.log('BROWSER PAGE ERROR:', error.message);
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });

    await page.goto(`${BASE_URL}/#/onboarding`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-onboarding.screen.active', { timeout: 10000 });
    await page.waitForSelector('#onboard-profile-company', { timeout: 10000 });
    await page.waitForSelector('#onboard-profile-industry', { timeout: 10000 });
    await page.waitForSelector('#onboard-profile-company-size', { timeout: 10000 });
    await page.waitForSelector('#onboard-profile-country', { timeout: 10000 });
    await page.waitForSelector('#onboard-profile-official-email', { timeout: 10000 });
    const legacyBusinessCards = await page.locator('#biz-options .option-card').count();
    assert(legacyBusinessCards === 0, 'Onboarding should use profile fields instead of old business cards');

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });

    await page.getByRole('button', { name: /^Log in$/i }).click();
    await page.waitForSelector('#screen-login.screen.active', { timeout: 5000 });
    assert(await activeScreen(page) === 'screen-login', 'Log in CTA did not route to login');

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
    await page.getByRole('button', { name: /^Get Started$/i }).click();
    await page.waitForSelector('#screen-register.screen.active', { timeout: 5000 });
    assert(await activeScreen(page) === 'screen-register', 'Get Started CTA did not route to create account');

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
    await page.getByRole('button', { name: /Start for free/i }).click();
    await page.waitForSelector('#screen-register.screen.active', { timeout: 5000 });

    const trialWording = await page.getByText(/14-day free trial/i).count();
    assert(trialWording === 0, 'Create Account still shows 14-day free trial wording');

    const fields = await visibleFieldIds(page);
    assert(fields.includes('register-email'), 'Create Account is missing email field');
    assert(fields.includes('register-password'), 'Create Account is missing password field');
    const forbiddenFields = [
      'register-name',
      'register-company',
      'register-industry',
      'register-size',
      'register-reg-no',
      'register-confirm'
    ];
    const stillVisible = forbiddenFields.filter(id => fields.includes(id));
    assert(stillVisible.length === 0, `Create Account still shows deferred fields: ${stillVisible.join(', ')}`);

    const email = `onboarding-${Date.now()}@example.com`;
    await page.fill('#register-email', email);
    await page.fill('#register-password', 'Account123!');
    await page.click('#register-btn');
    await page.waitForSelector('#screen-onboarding.screen.active', { timeout: 10000 });
    const storedUser = await page.evaluate(userEmail => {
      const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
      return users.find(user => user.email === userEmail);
    }, email);
    assert(storedUser?.name === email.split('@')[0], 'Simplified signup did not derive default name from email');
    assert(storedUser?.company === '', 'Simplified signup should defer company');
    assert(storedUser?.industry === '', 'Simplified signup should defer industry');
    assert(storedUser?.size === '1-10', 'Simplified signup should save safe default company size');
    assert(storedUser?.regNo === '', 'Simplified signup should defer registration number');

    await page.fill('#onboard-profile-company', 'Onboarding Profile Sdn Bhd');
    await page.selectOption('#onboard-profile-industry', 'Health / Healthcare');
    await page.selectOption('#onboard-profile-company-size', '11-50');
    await page.click('#finish-onboard');
    await page.waitForSelector('#onboard-save-status.profile-save-status.error', { timeout: 10000 });
    await page.fill('#onboard-profile-country', 'Malaysia');
    await page.fill('#onboard-profile-official-email', 'privacy@onboarding.test');
    await page.fill('#onboard-profile-ssm-number', '202402000002');
    await page.fill('#onboard-profile-website', 'https://onboarding.test');
    await page.fill('#onboard-profile-contact-number', '+60387654321');
    await page.fill('#onboard-profile-business-address', '88 Profile Street, Kuala Lumpur');
    await page.click('#finish-onboard');
    await page.waitForURL(/#\/dashboard$/, { timeout: 10000 });
    await page.waitForSelector('#page-dashboard.active', { timeout: 10000 });
    const savedOnboardingUser = await page.evaluate(userEmail => {
      const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
      const savedState = JSON.parse(localStorage.getItem('dataRexState') || '{}');
      return {
        user: users.find(user => user.email === userEmail),
        stateUser: savedState.user
      };
    }, email);
    assert(savedOnboardingUser.user?.company === 'Onboarding Profile Sdn Bhd', 'Onboarding did not save company');
    assert(savedOnboardingUser.user?.industry === 'Health / Healthcare', 'Onboarding did not save industry');
    assert(savedOnboardingUser.user?.size === '11-50', 'Onboarding did not save company size');
    assert(savedOnboardingUser.user?.country === 'Malaysia', 'Onboarding did not save country');
    assert(savedOnboardingUser.user?.officialEmail === 'privacy@onboarding.test', 'Onboarding did not save official email');
    assert(savedOnboardingUser.user?.ssmNumber === '202402000002', 'Onboarding did not save SSM number');
    assert(savedOnboardingUser.user?.website === 'https://onboarding.test', 'Onboarding did not save website');
    assert(savedOnboardingUser.user?.contactNumber === '+60387654321', 'Onboarding did not save contact number');
    assert(savedOnboardingUser.user?.businessAddress === '88 Profile Street, Kuala Lumpur', 'Onboarding did not save business address');
    assert(savedOnboardingUser.stateUser?.companySize === '11-50', 'Onboarding did not save state company size');
    assert(savedOnboardingUser.stateUser?.country === 'Malaysia', 'Onboarding did not save state country');
    assert(savedOnboardingUser.stateUser?.officialEmail === 'privacy@onboarding.test', 'Onboarding did not save state official email');
    const summaryStillVisible = await page.locator('#page-dashboard .summary-screen').count();
    assert(summaryStillVisible === 0, 'Onboarding should route directly to dashboard without setup summary');

    const dashboardVisible = await page.$eval('#page-dashboard', el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && !el.hidden;
    });
    assert(dashboardVisible, 'Dashboard page is not visible after signup');

    const uploadPath = path.join(os.tmpdir(), `datarex-upload-${Date.now()}.txt`);
    const uploadName = path.basename(uploadPath);
    fs.writeFileSync(uploadPath, 'DataRex Playwright upload retention check\n');

    await page.evaluate(() => window.showPage('documents', document.getElementById('nav-documents')));
    await page.waitForSelector('#page-documents.active', { timeout: 10000 });
    await page.setInputFiles('#file-input', uploadPath);
    await page.click('button:has-text("Upload")');
    await page.waitForSelector(`text=${uploadName}`, { timeout: 10000 });
    const storedBeforeLogout = await page.evaluate(name => {
      const docs = JSON.parse(localStorage.getItem('datarex_documents') || '[]');
      return docs.some(doc => doc.name === name && doc.dataUrl);
    }, uploadName);
    assert(storedBeforeLogout, 'Uploaded document was not written to local document storage with content');

    await page.evaluate(() => window.doLogout());
    await page.waitForSelector('#screen-login.screen.active', { timeout: 10000 });
    await page.fill('#login-email', email);
    await page.fill('#login-password', 'Account123!');
    await page.click('#login-btn');
    await page.waitForURL(/#\/dashboard$/, { timeout: 15000 });
    await page.evaluate(() => window.showPage('documents', document.getElementById('nav-documents')));
    await page.waitForSelector('#page-documents.active', { timeout: 10000 });
    await page.waitForSelector(`text=${uploadName}`, { timeout: 10000 });
    const storedAfterLogin = await page.evaluate(name => {
      const docs = JSON.parse(localStorage.getItem('datarex_documents') || '[]');
      return docs.some(doc => doc.name === name && doc.dataUrl);
    }, uploadName);
    assert(storedAfterLogin, 'Uploaded document was not retained after logout and login');

    assert(pageErrors.length === 0, `Browser page errors occurred: ${pageErrors.join(' | ')}`);

    console.log('PASS onboarding flow');
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
