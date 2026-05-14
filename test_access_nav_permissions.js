const { chromium } = require('playwright');

const BASE_URL = process.env.APP_URL || 'http://localhost:8060';
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function bootWithMockSupabase(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-landing.screen.active', { timeout: 15000 });
  await page.evaluate(() => {
    window.__navRows = [];
    const makeQuery = (table) => {
      const query = {
        _table: table,
        _filters: [],
        select() { return this; },
        eq(column, value) { this._filters.push({ column, value }); return this; },
        order() { return this; },
        limit() { return this; },
        maybeSingle() { return this.single(); },
        insert() { return Promise.resolve({ data: null, error: null }); },
        update() { return this; },
        delete() { return this; },
        count() { return this; },
        single() {
          const row = (window.__navRows || []).find(r => this._filters.every(f => r[f.column] === f.value));
          return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { message: 'No row' } });
        },
        upsert(records) {
          records.forEach(record => {
            const index = window.__navRows.findIndex(row =>
              row.account_id === record.account_id &&
              row.access_level === record.access_level &&
              row.nav_item === record.nav_item
            );
            if (index >= 0) window.__navRows[index] = { ...window.__navRows[index], ...record };
            else window.__navRows.push({ ...record });
          });
          return Promise.resolve({ data: records, error: null });
        },
        then(resolve) {
          const rows = (window.__navRows || []).filter(r => this._filters.every(f => r[f.column] === f.value));
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
      };
      return query;
    };
    supabaseClient = {
      from: makeQuery,
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'admin-1' } } } }) }
    };
    window.demoLogin();
    state.role = 'Accountadmin';
    state.accountId = 'acct-1';
    state.user.id = 'admin-1';
    window.saveState();
  });
  await page.waitForSelector('#screen-app.screen.active', { timeout: 15000 });
}

async function openAccess(page) {
  await page.evaluate(() => window.showPage('access', document.getElementById('nav-access')));
  await page.waitForSelector('#page-access.active', { timeout: 15000 });
  await page.waitForSelector('#nav-permissions-matrix .nav-perm-toggle', { state: 'attached', timeout: 15000 });
}

async function readNavPermission(page, role, navItem) {
  return page.evaluate(({ role, navItem }) => {
    const row = window.__navRows.find(r => (
      r.account_id === 'acct-1' &&
      r.access_level === role &&
      r.nav_item === navItem
    ));
    return row?.is_visible;
  }, { role, navItem });
}

async function setToggleAndSave(page, role, navItem, checked) {
  await page.selectOption('#nav-role-select', role);
  await page.waitForSelector(`#nav-permissions-matrix .nav-perm-toggle[data-nav="${navItem}"]`, { state: 'attached', timeout: 15000 });
  const toggle = page.locator(`#nav-permissions-matrix .nav-perm-toggle[data-nav="${navItem}"]`);
  if (await toggle.isChecked() !== checked) {
    await page.evaluate(({ navItem, checked }) => {
      const input = document.querySelector(`#nav-permissions-matrix .nav-perm-toggle[data-nav="${navItem}"]`);
      input.checked = checked;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { navItem, checked });
  }
  await page.evaluate(() => window.saveNavConfig());
  await page.waitForFunction(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Permissions'));
    return btn && !btn.disabled;
  }, { timeout: 15000 });
}

async function applyRole(page, role) {
  await page.evaluate(async role => {
    state.role = role;
    state.currentUserLevel = role;
    await window.loadNavPermissionsFromDB(role);
    window.applyNavPermissions();
  }, role);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER CONSOLE ERROR:', msg.text());
  });
  page.on('pageerror', error => console.log('BROWSER PAGE ERROR:', error.message));

  try {
    await bootWithMockSupabase(page);
    await openAccess(page);

    await setToggleAndSave(page, 'user', 'dataregister', false);
    assert(await readNavPermission(page, 'user', 'dataregister') === false, 'dataregister=false was not saved to nav_permissions');
    await applyRole(page, 'user');
    const dataRegisterDisplay = await page.$eval('#nav-dataregister', el => getComputedStyle(el).display);
    assert(dataRegisterDisplay === 'none', 'User can still see Data Register after disabling it');

    await setToggleAndSave(page, 'user', 'dataregister', true);
    assert(await readNavPermission(page, 'user', 'dataregister') === true, 'dataregister=true was not saved to nav_permissions');
    await applyRole(page, 'user');
    const dataRegisterVisible = await page.$eval('#nav-dataregister', el => getComputedStyle(el).display);
    assert(dataRegisterVisible !== 'none', 'User cannot see Data Register after enabling it');

    await setToggleAndSave(page, 'user', 'access', true);
    assert(await readNavPermission(page, 'user', 'access') === false, 'locked access permission should be saved as false');
    await applyRole(page, 'user');
    const accessVisible = await page.$eval('#nav-access', el => getComputedStyle(el).display);
    assert(accessVisible === 'none', 'User can see locked Access Control');

    console.log('PASS access nav permissions');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
