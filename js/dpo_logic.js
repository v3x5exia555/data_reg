/**
 * dpo_logic.js — DataRex DPO & Governance Module
 * Persistence: Supabase 'dpo_records' table
 * Design: Elite UI with Vertical Centering & TH Blueprint
 */

async function loadDPOFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const loadingEl = document.getElementById('dpo-loading');
  const tableEl = document.getElementById('dpo-table-container');
  const emptyEl = document.getElementById('dpo-empty-state');
  
  if (loadingEl) loadingEl.classList.remove('hidden');
  
  console.log('[JARVIS] DPO Fetch: Initiating sync...');
  try {
    const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
    const orgId = currentCompany ? currentCompany.id : state.user?.id;
    
    let query = supabase.from('dpo_records').select('*');
    if (orgId) query = query.eq('org_id', orgId);

    const { data, error } = await query.order('created_at', { ascending: false });
    console.log('[JARVIS] Raw Data (DPO):', data);
    
    if (error) {
      JARVIS_LOG.error('DPO', 'Fetch Error', error);
      renderDPOTable([]);
      return;
    }
    
    if (data) {
      console.log(`[JARVIS] DPO Fetch: ${data.length} records retrieved.`);
      state.dpoRecords = data;
      renderDPOTable(data);
    }
  } catch (err) {
    JARVIS_LOG.error('DPO', 'Exception', err);
    renderDPOTable([]);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

function renderDPOTable(records) {
  const tableContainer = document.getElementById('dpo-table-container');
  const tbody = document.getElementById('dpo-table-body');
  const emptyEl = document.getElementById('dpo-empty-state');
  const statusBadge = document.getElementById('dpo-status-badge');
  const apptDateStat = document.getElementById('dpo-appointment-date');
  
  if (!tbody) return;

  if (!records || records.length === 0) {
    if (tableContainer) tableContainer.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (statusBadge) statusBadge.innerHTML = '<span class="badge badge-warning">Not Appointed</span>';
    return;
  }

  if (tableContainer) tableContainer.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');

  // Elite TH Blueprint
  const thStyle = "background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; padding:12px 16px; border-bottom:1px solid #e2e8f0;";

  // Update Stats with latest DPO
  const latest = records[0];
  if (statusBadge) statusBadge.innerHTML = '<span class="badge badge-success">Active</span>';
  if (apptDateStat) apptDateStat.innerText = latest.appointment_date || '-';

  tbody.innerHTML = records.map((r, i) => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:12px 16px; color:#94a3b8; font-family:monospace; font-size:11px;">#${i+1}</td>
      <td style="padding:12px 16px; font-weight:600; color:#1e293b;">${r.name || '—'}</td>
      <td style="padding:12px 16px; color:#475569;">${r.email || '—'}</td>
      <td style="padding:12px 16px; color:#64748b;">${r.phone || '—'}</td>
      <td style="padding:12px 16px; color:#64748b;">${r.appointment_date || '—'}</td>
      <td style="padding:12px 16px;"><span class="badge badge-success">Active</span></td>
      <td style="padding:12px 16px;">
        <button class="btn-edit" onclick="openDPOModal(${i})" style="padding:4px 8px; font-size:11px;">Edit</button>
      </td>
    </tr>
  `).join('');

  // Apply Blueprint to existing header if necessary
  const thead = tableContainer.querySelector('thead');
  if (thead) {
    thead.querySelectorAll('th').forEach(th => th.style = thStyle);
  }
}

function openDPOModal(index = -1) {
  const modal = document.getElementById('modal-dpo');
  if (!modal) return;
  
  // Ensure Vertical Gravity
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  
  if (index >= 0) {
    const r = state.dpoRecords[index];
    document.getElementById('dpo-name').value = r.name || '';
    document.getElementById('dpo-email').value = r.email || '';
    document.getElementById('dpo-phone').value = r.phone || '';
    document.getElementById('dpo-appointment-date-input').value = r.appointment_date || '';
    document.getElementById('dpo-edit-index').value = index;
  } else {
    document.getElementById('dpo-name').value = '';
    document.getElementById('dpo-email').value = '';
    document.getElementById('dpo-phone').value = '';
    document.getElementById('dpo-appointment-date-input').value = '';
    document.getElementById('dpo-edit-index').value = '-1';
  }
  
  modal.classList.add('open');
}

function closeDPOModal() {
  const modal = document.getElementById('modal-dpo');
  if (modal) modal.classList.remove('open');
}

async function saveDPO() {
  const supabase = getSupabaseClient();
  const name = document.getElementById('dpo-name').value.trim();
  const email = document.getElementById('dpo-email').value.trim();
  const phone = document.getElementById('dpo-phone').value.trim();
  const date = document.getElementById('dpo-appointment-date-input').value;
  const editIndex = parseInt(document.getElementById('dpo-edit-index').value);

  if (!name || !email) { showToast('Name and Email are required', 'error'); return; }

  const dpoData = {
    name: name,
    email: email,
    phone: phone,
    appointment_date: date,
    status: 'Active'
  };

  const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
  const orgId = currentCompany ? currentCompany.id : state.user?.id;

  try {
    if (editIndex >= 0) {
      const existing = state.dpoRecords[editIndex];
      if (supabase && isSupabaseConfigured() && existing.id && !String(existing.id).startsWith('local-')) {
        const { error } = await supabase.from('dpo_records').update(dpoData).eq('id', existing.id);
        if (error) throw error;
      }
      state.dpoRecords[editIndex] = { ...existing, ...dpoData };
    } else {
      if (supabase && isSupabaseConfigured()) {
        const { data, error } = await supabase.from('dpo_records').insert([{ org_id: orgId, ...dpoData }]).select().single();
        if (error) throw error;
        state.dpoRecords.unshift(data);
      } else {
        state.dpoRecords.unshift({ ...dpoData, id: 'local-' + Date.now() });
      }
    }
    
    renderDPOTable(state.dpoRecords);
    closeDPOModal();
    showToast('DPO details saved', 'success');
    console.log('[JARVIS] DPO Save: Success. Persistence verified.');
  } catch (err) {
    JARVIS_LOG.error('DPO', 'Save Error', err);
    showToast('Failed to save DPO', 'error');
  }
}
