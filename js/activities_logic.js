/**
 * activities_logic.js — DataRex Processing Activities Module
 * Persistence: Supabase 'processing_activities' table
 * Design: Complex Checkbox Matrix & TH Blueprint with Advanced DPIA Logic
 */

// Constants from the Advanced UI Payload
const PA_NATURE = ["Collection", "Recording", "Storage", "Organisation", "Retrieval", "Use", "Disclosure", "Transfer", "Deletion / Disposal"];
const PA_SCOPE_WHO = ["Internal employees", "Customers", "Vendors", "Public users"];
const PA_SCOPE_FREQ = ["One-time", "Daily", "Weekly", "Monthly", "Continuous"];
const PA_SCOPE_STORAGE = ["On-premise", "Cloud system", "Hybrid"];
const PA_CONTEXT = ["Employer-employee relationship", "Customer-business relationship", "Public data collection", "Third-party processing"];
const PA_LEGAL = [
  {label: "Consent (Section 6)", tip: "Data subject has given clear consent."},
  {label: "Contract necessity (Section 6)", tip: "Processing necessary for contract."},
  {label: "Legal obligation", tip: "Required by Malaysian law."},
  {label: "Vital interests", tip: "Protect life or physical safety."},
  {label: "Legitimate interest", tip: "Pursued by controller."},
  {label: "Sensitive data (Section 40)", tip: "Special handling for health, biometric, etc."},
  {label: "Cross-border (Section 129)", tip: "Transfer outside Malaysia."}
];
const PA_DATA = [
  {label: "Name"}, {label: "IC / Passport"}, {label: "Email"}, {label: "Phone"},
  {label: "Address"}, {label: "Financial data"}, {label: "Salary"}, {label: "Attendance logs"},
  {label: "Biometric data", sensitive: true}, {label: "Health data", sensitive: true}
];
const PA_RECIP = ["Internal department", "HR", "IT", "Vendors", "Payroll provider", "Government agencies"];
const PA_GOV = ["EPF", "SOCSO", "LHDN"];
const PA_RETENTION = {"Employment records": 7, "Payroll records": 7, "Customer data": 5, "Financial data": 7};
const PA_COUNTRIES = ["Singapore", "Indonesia", "Thailand", "Philippines", "United States", "United Kingdom", "European Union", "Australia", "China", "Other"];
const PA_SAFEGUARDS = ["Contract clauses", "Encryption", "Access control", "Vendor compliance"];
const PA_TABLE = "processing_activities";
const PA_STORAGE_KEY = "activity_data";
const PA_ACTOR = "jarvis";

function createDefaultPAState() {
  return {
    name: "", purpose: "", nature: [], natureOther: "", who: [], freq: "", storage: "", scopeNote: "",
    context: [], powerImbalance: false, legal: [], legalOther: "", data: [], dataOther: "",
    recip: [], gov: [], recipOther: "", retType: "", retYears: 0, retOverride: false,
    total: 0, sensitive: 0, crossBorder: false, country: "", safeguards: []
  };
}

let paState = createDefaultPAState();
let editActivityIndex = -1;

function paLog(action, data = {}, response = null, error = null) {
  const payload = { actor: PA_ACTOR, ...data };
  if (typeof JARVIS_LOG !== "undefined" && JARVIS_LOG?.log) {
    JARVIS_LOG.log(action, "processing_activities", payload, response, error);
    return;
  }
  if (error) {
    console.error(`[JARVIS:${PA_ACTOR}] ${action}`, payload, error);
    return;
  }
  console.log(`[JARVIS:${PA_ACTOR}] ${action}`, payload, response || "");
}

function paEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e) {}
    return value.split(",").map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function paBool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function paNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function paCompanyId() {
  if (typeof state !== "undefined") {
    return state.user?.company || state.company || state.user?.email || "jarvis-company";
  }
  return "jarvis-company";
}

function paAppUserId() {
  if (typeof state !== "undefined") {
    return state.user?.id || state.session?.email || state.user?.email || PA_ACTOR;
  }
  return PA_ACTOR;
}

