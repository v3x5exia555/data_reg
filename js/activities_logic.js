/**
 * activities_logic.js — DataRex Processing Activities Module
 * Persistence: Supabase 'processing_activities' table
 * Design: Complex Checkbox Matrix & TH Blueprint
 */

async function loadActivitiesFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  console.log('[JARVIS] Fetching Processing Activities...');
  try {
    const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
    const orgId = currentCompany ? currentCompany.id : state.user?.id;
    
    let query = supabase.from('processing_activities').select('*');
    if (orgId) query = query.eq('org_id', orgId);

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      JARVIS_LOG.error('Activities', 'Fetch Error', error);
      renderActivities([]);
      return;
    }
    
    if (data) {
      console.log(`[JARVIS] FETCH SUCCESS: ${data.length} Activities retrieved.`);
      state.processingActivities = data;
      renderActivities(data);
    }
  } catch (err) {
    JARVIS_LOG.error('Activities', 'Exception', err);
    renderActivities([]);
  }
}

function renderActivities(list) {
  const tbody = document.getElementById('activities-tbody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `<div class="empty-state">No activities found.</div>`;
    return;
  }

  const thStyle = "background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; padding:12px 16px; border-bottom:1px solid #e2e8f0;";

  tbody.innerHTML = `
    <div class="data-table-wrap" style="background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${thStyle}">Activity Name</th>
            <th style="${thStyle}">Purpose</th>
            <th style="${thStyle}">Data Subjects</th>
            <th style="${thStyle}">Legal Basis</th>
            <th style="${thStyle}">Status</th>
            <th style="${thStyle} width:100px;">Actions</th>
          </tr>
        </thead>
        <tbody>${list.map((a, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px; font-weight:600; color:#1e293b;">${a.name || '—'}</td>
            <td style="padding:12px 16px; color:#475569; font-size:12px;">${a.purpose || '—'}</td>
            <td style="padding:12px 16px; color:#64748b;">${(a.who || []).join(', ') || '—'}</td>
            <td style="padding:12px 16px; color:#64748b;">${(a.legal || []).join(', ') || '—'}</td>
            <td style="padding:12px 16px;">
              <span class="vendor-badge vendor-badge-low">${a.status || 'Active'}</span>
            </td>
            <td style="padding:12px 16px;">
              <button class="btn-edit" onclick="editActivity(${i})" style="padding:4px 8px; font-size:11px;">Edit</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── CHECKBOX MATRIX RESTORATION ─────────────────────────────
function renderCheckboxMatrix(containerId, options, selectedValues = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px; background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
      ${options.map(opt => `
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#475569; cursor:pointer; padding:4px; border-radius:4px; transition:background 0.2s;" onmouseover="this.style.background='#fff'" onmouseout="this.style.background='transparent'">
          <input type="checkbox" name="${containerId}" value="${opt}" ${selectedValues.includes(opt) ? 'checked' : ''} style="width:14px; height:14px; accent-color:#2563eb;">
          ${opt}
        </label>
      `).join('')}
    </div>
  `;
}

// Initialize Matrices for the Add/Edit form
function initActivityMatrices(existingData = {}) {
  const natures = ['Collection', 'Recording', 'Storage', 'Organisation', 'Retrieval', 'Use', 'Disclosure', 'Transfer', 'Deletion / Disposal'];
  const who = ['Internal employees', 'Customers', 'Vendors', 'Public users', 'Job applicants'];
  const dataTypes = ['Name', 'IC / Passport', 'Email', 'Phone', 'Address', 'Salary', 'Financial data', 'Health data', 'Criminal data', 'Religion', 'Political opinion', 'Biometric data'];
  const legalBasis = ['Consent (Section 6)', 'Contract necessity (Section 6)', 'Legal obligation', 'Vital interests', 'Public task', 'Legitimate interest', 'Sensitive data (Section 40)', 'Cross-border (Section 129)'];
  const context = ['Employer-employee relationship', 'Customer-business relationship', 'Public data collection', 'Third-party processing'];
  const recip = ['Internal department', 'HR', 'IT', 'Vendors', 'Payroll provider', 'Government agencies'];
  const safeguards = ['Contract clauses', 'Encryption', 'Access control', 'Vendor compliance', 'Standard Contractual Clauses (SCC)'];
  
  renderCheckboxMatrix('pa2-natureGrid', natures, existingData.nature || []);
  renderCheckboxMatrix('pa2-whoGrid', who, existingData.who || []);
  renderCheckboxMatrix('pa2-dataGrid', dataTypes, existingData.data || []);
  renderCheckboxMatrix('pa2-legalGrid', legalBasis, existingData.legal || []);
  renderCheckboxMatrix('pa2-contextGrid', context, existingData.context || []);
  renderCheckboxMatrix('pa2-recipGrid', recip, existingData.recip || []);
  renderCheckboxMatrix('pa2-safeguardsGrid', safeguards, existingData.safeguards || []);
}

