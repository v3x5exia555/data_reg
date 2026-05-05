/**
 * vendor_logic.js — DataRex Vendor Management Module
 * Persistence: Supabase 'vendors' table
 * Design: Elite UI with TH Blueprint
 */

async function loadVendorsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  console.log('[JARVIS] Fetching Vendors...');
  try {
    const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
    const orgId = currentCompany ? currentCompany.id : state.user?.id;
    
    let query = supabase.from('vendors').select('*');
    if (orgId) query = query.eq('org_id', orgId);

    const { data, error } = await query.order('vendor_name');
    console.log('[JARVIS] Raw Data (Vendors):', data);
    
    if (error) {
      JARVIS_LOG.error('Vendors', 'Fetch Error', error);
      renderVendors([]);
      return;
    }
    
    if (data) {
      console.log(`[JARVIS] Fetching Vendors... Success: ${data.length} records retrieved.`);
      state.vendors = data.map(v => ({
        id: v.id,
        vendor_name: v.vendor_name,
        service_type: v.service_type,
        data_shared: v.data_shared || v.data_processed,
        risk_level: v.risk_level || 'Low',
        status: v.status || 'Active',
        has_agreement: v.has_agreement || v.has_dpa || false,
        agreement_date: v.agreement_date || null,
        notes: v.notes || '',
        created_at: v.created_at
      }));
      renderVendors(state.vendors);
    }
  } catch (err) {
    JARVIS_LOG.error('Vendors', 'Exception', err);
    renderVendors([]);
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

  if (list.length === 0) {
    tbody.innerHTML = `<div class="empty-state">No vendors found.</div>`;
    return;
  }

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

  tbody.innerHTML = `
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
        <tbody>${list.map((v, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px; font-weight:600; color:#1e293b;">${v.vendor_name || '—'}</td>
            <td style="padding:12px 16px; color:#475569;">${v.service_type || '—'}</td>
            <td style="padding:12px 16px; color:#64748b; font-size:12px;">${v.data_shared || '—'}</td>
            <td style="padding:12px 16px;">${getRiskBadge(v.risk_level)}</td>
            <td style="padding:12px 16px;">${getAgreementStatus(v)}</td>
            <td style="padding:12px 16px;">
              <button class="btn-edit" onclick="editVendor(${i})" style="padding:4px 8px; font-size:11px;">Edit</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function saveVendor() {
  const supabase = getSupabaseClient();
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
    data_shared: dataShared,
    risk_level: risk,
    status: status,
    has_agreement: agreement,
    agreement_date: agreementDate || null,
    notes: notes
  };

  const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
  const orgId = currentCompany ? currentCompany.id : state.user?.id;

  try {
    if (editIndex > -1) {
      const existingVendor = state.vendors[editIndex];
      if (supabase && isSupabaseConfigured() && existingVendor.id && !String(existingVendor.id).startsWith('local-')) {
        const { error } = await supabase.from('vendors').update(vendorData).eq('id', existingVendor.id);
        if (error) throw error;
        JARVIS_LOG.success('Vendors', 'Update', { id: existingVendor.id });
      }
      state.vendors[editIndex] = { ...existingVendor, ...vendorData };
    } else {
      if (supabase && isSupabaseConfigured()) {
        const { data, error } = await supabase.from('vendors').insert([{ org_id: orgId, ...vendorData }]).select().single();
        if (error) throw error;
        JARVIS_LOG.success('Vendors', 'Insert', { id: data?.id });
        state.vendors.unshift(data);
      } else {
        state.vendors.unshift({ ...vendorData, id: 'local-' + Date.now() });
      }
    }
    
    renderVendors(state.vendors);
    closeModal('modal-vendor');
    showToast('Vendor saved successfully', 'success');
  } catch (err) {
    JARVIS_LOG.error('Vendors', 'Save Error', err);
    showToast('Failed to save vendor: ' + err.message, 'error');
  }
}