function paNormalizeActivity(row = {}) {
  return {
    ...createDefaultPAState(),
    id: row.id || `local-${Date.now()}`,
    userId: row.user_id || row.userId || null,
    companyId: row.company_id || row.companyId || paCompanyId(),
    name: row.name || "",
    purpose: row.purpose || "",
    nature: paArray(row.nature),
    natureOther: row.nature_other ?? row.natureOther ?? "",
    who: paArray(row.who),
    freq: row.freq || "",
    storage: row.storage || "",
    scopeNote: row.scope_note ?? row.scopeNote ?? "",
    context: paArray(row.context),
    powerImbalance: paBool(row.power_imbalance ?? row.powerImbalance),
    legal: paArray(row.legal),
    legalOther: row.legal_other ?? row.legalOther ?? "",
    data: paArray(row.data),
    dataOther: row.data_other ?? row.dataOther ?? "",
    recip: paArray(row.recip),
    gov: paArray(row.gov),
    recipOther: row.recip_other ?? row.recipOther ?? "",
    retType: row.ret_type ?? row.retType ?? "",
    retYears: paNumber(row.ret_years ?? row.retYears),
    retOverride: paBool(row.ret_override ?? row.retOverride),
    total: paNumber(row.total),
    sensitive: paNumber(row.sensitive),
    crossBorder: paBool(row.cross_border ?? row.crossBorder),
    country: row.country || "",
    safeguards: paArray(row.safeguards),
    actor: row.actor || PA_ACTOR,
    created_at: row.created_at || row.createdAt || new Date().toISOString(),
    updated_at: row.updated_at || row.updatedAt || null
  };
}

function paToSupabasePayload(activity, userId) {
  const a = paNormalizeActivity(activity);
  const payload = {
    company_id: a.companyId || paCompanyId(),
    name: a.name,
    purpose: a.purpose,
    nature: a.nature,
    nature_other: a.natureOther,
    who: a.who,
    freq: a.freq,
    storage: a.storage,
    scope_note: a.scopeNote,
    context: a.context,
    power_imbalance: a.powerImbalance,
    legal: a.legal,
    legal_other: a.legalOther,
    data: a.data,
    data_other: a.dataOther,
    recip: a.recip,
    gov: a.gov,
    recip_other: a.recipOther,
    ret_type: a.retType,
    ret_years: a.retYears,
    ret_override: a.retOverride,
    total: a.total,
    sensitive: a.sensitive,
    cross_border: a.crossBorder,
    country: a.country,
    safeguards: a.safeguards,
    updated_at: new Date().toISOString(),
    actor: a.actor || PA_ACTOR
  };
  payload.user_id = String(userId || a.userId || paAppUserId() || PA_ACTOR);
  return payload;
}

async function paGetSupabaseUserId(supabase) {
  try {
    const sessionResult = await supabase.auth.getSession();
    const sessionUserId = sessionResult?.data?.session?.user?.id;
    if (sessionUserId) return sessionUserId;
  } catch (e) {}
  return null;
}

function paSaveLocalBackup(activities) {
  localStorage.setItem(PA_STORAGE_KEY, JSON.stringify(activities));
}

function paReadLocalBackup() {
  try {
    return JSON.parse(localStorage.getItem(PA_STORAGE_KEY) || "[]").map(paNormalizeActivity);
  } catch (err) {
    paLog("LOCAL_BACKUP_READ_ERROR", {}, null, err);
    return [];
  }
}

function loadActivitiesFromLocal(reason = "Supabase unavailable") {
  const localData = paReadLocalBackup();
  paLog("FETCH_LOCAL_FALLBACK", { reason, count: localData.length });
  state.processingActivities = localData;
  renderProcessingActivities(localData);
}