function openProcessingModal(index = -1) {
  const modal = document.getElementById('modal-processing');
  if (!modal) return;
  
  const title = document.getElementById('pa2-modal-title');
  const btn = document.querySelector('.modal-footer .btn-primary');
  
  if (index >= 0) {
    const act = state.processingActivities[index];
    document.getElementById('pa2-name').value = act.name || '';
    document.getElementById('pa2-purpose').value = act.purpose || '';
    document.getElementById('pa2-freq').value = act.freq || '';
    document.getElementById('pa2-storage').value = act.storage || '';
    document.getElementById('pa2-retType').value = act.retType || '';
    document.getElementById('pa2-retYears').value = act.retYears || '';
    document.getElementById('pa2-total').value = act.total || 0;
    document.getElementById('pa2-sensitive').value = act.sensitive || 0;
    document.getElementById('pa2-crossBorder').checked = !!act.crossBorder;
    document.getElementById('pa2-country').value = act.country || '';
    
    initActivityMatrices(act);
    title.innerText = 'Edit Processing Activity';
    btn.innerText = 'Update Activity';
    btn.onclick = () => pa2Save(index);
  } else {
    document.getElementById('pa2-name').value = '';
    document.getElementById('pa2-purpose').value = '';
    document.getElementById('pa2-freq').value = '';
    document.getElementById('pa2-storage').value = '';
    document.getElementById('pa2-retType').value = '';
    document.getElementById('pa2-retYears').value = '';
    document.getElementById('pa2-total').value = '';
    document.getElementById('pa2-sensitive').value = '';
    document.getElementById('pa2-crossBorder').checked = false;
    document.getElementById('pa2-country').value = '';
    
    initActivityMatrices();
    title.innerText = 'New Processing Activity';
    btn.innerText = 'Save Activity';
    btn.onclick = () => pa2Save();
  }
  
  modal.classList.add('open');
}

function closeProcessingModal() {
  const modal = document.getElementById('modal-processing');
  if (modal) modal.classList.remove('open');
}

async function pa2Save(index = -1) {
  const name = document.getElementById('pa2-name').value.trim();
  if (!name) { showToast('Activity name is required', 'error'); return; }

  const getChecks = (gridId) => {
    return Array.from(document.querySelectorAll(`#${gridId} input:checked`)).map(i => i.value);
  };

  const activityData = {
    name: name,
    purpose: document.getElementById('pa2-purpose').value.trim(),
    nature: getChecks('pa2-natureGrid'),
    who: getChecks('pa2-whoGrid'),
    freq: document.getElementById('pa2-freq').value,
    storage: document.getElementById('pa2-storage').value,
    context: getChecks('pa2-contextGrid'),
    legal: getChecks('pa2-legalGrid'),
    data: getChecks('pa2-dataGrid'),
    recip: getChecks('pa2-recipGrid'),
    retType: document.getElementById('pa2-retType').value,
    retYears: document.getElementById('pa2-retYears').value,
    total: parseInt(document.getElementById('pa2-total').value) || 0,
    sensitive: parseInt(document.getElementById('pa2-sensitive').value) || 0,
    crossBorder: document.getElementById('pa2-crossBorder').checked,
    country: document.getElementById('pa2-country').value,
    safeguards: getChecks('pa2-safeguardsGrid')
  };

  const supabase = getSupabaseClient();
  const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
  const orgId = currentCompany ? currentCompany.id : state.user?.id;

  try {
    if (index >= 0) {
      const existing = state.processingActivities[index];
      if (supabase && isSupabaseConfigured() && existing.id && !String(existing.id).startsWith('local-')) {
        const { error } = await supabase.from('processing_activities').update(activityData).eq('id', existing.id);
        if (error) throw error;
      }
      state.processingActivities[index] = { ...existing, ...activityData };
    } else {
      if (supabase && isSupabaseConfigured()) {
        const { data, error } = await supabase.from('processing_activities').insert([{ org_id: orgId, ...activityData }]).select().single();
        if (error) throw error;
        state.processingActivities.unshift(data);
      } else {
        state.processingActivities.unshift({ ...activityData, id: 'local-' + Date.now() });
      }
    }
    
    renderActivities(state.processingActivities);
    closeProcessingModal();
    showToast('Activity saved successfully', 'success');
  } catch (err) {
    JARVIS_LOG.error('Activities', 'Save Error', err);
    showToast('Failed to save activity', 'error');
  }
}

function pa2Discard() {
  if (confirm('Discard changes?')) closeProcessingModal();
}

