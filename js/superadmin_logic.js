/* superadmin_logic.js — Accounts page (Superadmin only) */

async function loadAccounts() {
  if (state.role !== 'Superadmin') return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    JARVIS_LOG.error('Accounts', 'Load', error);
    return;
  }

  // Per-account seat usage (count user_profiles per account_id).
  const ids = accounts.map(a => a.id);
  const { data: counts } = await supabase
    .from('user_profiles')
    .select('account_id')
    .in('account_id', ids);
  const seatUsage = (counts || []).reduce((m, r) => {
    m[r.account_id] = (m[r.account_id] || 0) + 1;
    return m;
  }, {});

  renderAccountStats(accounts, seatUsage);
  renderAccountsList(accounts, seatUsage);
}

function renderAccountStats(accounts, seatUsage) {
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
  const search = (document.getElementById('account-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('account-status-filter')?.value || 'all';
  const filtered = accounts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search && !a.name.toLowerCase().includes(search)) return false;
    return true;
  });
  list.innerHTML = filtered.map(a => `
    <article class="account-row" data-id="${a.id}">
      <div class="account-name">${escapeHtml(a.name)}</div>
      <div class="account-meta">
        ${seatUsage[a.id] || 0}/${a.seat_limit} seats · ${a.status}
      </div>
      <div class="account-actions">
        <button class="btn-secondary" data-action="view-as" data-id="${a.id}">View as</button>
        <button class="btn-secondary" data-action="edit-seats" data-id="${a.id}">Edit seats</button>
        <button class="btn-secondary" data-action="${a.status === 'active' ? 'suspend' : 'reactivate'}" data-id="${a.id}">
          ${a.status === 'active' ? 'Suspend' : 'Reactivate'}
        </button>
        <button class="btn-danger" data-action="delete" data-id="${a.id}">Delete</button>
      </div>
    </article>
  `).join('');
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
  showToast(`Created. Email: ${out.email}  Password: ${out.temp_password}`, 'success');
  if (typeof closeModal === 'function') closeModal('modal-new-account');
  await loadAccounts();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.addEventListener('click', (e) => {
  const action = e.target?.dataset?.action;
  if (!action) return;
  const id = e.target.dataset.id;
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
