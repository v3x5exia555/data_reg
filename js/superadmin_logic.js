/* superadmin_logic.js — Accounts page (Superadmin only) */

let accountsCache = [];
let accountSeatUsageCache = {};

async function loadAccounts() {
  if (state.role !== 'Superadmin') {
    renderAccountStats([], {});
    renderAccountsList([], {});
    return;
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    renderAccountStats([], {});
    renderAccountsList([], {});
    return;
  }

  const { data: accounts = [], error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    JARVIS_LOG.error('Accounts', 'Load', error);
    renderAccountStats([], {});
    renderAccountsList([], {});
    return;
  }

  // Per-account seat usage (count user_profiles per account_id).
  const ids = accounts.map(a => a.id);
  let counts = [];
  if (ids.length) {
    const { data, error: countError } = await supabase
      .from('user_profiles')
      .select('account_id')
      .in('account_id', ids);
    if (countError) console.warn('[Accounts] Seat count failed', countError);
    counts = data || [];
  }
  const seatUsage = (counts || []).reduce((m, r) => {
    m[r.account_id] = (m[r.account_id] || 0) + 1;
    return m;
  }, {});

  accountsCache = accounts || [];
  accountSeatUsageCache = seatUsage || {};
  renderAccountStats(accountsCache, accountSeatUsageCache);
  renderAccountsList(accountsCache, accountSeatUsageCache);
}

function renderAccountStats(accounts, seatUsage) {
  if (!document.getElementById('stat-total')) return;
  const total = accounts.length;
  const active = accounts.filter(a => a.status === 'active').length;
  const suspended = accounts.filter(a => a.status === 'suspended').length;
  const seatsUsed = Object.values(seatUsage).reduce((a, b) => a + b, 0);
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-seats').textContent = seatsUsed;
  document.getElementById('stat-suspended').textContent = suspended;
}