async function loadActivitiesFromSupabase() {
  paLog("FETCH_START", { source: "supabase" });
  try {
    const supabase = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
    if (!supabase || (typeof isSupabaseConfigured === "function" && !isSupabaseConfigured())) {
      loadActivitiesFromLocal("Supabase is not configured");
      return;
    }

    const { data, error } = await supabase
      .from(PA_TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const activities = (data || []).map(paNormalizeActivity);
    const localBackup = paReadLocalBackup();

    if (activities.length === 0 && localBackup.length > 0) {
      state.processingActivities = localBackup;
      renderProcessingActivities(localBackup);
      paLog("FETCH_EMPTY_USING_LOCAL_BACKUP", { source: "supabase", localCount: localBackup.length }, { count: 0 });
      return;
    }

    state.processingActivities = activities;
    paSaveLocalBackup(activities);
    renderProcessingActivities(activities);
    paLog("FETCH_SUCCESS", { source: "supabase", count: activities.length }, { count: activities.length });
  } catch (err) {
    paLog("FETCH_ERROR", { source: "supabase" }, null, err);
    loadActivitiesFromLocal(err.message || "Supabase fetch failed");
    if (typeof showToast === "function") showToast("Could not fetch processing activities from Supabase. Showing local backup.", "warning");
  }
}

function renderActivities(list) {
  renderProcessingActivities(list);
}

function renderProcessingActivities(list = []) {
  const tbody = document.getElementById('processing-activities-tbody');
  const emptyEl = document.getElementById('processing-activities-empty');
  const tableWrap = document.getElementById('processing-activities-table-wrap');

  if (!tbody || !emptyEl || !tableWrap) return;

  const activities = (list || []).map(paNormalizeActivity);
  const term = (document.getElementById("processing-search")?.value || "").trim().toLowerCase();
  const filtered = term
    ? activities.filter(a => [
        a.name, a.purpose, a.freq, a.country,
        ...a.data, ...a.legal, ...a.nature, ...a.who, ...a.recip, ...a.gov
      ].join(" ").toLowerCase().includes(term))
    : activities;

  const totalCount = document.getElementById("pa-total-count");
  const crossCount = document.getElementById("pa-crossborder-count");
  const sensitiveCount = document.getElementById("pa-sensitive-count");
  if (totalCount) totalCount.textContent = activities.length;
  if (crossCount) crossCount.textContent = activities.filter(a => a.crossBorder).length;
  if (sensitiveCount) {
    sensitiveCount.textContent = activities.filter(a => a.sensitive > 0 || a.data.some(d => (PA_DATA.find(x => x.label === d) || {}).sensitive)).length;
  }

  // TH Blueprint Styles
  const thStyle = "background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; padding:12px 16px; border-bottom:2px solid #e2e8f0;";
  const thead = tableWrap.querySelector('thead');
  if (thead) {
    thead.querySelectorAll('th').forEach(th => th.style = thStyle);
  }

  if (filtered.length === 0) {
    emptyEl.style.display = 'block';
    tableWrap.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  tableWrap.style.display = 'block';

  tbody.innerHTML = filtered.map((a) => {
    const originalIndex = activities.findIndex(item => item.id === a.id);
    const dataSummary = a.data.length ? `${a.data.length} categories` : "—";
    const legalSummary = a.legal.length ? a.legal.map(paEscape).join(", ") : "—";
    return `
    <tr style="border-bottom:1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
      <td style="padding:16px; color:#94a3b8; font-family:monospace; font-size:11px;">#${originalIndex + 1}</td>
      <td style="padding:16px; font-weight:600; color:#1e293b;">${paEscape(a.name) || '—'}</td>
      <td style="padding:16px; color:#475569; font-size:12px;">${paEscape(a.purpose) || '—'}</td>
      <td style="padding:16px; color:#64748b;">${paEscape(dataSummary)}</td>
      <td style="padding:16px; color:#64748b;">${legalSummary}</td>
      <td style="padding:16px; color:#64748b;">${paEscape(a.freq) || '—'}</td>
      <td style="padding:16px; color:#64748b;">${a.total.toLocaleString()}</td>
      <td style="padding:16px;">
        ${a.crossBorder ? '<span class="badge badge-warning" style="background:#fef3c7; color:#d97706; padding:4px 8px; border-radius:4px; font-size:11px;">Yes</span>' : '<span style="color:#94a3b8; font-size:11px;">No</span>'}
      </td>
      <td style="padding:16px; text-align:right;">
        <button class="btn-edit" onclick="openProcessingModal(${originalIndex})" style="padding:6px 12px; font-size:12px; border:1px solid #e2e8f0; border-radius:6px; background:white; cursor:pointer;">Edit</button>
      </td>
    </tr>
  `;
  }).join('');
}

// ─── COMPLEX MATRIX & DPIA LOGIC ─────────────────────────────

function paCheckGrid(elId, opts, key) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = "";
  opts.forEach(o => {
    const label = typeof o === "string" ? o : o.label;
    const sensitive = typeof o === "object" && o.sensitive;
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-size:13px; background:white;";
    wrap.innerHTML = `<input type="checkbox" value="${label}" style="accent-color:#3b82f6;" />
                      <span style="flex:1;">${label}</span>
                      ${sensitive ? '<span style="font-size:10px; background:#fee2e2; color:#ef4444; padding:2px 6px; border-radius:4px;">Sensitive</span>' : ''}`;

    const input = wrap.querySelector("input");
    input.checked = paState[key].includes(label);

    input.addEventListener("change", e => {
      if (e.target.checked) {
        if (!paState[key].includes(label)) paState[key].push(label);
      } else {
        paState[key] = paState[key].filter(x => x !== label);
      }
      paOnChange();
    });
    el.appendChild(wrap);
  });
}

function paFillSelect(id, opts, labelFn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<option value="">Select option...</option>';
  opts.forEach(o => {
    const op = document.createElement("option");
    op.value = typeof o === "string" ? o : o;
    op.textContent = labelFn ? labelFn(o) : o;
    el.appendChild(op);
  });
}

function initActivityUI() {
  paCheckGrid("pa-natureGrid", PA_NATURE, "nature");
  paCheckGrid("pa-whoGrid", PA_SCOPE_WHO, "who");
  paCheckGrid("pa-contextGrid", PA_CONTEXT, "context");
  paCheckGrid("pa-legalGrid", PA_LEGAL, "legal");
  paCheckGrid("pa-dataGrid", PA_DATA, "data");
  paCheckGrid("pa-recipGrid", PA_RECIP, "recip");
  paCheckGrid("pa-govGrid", PA_GOV, "gov");
  paCheckGrid("pa-safeGrid", PA_SAFEGUARDS, "safeguards");

  paFillSelect("pa-freq", PA_SCOPE_FREQ);
  paFillSelect("pa-storage", PA_SCOPE_STORAGE);
  paFillSelect("pa-country", PA_COUNTRIES);
  paFillSelect("pa-retType", Object.keys(PA_RETENTION), k => `${k} (${PA_RETENTION[k]} yrs)`);

  // Setup event listeners for inputs
  const bind = (id, key, isNum=false) => {
    const el = document.getElementById(id);
    if(el) {
      el.value = paState[key];
      el.addEventListener("input", e => { paState[key] = isNum ? Number(e.target.value) : e.target.value; paOnChange(); });
    }
  };
  bind("pa-name", "name"); bind("pa-purpose", "purpose");
  bind("pa-total", "total", true); bind("pa-sens", "sensitive", true); bind("pa-retYears", "retYears", true);

  const bindSelect = (id, key) => {
    const el = document.getElementById(id);
    if(el) { el.value = paState[key]; el.addEventListener("change", e => { paState[key] = e.target.value; paOnChange(); }); }
  };
  bindSelect("pa-freq", "freq"); bindSelect("pa-storage", "storage"); bindSelect("pa-country", "country");

  const retTypeEl = document.getElementById("pa-retType");
  if (retTypeEl) {
    retTypeEl.value = paState.retType;
    retTypeEl.addEventListener("change", e => {
      paState.retType = e.target.value;
      paState.retYears = PA_RETENTION[e.target.value] || 0;
      const yrsEl = document.getElementById("pa-retYears");
      if(yrsEl) yrsEl.value = paState.retYears;
      paOnChange();
    });
    const cbEl = document.getElementById("pa-crossBorder");
    if (cbEl) {
      cbEl.checked = !!paState.crossBorder;
    }
  }
}

function paOnChange() {
  const isSensitive = paState.data.some(d => (PA_DATA.find(x => x.label === d) || {}).sensitive);

  const sensAlert = document.getElementById("pa-sensitiveAlert");
  if(sensAlert) sensAlert.style.display = isSensitive ? "block" : "none";

  const cbWrap = document.getElementById("pa-cbWrap");
  if(cbWrap) cbWrap.style.display = paState.crossBorder ? "block" : "none";

  // DPIA Logic
  const overTotal = paState.total > 20000;
  const overSens = paState.sensitive > 10000;
  const trig = overTotal || overSens;

  const dpiaLabel = document.getElementById("pa-dpiaLabel");
  if(dpiaLabel) dpiaLabel.textContent = trig ? "DPIA Required" : "DPIA Not Required (yet)";

  const t1Bar = document.getElementById("pa-t1Bar");
  if(t1Bar) {
    t1Bar.style.width = Math.min(100, paState.total / 20000 * 100) + "%";
    t1Bar.style.background = overTotal ? "#ef4444" : "#3b82f6";
  }
  const t2Bar = document.getElementById("pa-t2Bar");
  if(t2Bar) {
    t2Bar.style.width = Math.min(100, paState.sensitive / 10000 * 100) + "%";
    t2Bar.style.background = overSens ? "#ef4444" : "#3b82f6";
  }
}

function openProcessingModal(index = -1) {
  const modal = document.getElementById('modal-processing');
  if (!modal) return;

  // Vertical Gravity
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  editActivityIndex = index;

  if (index >= 0) {
    const act = state.processingActivities[index];
    paState = paNormalizeActivity(act);
  } else {
    // Reset state
    paState = createDefaultPAState();
  }

  initActivityUI();
  paOnChange();

  modal.classList.add('open');
}

function closeProcessingModal() {
  const modal = document.getElementById('modal-processing');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = '';
  }
}

