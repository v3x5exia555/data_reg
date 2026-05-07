/**
 * vendor_logic.js — DataRex Vendor Management Module
 * STATUS: Supabase-backed with Local Storage fallback
 */

function normalizeVendorRecord(record = {}) {
  const dataShared = Array.isArray(record.data_processed)
    ? record.data_processed.join(', ')
    : (record.data_shared || record.data_processed || '');
  const hasAgreement = record.has_agreement ?? record.has_dpa ?? false;
  return {
    id: record.id,
    vendor_name: record.vendor_name || '',
    service_type: record.service_type || '',
    data_shared: dataShared,
    risk_level: record.risk_level || 'Low',
    status: record.status || 'Active',
    has_agreement: !!hasAgreement,
    agreement_date: record.agreement_date || null,
    contact_email: record.contact_email || '',
    notes: record.notes || '',
    created_at: record.created_at || new Date().toISOString()
  };
}

function readLocalVendors() {
  try {
    const list = JSON.parse(localStorage.getItem('vendor_data') || '[]');
    return Array.isArray(list) ? list.map(normalizeVendorRecord) : [];
  } catch (err) {
    console.error('[JARVIS] Local Storage Parse Error (Vendors)', err);
    return [];
  }
}

async function loadVendorsFromSupabase() {
  console.log('[JARVIS] Fetching Vendors...');
  const localData = readLocalVendors();
  state.vendors = localData;
  renderVendors(localData);

  const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  const configured = typeof isSupabaseConfigured !== 'function' || isSupabaseConfigured();
  if (!supabase || !configured) {
    console.log('[JARVIS] Supabase not configured; using local vendor data.');
    return;
  }

  try {
    const accountId = (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null;
    let query = supabase.from('vendors').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[JARVIS] Vendors Supabase Fetch Error:', error.message);
      return;
    }

    const remote = (data || []).map(normalizeVendorRecord);
    if (remote.length === 0) {
      console.log('[JARVIS] Vendors: Supabase returned 0 rows; keeping local data.');
      return;
    }

    const seen = new Set(remote.map(r => r.id).filter(Boolean));
    const localOnly = localData.filter(r => !r.id || !seen.has(r.id));
    const merged = [...remote, ...localOnly];

    console.log(`[JARVIS] Vendors FETCH SUCCESS: ${remote.length} from Supabase, ${localOnly.length} local-only.`);
    state.vendors = merged;
    localStorage.setItem('vendor_data', JSON.stringify(merged));
    renderVendors(merged);
  } catch (err) {
    console.error('[JARVIS] Vendors fetch exception:', err);
  }
}

function renderVendors(vendors) {
  const tbody = document.getElementById('vendors-tbody');
  if (!tbody) return;
  const list = vendors || [];

  // Summary Update
  const totalCount = document.getElementById('vendor-total-count');
  const dpaCount = document.getElementById('vendor-dpa-count');
  const pendingCount = document.getElementById('vendor-pending-count');

  if (totalCount) totalCount.textContent = list.length;
  if (dpaCount) dpaCount.textContent = list.filter(v => v.has_agreement).length;
  if (pendingCount) pendingCount.textContent = list.filter(v => !v.has_agreement).length;

  const getRiskBadge = (risk) => {
    if (risk === 'High') return '<span class="vendor-badge vendor-badge-high">High</span>';
    if (risk === 'Medium') return '<span class="vendor-badge vendor-badge-medium">Medium</span>';
    return '<span class="vendor-badge vendor-badge-low">Low</span>';
  };

  const getAgreementStatus = (v) => {
    if (v.has_agreement) return '<span class="vendor-signed">Signed</span>';
    return '<span class="vendor-missing">Missing</span>';
  };

  // The TH Blueprint Implementation
  const thStyle = "background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; padding:12px 16px; border-bottom:1px solid #e2e8f0;";

  const headerHTML = `
    <div class="data-table-wrap" style="background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
      <table class="styled-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${thStyle}">Vendor Name</th>
            <th style="${thStyle}">Service Type</th>
            <th style="${thStyle}">Data Shared</th>
            <th style="${thStyle}">Risk</th>
            <th style="${thStyle}">DPA</th>
            <th style="${thStyle} width:100px;">Actions</th>
          </tr>
        </thead>
        <tbody>`;

  if (list.length === 0) {
    tbody.innerHTML = headerHTML + `
          <tr>
            <td colspan="6" style="padding:24px; text-align:center; color:#94a3b8; font-size:14px;">
              No vendors found. Click "Add Vendor" to begin.
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
    return;
  }

  tbody.innerHTML = headerHTML + list.map((v, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px; font-weight:600; color:#1e293b;">${v.vendor_name || '—'}</td>
            <td style="padding:12px 16px; color:#475569;">${v.service_type || '—'}</td>
            <td style="padding:12px 16px; color:#64748b; font-size:12px;">${v.data_shared || '—'}</td>
            <td style="padding:12px 16px;">${getRiskBadge(v.risk_level)}</td>
            <td style="padding:12px 16px;">${getAgreementStatus(v)}</td>
            <td style="padding:12px 16px;">
              <button class="btn-edit" onclick="editVendor(${i})" style="padding:4px 8px; font-size:11px;">Edit</button>
            </td>
          </tr>`).join('') + `
        </tbody>
      </table>
    </div>`;
}