function renderAccountsList(accounts, seatUsage) {
  const list = document.getElementById('accounts-list');
  if (!list) return;
  const search = (document.getElementById('account-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('account-status-filter')?.value || 'all';
  const filtered = accounts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    const haystack = [a.name, a.status, a.id].filter(Boolean).join(' ').toLowerCase();
    if (search && !haystack.includes(search)) return false;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `
      <div class="accounts-empty">
        <div class="accounts-empty-icon"><i class="fa-solid fa-building-circle-exclamation" aria-hidden="true"></i></div>
        <h3>No accounts found</h3>
        <p>Try another search, change the status filter, or create a new account.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="accounts-table-head">
      <span>Account</span>
      <span>Status</span>
      <span>Seats</span>
      <span>Actions</span>
    </div>
    ${filtered.map(a => {
      const used = seatUsage[a.id] || 0;
      const limit = a.seat_limit || 0;
      const status = a.status || 'active';
      const initials = accountInitials(a.name);
      return `
    <article class="account-row ${status === 'suspended' ? 'is-suspended' : ''}" data-id="${a.id}">
      <button class="account-main" type="button" data-action="view-as" data-id="${a.id}" aria-label="View as ${escapeHtml(a.name || 'account')}">
        <span class="account-avatar">${initials}</span>
        <span class="account-copy">
          <span class="account-name">${escapeHtml(a.name || 'Untitled account')}</span>
          <span class="account-meta">${escapeHtml(a.id || '')}</span>
        </span>
      </button>
      <div class="account-status">
        <span class="account-status-badge ${status === 'active' ? 'active' : 'suspended'}">${escapeHtml(status)}</span>
      </div>
      <div class="account-seat-pill">${used}/${limit} seats</div>
      <div class="account-actions">
        <button class="btn-secondary account-action-primary" data-action="view-as" data-id="${a.id}">View as</button>
        <button class="btn-secondary" data-action="edit-seats" data-id="${a.id}">Seats</button>
        <button class="btn-secondary" data-action="${status === 'active' ? 'suspend' : 'reactivate'}" data-id="${a.id}">
          ${status === 'active' ? 'Suspend' : 'Reactivate'}
        </button>
        <button class="btn-danger" data-action="delete" data-id="${a.id}">Delete</button>
      </div>
    </article>`;
    }).join('')}`;
}

function enterViewAs(accountId) {
  state.viewAsAccountId = accountId;
  localStorage.setItem('viewAsAccountId', accountId);
  if (typeof renderViewAsBanner === 'function') renderViewAsBanner();
  if (typeof navigateTo === 'function') navigateTo('dashboard');
}

function exitViewAs() {
  state.viewAsAccountId = null;
  localStorage.removeItem('viewAsAccountId');
  if (typeof renderViewAsBanner === 'function') renderViewAsBanner();
  if (typeof navigateTo === 'function') navigateTo('accounts');
}

async function createAccountFromForm(formEl) {
  const fd = new FormData(formEl);
  const body = {
    mode: 'account',
    email: fd.get('email'),
    temp_password: fd.get('temp_password'),
    company_name: fd.get('company_name'),
    seat_limit: Number(fd.get('seat_limit')),
    seed_sample_data: fd.get('seed_sample_data') === 'on',
  };
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const supaUrl = (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) || window.ENV?.SUPABASE_URL || (window.SUPABASE_URL || '');
  const res = await fetch(`${supaUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  if (!res.ok) {
    showToast(out.error || 'Failed to create account', 'error');
    return;
  }
  // Show credentials before sign-out so admin can note them
  alert(`Account created!\n\nEmail: ${out.email}\nPassword: ${out.temp_password}\n\nShare these credentials with the new user.`);
  if (typeof closeModal === 'function') closeModal('modal-new-account');
  // Sign out superadmin so the new account admin can log in immediately
  try { await supabase.auth.signOut(); } catch (e) { console.error('Signout error', e); }
  if (typeof clearSession === 'function') clearSession();
  if (typeof goTo === 'function') goTo('screen-login');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function accountInitials(name) {
  return String(name || 'A')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A';
}

document.addEventListener('click', (e) => {
  const closeId = e.target?.dataset?.close;
  if (closeId && typeof closeModal === 'function') {
    closeModal(closeId);
    return;
  }

  const actionEl = e.target?.closest?.('[data-action]');
  const action = actionEl?.dataset?.action;
  if (!action) return;
  const id = actionEl.dataset.id;
  if (action === 'view-as') enterViewAs(id);
  else if (action === 'suspend') updateAccountStatus(id, 'suspended');
  else if (action === 'reactivate') updateAccountStatus(id, 'active');
  else if (action === 'edit-seats') openEditSeatsModal(id);
  else if (action === 'delete') openDeleteAccountModal(id);
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'form-new-account') {
    e.preventDefault();
    createAccountFromForm(e.target);
  }
});

document.addEventListener('input', (e) => {
  if (e.target?.id === 'account-search') {
    renderAccountsList(accountsCache, accountSeatUsageCache);
  }
});

document.addEventListener('change', (e) => {
  if (e.target?.id === 'account-status-filter') {
    renderAccountsList(accountsCache, accountSeatUsageCache);
  }
});

document.addEventListener('click', (e) => {
  if (e.target?.id === 'btn-new-account') {
    if (typeof openModal === 'function') openModal('modal-new-account');
  }
});

async function updateAccountStatus(accountId, status) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('accounts').update({ status }).eq('id', accountId);
  if (error) { showToast('Update failed', 'error'); return; }
  await loadAccounts();
}

function openEditSeatsModal(accountId) {
  const next = window.prompt('New seat limit (>=1):');
  if (!next) return;
  const n = parseInt(next, 10);
  if (!n || n < 1) { showToast('Invalid value', 'error'); return; }
  const supabase = getSupabaseClient();
  supabase.from('accounts').update({ seat_limit: n }).eq('id', accountId)
    .then(({ error }) => {
      if (error) showToast('Update failed', 'error');
      else loadAccounts();
    });
}

function openDeleteAccountModal(accountId) {
  const row = document.querySelector(`.account-row[data-id="${accountId}"]`);
  const name = row?.querySelector('.account-name')?.textContent || 'this account';
  const typed = window.prompt(`Type the account name to confirm deletion:\n${name}`);
  if (typed !== name) { showToast('Cancelled', 'info'); return; }
  const supabase = getSupabaseClient();
  supabase.from('accounts').delete().eq('id', accountId)
    .then(({ error }) => {
      if (error) showToast('Delete failed', 'error');
      else loadAccounts();
    });
}