async function paSaveActivity() {
  if (!paState.name.trim()) { showToast("Activity name is required", "error"); return; }

  const normalized = paNormalizeActivity({ ...paState, companyId: paCompanyId() });
  const existing = editActivityIndex >= 0 ? state.processingActivities[editActivityIndex] : null;
  let savedActivity = normalized;
  let savedToSupabase = false;

  try {
    const supabase = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
    if (supabase && (typeof isSupabaseConfigured !== "function" || isSupabaseConfigured())) {
      const userId = await paGetSupabaseUserId(supabase);
      const payload = paToSupabasePayload({ ...normalized, id: existing?.id || normalized.id, companyId: existing?.companyId || normalized.companyId }, userId || existing?.userId);
      let result;

      if (existing?.id && !String(existing.id).startsWith("local-")) {
        result = await supabase
          .from(PA_TABLE)
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .single();
      } else {
        result = await supabase
          .from(PA_TABLE)
          .insert([payload])
          .select("*")
          .single();
      }

      if (result.error) throw result.error;
      savedActivity = paNormalizeActivity(result.data);
      savedToSupabase = true;
      paLog("SAVE_SUCCESS", { source: "supabase", id: savedActivity.id }, { id: savedActivity.id });
    } else {
      paLog("SAVE_LOCAL_FALLBACK", { reason: "Supabase is not configured" });
    }
  } catch (err) {
    paLog("SAVE_ERROR", { source: "supabase" }, null, err);
    if (typeof showToast === "function") showToast("Supabase save failed. Saved local backup instead.", "warning");
  }

  try {
    state.processingActivities = state.processingActivities || [];
    if (editActivityIndex >= 0) {
      state.processingActivities[editActivityIndex] = { ...existing, ...savedActivity };
    } else {
      state.processingActivities.unshift({
        ...savedActivity,
        id: savedToSupabase ? savedActivity.id : `local-${Date.now()}`,
        created_at: savedActivity.created_at || new Date().toISOString()
      });
    }

    paSaveLocalBackup(state.processingActivities);

    renderProcessingActivities(state.processingActivities);
    closeProcessingModal();
    showToast(savedToSupabase ? 'Processing Activity saved to Supabase' : 'Processing Activity saved locally', 'success');
  } catch (err) {
    paLog("SAVE_LOCAL_ERROR", {}, null, err);
    showToast('Failed to save activity', 'error');
  }
}

