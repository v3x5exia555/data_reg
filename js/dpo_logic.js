/**
 * dpo_logic.js — DataRex DPO & Governance Module
 * STATUS: LOCAL STORAGE MODE (LSM)
 */

let dpoAppointmentFileMeta = null;

function parseDPOSafe(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (err) {
    console.warn(`[JARVIS] Could not parse ${key}`, err);
    return fallback;
  }
}

function normalizeDPORecord(record = {}) {
  return {
    id: record.id || `local-${Date.now()}`,
    user_id: record.user_id || record.userId || '',
    company_id: record.company_id || record.companyId || record.company || '',
    name: record.name || record.full_name || record.fullName || '',
    email: record.email || '',
    phone: record.phone || record.phone_number || '',
    nationality: record.nationality || '',
    appointment_date: record.appointment_date || record.appointmentDate || '',
    appointment_letter_name: record.appointment_letter_name || record.appointmentLetterName || '',
    appointment_letter_url: record.appointment_letter_url || record.appointmentLetterUrl || '',
    training_status: record.training_status || record.trainingStatus || 'pending',
    status: record.status || (record.is_active === false ? 'Inactive' : 'Active'),
    created_at: record.created_at || record.createdAt || new Date().toISOString()
  };
}

function mergeDPORecords(records = []) {
  const seen = new Set();
  return records
    .map(normalizeDPORecord)
    .filter(record => record.name || record.email)
    .filter(record => {
      const key = record.id || `${record.email}-${record.name}-${record.appointment_date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function getLocalDPORecords() {
  const records = [];
  const list = parseDPOSafe('dpo_data', []);
  if (Array.isArray(list)) records.push(...list);

  const legacy = parseDPOSafe('datarex_dpo', null);
  if (legacy && typeof legacy === 'object') records.push(legacy);

  if (state.dpo && typeof state.dpo === 'object') records.push(state.dpo);
  if (Array.isArray(state.dpoRecords)) records.push(...state.dpoRecords);

  return mergeDPORecords(records);
}

function cacheDPORecords(records = []) {
  const lightweight = mergeDPORecords(records).map(record => ({
    ...record,
    appointment_letter_url: record.appointment_letter_url?.startsWith('data:') ? '' : record.appointment_letter_url
  }));
  localStorage.setItem('dpo_data', JSON.stringify(lightweight));
}

function getDPOModal() {
  return document.getElementById('modal-dpo-form') || document.getElementById('modal-dpo');
}

function getDPOField(id, modal = getDPOModal()) {
  return modal?.querySelector(`#${id}`) || document.getElementById(id);
}

function getDPODateField(modal = getDPOModal()) {
  return modal?.querySelector('#dpo-appointment-date-input, #dpo-date') ||
    document.getElementById('dpo-appointment-date-input') ||
    document.getElementById('dpo-date');
}

function setDPOFieldValue(id, value = '', modal = getDPOModal()) {
  const el = getDPOField(id, modal);
  if (el) el.value = value;
}

function setDPOUploadState(stateName, file = null, message = '') {
  const modal = getDPOModal();
  const zone = getDPOField('dpo-upload-zone', modal);
  const inner = getDPOField('dpo-upload-inner', modal);
  const progress = getDPOField('dpo-upload-progress', modal);
  const complete = getDPOField('dpo-upload-complete', modal);
  const error = getDPOField('dpo-upload-error', modal);

  [inner, progress, complete, error].forEach(el => el?.classList.add('hidden'));
  zone?.classList.remove('error');

  if (stateName === 'complete' && file) {
    const nameEl = getDPOField('dpo-upload-name', modal);
    const sizeEl = getDPOField('dpo-upload-size', modal);
    const barEl = getDPOField('dpo-upload-bar', modal);
    const percentEl = getDPOField('dpo-upload-percent', modal);
    const completeText = getDPOField('dpo-upload-complete-text', modal);
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${Math.ceil(file.size / 1024)} KB`;
    if (barEl) barEl.style.width = '100%';
    if (percentEl) percentEl.textContent = '100%';
    if (completeText) completeText.textContent = file.name;
    progress?.classList.remove('hidden');
    complete?.classList.remove('hidden');
    return;
  }

  if (stateName === 'error') {
    const errorText = getDPOField('dpo-upload-error-text', modal);
    if (errorText) errorText.textContent = message || 'File could not be uploaded';
    zone?.classList.add('error');
    inner?.classList.remove('hidden');
    error?.classList.remove('hidden');
    return;
  }

  inner?.classList.remove('hidden');
}

async function loadDPOFromSupabase() {
  console.log('[JARVIS] Fetching DPO records...');
  const loadingEl = document.getElementById('dpo-loading');
  if (loadingEl) loadingEl.classList.remove('hidden');

  const localData = getLocalDPORecords();
  state.dpoRecords = localData;
  renderDPOTable(localData);

  const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (supabase && typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
    try {
      const accountId = (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null;
      let query = supabase.from('dpo').select('*');
      if (accountId) query = query.eq('account_id', accountId);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(100);

      if (error) throw error;

      const remoteData = mergeDPORecords(data || []);
      const currentCompany = state.user?.company || state.company || '';
      const currentUserId = state.user?.id || '';
      const preferredRemote = remoteData.filter(record =>
        (currentCompany && record.company_id === currentCompany) ||
        (currentUserId && record.user_id === currentUserId)
      );
      const displayData = mergeDPORecords([
        ...(preferredRemote.length ? preferredRemote : remoteData),
        ...localData
      ]);

      console.log(`[JARVIS] FETCH SUCCESS: ${displayData.length} DPO records available.`);
      state.dpoRecords = displayData;
      cacheDPORecords(displayData);
      renderDPOTable(displayData);
    } catch (err) {
      console.error('[JARVIS] DPO Supabase Fetch Error', err);
      console.log(`[JARVIS] Falling back to ${localData.length} local DPO records.`);
      state.dpoRecords = localData;
      renderDPOTable(localData);
    }
  }

  if (loadingEl) loadingEl.classList.add('hidden');
}

function renderDPOTable(records = []) {
  const container = document.getElementById('dpo-table-container');
  const tbody = document.getElementById('dpo-table-body');

  if (!container || !tbody) return;

  const list = records || [];
  const latest = list[0];
  const statusEl = document.getElementById('dpo-status-badge');
  const appointmentEl = document.getElementById('dpo-appointment-date');
  const trainingEl = document.getElementById('dpo-training-status');
  const emptyStates = document.querySelectorAll('#dpo-empty-state, #dpo-empty-state-card');

  container.classList.toggle('hidden', list.length === 0);
  emptyStates.forEach(el => el.classList.toggle('hidden', list.length > 0));

  if (statusEl) {
    statusEl.innerHTML = latest
      ? '<span class="badge badge-success">Appointed</span>'
      : '<span class="badge badge-warning">Not Appointed</span>';
  }
  if (appointmentEl) appointmentEl.textContent = latest?.appointment_date || '-';
  if (trainingEl) trainingEl.textContent = latest?.training_status || '-';

  // Elite TH Blueprint
  const thStyle = "background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; padding:12px 16px; border-bottom:2px solid #e2e8f0;";
  const thead = container.querySelector('thead');
  if (thead) {
    thead.querySelectorAll('th').forEach(th => th.style = thStyle);
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:24px; text-align:center; color:#94a3b8; font-size:14px;">
          No DPO records found. Click "Add DPO" to begin.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((r, i) => `
    <tr style="border-bottom:1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
      <td style="padding:16px; color:#94a3b8; font-family:monospace; font-size:11px;">#${i+1}</td>
      <td style="padding:16px; font-weight:600; color:#1e293b;">${r.name || '—'}</td>
      <td style="padding:16px; color:#475569;">${r.email || '—'}</td>
      <td style="padding:16px; color:#64748b;">${r.phone || '—'}</td>
      <td style="padding:16px; color:#64748b;">${r.nationality || '—'}</td>
      <td style="padding:16px; color:#64748b;">${r.appointment_date || '—'}</td>
      <td style="padding:16px;"><span class="badge badge-success" style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:4px; font-size:11px;">Active</span></td>
      <td style="padding:16px; text-align:right;">
        <button class="btn-edit" onclick="deleteDPOLocal(${i})" style="padding:6px 12px; font-size:12px; border:1px solid #fee2e2; border-radius:6px; background:#fef2f2; color:#ef4444; cursor:pointer;">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openDPOModal() {
  const modal = getDPOModal();
  if (modal) {
    document.querySelectorAll('#modal-dpo, #modal-dpo-form').forEach(el => {
      if (el !== modal) {
        el.classList.remove('open');
        el.style.display = 'none';
      }
    });

    // Vertical Gravity
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    setDPOFieldValue('dpo-name', '', modal);
    setDPOFieldValue('dpo-email', '', modal);
    setDPOFieldValue('dpo-phone', '', modal);
    setDPOFieldValue('dpo-nationality', '', modal);
    const dateEl = getDPODateField(modal);
    if (dateEl) dateEl.value = '';
    dpoAppointmentFileMeta = null;
    setDPOUploadState('idle');

    modal.classList.add('open');
  }
}

function closeDPOModal() {
  document.querySelectorAll('#modal-dpo, #modal-dpo-form').forEach(modal => {
    modal.classList.remove('open');
    modal.style.display = 'none';
  });
}

function closeDPODetailModal() {
  const modal = document.getElementById('modal-dpo-detail');
  if (!modal) return;
  modal.classList.remove('open');
  modal.style.display = 'none';
}

async function saveDPO() {
  const modal = getDPOModal();
  const name = getDPOField('dpo-name', modal)?.value || '';
  const email = getDPOField('dpo-email', modal)?.value || '';
  const phone = getDPOField('dpo-phone', modal)?.value || '';
  const nationality = getDPOField('dpo-nationality', modal)?.value || '';
  const date = getDPODateField(modal)?.value || '';

  if (!name.trim()) { alert("Name is required"); return; }

  const newRecord = {
    id: 'local-' + Date.now(),
    user_id: state.user?.id || '',
    company_id: state.user?.company || state.company || '',
    name,
    email,
    phone,
    nationality,
    appointment_date: date,
    appointment_letter_name: dpoAppointmentFileMeta?.name || '',
    training_status: 'pending',
    created_at: new Date().toISOString()
  };

  state.dpoRecords = state.dpoRecords || [];
  let savedRecord = newRecord;

  const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if (supabase && typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
    const { id, status, created_at, ...payload } = newRecord;
    try {
      const { data, error } = await supabase
        .from('dpo')
        .insert([{
          ...payload,
          account_id: (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null
        }])
        .select()
        .single();
      if (error) throw error;
      savedRecord = normalizeDPORecord(data);
    } catch (err) {
      console.error('[JARVIS] DPO Supabase Save Error', err);
      if (typeof showToast === 'function') showToast('DPO saved locally; Supabase save failed', 'warning');
    }
  }

  state.dpoRecords.unshift(savedRecord);
  state.dpoRecords = mergeDPORecords(state.dpoRecords);

  cacheDPORecords(state.dpoRecords);

  renderDPOTable(state.dpoRecords);
  closeDPOModal();
  if (typeof showToast === 'function') showToast('DPO appointment saved', 'success');
}

function handleDPOFileUpload(input) {
  const file = input?.files?.[0];
  if (!file) {
    dpoAppointmentFileMeta = null;
    setDPOUploadState('idle');
    return;
  }

  const maxBytes = 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    input.value = '';
    dpoAppointmentFileMeta = null;
    setDPOUploadState('error', null, 'File is too large. Maximum size is 50MB.');
    return;
  }

  dpoAppointmentFileMeta = {
    name: file.name,
    size: file.size,
    type: file.type,
    selected_at: new Date().toISOString()
  };
  setDPOUploadState('complete', file);
}

function deleteDPOLocal(index) {
  if (confirm("Delete this DPO record?")) {
    state.dpoRecords.splice(index, 1);
    cacheDPORecords(state.dpoRecords);
    renderDPOTable(state.dpoRecords);
  }
}
