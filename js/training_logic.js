/**
 * training_logic.js — DataRex Training Management Module
 * STATUS: Supabase-backed with Local Storage fallback
 */

function normalizeTrainingRecord(record = {}) {
  return {
    id: record.id,
    employee_name: record.employee_name || '',
    training_type: record.training_type || '',
    // DB column is `training_date`; UI uses `completion_date`.
    completion_date: record.completion_date || record.training_date || '',
    // DB column is `expires_at`; UI uses `expiry_date`.
    expiry_date: record.expiry_date || record.expires_at || null,
    status: record.status || 'Completed',
    created_at: record.created_at || new Date().toISOString()
  };
}

function readLocalTraining() {
  try {
    const list = JSON.parse(localStorage.getItem('training_data') || '[]');
    return Array.isArray(list) ? list.map(normalizeTrainingRecord) : [];
  } catch (err) {
    console.error('[JARVIS] Local Storage Parse Error (Training)', err);
    return [];
  }
}

async function loadTrainingFromSupabase() {
  console.log('[JARVIS] Fetching Training Records...');
  const localData = readLocalTraining();
  state.trainingRecords = localData;
  renderTraining(localData);

  const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  const configured = typeof isSupabaseConfigured !== 'function' || isSupabaseConfigured();
  if (!supabase || !configured) {
    console.log('[JARVIS] Supabase not configured; using local training data.');
    return;
  }

  try {
    const accountId = (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null;
    let query = supabase.from('training_records').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[JARVIS] Training Supabase Fetch Error:', error.message);
      return;
    }

    const remote = (data || []).map(normalizeTrainingRecord);
    if (remote.length === 0) {
      console.log('[JARVIS] Training: Supabase returned 0 rows; keeping local data.');
      return;
    }

    const seen = new Set(remote.map(r => r.id).filter(Boolean));
    const localOnly = localData.filter(r => !r.id || !seen.has(r.id));
    const merged = [...remote, ...localOnly];

    console.log(`[JARVIS] Training FETCH SUCCESS: ${remote.length} from Supabase, ${localOnly.length} local-only.`);
    state.trainingRecords = merged;
    localStorage.setItem('training_data', JSON.stringify(merged));
    renderTraining(merged);
  } catch (err) {
    console.error('[JARVIS] Training fetch exception:', err);
  }
}

function renderTraining(records) {
  const tbody = document.getElementById('training-body');
  if (!tbody) return;
  const list = records || [];

  // The TH Blueprint Implementation
  const thStyle = "background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; padding:12px 16px; border-bottom:1px solid #e2e8f0;";

  const headerHTML = `
    <div class="data-table-wrap" style="background:#fff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
      <table class="styled-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${thStyle}">Employee Name</th>
            <th style="${thStyle}">Training Type</th>
            <th style="${thStyle}">Completion Date</th>
            <th style="${thStyle}">Status</th>
            <th style="${thStyle} width:100px;">Actions</th>
          </tr>
        </thead>
        <tbody>`;

  if (list.length === 0) {
    tbody.innerHTML = headerHTML + `
          <tr>
            <td colspan="5" style="padding:24px; text-align:center; color:#94a3b8; font-size:14px;">
              No training records found. Click "Add Record" to begin.
            </td>
          </tr>
        </tbody>
      </table>
    </div>`;
    return;
  }

  tbody.innerHTML = headerHTML + list.map((t, i) => `
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 16px; font-weight:600; color:#1e293b;">${t.employee_name || '—'}</td>
            <td style="padding:12px 16px; color:#475569;">${t.training_type || '—'}</td>
            <td style="padding:12px 16px; color:#64748b;">${t.completion_date || '—'}</td>
            <td style="padding:12px 16px;">
              <span class="vendor-badge vendor-badge-low">${t.status}</span>
            </td>
            <td style="padding:12px 16px;">
              <button class="btn-edit" onclick="editTraining(${i})" style="padding:4px 8px; font-size:11px;">Edit</button>
            </td>
          </tr>`).join('') + `
        </tbody>
      </table>
    </div>`;
}

