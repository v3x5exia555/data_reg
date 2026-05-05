/**
 * training_logic.js — DataRex Training Management Module
 * Persistence: Supabase 'training_record' table
 * Design: Elite UI with TH Blueprint
 */

async function loadTrainingFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  console.log('[JARVIS] Fetching Training Records...');
  try {
    const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
    const orgId = currentCompany ? currentCompany.id : state.user?.id;
    
    // Resilient fetch: Try training_record (plural/singular fallback)
    let query = supabase.from('training_record').select('*');
    if (orgId) query = query.eq('org_id', orgId);

    let { data, error } = await query.order('completion_date', { ascending: false });
    console.log('[JARVIS] Raw Data (Training):', data);
    
    if (error && error.code === '42P01') { // Table not found, try plural
       console.warn('[JARVIS] training_record not found, falling back to training_records');
       const pluralRes = await supabase.from('training_records').select('*').order('completion_date', { ascending: false });
       data = pluralRes.data;
       error = pluralRes.error;
    }

    if (error) {
      JARVIS_LOG.error('Training', 'Fetch Error', error);
      renderTraining([]);
      return;
    }
    
    if (data) {
      console.log(`[JARVIS] FETCH SUCCESS: ${data.length} Training records retrieved.`);
      state.trainingRecords = data.map(t => ({
        id: t.id,
        employee_name: t.employee_name,
        training_type: t.training_type,
        completion_date: t.completion_date,
        expiry_date: t.expiry_date || null,
        status: t.status || 'Completed',
        notes: t.notes || ''
      }));
      renderTraining(state.trainingRecords);
    }
  } catch (err) {
    JARVIS_LOG.error('Training', 'Exception', err);
    renderTraining([]);
  }
}

function renderTraining(records) {
  const tbody = document.getElementById('training-body');
  if (!tbody) return;
  const list = records || [];

  if (list.length === 0) {
    tbody.innerHTML = `<div class="empty-state">No training records found.</div>`;
    return;
  }

  // The TH Blueprint Implementation
  const thStyle = "background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; padding:12px 16px; border-bottom:1px solid #e2e8f0;";

  tbody.innerHTML = `
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
        <tbody>${list.map((t, i) => `
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
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function saveTraining() {
  const supabase = getSupabaseClient();
  const name = document.getElementById('training-employee').value.trim();
  const type = document.getElementById('training-type').value.trim();
  const date = document.getElementById('training-date').value;
  const editIndex = parseInt(document.getElementById('training-index').value);

  if (!name || !type || !date) { showToast('Please fill in all required fields', 'error'); return; }

  const trainingData = {
    employee_name: name,
    training_type: type,
    completion_date: date,
    status: 'Completed'
  };

  const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
  const orgId = currentCompany ? currentCompany.id : state.user?.id;

  try {
    if (editIndex > -1) {
      const existing = state.trainingRecords[editIndex];
      if (supabase && isSupabaseConfigured() && existing.id && !String(existing.id).startsWith('local-')) {
        const { error } = await supabase.from('training_record').update(trainingData).eq('id', existing.id);
        if (error) throw error;
        JARVIS_LOG.success('Training', 'Update', { id: existing.id });
      }
      state.trainingRecords[editIndex] = { ...existing, ...trainingData };
    } else {
      if (supabase && isSupabaseConfigured()) {
        const { data, error } = await supabase.from('training_record').insert([{ org_id: orgId, ...trainingData }]).select().single();
        if (error) throw error;
        JARVIS_LOG.success('Training', 'Insert', { id: data?.id });
        state.trainingRecords.unshift(data);
      } else {
        state.trainingRecords.unshift({ ...trainingData, id: 'local-' + Date.now() });
      }
    }
    
    renderTraining(state.trainingRecords);
    closeModal('modal-training');
    showToast('Training record saved', 'success');
  } catch (err) {
    JARVIS_LOG.error('Training', 'Save Error', err);
    showToast('Failed to save record', 'error');
  }
}