// For Checkbox changes to Cross Border switch
function paToggleSwitch(id, key) {
  paState[key] = !paState[key];
  const sw = document.getElementById(id);
  if(sw) {
    sw.checked = paState[key];
  }
  paOnChange();
}

async function loadSampleProcessingActivities() {
  const samples = [
    {
      name: "Employee payroll processing",
      purpose: "Calculate salary, statutory deductions, and employee benefits.",
      nature: ["Collection", "Storage", "Use", "Disclosure"],
      who: ["Internal employees"],
      freq: "Monthly",
      storage: "Cloud system",
      context: ["Employer-employee relationship"],
      legal: ["Contract necessity (Section 6)", "Legal obligation"],
      data: ["Name", "IC / Passport", "Email", "Financial data", "Salary"],
      recip: ["HR", "Payroll provider"],
      gov: ["EPF", "SOCSO", "LHDN"],
      retType: "Payroll records",
      retYears: 7,
      total: 120,
      sensitive: 0,
      crossBorder: false
    },
    {
      name: "Customer support case handling",
      purpose: "Resolve customer requests and maintain support history.",
      nature: ["Recording", "Storage", "Retrieval", "Use"],
      who: ["Customers"],
      freq: "Daily",
      storage: "Hybrid",
      context: ["Customer-business relationship"],
      legal: ["Contract necessity (Section 6)", "Legitimate interest"],
      data: ["Name", "Email", "Phone"],
      recip: ["Internal department", "Vendors"],
      retType: "Customer data",
      retYears: 5,
      total: 5000,
      sensitive: 0,
      crossBorder: true,
      country: "Singapore",
      safeguards: ["Contract clauses", "Encryption", "Access control"]
    }
  ].map(item => paNormalizeActivity({ ...item, companyId: paCompanyId(), created_at: new Date().toISOString() }));

  const supabase = typeof getSupabaseClient === "function" ? getSupabaseClient() : null;
  let savedSamples = samples;
  let savedToSupabase = false;

  try {
    if (supabase && (typeof isSupabaseConfigured !== "function" || isSupabaseConfigured())) {
      const userId = await paGetSupabaseUserId(supabase);
      const payloads = samples.map(sample => paToSupabasePayload(sample, userId));
      const { data, error } = await supabase.from(PA_TABLE).insert(payloads).select("*");
      if (error) throw error;
      savedSamples = (data || []).map(paNormalizeActivity);
      savedToSupabase = true;
      paLog("SAMPLE_SAVE_SUCCESS", { source: "supabase", count: savedSamples.length }, { count: savedSamples.length });
    }
  } catch (err) {
    paLog("SAMPLE_SAVE_ERROR", { source: "supabase" }, null, err);
    if (typeof showToast === "function") showToast("Sample data could not be saved to Supabase. Added local samples instead.", "warning");
  }

  state.processingActivities = [...savedSamples, ...(state.processingActivities || [])];
  paSaveLocalBackup(state.processingActivities);
  renderProcessingActivities(state.processingActivities);
  if (typeof showToast === "function") showToast(savedToSupabase ? "Sample activities saved to Supabase" : "Sample activities added locally", "success");
}