function getTrainingField(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function setTrainingField(value, ...ids) {
  const el = getTrainingField(...ids);
  if (el) el.value = value;
}

function resetTrainingForm() {
  setTrainingField('-1', 'training-index', 'train-index');
  setTrainingField('', 'training-employee', 'train-employee');
  setTrainingField('', 'training-type', 'train-course');
  setTrainingField('', 'training-date', 'train-date');
  setTrainingField('', 'training-expiry', 'train-expiry');
  setTrainingField('Completed', 'training-status', 'train-status');

  const title = document.querySelector('#modal-training h3');
  if (title) title.textContent = 'Add Training Record';
  const saveBtn = document.querySelector('#modal-training .btn-save');
  if (saveBtn) saveBtn.textContent = 'Save Record';
}

function editTraining(index) {
  const record = state.trainingRecords?.[index];
  if (!record) return;

  setTrainingField(String(index), 'training-index', 'train-index');
  setTrainingField(record.employee_name || '', 'training-employee', 'train-employee');
  setTrainingField(record.training_type || '', 'training-type', 'train-course');
  setTrainingField(record.completion_date || '', 'training-date', 'train-date');
  setTrainingField(record.expiry_date || '', 'training-expiry', 'train-expiry');
  setTrainingField(record.status || 'Completed', 'training-status', 'train-status');

  const title = document.querySelector('#modal-training h3');
  if (title) title.textContent = 'Edit Training Record';
  const saveBtn = document.querySelector('#modal-training .btn-save');
  if (saveBtn) saveBtn.textContent = 'Update Record';
  openModal('modal-training');
}

async function saveTraining() {
  const name = (getTrainingField('training-employee', 'train-employee')?.value || '').trim();
  const type = (getTrainingField('training-type', 'train-course')?.value || '').trim();
  const date = getTrainingField('training-date', 'train-date')?.value || '';
  const expiryDate = getTrainingField('training-expiry', 'train-expiry')?.value || '';
  const status = getTrainingField('training-status', 'train-status')?.value || 'Completed';
  const editIndex = parseInt(getTrainingField('training-index', 'train-index')?.value || '-1', 10);

  if (!name || !type || !date) { showToast('Please fill in all required fields', 'error'); return; }

  state.trainingRecords = state.trainingRecords || [];
  const existing = editIndex > -1 ? state.trainingRecords[editIndex] : null;
  const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  const configured = typeof isSupabaseConfigured !== 'function' || isSupabaseConfigured();
  const orgId = (typeof getCurrentOrgId === 'function') ? getCurrentOrgId() : (state.user?.id || null);

  // DB-shaped payload (column names from migration 20260428000002).
  const dbPayload = {
    employee_name: name,
    training_type: type,
    training_date: date,
    expires_at: expiryDate || null,
    status
  };

  let supabaseSucceeded = false;
  if (supabase && configured && orgId) {
    try {
      if (existing && existing.id && !String(existing.id).startsWith('local-')) {
        const { error } = await supabase.from('training_records')
          .update(dbPayload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('training_records')
          .insert([{
            ...dbPayload,
            org_id: orgId,
            account_id: (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null
          }]);
        if (error) throw error;
      }
      supabaseSucceeded = true;
    } catch (err) {
      console.error('[JARVIS] Training Supabase Save Error', err);
    }
  }

  // Local mirror in UI shape.
  const localRecord = normalizeTrainingRecord({
    ...dbPayload,
    completion_date: date,
    expiry_date: expiryDate || null,
    id: existing?.id || ('local-' + Date.now()),
    created_at: existing?.created_at || new Date().toISOString()
  });
  if (editIndex > -1) {
    state.trainingRecords[editIndex] = { ...existing, ...localRecord };
  } else {
    state.trainingRecords.unshift(localRecord);
  }
  localStorage.setItem('training_data', JSON.stringify(state.trainingRecords));

  closeModal('modal-training');

  if (supabaseSucceeded) {
    await loadTrainingFromSupabase();
    showToast('Training record saved', 'success');
  } else {
    renderTraining(state.trainingRecords);
    showToast(supabase && configured ? 'Saved locally; Supabase save failed' : 'Saved locally', 'warning');
  }
}
