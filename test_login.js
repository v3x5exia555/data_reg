const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  
  await page.goto('http://localhost:8060/#/login');
  
  // Wait for login form
  await page.waitForSelector('#login-email');
  await page.type('#login-email', 'test@test.com');
  await page.type('#login-password', '123456');
  
  await page.click('#login-btn');
  
  console.log('Clicked login, waiting 4 seconds...');
  await page.waitForTimeout(4000);
  
  const currentUrl = await page.url();
  console.log('Current URL:', currentUrl);
  
  const activeScreen = await page.evaluate(() => {
    const el = document.querySelector('.screen.active');
    return el ? el.id : null;
  });
  console.log('Active Screen:', activeScreen);
  
  await browser.close();
})();