function resetVendorForm() {
  const fields = {
    'vendor-index': '-1',
    'vendor-name': '',
    'vendor-service': '',
    'vendor-data-shared': '',
    'vendor-risk': 'Low',
    'vendor-status': 'Active',
    'vendor-agreement': 'Missing',
    'vendor-agreement-date': '',
    'vendor-notes': ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  const title = document.querySelector('#modal-vendor .modal-vendor-title');
  if (title) title.textContent = 'Add vendor';
  const saveBtn = document.getElementById('vendor-save-btn');
  if (saveBtn) saveBtn.textContent = 'Add vendor';
}

function editVendor(index) {
  const vendor = state.vendors?.[index];
  if (!vendor) return;

  const values = {
    'vendor-index': String(index),
    'vendor-name': vendor.vendor_name || '',
    'vendor-service': vendor.service_type || '',
    'vendor-data-shared': vendor.data_shared || '',
    'vendor-risk': vendor.risk_level || 'Low',
    'vendor-status': vendor.status || 'Active',
    'vendor-agreement': vendor.has_agreement ? 'Signed' : 'Missing',
    'vendor-agreement-date': vendor.agreement_date || '',
    'vendor-notes': vendor.notes || ''
  };

  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  const title = document.querySelector('#modal-vendor .modal-vendor-title');
  if (title) title.textContent = 'Edit vendor';
  const saveBtn = document.getElementById('vendor-save-btn');
  if (saveBtn) saveBtn.textContent = 'Update vendor';
  openModal('modal-vendor');
}

async function saveVendor() {
  const name = document.getElementById('vendor-name').value.trim();
  const service = document.getElementById('vendor-service').value.trim();
  const dataShared = document.getElementById('vendor-data-shared').value.trim();
  const risk = document.getElementById('vendor-risk').value;
  const status = document.getElementById('vendor-status').value;
  const agreement = document.getElementById('vendor-agreement').value === 'Signed';
  const agreementDate = document.getElementById('vendor-agreement-date').value;
  const notes = document.getElementById('vendor-notes').value.trim();
  const editIndex = parseInt(document.getElementById('vendor-index').value);

  if (!name) { showToast('Vendor name is required', 'error'); return; }

  const vendorData = {
    vendor_name: name,
    service_type: service,
    data_processed: dataShared ? dataShared.split(',').map(s => s.trim()).filter(Boolean) : [],
    risk_level: risk,
    status: status,
    has_dpa: agreement,
    agreement_date: agreementDate || null,
    notes: notes
  };

  state.vendors = state.vendors || [];
  const existingVendor = editIndex > -1 ? state.vendors[editIndex] : null;
  const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  const configured = typeof isSupabaseConfigured !== 'function' || isSupabaseConfigured();
  const orgId = (typeof getCurrentOrgId === 'function') ? getCurrentOrgId() : (state.user?.id || null);

  let supabaseSucceeded = false;
  if (supabase && configured && orgId) {
    try {
      if (existingVendor && existingVendor.id && !String(existingVendor.id).startsWith('local-')) {
        const { error } = await supabase.from('vendors')
          .update({ ...vendorData, updated_at: new Date().toISOString() })
          .eq('id', existingVendor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vendors')
          .insert([{
            ...vendorData,
            org_id: orgId,
            account_id: (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null
          }]);
        if (error) throw error;
      }
      supabaseSucceeded = true;
    } catch (err) {
      console.error('[JARVIS] Vendor Supabase Save Error', err);
    }
  }

  // Local mirror: keep localStorage in sync (used as fallback when offline).
  const localRecord = normalizeVendorRecord({
    ...vendorData,
    id: existingVendor?.id || ('local-' + Date.now()),
    data_shared: dataShared,
    has_agreement: agreement,
    created_at: existingVendor?.created_at || new Date().toISOString()
  });
  if (editIndex > -1) {
    state.vendors[editIndex] = { ...existingVendor, ...localRecord };
  } else {
    state.vendors.unshift(localRecord);
  }
  localStorage.setItem('vendor_data', JSON.stringify(state.vendors));

  closeModal('modal-vendor');

  if (supabaseSucceeded) {
    await loadVendorsFromSupabase();
    showToast('Vendor saved', 'success');
  } else {
    renderVendors(state.vendors);
    showToast(supabase && configured ? 'Vendor saved locally; Supabase save failed' : 'Vendor saved locally', 'warning');
  }
}
