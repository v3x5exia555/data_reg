/* ============================================================
   app.js — DataRex PDPA Portal
   All application logic: state, navigation, rendering, events
   ============================================================ */

/* ───────────────────────────────────────────────
   JARVIS GLOBAL LOGGING SYSTEM
   ─────────────────────────────────────────────── */
const JARVIS_LOG = {
  enabled: true,

  log(action, component, data = {}, response = null, error = null) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      component,
      data,
      response,
      error: error ? { message: error.message, code: error.code } : null,
      user_id: state.user?.id || 'anonymous',
      user_email: state.user?.email || 'anonymous'
    };

    // Console output
    console.log(
      `%c[JARVIS] ${timestamp.split('T')[1].split('.')[0]} | ${component} | ${action}`,
      'color: #4f46e5; font-weight: bold',
      data,
      response ? `✓ ${JSON.stringify(response)}` : '',
      error ? `✗ ${error.message}` : ''
    );

    // Save to Supabase (async, non-blocking)
    this.saveToSupabase(logEntry);

    return logEntry;
  },

  async saveToSupabase(entry) {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) return;

    try {
      await supabase.from('system_logs').insert([{
        action: entry.action,
        component: entry.component,
        data: entry.data,
        response: entry.response,
        error_message: entry.error?.message,
        error_code: entry.error?.code,
        user_id: entry.user_id,
        user_email: entry.user_email,
        account_id: getEffectiveAccountId()
      }]);
    } catch (e) {
      console.error('JARVIS Log Save Error:', e);
    }
  },

  // Convenience methods
  click(component, element, data = {}) {
    return this.log('CLICK', component, { element, ...data });
  },

  submit(component, formName, data = {}) {
    return this.log('SUBMIT', component, { form: formName, ...data });
  },

  success(component, action, data = {}) {
    return this.log('SUCCESS', component, { action, ...data });
  },

  error(component, action, err, data = {}) {
    return this.log('ERROR', component, { action, ...data }, null, err);
  },

  pageView(page) {
    return this.log('PAGE_VIEW', page, { url: window.location.hash });
  }
};

// Global error handler
window.addEventListener('error', (e) => {
  JARVIS_LOG.error('Window', 'JavaScript Error', e.error || new Error(e.message));
});

/* ───────────────────────────────────────────────
   STATE
   ─────────────────────────────────────────────── */
const state = {
  isLoggedIn: false,
  user: { name: 'Demo DPO', company: 'Acme Pte Ltd', email: 'dpo@acme.com' },
  bizType: null,
  currentUserLevel: 'Accountadmin',
  // Multi-tenant state (populated on login from user_profiles).
  role: null,           // 'Superadmin' | 'Accountadmin' | 'user'
  accountId: null,      // null only for Superadmin
  viewAsAccountId: null, // Superadmin override; persisted in localStorage
  navPermissions: null,
  session: {
    sessionId: null,
    token: null,
    createdAt: null,
    expiresAt: null
  },
  checks: {
    'collect-personal': false, 'appoint-dpo': false,
    'ask-consent': false, 'withdraw-consent': false,
    'store-secure': false, 'control-access': false,
    'delete-data': false, 'privacy-policy': false,
    'policy-findable': false, 'breach-plan': false,
    'records-confidential': false, 'explicit-consent-medical': false
  },
  records: [
    { type:'Name, email, phone', purpose:'Respond to enquiries', storage:'Website DB, email inbox', access:'Admin, sales team', retention:6, consent:true, note:'' },
    { type:'Patient medical record', purpose:'Medical treatment', storage:'Clinic management system', access:'Doctors, clinic admin', retention:84, consent:true, note:'Sensitive — restricted access' },
    { type:'Employee IC & personal details', purpose:'Employment payroll', storage:'HR system, internal server', access:'HR dept, management', retention:84, consent:false, note:'Required for statutory compliance' },
    { type:'Customer email address', purpose:'Promotions & newsletters', storage:'Mailchimp, CRM', access:'Marketing team', retention:24, consent:true, note:'Subscribed via website form' },
    { type:'Customer phone number', purpose:'Order updates & support', storage:'WhatsApp Business', access:'Customer service team', retention:12, consent:true, note:'Collected via order form' }
  ],
  team: [
    { name: 'Aisha Rahman', role: 'Data Protection Officer', level: 'Accountadmin' },
    { name: 'Mark Tan', role: 'Head of Marketing', level: 'useradmin' }
  ],
  documents: [],
  customRoles: ['Accountadmin', 'security_user', 'useradmin', 'user'],
  alerts: [
    { id: 'a1', type: 'warning', title: 'Privacy Policy missing', message: 'Upload your Privacy Policy document to remain compliant.', link: 'documents', linkText: 'Upload now' },
    { id: 'a2', type: 'error', title: 'Overdue compliance tasks', message: '2 checklist items are overdue. Complete them to maintain your compliance score.', link: 'checklist', linkText: 'View tasks' },
    { id: 'a3', type: 'info', title: 'Consent review due', message: 'Customer consent for newsletter marketing expires in 30 days. Consider renewal.', link: 'consent', linkText: 'Review' },
    { id: 'a4', type: 'warning', title: 'Retention deadline', message: 'Employee records from 2023 should be reviewed for deletion.', link: 'retention', linkText: 'Review records' }
  ],
  dataRequests: [],
  vendors: [],
  trainingRecords: [],
  dpoRecords: [],
  processingActivities: [],
  dpiaItems: [],
  breachLog: [],
  crossBorderTransfers: [],
  cases: [],
  optouts: []
};

const PAGES_TO_LOAD = [
  'auth__landing', 'auth__login', 'auth__register', 'auth__onboarding',
  '00__dashboard', '01__checklist', '02__companies', '03__datasources',
  '04__dataregister', '05__consent', '06__access', '07__retention',
  '07__vendors', '08__dpo', '08__training', '09__datarequests', '10__breachlog',
  '04__dpia', '11__deica', '06__crossborder', '15__documents',
  '16__audit', '17__alerts', '18__cases', '19__monitoring', '21__processing',
  '20__accounts', '22__people'
];
const PAGE_ASSET_VERSION = '34';

async function loadAllPages() {
  const mainArea = document.getElementById('main-content-area');
  const modalContainer = document.getElementById('modal-container');

  // Load Modals
  try {
    const modalRes = await fetch(`modals.html?v=${PAGE_ASSET_VERSION}`);
    if (modalRes.ok) modalContainer.innerHTML = await modalRes.text();
    if (typeof initActivityMatrices === 'function') initActivityMatrices();
  } catch (e) { console.error('Failed to load modals:', e); }

  // Load Pages
  const loadPromises = PAGES_TO_LOAD.map(async (pageId) => {
    try {
      const res = await fetch(`pages/${pageId}.html?v=${PAGE_ASSET_VERSION}`);
      console.log(`Loading page ${pageId}: ${res.status}`);
      if (res.ok) {
        const html = await res.text();
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Strip any inline <script> tags from fetched fragments. Page-specific
        // logic must live in dedicated module files (see js/app.js, js/*_logic.js)
        // and expose initializers on `window`. Executing fetched scripts is
        // disallowed because it opens an XSS-to-RCE channel.
        temp.querySelectorAll('script').forEach(script => script.remove());

        const pageEl = temp.firstElementChild;
        if (pageEl) {
          console.log(`Page ${pageId} loaded, element ID: ${pageEl.id}`);
          if (pageId.startsWith('auth__')) {
            document.getElementById('app').appendChild(pageEl);
          } else {
            mainArea.appendChild(pageEl);
          }

          // Optional named init hook: window.initPage_<pageId>()
          const initFn = window['initPage_' + pageId];
          if (typeof initFn === 'function') {
            try { initFn(); }
            catch (e) { console.error(`initPage_${pageId} failed:`, e); }
          }
        }
      }
    } catch (e) { console.error(`Failed to load page ${pageId}:`, e); }
  });

  await Promise.all(loadPromises);
}

// ─── LOCAL STORAGE PERSISTENCE ────────────────────────────────
function loadState() {
  const saved = localStorage.getItem('dataRexState');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge saved state into default state
      if (typeof parsed.isLoggedIn !== 'undefined') state.isLoggedIn = parsed.isLoggedIn;
      if (parsed.user) {
        Object.assign(state.user, parsed.user);
        // One-shot migration for legacy non-UUID IDs (e.g. 'user-1234567890'
        // produced by older builds of doLogin). Generate a stable UUID, write
        // it back to dataRexState AND the matching datarex_users record, and
        // re-tag any localStorage documents that were saved with the old id
        // so docMatchesScope keeps showing them.
        const oldId = state.user.id;
        if (oldId && (oldId.startsWith('user-') || oldId.length < 32)) {
          const stableId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
          state.user.id = stableId;
          try {
            const localUsers = JSON.parse(localStorage.getItem('datarex_users') || '[]');
            const match = localUsers.find(u => u.email === state.user.email);
            if (match) {
              match.id = stableId;
              localStorage.setItem('datarex_users', JSON.stringify(localUsers));
            }
          } catch (_) { /* best effort */ }
          try {
            const docs = JSON.parse(localStorage.getItem('datarex_documents') || '[]');
            let dirty = false;
            for (const d of docs) {
              if (d && d.userId === oldId) { d.userId = stableId; dirty = true; }
            }
            if (dirty) localStorage.setItem('datarex_documents', JSON.stringify(docs));
          } catch (_) { /* best effort */ }
          try { saveState(); } catch (_) {}
        }
      }
      if (parsed.bizType) state.bizType = parsed.bizType;
      if (parsed.checks) Object.assign(state.checks, parsed.checks);
      if (parsed.records) state.records = parsed.records;
      else {
        const savedRecords = localStorage.getItem('datarex_records');
        if (savedRecords) state.records = JSON.parse(savedRecords);
      }
      if (parsed.team) state.team = parsed.team;
      if (parsed.documents) state.documents = parsed.documents;
      if (parsed.currentUserLevel) state.currentUserLevel = parsed.currentUserLevel;
      if (parsed.navPermissions) state.navPermissions = parsed.navPermissions;
    } catch (e) {
      console.error('Failed to parse saved state', e);
    }
  }
  // Update UI
  const selectEl = document.getElementById('company-select');
  if (selectEl && state.user.company) {
    selectEl.value = state.user.company;
  }
  updateActiveCompanyLabel();
}
function saveState() {
  // `state.documents` items can carry multi-MB `dataUrl` payloads. The
  // canonical store for those is `datarex_documents` (see writeLocalDocuments);
  // keeping them out of `dataRexState` prevents quota errors when there are
  // several uploads.
  const { documents: _docs, ...rest } = state;
  localStorage.setItem('dataRexState', JSON.stringify(rest));
}

function getDisplayCompanyName(preferredName = '') {
  if (preferredName) return preferredName;
  if (state.viewAsAccountId && state._viewAsAccountName?.id === state.viewAsAccountId) {
    return state._viewAsAccountName.name;
  }

  const candidates = [
    state.user?.company,
    state.company,
    state.companies?.find(c => c?.active)?.name,
    state.companies?.[0]?.name
  ];

  try {
    const savedState = JSON.parse(localStorage.getItem('dataRexState') || '{}');
    candidates.push(savedState.user?.company, savedState.company);
  } catch (_) { /* best effort */ }

  try {
    const localUsers = JSON.parse(localStorage.getItem('datarex_users') || '[]');
    const currentEmail = state.user?.email;
    const currentUser = currentEmail ? localUsers.find(u => u.email === currentEmail) : null;
    candidates.push(currentUser?.company, localUsers[0]?.company);
  } catch (_) { /* best effort */ }

  return candidates.find(name => name && name !== 'Select Company') || 'Acme Pte Ltd';
}

function updateActiveCompanyLabel(preferredName = '') {
  const companyName = getDisplayCompanyName(preferredName);

  if (companyName && companyName !== 'Select Company') {
    state.user.company = companyName;
    state.company = companyName;
  }

  const activeCompanyName = document.getElementById('active-company-name');
  if (activeCompanyName) {
    activeCompanyName.textContent = companyName;
    activeCompanyName.title = companyName;
  }

  const sidebarOrg = document.getElementById('sidebar-org');
  if (sidebarOrg) {
    sidebarOrg.textContent = companyName;
    sidebarOrg.title = companyName;
  }

  const selector = document.getElementById('sidebar-org-selector');
  if (selector) selector.title = companyName;
}

function switchOrg(company) {
  state.user.company = company;
  state.company = company;
  saveState();

  updateActiveCompanyLabel(company);

  const dropdown = document.getElementById('org-dropdown');
  if (dropdown) dropdown.classList.remove('open');

  renderCompanies();
  renderRegister();
  renderDocuments();

  // Reload all org-scoped modules so they don't show stale data from the
  // previously-selected company. Each loader is feature-flagged on availability.
  if (typeof loadDPOFromSupabase === 'function') loadDPOFromSupabase();
  if (typeof loadVendorsFromSupabase === 'function') loadVendorsFromSupabase();
  if (typeof loadTrainingFromSupabase === 'function') loadTrainingFromSupabase();
  if (typeof loadActivitiesFromSupabase === 'function') loadActivitiesFromSupabase();

  const selectEl = document.getElementById('company-select');
  if (selectEl) selectEl.value = company;

  showToast(`Switched to ${company}`, 'success');
}

function toggleOrgDropdown() {
  const dropdown = document.getElementById('org-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
      renderOrgDropdown();
    }
  }
}

function openCompaniesTab() {
  const dropdown = document.getElementById('org-dropdown');
  if (dropdown) dropdown.classList.remove('open');
  showPage('companies', document.getElementById('nav-companies'));
}

function renderOrgDropdown() {
  const list = document.getElementById('org-dropdown-list');
  if (!list) return;

  const companies = state.companies || [];
  const current = state.user?.company;

  if (companies.length === 0) {
    list.innerHTML = '<div class="org-dropdown-item" style="color:#9ca3af;cursor:default;justify-content:center;">No other companies</div>';
    return;
  }

  list.innerHTML = companies.map(c => `
    <div class="org-dropdown-item ${c.name === current ? 'active' : ''}" onclick="switchOrg('${c.name}')">
      <div class="item-icon">🏢</div>
      <div style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
      ${c.name === current ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--blue)"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
    </div>
  `).join('');
}
// Pre-populate demo user if not exists
// SHA-256 hash of 'Admin123!@#'
const DEMO_PASSWORD_HASH = 'a8d51fc6a058bfeacb77818d42d420ac1bf31529393a784ec60f7c2443047462';
if (!localStorage.getItem('datarex_users')) {
  localStorage.setItem('datarex_users', JSON.stringify([
    { name: 'Demo DPO', company: 'Acme Pte Ltd', email: 'admin@datarex.com', password_hash: DEMO_PASSWORD_HASH, industry: 'Technology', size: '11-50', regNo: '202001000001 (A)' }
  ]));
}
loadState(); // Load immediately on script run

// ─── AUTH STATE LISTENER ─────────────────────────────────────
function initAuthListener() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      state.isLoggedIn = true;
      state.user = {
        ...state.user,
        id: session.user.id,
        email: session.user.email,
        // Preserve name/company already set by doLogin() — for admin-created users
        // user_metadata is empty and would overwrite valid DB-fetched values with ''.
        name: session.user.user_metadata?.name || state.user.name || session.user.email,
        company: session.user.user_metadata?.company || state.user.company || ''
      };
      saveState();

      // Only auto-launch on session restore (screen-app already visible).
      // doLogin() handles the launchApp call for explicit password logins.
      if (document.getElementById('screen-app')?.classList.contains('active')) {
        launchApp(session.user);
      }
    } else if (event === 'SIGNED_OUT') {
      state.isLoggedIn = false;
      state.user = { name: '', company: '', email: '' };
      saveState();
      if (!document.getElementById('screen-landing')?.classList.contains('active')) {
        goTo('screen-landing');
      }
    }
  });
}

// Initialization moved to consolidated block at end of file
// document.addEventListener('DOMContentLoaded', initAuthListener);

// ─── TOAST NOTIFICATIONS ─────────────────────────────────────
function showToast(message, type = 'info') {
  const existing = document.getElementById('toast-container');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-container';
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showSuccess(msg) { showToast(msg, 'success'); }
function showError(msg) { showToast(msg, 'error'); }
function showWarning(msg) { showToast(msg, 'warning'); }
function mapSupabaseError(err) {
  if (!err) return 'Unknown error';
  const code = err.code || '';
  const msg = err.message || String(err);
  if (code === '42501' || /row-level security/i.test(msg)) {
    return "You don't have access to that account.";
  }
  if (code === '23514' && /role/i.test(msg)) {
    return "That role change isn't allowed.";
  }
  return msg;
}

// ─── PASSWORD STRENGTH METER ─────────────────────────────────
function updatePasswordStrength(password) {
  const bars = [
    document.getElementById('strength-bar-1'),
    document.getElementById('strength-bar-2'),
    document.getElementById('strength-bar-3'),
    document.getElementById('strength-bar-4')
  ];
  const text = document.getElementById('strength-text');
  if (!text || bars.some(b => !b)) return;

  bars.forEach(bar => {
    bar.classList.remove('active-weak', 'active-fair', 'active-good', 'active-strong');
  });

  if (!password) {
    text.textContent = 'Enter a password';
    text.className = 'strength-text';
    return;
  }

  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  strength = Math.min(strength, 4);

  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  const classes = ['weak', 'fair', 'good', 'strong'];
  const activeClasses = ['active-weak', 'active-fair', 'active-good', 'active-strong'];

  for (let i = 0; i < strength; i++) {
    bars[i].classList.add(activeClasses[strength - 1]);
  }

  if (strength > 0) {
    text.textContent = labels[strength - 1];
    text.className = 'strength-text ' + classes[strength - 1];
  } else {
    text.textContent = 'Too short';
    text.className = 'strength-text weak';
  }
}
window.updatePasswordStrength = updatePasswordStrength;

// ─── PASSWORD HASHING ────────────────────────────────────────
// SHA-256 hash for at-rest storage of passwords in localStorage.
// Note: this is not a substitute for proper auth (Supabase Auth),
// but it prevents trivial credential theft via DevTools.
async function hashPasswordForStorage(pw) {
  const enc = new TextEncoder().encode(String(pw || ''));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
window.hashPasswordForStorage = hashPasswordForStorage;

// ─── SUPABASE INTEGRATION ────────────────────────────────────
// Credentials are now loaded securely via js/env.js
// Use window.supabaseClient after env.js has initialized
let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (window.supabaseClient) {
    supabaseClient = window.supabaseClient;
    return supabaseClient;
  }
  return null;
}

function isSupabaseConfigured() {
  return !!(window.ENV?.SUPABASE_URL && window.ENV?.SUPABASE_ANON_KEY);
}

// ─── SESSION MANAGEMENT ─────────────────────────────────────
function getSessionToken() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.auth.getSession();
  return data?.session?.access_token || null;
}

function getSessionId() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.auth.getSession();
  return data?.session?.id || null;
}

function getSessionExpiry() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.auth.getSession();
  return data?.session?.expires_at || null;
}

function isSessionExpired() {
  const expiry = getSessionExpiry();
  if (!expiry) return true;
  return Date.now() >= expiry * 1000;
}

function getRefreshToken() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = supabase.auth.getSession();
  return data?.session?.refresh_token || null;
}

function saveSessionToStorage() {
  const token = getSessionToken();
  const sessionId = getSessionId();
  if (token && sessionId) {
    localStorage.setItem('datarex_session_token', token);
    localStorage.setItem('datarex_session_id', sessionId);
    localStorage.setItem('datarex_session_time', Date.now().toString());
  }
}

function clearSessionFromStorage() {
  localStorage.removeItem('datarex_session_token');
  localStorage.removeItem('datarex_session_id');
  localStorage.removeItem('datarex_session_time');
}

function getStoredSession() {
  return {
    token: localStorage.getItem('datarex_session_token'),
    sessionId: localStorage.getItem('datarex_session_id'),
    timestamp: localStorage.getItem('datarex_session_time')
  };
}

// ─── API HELPER WITH AUTH ─────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getSessionToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(endpoint, { ...options, headers });
}
// ─────────────────────────────────────────────────────────────

/* ───────────────────────────────────────────────
   STATIC DATA
   ─────────────────────────────────────────────── */
const CHECKLIST = [
  { section:'Basics', items:[
    { id:'collect-personal', q:'Do you collect personal data?', hint:'Personal data is any info that identifies a person — names, emails, IDs, photos.' },
    { id:'appoint-dpo', q:'Have you appointed a DPO?', hint:'Every organisation handling personal data should have a Data Protection Officer.' }
  ]},
  { section:'Consent', items:[
    { id:'ask-consent', q:'Do you ask for consent before collecting data?', hint:'Consent must be freely given, specific, informed, and unambiguous.' },
    { id:'withdraw-consent', q:'Can people withdraw consent easily?', hint:'Provide a clear, simple way to opt out at any time.' }
  ]},
  { section:'Security', items:[
    { id:'store-secure', q:'Is personal data stored securely?', hint:'Use encryption, backups, and access controls.' },
    { id:'control-access', q:'Do you restrict who can access data?', hint:'Only staff with a legitimate reason should have access.' },
    { id:'delete-data', q:'Do you delete data when no longer needed?', hint:'Set a retention schedule and stick to it.' }
  ]},
  { section:'Transparency', items:[
    { id:'privacy-policy', q:'Do you have a Privacy Policy?', hint:'It should explain what you collect, why, and how you protect it.' },
    { id:'policy-findable', q:'Is your Privacy Policy easy to find?', hint:'Link it from your website footer and sign-up forms.' }
  ]},
  { section:'Incident Response', items:[
    { id:'breach-plan', q:'Do you have a data breach response plan?', hint:'Know who to notify and within what timeframe (72h for PDPA).' },
    { id:'records-confidential', q:'Are physical records stored confidentially?', hint:'Lock paper documents; restrict access.' },
    { id:'explicit-consent-medical', q:'Do you get explicit consent for sensitive data?', hint:'Medical, financial, and biometric data require higher consent standards.' }
  ]}
];

const CONSENT_DATA = [
  { title:'Customer contact data', purpose:'Customer communications & support',
    toggles:[ { label:'Newsletter & marketing', checked:true }, { label:'Order confirmations', checked:true }, { label:'Third-party sharing', checked:false } ] },
  { title:'Employee personal data', purpose:'HR, payroll & legal compliance',
    toggles:[ { label:'Payroll processing', checked:true }, { label:'Training communications', checked:true } ] },
  { title:'Website analytics', purpose:'Site performance & UX improvement',
    toggles:[ { label:'Analytics cookies', checked:false }, { label:'Functional cookies', checked:true } ] }
];

async function loadConsentFromSupabase() {
  loadOptOuts();
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) {
    renderConsent(); // Fallback to static data
    return;
  }

  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) { renderConsent(); return; }
  let consentQuery = supabase.from('consent_settings').select('*');
  if (accountId) consentQuery = consentQuery.eq('account_id', accountId);
  const { data, error } = await consentQuery.order('category');

  if (error) {
    console.error('Failed to load consent:', error);
    renderConsent(); // Fallback if no data
    return;
  }

  if (data && data.length > 0) {
    renderConsentFromDB(data);
  } else {
    renderConsent(); // Fallback if no data
  }
}

function renderConsentFromDB(data) {
  const body = document.getElementById('consent-body');
  if (!body) return;

  const categories = {};
  data.forEach(item => {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category].push(item);
  });

  const icons = {'Customer contact data': '📧', 'Employee personal data': '👥', 'Website analytics': '📊'};
  const colors = {'Customer contact data': '#e3f2fd', 'Employee personal data': '#f3e5f5', 'Website analytics': '#e8f5e9'};

  let html = '';
  Object.entries(categories).forEach(([category, items]) => {
    const icon = icons[category] || '📋';
    const bg = colors[category] || '#f5f5f5';
    const enabled = items.filter(i => i.is_enabled).length;

    html += `
      <div class="consent-item">
        <div class="consent-header-row">
          <div class="consent-icon" style="background:${bg}">${icon}</div>
          <div style="flex:1">
            <div class="consent-head" style="margin-bottom:8px;">
              <div>
                <div class="consent-title">${category}</div>
                <div class="consent-purpose">Manage consent settings for ${category.toLowerCase()}</div>
              </div>
              <span class="badge badge-green">${enabled}/${items.length} enabled</span>
            </div>
          </div>
        </div>
        ${items.map(item => `
          <div class="toggle-row">
            <div class="toggle-label">
              <span class="toggle-status ${item.is_enabled ? 'on' : 'off'}">${item.is_enabled ? 'ON' : 'OFF'}</span>
              <span>${item.toggle_label}</span>
            </div>
            <label class="toggle-wrap">
              <input type="checkbox" ${item.is_enabled ? 'checked' : ''} onchange="updateConsentDb('${item.id}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        `).join('')}
      </div>
    `;
  });

  body.innerHTML = html;
  updateConsentStats();
  renderOptOutLog();
}

function updateConsentStats() {
  const marketingRecordsCount = document.getElementById('marketing-records-count');
  const missingOptoutCount = document.getElementById('missing-optout-count');
  const optoutsLoggedCount = document.getElementById('optouts-logged-count');

  if (!marketingRecordsCount) return;

  // Filter records that involve marketing/newsletters
  const marketingRecords = (state.records || []).filter(r =>
    r.purpose.toLowerCase().includes('marketing') ||
    r.purpose.toLowerCase().includes('newsletter') ||
    r.purpose.toLowerCase().includes('promotions')
  );

  marketingRecordsCount.textContent = marketingRecords.length;

  // Check for records that might be missing opt-out info (demo logic)
  const missing = marketingRecords.filter(r => !r.consent).length;
  missingOptoutCount.textContent = missing;

  // Opt-outs logged (could be from a separate state.optouts array if implemented)
  optoutsLoggedCount.textContent = state.optouts?.length || 0;
}

async function updateConsentDb(id, checked) {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;

  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) return;

  let query = supabase.from('consent_settings').update({ is_enabled: checked }).eq('id', id);
  if (accountId) query = query.eq('account_id', accountId);
  const { error } = await query;

  if (error) {
    console.error('Update failed:', error);
    showToast('Failed to update consent', 'error');
  } else {
    showToast('Consent updated', 'success');
  }
}

function loadOptOuts() {
  state.optouts = readLocalList('optout_data');
  renderOptOutLog();
}

function renderOptOutLog() {
  const body = document.getElementById('optout-log-body');
  if (!body) return;

  const list = state.optouts || [];
  if (list.length === 0) {
    body.className = 'optout-empty';
    body.innerHTML = 'No opt-outs logged yet.';
    return;
  }

  body.className = '';
  body.innerHTML = `
    <div class="data-table-wrap">
      <table class="styled-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Channel</th><th>Date</th><th>Notes</th></tr>
        </thead>
        <tbody>
          ${list.map(item => `
            <tr>
              <td>${item.name || '—'}</td>
              <td>${item.email || '—'}</td>
              <td>${item.channel || '—'}</td>
              <td>${item.request_date || '—'}</td>
              <td>${item.notes || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function resetOptOutForm() {
  const values = {
    'optout-name': '',
    'optout-email': '',
    'optout-channel': 'Email',
    'optout-date': new Date().toISOString().slice(0, 10),
    'optout-notes': ''
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

function saveOptOut() {
  const optOut = {
    id: 'local-' + Date.now(),
    name: document.getElementById('optout-name')?.value.trim() || '',
    email: document.getElementById('optout-email')?.value.trim() || '',
    channel: document.getElementById('optout-channel')?.value || 'Email',
    request_date: document.getElementById('optout-date')?.value || new Date().toISOString().slice(0, 10),
    notes: document.getElementById('optout-notes')?.value.trim() || '',
    created_at: new Date().toISOString()
  };

  if (!optOut.name) {
    showToast('Person name is required', 'error');
    return;
  }

  state.optouts = state.optouts || [];
  state.optouts.unshift(optOut);
  saveLocalList('optout_data', state.optouts);
  renderOptOutLog();
  updateConsentStats();
  closeModal('modal-log-optout');
  showToast('Opt-out logged locally', 'success');
}

const RETENTION_DATA = [
  { title:'Customer contact data', sub:'Names, emails, phone numbers', months:24, active:true },
  { title:'Employee records', sub:'HR files, payroll data, IC numbers', months:84, active:true },
  { title:'Visitor data', sub:'Website logs, cookie identifiers', months:12, active:true },
  { title:'CCTV footage', sub:'Security camera recordings', months:1, active:false }
];

/* ───────────────────────────────────────────────
   NAVIGATION HELPERS
   ─────────────────────────────────────────────── */
function goTo(screenId, noPush) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);

  if (!noPush) {
    const slug = screenId.replace('screen-', '');
    history.pushState(null, '', '#/' + slug);
  }
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('open', isOpen);
}

function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('open');
}

function showPage(pageId, navEl, noPush) {
  const pageAliases = { dpia: 'dpiapage', 'dpia-workflow': 'deica', deica_workflow: 'deica' };
  pageId = pageAliases[pageId] || pageId;
  console.log('showPage called:', pageId);

  const page = document.getElementById('page-' + pageId);
  console.log('Page element found:', !!page);
  if (!page) {
    console.warn(`[JARVIS] Page not found: page-${pageId}`);
    if (typeof showToast === 'function') showToast(`Page is not available yet: ${pageId}`, 'warning');
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page-shell').forEach(p => p.classList.remove('active'));

  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Find and activate target page
  page.classList.add('active');

  // Activate nav item
  if (!navEl) navEl = document.getElementById('nav-' + pageId);
  if (navEl) navEl.classList.add('active');
  closeSidebar();

  console.log(`[JARVIS] Current Local Storage State (Navigating to ${pageId}):`, {
    dpo_data: JSON.parse(localStorage.getItem('dpo_data') || '[]'),
    vendor_data: JSON.parse(localStorage.getItem('vendor_data') || '[]'),
    activity_data: JSON.parse(localStorage.getItem('activity_data') || '[]'),
    training_data: JSON.parse(localStorage.getItem('training_data') || '[]')
  });

  // Page-specific actions
  if (pageId === 'vendors' && typeof loadVendorsFromSupabase === 'function') loadVendorsFromSupabase();
  if (pageId === 'access' && typeof loadSeatUsage === 'function') loadSeatUsage();
  if (pageId === 'accounts' && typeof loadAccounts === 'function') loadAccounts();
  if (pageId === 'people' && typeof loadAllPeople === 'function') loadAllPeople();
  if (pageId === 'training' && typeof loadTrainingFromSupabase === 'function') loadTrainingFromSupabase();
  if (pageId === 'processing_activities' && typeof loadActivitiesFromSupabase === 'function') loadActivitiesFromSupabase();
  if (pageId === 'dpo' && typeof loadDPOFromSupabase === 'function') loadDPOFromSupabase();
  if (pageId === 'dataregister') renderRegister();
  if (pageId === 'checklist') renderChecklist();
  if (pageId === 'audit') renderAudit();
  if (pageId === 'companies') loadCompaniesFromSupabase();
  if (pageId === 'consent') loadConsentFromSupabase();
  if (pageId === 'datarequests') loadDataRequestsFromSupabase();
  if (pageId === 'breachlog') loadBreachLogFromSupabase();
  if (pageId === 'dpiapage') loadDPIAFromSupabase();
  if (pageId === 'deica') renderDEICA();
  if (pageId === 'crossborder') loadCrossBorderFromSupabase();
  if (pageId === 'alerts') loadAlertsFromSupabase();
  if (pageId === 'cases') loadCasesFromSupabase();
  if (pageId === 'access') {
    renderTeam();
    loadNavPermissions();
  }
  if (pageId === 'retention') renderRetention();
  if (pageId === 'documents') renderDocuments();
  if (pageId === 'dashboard') loadDashboardFromSupabase();
  if (pageId === 'dashboard' && typeof loadDashboardActivity === 'function') loadDashboardActivity();
  // Static pages (no data hooks): datasources, monitoring

  // Admin-only elements
  const isAdmin = state.currentUserLevel === 'Accountadmin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  // Update URL
  if (!noPush) {
    const newUrl = '#/' + pageId;
    console.log('Updating URL to:', newUrl);
    history.pushState(null, '', newUrl);
  }

  if (typeof renderViewAsBanner === 'function') renderViewAsBanner();
}

// Expose to global scope for onclick handlers
window.showPage = showPage;

/* ───────────────────────────────────────────────
   AUTH: SHARED HELPERS
   ─────────────────────────────────────────────── */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  if (btn) {
    btn.innerHTML = show
      ? `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
           <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
           <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
           <line x1="1" y1="1" x2="23" y2="23"/>
         </svg>`
      : `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
           <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
         </svg>`;
  }
}
const togglePw = togglePassword; // Alias for backward compatibility

function clearErrors(...ids) {
  ids.forEach(id => {
    const errEl = document.getElementById(id + '-error');
    const inpEl = document.getElementById(id);
    if (errEl) errEl.classList.remove('visible');
    if (inpEl) inpEl.classList.remove('error-field');
  });
}

function showError(id) {
  const errEl = document.getElementById(id + '-error');
  const inpEl = document.getElementById(id);
  if (errEl) errEl.classList.add('visible');
  if (inpEl) inpEl.classList.add('error-field');
}

function isValidEmail(email) {
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ───────────────────────────────────────────────
   SESSION MANAGEMENT
   ─────────────────────────────────────────────── */
function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function createSession(email) {
  const sessionId = generateSessionId();
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours

  state.session = {
    sessionId: sessionId,
    token: token,
    createdAt: now,
    expiresAt: expiresAt,
    email: email
  };
  state.isLoggedIn = true;
  state.user.email = email;
  state.user.id = 'datarex-org-' + email.replace('@', '_').replace('.', '_');

  localStorage.setItem('datarex_session', JSON.stringify(state.session));
  saveState();
  return { sessionId, token };
}

function loadSession() {
  const saved = localStorage.getItem('datarex_session');
  if (saved) {
    try {
      const session = JSON.parse(saved);
      if (session.expiresAt > Date.now()) {
        state.session = session;
        state.isLoggedIn = true;
        return true;
      }
    } catch (e) {}
  }
  return false;
}

function clearSession() {
  state.session = {
    sessionId: null,
    token: null,
    createdAt: null,
    expiresAt: null
  };
  state.isLoggedIn = false;
  localStorage.removeItem('datarex_session');
  saveState();
}

/* ───────────────────────────────────────────────
   AUTH: LOGIN
   ─────────────────────────────────────────────── */

async function doLogin() {
  console.log('=== LOGIN DEBUG START ===');
  clearErrors('login-email', 'login-password');
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;
  console.log('Email:', email);
  console.log('Password:', pw ? 'provided' : 'empty');

  if (!isValidEmail(email)) { showError('login-email'); console.log('Invalid email'); return; }
  if (!pw || pw.length < 4) { showError('login-password'); console.log('Invalid password'); return; }

  // Clear any stale role/account from the previous session before auth events fire
  state.role = null;
  state.accountId = null;
  state.viewAsAccountId = null;
  localStorage.removeItem('viewAsAccountId');

  const btn = document.getElementById('login-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  console.log('ENV check:', {
    SUPABASE_URL: window.ENV?.SUPABASE_URL || 'MISSING',
    SUPABASE_ANON_KEY: window.ENV?.SUPABASE_ANON_KEY ? 'set' : 'MISSING',
    supabaseClient: window.supabaseClient ? 'exists' : 'MISSING'
  });

  try {
    let data = null;

    // 1. Try Supabase Auth first (requires env.js to have populated window.ENV)
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password: pw
          });
          if (!authError && authData?.user) {
            data = {
              email: authData.user.email,
              name: authData.user.user_metadata?.name || authData.user.email,
              company: authData.user.user_metadata?.company || '',
              id: authData.user.id
            };
            console.log('Login SUCCESS (Supabase Auth):', data.email);
          }
        }
      } catch (apiError) {
        console.warn('Supabase auth failed, trying local fallback...', apiError);
      }
    }

    // 2. Try LocalStorage fallback if Supabase failed
    if (!data) {
      const localUsers = JSON.parse(localStorage.getItem('datarex_users') || '[]');
      const pwHash = await hashPasswordForStorage(pw);
      const localUser = localUsers.find(u => u.email === email && u.password_hash === pwHash);
      if (localUser) {
        // Persist a stable id on the user record so every subsequent login
        // produces the same state.user.id. Without this, doRegister stored
        // no id, the fallback used `'user-' + Date.now()`, and per-user data
        // (e.g. uploaded documents matched by docMatchesScope) became
        // invisible after the next login or reload.
        if (!localUser.id) {
          localUser.id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
          localStorage.setItem('datarex_users', JSON.stringify(localUsers));
        }
        data = localUser;
        console.log('Login SUCCESS (local):', data.email);
      }
    }

    btn.classList.remove('loading');
    btn.disabled = false;

    if (!data) {
      showError('login-password');
      const errEl = document.getElementById('login-password-error');
      if (errEl) {
        errEl.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Invalid email or password.';
        errEl.classList.add('visible');
      }
      console.log('=== LOGIN DEBUG END (FAILED) ===');
      return;
    }

    console.log('Creating session...');
    createSession(email);

    if (data) {
      state.user = {
        name: data.name || data.company || 'User',
        company: data.company || 'My Company',
        email: email,
        industry: data.industry,
        companySize: data.size,
        regNo: data.regNo || '',
        id: data.id || 'user-' + Date.now()
      };
      saveState();
    }

    // Populate multi-tenant state from user_profiles
    const supabase = getSupabaseClient();
    if (supabase && state.user?.id) {
      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('role, account_id, first_name, last_name')
        .eq('id', state.user.id)
        .single();
      if (!profileErr && profile) {
        state.role = profile.role;
        state.accountId = profile.account_id;
        // Use stored first/last name so admin-created users don't show their email as name
        if (profile.first_name) {
          const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
          state.user.name = fullName;
        }
        // Only Superadmin uses view-as; clear stale localStorage value for all other roles.
        state.viewAsAccountId = profile.role === 'Superadmin'
          ? (localStorage.getItem('viewAsAccountId') || null)
          : null;
        if (profile.role !== 'Superadmin') localStorage.removeItem('viewAsAccountId');
        JARVIS_LOG.success('Auth', 'Profile loaded', { role: profile.role, accountId: profile.account_id });
      } else {
        JARVIS_LOG.error('Auth', 'Failed to load profile', profileErr || new Error('No profile row'));
      }
    }

    // Check account status (Accountadmin/user only — Superadmin has no account).
    if (state.role !== 'Superadmin' && state.accountId) {
      const { data: acct } = await supabase.from('accounts').select('status,name').eq('id', state.accountId).single();
      if (acct?.name) {
        state.user.company = acct.name;
        state.company = acct.name;
        saveState();
        updateActiveCompanyLabel(acct.name);
      }
      if (acct?.status === 'suspended') {
        await supabase.auth.signOut();
        state.user = { name: '', company: '', email: '' };
        state.role = null;
        state.accountId = null;
        showToast('Your account is suspended — contact support', 'error');
        if (typeof navigateTo === 'function') navigateTo('login');
        else if (typeof showPage === 'function') showPage('login');
        return;
      }
    }

    const loginForm = document.getElementById('login-form');
    const loginFooter = document.getElementById('login-footer');
    const loginSuccess = document.getElementById('login-success');

    if (loginForm) loginForm.style.display = 'none';
    if (loginFooter) loginFooter.style.display = 'none';
    if (loginSuccess) loginSuccess.classList.add('show');

    console.log('Launching app...');
    // Route by role after launchApp sets up the UI. launchApp() always navigates to dashboard;
    // for Superadmin we override that immediately after it runs.
    setTimeout(() => {
      launchApp();
      if (state.role === 'Superadmin') {
        if (typeof navigateTo === 'function') navigateTo('accounts');
        else if (typeof showPage === 'function') showPage('accounts');
      }
      // Accountadmin / user fall through — launchApp already lands on dashboard.
    }, 1200);
    console.log('=== LOGIN DEBUG END (SUCCESS) ===');
  } catch (error) {
    btn.classList.remove('loading');
    btn.disabled = false;
    console.error('Login EXCEPTION:', error);
    showToast('Login failed. Please try again.', 'error');
  }
}

/* ───────────────────────────────────────────────
   AUTH: LOGOUT
   ─────────────────────────────────────────────── */
async function doLogout() {
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    try { await supabase.auth.signOut(); } catch (e) { console.error('Logout error:', e); }
  }
  state.role = null;
  state.accountId = null;
  state.viewAsAccountId = null;
  localStorage.removeItem('viewAsAccountId');
  clearSession();
  goTo('screen-landing');
  showSuccess('Logged out successfully');
}

/* ───────────────────────────────────────────────
   ONBOARDING
   ─────────────────────────────────────────────── */
function selectBiz(el) {
  document.querySelectorAll('#biz-options .option-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.bizType = el.querySelector('h4').textContent;
  saveState();
}

function toggleSrc(el) {
  el.classList.toggle('multi-selected');
}

function goOnboard2() {
  document.getElementById('onboard-step-1').style.display = 'none';
  const s2 = document.getElementById('onboard-step-2');
  s2.style.display = 'flex';
  s2.style.flexDirection = 'column';
}

function backOnboard1() {
  document.getElementById('onboard-step-2').style.display = 'none';
  document.getElementById('onboard-step-1').style.display = '';
}

function finishOnboard() {
  const selected = document.querySelectorAll('#src-options .option-card.selected');
  state.dataSources = Array.from(selected).map(el => el.querySelector('h4').textContent);
  state.isLoggedIn = true;
  saveState();

  // Switch to app screen first so summary is visible
  goTo('screen-app', true);
  showSummary();
}

function showSummary() {
  const u = state.user || {};
  const industryIcons = {
    'Healthcare': '🏥', 'Finance': '💰', 'Ecommerce': '🛒',
    'Education': '🎓', 'Retail': '🏪', 'Technology': '💻',
    'Consulting': '💼', 'Manufacturing': '🏭', 'Other': '⚙️'
  };

  const html = `
    <div class="summary-screen">
      <div class="summary-card">
        <div class="summary-icon">✅</div>
        <h2>You're all set!</h2>
        <p class="summary-sub">Here's a summary of your setup</p>

        <div class="summary-sections">
          <div class="summary-section">
            <h3>👤 Account</h3>
            <div class="summary-item"><span>Name</span><span>${u.name || '-'}</span></div>
            <div class="summary-item"><span>Email</span><span>${u.email || '-'}</span></div>
          </div>

          <div class="summary-section">
            <h3>🏢 Company</h3>
            <div class="summary-item"><span>Company</span><span>${u.company || '-'}</span></div>
            <div class="summary-item"><span>Reg. No.</span><span>${u.regNo || '-'}</span></div>
            <div class="summary-item"><span>Industry</span><span>${industryIcons[u.industry] || ''} ${u.industry || '-'}</span></div>
            <div class="summary-item"><span>Size</span><span>${u.companySize || '-'}</span></div>
          </div>

          <div class="summary-section">
            <h3>📊 Business Type</h3>
            <div class="summary-item"><span>Type</span><span>${state.bizType || 'Not selected'}</span></div>
          </div>

          <div class="summary-section">
            <h3>📥 Data Sources</h3>
            <div class="summary-tags">
              ${(state.dataSources || []).map(s => `<span class="summary-tag">${s}</span>`).join('') || '<span>None selected</span>'}
            </div>
          </div>
        </div>

        <div class="summary-actions">
          <button class="btn btn-ghost" onclick="goTo('screen-register')">← Edit</button>
          <button class="btn btn-primary" onclick="goToDashboard()">Go to Dashboard →</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('page-dashboard').innerHTML = html;
}

function goToDashboard() {
  showPage('dashboard', null, true);
  showToast('Welcome to your dashboard!', 'success');
}

/* ───────────────────────────────────────────────
   AUTH: REGISTER
   ─────────────────────────────────────────────── */
async function doRegister() {
  // Read all fields up front and clear any prior inline error rows so the
  // form mirrors login's validation UX (red inline message under the
  // offending field plus a toast).
  const fieldIds = [
    'register-name', 'register-email', 'register-company',
    'register-industry', 'register-size',
    'register-password', 'register-confirm'
  ];
  clearErrors(...fieldIds);
  const val = (id) => (document.getElementById(id)?.value ?? '');
  const name = val('register-name').trim();
  const company = val('register-company').trim();
  const email = val('register-email').trim();
  const pw = val('register-password');
  const pwConfirm = val('register-confirm');
  const industry = val('register-industry');
  const size = val('register-size');
  const regNo = val('register-reg-no').trim();

  const fail = (fieldId, message) => {
    showError(fieldId);
    showToast(message, 'error');
  };
  if (!name)     { return fail('register-name',     'Please enter your name'); }
  if (!email || !isValidEmail(email)) { return fail('register-email', 'Please enter a valid email'); }
  if (!company)  { return fail('register-company',  'Please enter company name'); }
  if (!industry) { return fail('register-industry', 'Please select your industry'); }
  if (!size)     { return fail('register-size',     'Please select company size'); }
  if (!pw || pw.length < 6) { return fail('register-password', 'Password must be at least 6 characters'); }
  if (pw !== pwConfirm)     { return fail('register-confirm',  'Passwords do not match'); }

  // Save user data to localStorage for login validation
  const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
  const exists = users.find(u => u.email === email);
  if (exists) { return fail('register-email', 'Email already registered'); }

  const pwHash = await hashPasswordForStorage(pw);
  const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
  // Persist the id on the user record so doLogin's localStorage fallback
  // returns the same id on every subsequent login.
  users.push({ id: newId, name, company, email, password_hash: pwHash, industry, size, regNo });
  localStorage.setItem('datarex_users', JSON.stringify(users));

  // Set current user
  state.user = {
    name: name,
    company: company,
    email: email,
    industry: industry,
    companySize: size,
    regNo: regNo,
    id: newId
  };
  state.isLoggedIn = true;
  saveState();

  showToast('Account created!', 'success');
  goTo('screen-onboarding');
}

function demoLogin()     {
  console.log('Demo Login triggered');
  createSession('admin@datarex.com');

  // Check for existing demo DPO data
  const savedDpo = localStorage.getItem('datarex_dpo');
  if (savedDpo) {
    try {
      state.dpo = JSON.parse(savedDpo);
      state.dpoHistory = [];
    } catch (e) {
      state.dpo = null;
      state.dpoHistory = [];
    }
  }

  // Set demo user state with regNo
  state.user = {
    name: 'Demo DPO',
    company: 'Acme Pte Ltd',
    email: 'admin@datarex.com',
    industry: 'Technology',
    companySize: '11-50',
    regNo: '202001000001 (A)',
    id: '00000000-0000-0000-0000-000000000001'
  };
  saveState();
  launchApp();
}

window.demoLogin = demoLogin;
window.doLogin = doLogin;
window.toggleOrgDropdown = toggleOrgDropdown;
window.openCompaniesTab = openCompaniesTab;
window.switchOrg = switchOrg;
if (typeof saveDPOToSupabase !== 'undefined') window.saveDPOToSupabase = saveDPOToSupabase;
if (typeof saveDPO !== 'undefined' && !window.saveDPOToSupabase) window.saveDPOToSupabase = saveDPO;
if (typeof loadDPOFromSupabase !== 'undefined') window.loadDPOFromSupabase = loadDPOFromSupabase;

/* ───────────────────────────────────────────────
   LAUNCH APP
   ─────────────────────────────────────────────── */
function launchApp(user) {
  state.isLoggedIn = true;
  if (user) {
    state.user = {
      ...state.user,
      id: user.id,
      email: user.email
    };
  }
  saveState();

  const firstName = state.user.name ? state.user.name.split(' ')[0] : 'Demo';
  const sidebarName = document.getElementById('sidebar-name');
  if (sidebarName) sidebarName.textContent = state.user.name;

  const sidebarOrg = document.getElementById('sidebar-org');
  if (sidebarOrg) sidebarOrg.textContent = getDisplayCompanyName();
  updateActiveCompanyLabel();

  const sidebarAvatar = document.getElementById('sidebar-avatar');
  if (sidebarAvatar) sidebarAvatar.textContent = firstName[0] ? firstName[0].toUpperCase() : 'D';

  const dashName = document.getElementById('dash-name');
  if (dashName) dashName.textContent = firstName;

  const dashDate = document.getElementById('dash-date');
  if (dashDate) {
    dashDate.textContent = 'Today is ' + new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + '.';
  }

  renderChecklist();
  renderRegister();
  renderConsent();
  renderRetention();
  renderTeam();
  renderDocuments();
  renderAlerts();
  loadNavPermissions();
  updateScore();
  updateAlertBadge();
  applyNavPermissions();
  goTo('screen-app', true);

  const hash = window.location.hash.replace('#/', '');
  if (hash && !['login', 'onboarding', 'app', 'landing'].includes(hash)) {
    showPage(hash, null, true);
  } else {
    showPage('dashboard', null, true);
    history.replaceState(null, '', '#/dashboard');
  }

  // Render view-as banner on boot (state.viewAsAccountId already restored from localStorage above)
  if (typeof renderViewAsBanner === 'function') renderViewAsBanner();
}

/* ───────────────────────────────────────────────
   DASHBOARD
   ─────────────────────────────────────────────── */
async function loadDashboardFromSupabase() {
  await Promise.allSettled([
    typeof loadDPOFromSupabase === 'function' ? loadDPOFromSupabase() : Promise.resolve(),
    typeof loadTrainingFromSupabase === 'function' ? loadTrainingFromSupabase() : Promise.resolve(),
    typeof loadDPIAFromSupabase === 'function' ? loadDPIAFromSupabase() : Promise.resolve(),
    typeof loadDataRequestsFromSupabase === 'function' ? loadDataRequestsFromSupabase() : Promise.resolve(),
    typeof loadBreachLogFromSupabase === 'function' ? loadBreachLogFromSupabase() : Promise.resolve()
  ]);

  const recordsEl = document.getElementById('dash-records-count');
  const dpoEl = document.getElementById('dash-dpo-name');

  let recordsCount = (state.records || []).length;
  let dpoName = getDashboardDpoName();

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user?.id) {
    const accountId = getEffectiveAccountId();
    let recordsQuery = supabase.from('data_records').select('id', { count: 'exact', head: true }).eq('user_id', state.user.id);
    if (accountId) recordsQuery = recordsQuery.eq('account_id', accountId);
    let dpoQuery = supabase.from('dpo').select('name').eq('user_id', state.user.id);
    if (accountId) dpoQuery = dpoQuery.eq('account_id', accountId);
    dpoQuery = dpoQuery.order('created_at', { ascending: false }).limit(1);
    const [recordsRes, dpoRes] = await Promise.all([recordsQuery, dpoQuery]);
    if (!recordsRes.error && typeof recordsRes.count === 'number') recordsCount = recordsRes.count;
    if (!dpoRes.error && dpoRes.data?.[0]?.name) dpoName = dpoRes.data[0].name;
  }

  if (recordsEl) recordsEl.textContent = recordsCount;
  if (dpoEl) dpoEl.textContent = dpoName;
  renderDashboardOverview({ recordsCount, dpoName });
  updateScore();
}

function getDashboardDpoName() {
  const candidates = [
    state.dpoRecords?.[0]?.name,
    state.dpoRecords?.[0]?.dpo_name,
    state.dpo?.name,
    state.user?.name
  ];
  return candidates.find(Boolean) || 'Not assigned';
}

function renderDashboardOverview({ recordsCount, dpoName }) {
  const companyName = typeof getDisplayCompanyName === 'function'
    ? getDisplayCompanyName()
    : (state.user?.company || 'Acme Pte Ltd');
  setDashboardText('dash-company-title', companyName);
  setDashboardText('dash-company-badge', companyName);

  const hasDpo = dpoName && dpoName !== 'Not assigned';
  const dpoWarning = document.getElementById('dpo-warning');
  if (dpoWarning) dpoWarning.hidden = hasDpo;
  setDashboardText('dpo-status-value', hasDpo ? 'Assigned' : 'Missing');
  setDashboardText('dpo-status-sub', hasDpo ? dpoName : 'Assign now');
  setDashboardTone('dpo-status-value', hasDpo ? 'good' : 'danger');

  const dpias = state.dpiaItems || [];
  const highRisk = dpias.filter(item => String(item.risk_level || '').toLowerCase() === 'high').length;
  const openMitigations = dpias.filter(item => {
    const status = String(item.status || '').toLowerCase();
    return status.includes('pending') || status.includes('review') || String(item.mitigation_measures || '').trim();
  }).length;
  setDashboardText('dpia-required-count', dpias.length);
  setDashboardText('high-risk-count', highRisk);
  setDashboardTone('high-risk-count', highRisk ? 'danger' : 'good');
  setDashboardText('expiring-soon-count', countExpiringTraining(state.trainingRecords || [], 90));
  setDashboardText('open-mitigations-count', openMitigations);

  const trainingStats = getDashboardTrainingStats();
  setDashboardText('training-coverage-value', `${trainingStats.coverage}%`);
  const trainingBar = document.getElementById('training-coverage-bar');
  if (trainingBar) trainingBar.style.width = `${trainingStats.coverage}%`;
  setDashboardText('training-last-date', trainingStats.lastDate ? `Last: ${formatDashboardDate(trainingStats.lastDate)}` : 'No training yet');
  setDashboardTone('training-coverage-value', trainingStats.coverage >= 80 ? 'good' : trainingStats.coverage >= 50 ? 'warn' : 'danger');

  const seatsUsed = (state.team || []).length;
  const seatLimit = Number(state.account?.seat_limit || state.seatLimit || 0);
  setDashboardText('dashboard-seats-used', `${seatsUsed} / ${seatLimit || seatsUsed || 0}`);
  const usageCost = 99 + Math.max(seatsUsed - 2, 0) * 4;
  setDashboardText('dashboard-usage-cost', `$${usageCost.toFixed(2)}`);
  setDashboardText('dashboard-cycle-cost', `$${usageCost.toFixed(2)}`);

  renderDashboardAlerts({
    hasDpo,
    recordsCount,
    missingConsent: (state.records || []).filter(r => !Boolean(r.consent || r.consent_obtained)).length,
    highRisk,
    pendingTasks: Math.max(Object.values(state.checks || {}).filter(v => !v).length, 0),
    trainingExpiring: countExpiringTraining(state.trainingRecords || [], 60),
    overdueRequests: getOverdueRequestCount()
  });
}

function setDashboardText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setDashboardTone(id, tone) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('is-good', 'is-warn', 'is-danger');
  if (tone) el.classList.add(`is-${tone}`);
}

function getDashboardTrainingStats() {
  const records = state.trainingRecords || [];
  const teamSize = Math.max((state.team || []).length, records.length, 1);
  const completed = records.filter(r => String(r.status || '').toLowerCase() !== 'expired').length;
  const coverage = Math.min(100, Math.round((completed / teamSize) * 100));
  const lastDate = records
    .map(r => r.completion_date || r.training_date || r.created_at)
    .filter(Boolean)
    .sort()
    .pop();
  return { coverage, lastDate };
}

function countExpiringTraining(records, days) {
  const now = new Date();
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return records.filter(r => {
    const raw = r.expiry_date || r.expires_at;
    if (!raw) return false;
    const date = new Date(raw);
    return date >= now && date <= limit;
  }).length;
}

function getOverdueRequestCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (state.dataRequests || []).filter(r => {
    const status = String(r.status || '').toLowerCase();
    if (!['open', 'pending', 'in progress'].includes(status)) return false;
    if (!r.created_at) return false;
    const deadline = new Date(r.created_at);
    deadline.setDate(deadline.getDate() + 21);
    return deadline < today;
  }).length;
}

function renderDashboardAlerts(metrics) {
  const alerts = [
    !metrics.hasDpo && { icon: 'fa-user-shield', text: 'No DPO is assigned for this company.', link: 'dpo', nav: 'nav-dpo' },
    metrics.overdueRequests && { icon: 'fa-triangle-exclamation', text: `${metrics.overdueRequests} data subject request(s) overdue.`, link: 'datarequests', nav: 'nav-datarequests' },
    metrics.highRisk && { icon: 'fa-triangle-exclamation', text: `${metrics.highRisk} high-risk DPIA item(s) need review.`, link: 'dpiapage', nav: 'nav-dpiapage' },
    metrics.missingConsent && { icon: 'fa-circle-exclamation', text: `${metrics.missingConsent} data record(s) missing consent.`, link: 'dataregister', nav: 'nav-dataregister' },
    metrics.pendingTasks && { icon: 'fa-list-check', text: `${metrics.pendingTasks} checklist task(s) still pending.`, link: 'checklist', nav: 'nav-checklist' },
    metrics.trainingExpiring && { icon: 'fa-graduation-cap', text: `${metrics.trainingExpiring} training record(s) expiring soon.`, link: 'training', nav: 'nav-training' }
  ].filter(Boolean);

  setDashboardText('alert-count', `${alerts.length} active`);
  const list = document.getElementById('dashboard-alerts');
  if (!list) return;
  if (!alerts.length) {
    list.innerHTML = '<li><span><i class="fa-solid fa-circle-check" aria-hidden="true"></i>No active alerts. Great work.</span></li>';
    return;
  }
  list.innerHTML = alerts.map(alert => `
    <li>
      <span><i class="fa-solid ${alert.icon}" aria-hidden="true"></i>${escapeHtmlForDashboard(alert.text)}</span>
      <a href="#/${alert.link}" onclick="showPage('${alert.link}',document.getElementById('${alert.nav}'));return false;">Open</a>
    </li>
  `).join('');
}

function formatDashboardDate(raw) {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ───────────────────────────────────────────────
   SCORE & STATS
   ─────────────────────────────────────────────── */
function updateScore() {
  const total = Object.keys(state.checks).length;
  const done  = Object.values(state.checks).filter(Boolean).length;
  const pct   = Math.round((done / total) * 100);

  const scoreDisplay = document.getElementById('score-display');
  if (scoreDisplay) scoreDisplay.textContent = pct + '%';

  const scoreBar = document.getElementById('score-bar');
  if (scoreBar) scoreBar.style.width = pct + '%';

  const tasksDoneLabel = document.getElementById('tasks-done-label');
  if (tasksDoneLabel) tasksDoneLabel.textContent = `${done} of ${total} tasks done`;

  const statCompleted = document.getElementById('stat-completed');
  if (statCompleted) statCompleted.textContent = done;

  const statPending = document.getElementById('stat-pending');
  if (statPending) statPending.textContent = total - done;

  const progLabel = document.getElementById('prog-label');
  if (progLabel) progLabel.textContent = `${done} of ${total} done`;

  const progPct = document.getElementById('prog-pct');
  if (progPct) progPct.textContent = pct + '%';

  const progFill = document.getElementById('prog-fill');
  if (progFill) progFill.style.width = pct + '%';

  const glanceProgress = document.getElementById('glance-progress');
  if (glanceProgress) glanceProgress.textContent = `${done}/${total} →`;

  const badge = document.getElementById('risk-badge');
  if (badge) {
    if (pct >= 80)      { badge.textContent = 'Low risk';    badge.className = 'badge badge-green'; setDashboardText('dashboard-risk-level', 'Low'); setDashboardTone('dashboard-risk-level', 'good'); }
    else if (pct >= 50) { badge.textContent = 'Medium risk'; badge.className = 'badge badge-amber'; setDashboardText('dashboard-risk-level', 'Medium'); setDashboardTone('dashboard-risk-level', 'warn'); }
    else                { badge.textContent = 'High risk';   badge.className = 'badge badge-red'; setDashboardText('dashboard-risk-level', 'High'); setDashboardTone('dashboard-risk-level', 'danger'); }
  }
}

/* ───────────────────────────────────────────────
   CHECKLIST
   ─────────────────────────────────────────────── */
function toggleAllChecklist(status) {
  CHECKLIST.forEach(section => {
    section.items.forEach(item => {
      state.checks[item.id] = status;
    });
  });
  saveState();
  renderChecklist();
  updateScore();
}

async function renderChecklist() {
  const body = document.getElementById('checklist-body');
  if (!body) return;
  body.innerHTML = '';

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user.id) {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('user_id', state.user.id);

    if (!error && data) {
      data.forEach(item => {
        state.checks[item.item_id] = item.completed;
      });
    }
  }

  CHECKLIST.forEach(section => {
    const done  = section.items.filter(i => state.checks[i.id]).length;
    const total = section.items.length;
    const wrap  = document.createElement('div');
    wrap.className = 'checklist-section';
    wrap.innerHTML = `<div class="section-head"><h3>${section.section}</h3><span class="section-count ${done === total ? 'complete' : ''}">${done}/${total} completed</span></div>`;

    section.items.forEach(item => {
      const checked = state.checks[item.id];
      const el = document.createElement('div');
      el.className = 'check-item' + (checked ? ' done' : '');
      el.innerHTML = `
        <div class="checkbox">
          ${checked ? '<svg width="13" height="13" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
        <div class="check-text"><h4>${item.q}</h4><p>${item.hint}</p></div>`;
      el.addEventListener('click', async () => {
        state.checks[item.id] = !state.checks[item.id];
        saveState();
        renderChecklist();
        updateScore();

        if (supabase && isSupabaseConfigured() && state.user.id) {
          await supabase.from('checklist_items').upsert({
            user_id: state.user.id,
            item_id: item.id,
            completed: state.checks[item.id],
            completed_at: state.checks[item.id] ? new Date().toISOString() : null
          }, { onConflict: 'user_id,item_id' });
        }
      });
      wrap.appendChild(el);
    });
    body.appendChild(wrap);
  });
}

/* ───────────────────────────────────────────────
   ONBOARDING
   ─────────────────────────────────────────────── */
function getDataRecordScope() {
  return {
    accountId: (typeof getEffectiveAccountId === 'function' && getEffectiveAccountId()) || state.accountId || state.viewAsAccountId || '',
    userId: state.user?.id || ''
  };
}

function normalizeDataRecord(row, source = 'local') {
  return {
    id: row.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: row.type || row.data_type || '',
    purpose: row.purpose || '',
    storage: row.storage || '',
    access: row.access || row.access_level || '',
    retention: row.retention || row.retention_months || 12,
    consent: typeof row.consent !== 'undefined' ? row.consent : Boolean(row.consent_obtained),
    note: row.note || '',
    accountId: row.accountId || row.account_id || '',
    userId: row.userId || row.user_id || '',
    source,
    created_at: row.created_at || row.createdAt || new Date().toISOString(),
    updated_at: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString()
  };
}

function readLocalDataRecords() {
  try {
    const direct = JSON.parse(localStorage.getItem('datarex_records') || '[]');
    const savedState = JSON.parse(localStorage.getItem('dataRexState') || '{}');
    const fromState = Array.isArray(savedState.records) ? savedState.records : [];
    return mergeDataRecords(
      direct.map(row => normalizeDataRecord(row, row.source || 'local')),
      fromState.map(row => normalizeDataRecord(row, row.source || 'local'))
    );
  } catch (err) {
    console.error('[JARVIS] Failed to read local data records', err);
    return [];
  }
}

function writeLocalDataRecords(records) {
  const normalized = (records || []).filter(Boolean).map(row => normalizeDataRecord(row, row.source || 'local'));
  state.records = normalized;
  localStorage.setItem('datarex_records', JSON.stringify(normalized));
  saveState();
}

function dataRecordMatchesScope(record) {
  const { accountId, userId } = getDataRecordScope();
  if (accountId && record.accountId && String(record.accountId) !== String(accountId)) return false;
  if (userId && record.userId && String(record.userId) !== String(userId)) return false;
  return true;
}

function mergeDataRecords(primary, secondary) {
  const byKey = new Map();
  for (const row of [...(primary || []), ...(secondary || [])]) {
    if (!row) continue;
    const record = normalizeDataRecord(row, row.source || 'local');
    const key = record.id || `${record.type}-${record.purpose}-${record.storage}-${record.created_at}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      continue;
    }
    const existingTs = Date.parse(existing.updated_at || existing.created_at || 0) || 0;
    const recordTs = Date.parse(record.updated_at || record.created_at || 0) || 0;
    if (recordTs >= existingTs) byKey.set(key, record);
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const ad = Date.parse(a.created_at || 0) || 0;
    const bd = Date.parse(b.created_at || 0) || 0;
    return bd - ad;
  });
}

async function renderRegister() {
  const body = document.getElementById('register-body-wrap');
  if (!body) return;

  const supabase = getSupabaseClient();
  const userId = state.user?.id;
  const localRecords = readLocalDataRecords().filter(dataRecordMatchesScope);
  let list = localRecords;

  console.log('[JARVIS] Fetching from data_records...');
  if (supabase && isSupabaseConfigured() && userId) {
    const accountId = getEffectiveAccountId();
    let query = supabase.from('data_records').select('*').eq('user_id', userId);
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      console.log(`[JARVIS] Fetching from data_records... Success: ${data.length} records found.`);
      const remoteRecords = data.map(r => normalizeDataRecord(r, 'supabase'));
      list = mergeDataRecords(remoteRecords, localRecords);
      writeLocalDataRecords(list);
    } else if (error) {
      JARVIS_LOG.error('DataRegister', 'Load from Supabase', error);
    }
  }

  state.records = list;

  // Summary
  const summaryEl = document.getElementById('register-summary');
  if (summaryEl) {
    const missingConsent = list.filter(r => !r.consent).length;
    summaryEl.innerHTML = `
      <div class="co-stat"><span class="co-stat-num">${list.length}</span><span class="co-stat-label">Total Records</span></div>
      <div class="co-stat-divider"></div>
      <div class="co-stat"><span class="co-stat-num co-num-red">${missingConsent}</span><span class="co-stat-label">Missing Consent</span></div>
    `;
  }

  // Search
  const q = (document.getElementById('register-search')?.value || '').toLowerCase();
  const filtered = q ? list.filter(r =>
    (r.type||'').toLowerCase().includes(q) ||
    (r.purpose||'').toLowerCase().includes(q) ||
    (r.storage||'').toLowerCase().includes(q)
  ) : list;

  if (filtered.length === 0) {
    body.innerHTML = `<div class="empty-state"><p>${q ? 'No results for "' + q + '"' : 'No data records yet'}</p><small>Click "+ Add record" to start building your data inventory.</small></div>`;
    return;
  }

  body.innerHTML = `<div class="data-table-wrap"><table class="styled-table"><thead style="background:#f8fafc;"><tr style="background:#f8fafc;">
    <th class="th-narrow" style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">ID</th>
    <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Data Type</th>
    <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Purpose</th>
    <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Storage</th>
    <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Access</th>
    <th class="th-narrow" style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Retention</th>
    <th class="th-narrow" style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Consent</th>
    <th class="th-actions" style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;"></th>
  </tr></thead><tbody>${filtered.map((r, i) => {
    const rowIndex = list.indexOf(r);
    return `
    <tr>
      <td class="td-id">#${i + 1}</td>
      <td class="td-bold td-type">${r.type}</td>
      <td class="td-muted td-purpose">${r.purpose}</td>
      <td class="td-muted">${r.storage}</td>
      <td class="td-muted">${r.access}</td>
      <td class="td-muted">${r.retention} mo</td>
      <td><span class="status-badge ${r.consent ? 'status-active' : 'status-error'}">${r.consent ? 'Yes' : 'Missing'}</span></td>
      <td><div class="row-actions co-actions td-actions">
        <button class="btn-edit" onclick="editRecord(${rowIndex})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-delete" onclick="deleteRecord(${rowIndex})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;

  const glanceRecords = document.getElementById('glance-records');
  if (glanceRecords) glanceRecords.textContent = list.length + ' →';
}

async function deleteRecord(i) {
  const record = state.records[i];
  if (confirm(`Delete "${record?.type || 'this record'}"?`)) {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured() && record?.id && record.source === 'supabase') {
      await supabase.from('data_records').delete().eq('id', record.id);
    }
    state.records.splice(i, 1);
    writeLocalDataRecords(state.records);
    renderRegister();
    renderConsent();
    renderRetention();
    showToast('Record deleted', 'success');
  }
}

/* ───────────────────────────────────────────────
   MODALS
   ─────────────────────────────────────────────── */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) {
    console.warn(`[JARVIS] Modal not found: ${id}`);
    if (typeof showToast === 'function') showToast(`Form is not available yet: ${id}`, 'warning');
    return;
  }

  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove('open');
  modal.style.display = 'none';

  if (id === 'modal-record') {
    resetRecordForm();
  }
  if (id === 'modal-data-request') {
    resetDataRequestForm();
  }
  if (id === 'modal-log-optout') resetOptOutForm();
  if (id === 'modal-crossborder') resetCrossBorderForm();
  if (id === 'modal-breach') resetBreachForm();
  if (id === 'modal-case') resetCaseForm();
}

function getCurrentOrgId() {
  const currentCompany = (state.companies || []).find(c => c.name === (state.user?.company || ''));
  return currentCompany ? currentCompany.id : state.user?.id;
}

// Returns the account_id to scope queries to.
// - Superadmin with no view-as: returns null (callers must handle this — only the Accounts page reads when null)
// - Superadmin with view-as: returns the picked account_id
// - Accountadmin / user: returns their pinned account_id
function getEffectiveAccountId() {
  if (state.role === 'Superadmin') return state.viewAsAccountId || null;
  return state.accountId || null;
}

async function loadSeatUsage() {
  if (state.role === 'Superadmin' && !state.viewAsAccountId) return; // not on a per-account view
  const accountId = getEffectiveAccountId();
  if (!accountId) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { data: account } = await supabase
    .from('accounts').select('seat_limit').eq('id', accountId).single();
  const { count } = await supabase
    .from('user_profiles').select('id', { count: 'exact', head: true }).eq('account_id', accountId);
  const limit = account?.seat_limit ?? 0;
  const current = count ?? 0;
  const limitEl = document.getElementById('seat-limit');
  const curEl = document.getElementById('seat-current');
  const btn = document.getElementById('btn-add-user');
  if (limitEl) limitEl.textContent = limit;
  if (curEl) curEl.textContent = current;
  if (btn) {
    btn.disabled = current >= limit;
    btn.title = btn.disabled ? 'Upgrade to add more seats. Contact support.' : '';
  }
}

async function loadDashboardActivity() {
  const accountId = getEffectiveAccountId();
  const list = document.getElementById('user-activity-list');
  if (!accountId) {
    if (list) list.innerHTML = '<li><span class="activity-action">No recent activity yet</span></li>';
    return;
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    if (list) list.innerHTML = '<li><span class="activity-action">No recent activity yet</span></li>';
    return;
  }
  const { data, error } = await supabase
    .from('system_logs')
    .select('action, component, user_email, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) { JARVIS_LOG.error('Dashboard', 'Activity load', error); return; }
  if (!list) return;
  if (!data?.length) {
    list.innerHTML = '<li><span class="activity-action">No recent activity yet</span></li>';
    return;
  }
  list.innerHTML = (data || []).map(r => `
    <li>
      <span class="activity-user">${escapeHtmlForDashboard(r.user_email || 'someone')}</span>
      <span class="activity-action">${escapeHtmlForDashboard(r.action)} · ${escapeHtmlForDashboard(r.component)}</span>
      <span class="activity-time">${timeAgo(r.created_at)}</span>
    </li>
  `).join('');
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function escapeHtmlForDashboard(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function addUserPrompt() {
  const email = window.prompt('User email:');
  if (!email) return;
  const temp = window.prompt('Temporary password (min 8 chars):');
  if (!temp || temp.length < 8) { showToast('Password too short', 'error'); return; }
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const accountId = getEffectiveAccountId();
  const supaUrl = (window.ENV?.SUPABASE_URL) || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
  const res = await fetch(`${supaUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'user', email, temp_password: temp, account_id: accountId }),
  });
  const out = await res.json();
  if (!res.ok) {
    if (res.status === 402) showToast('Seat limit reached. Upgrade to add more users.', 'error');
    else showToast(out.error || 'Failed to add user', 'error');
    return;
  }
  showToast(`Added. Share: ${out.email} / ${out.temp_password}`, 'success');
  await loadSeatUsage();
}

document.addEventListener('click', (e) => {
  if (e.target?.id === 'btn-add-user') addUserPrompt();
});

function renderViewAsBanner() {
  const banner = document.getElementById('view-as-banner');
  if (!banner) return;
  if (!state.viewAsAccountId || state.role !== 'Superadmin') {
    banner.hidden = true;
    banner.innerHTML = '';
    updateActiveCompanyLabel();
    return;
  }
  // Best-effort: we have the id; ask Supabase for the name (cached in state).
  const cached = state._viewAsAccountName;
  if (cached && cached.id === state.viewAsAccountId) {
    paint(cached.name);
    return;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return paint('account');
  supabase.from('accounts').select('name').eq('id', state.viewAsAccountId).single()
    .then(({ data }) => {
      state._viewAsAccountName = { id: state.viewAsAccountId, name: data?.name || 'account' };
      paint(state._viewAsAccountName.name);
    });
  function paint(name) {
    banner.hidden = false;
    updateActiveCompanyLabel(name);
    banner.innerHTML = `👁 Viewing as <strong>${name}</strong> · <button id="btn-exit-view-as">Exit view-as</button>`;
  }
}

document.addEventListener('click', (e) => {
  if (e.target?.id === 'btn-exit-view-as' && typeof exitViewAs === 'function') exitViewAs();
});

function readLocalList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (err) {
    console.error(`[JARVIS] Failed to parse ${key}`, err);
    return [];
  }
}

function saveLocalList(key, list) {
  localStorage.setItem(key, JSON.stringify(list || []));
}

function editRecord(index) {
  const record = state.records[index];
  if (!record) return;

  document.getElementById('rec-index').value = index;
  document.getElementById('rec-type').value = record.type || '';
  document.getElementById('rec-purpose').value = record.purpose || '';
  document.getElementById('rec-storage').value = record.storage || '';
  document.getElementById('rec-access').value = record.access || '';
  document.getElementById('rec-retention').value = record.retention || 12;
  document.getElementById('rec-consent').checked = record.consent || false;
  document.getElementById('rec-note').value = record.note || '';

  document.getElementById('modal-record-title').textContent = 'Edit data record';
  document.getElementById('rec-save-btn').textContent = 'Update record';

  openModal('modal-record');
}

async function saveRecord() {
  const type      = document.getElementById('rec-type').value.trim();
  const purpose   = document.getElementById('rec-purpose').value.trim();
  const storage   = document.getElementById('rec-storage').value.trim();
  const access    = document.getElementById('rec-access').value.trim();
  const retention = parseInt(document.getElementById('rec-retention').value) || 12;
  const consent   = document.getElementById('rec-consent').checked;
  const note      = document.getElementById('rec-note').value.trim();
  const editIndex = parseInt(document.getElementById('rec-index').value);

  if (!type) {
    JARVIS_LOG.error('DataRegister', 'Validation failed', new Error('Type of data is required'));
    showToast('Please enter the type of data.', 'error');
    return;
  }

  const { accountId, userId: scopedUserId } = getDataRecordScope();
  const supabase = getSupabaseClient();
  const userId = scopedUserId || state.user?.id;
  const now = new Date().toISOString();
  const recordData = {
    id: `local-${Date.now()}`,
    type,
    purpose,
    storage,
    access,
    retention,
    consent,
    note,
    accountId,
    userId: userId || '',
    source: 'local',
    created_at: now,
    updated_at: now
  };

  JARVIS_LOG.submit('DataRegister', editIndex >= 0 ? 'Update' : 'Insert', {
    form_data: recordData,
    editIndex,
    timestamp: new Date().toISOString()
  });

  if (editIndex >= 0) {
    const existingRecord = state.records[editIndex];
    Object.assign(state.records[editIndex], recordData);
    state.records[editIndex].id = existingRecord.id;
    state.records[editIndex].source = existingRecord.source || state.records[editIndex].source;
    state.records[editIndex].created_at = existingRecord.created_at || state.records[editIndex].created_at;
    state.records[editIndex].updated_at = now;

    if (supabase && isSupabaseConfigured() && existingRecord.id && existingRecord.source === 'supabase') {
      const payload = {
        data_type: type,
        purpose: purpose,
        storage: storage,
        access_level: access,
        retention_months: retention,
        consent_obtained: consent,
        note: note,
        updated_at: now
      };
      if (accountId) payload.account_id = accountId;
      const { error } = await supabase.from('data_records').update(payload).eq('id', existingRecord.id);

      console.table({
        timestamp: new Date().toISOString(),
        operation: 'UPDATE',
        table: 'data_records',
        record_id: existingRecord.id,
        supabase_response: error ? `ERROR: ${error.message}` : 'SUCCESS',
        error_message: error?.message || 'N/A'
      });

      if (error) {
        JARVIS_LOG.error('DataRegister', 'Update to Supabase', error);
      } else {
        JARVIS_LOG.success('DataRegister', 'Update to Supabase', { id: existingRecord.id });
      }
    }

    writeLocalDataRecords(state.records);
    renderRegister();
    renderConsent();
    renderRetention();
    closeModal('modal-record');
    resetRecordForm();
    showToast('Record updated!', 'success');
    return;
  }

  state.records.unshift(recordData);
  writeLocalDataRecords(state.records);

  if (supabase && isSupabaseConfigured() && userId) {
    const payload = {
      user_id: userId,
      data_type: type,
      purpose: purpose,
      storage: storage,
      access_level: access,
      retention_months: retention,
      consent_obtained: consent,
      note: note
    };
    if (accountId) payload.account_id = accountId;
    const { data, error } = await supabase.from('data_records').insert([payload]).select().single();

    console.table({
      timestamp: new Date().toISOString(),
      operation: 'INSERT',
      table: 'data_records',
      form_data: JSON.stringify(recordData),
      supabase_response: error ? `ERROR: ${error.code}` : 'SUCCESS',
      error_message: error?.message || 'N/A',
      error_details: error ? JSON.stringify(error) : 'N/A'
    });

    if (error) {
      JARVIS_LOG.error('DataRegister', 'Insert to Supabase', error);
      showToast('Record saved (local + sync queued)', 'success');
    } else if (data) {
      recordData.id = data.id;
      recordData.accountId = data.account_id || accountId;
      recordData.userId = data.user_id || userId;
      recordData.source = 'supabase';
      recordData.created_at = data.created_at || recordData.created_at;
      recordData.updated_at = data.updated_at || recordData.updated_at;
      writeLocalDataRecords(state.records);
      JARVIS_LOG.success('DataRegister', 'Insert to Supabase', { id: data.id });
      showToast('Record saved!', 'success');
    }
  } else {
    showToast('Record saved locally', 'success');
  }

  writeLocalDataRecords(state.records);
  renderRegister();
  renderConsent();
  renderRetention();
  closeModal('modal-record');
  resetRecordForm();
}

function resetRecordForm() {
  document.getElementById('rec-index').value = '-1';
  document.getElementById('rec-type').value = '';
  document.getElementById('rec-purpose').value = '';
  document.getElementById('rec-storage').value = '';
  document.getElementById('rec-access').value = '';
  document.getElementById('rec-retention').value = '12';
  document.getElementById('rec-consent').checked = false;
  document.getElementById('rec-note').value = '';
  document.getElementById('modal-record-title').textContent = 'Add data record';
  document.getElementById('rec-save-btn').textContent = 'Save record';
}

async function saveCompany() {
  const id = document.getElementById('company-id').value;
  const name = document.getElementById('company-name').value.trim();
  const country = document.getElementById('company-country').value;
  const dpo = document.getElementById('company-dpo').value.trim();
  const industry = document.getElementById('company-industry').value;
  const regNo = document.getElementById('company-reg-no').value.trim();


  if (!name) {
    showToast('Please enter a company name.', 'error');
    return;
  }

  if (state.currentUserLevel !== 'Accountadmin') {
    showToast('Only Accountadmin can add companies.', 'error');
    return;
  }

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    try {
      let query = supabase.from('companies');
      const companyData = {
        name: name,
        industry: industry,
        country: country,
        dpo_name: dpo,
        reg_no: regNo,
        updated_at: new Date().toISOString()
      };

      let res;
      if (id) {
        // Update existing
        res = await query.update(companyData).eq('id', id).select().single();
      } else {
        // Insert new
        res = await query.insert([companyData]).select().single();
      }

      const { data, error } = res;

      if (error) {
        console.error('Save error:', error);
        // Fallback to localStorage
        const newCompany = { name, country, dpo, industry, regNo };
        state.companies = state.companies || [];
        state.companies.push(newCompany);
        state.user.company = name;
        saveState();
        renderCompanies();
        showToast(`${name} added! (local)`, 'success');
      } else {
        // Check if company already exists (by id for SQL or by name for local)
        const existingIdx = state.companies.findIndex(c => c.id === data.id);
        if (existingIdx >= 0) {
          state.companies[existingIdx] = data;
        } else {
          state.companies.push(data);
        }
        state.user.company = name;
        saveState();
        renderCompanies();
        showToast(`${name} added!`, 'success');
      }
    } catch (err) {
      console.error('Exception:', err);
      // Fallback to localStorage
      const newCompany = { name, country, dpo, industry, regNo };
      state.companies = state.companies || [];
      state.companies.push(newCompany);
      state.user.company = name;
      saveState();
      renderCompanies();
      showToast(`${name} added! (local)`, 'success');
    }
  } else {
    // Fallback to localStorage
    const newCompany = { name, country, dpo, industry, regNo };
    state.companies = state.companies || [];
    state.companies.push(newCompany);
    state.user.company = name;
    saveState();
    renderCompanies();
    showToast(`${name} added!`, 'success');
  }

  closeModal('modal-company');
  document.getElementById('company-name').value = '';
  document.getElementById('company-dpo').value = '';
  document.getElementById('company-reg-no').value = '';

  renderCompanies();
}

let companiesSortCol = 'name';
let companiesSortAsc = true;

function sortCompanies(column) {
  if (companiesSortCol === column) {
    companiesSortAsc = !companiesSortAsc;
  } else {
    companiesSortCol = column;
    companiesSortAsc = true;
  }

  if (!state.companies) return;

  state.companies.sort((a, b) => {
    const aVal = (a[column] || '').toString().toLowerCase();
    const bVal = (b[column] || '').toString().toLowerCase();
    if (aVal < bVal) return companiesSortAsc ? -1 : 1;
    if (aVal > bVal) return companiesSortAsc ? 1 : -1;
    return 0;
  });

  renderCompanies();
}

function renderCompanies() {
  const body = document.getElementById('companies-body-wrap');
  if (!body) return;

  const currentCompanyName = state.user?.company || state.company || 'Acme Pte Ltd';
  const companies = state.companies || [{ name: 'Acme Pte Ltd', regNo: '202001000001 (A)', industry: 'General', country: 'Singapore', dpo_name: 'Demo DPO' }];

  // Summary
  const summaryEl = document.getElementById('companies-summary');
  if (summaryEl) {
    const dpoCount = companies.filter(c => c.dpo_name).length;
    summaryEl.innerHTML = `
      <div class="co-stat"><span class="co-stat-num">${companies.length}</span><span class="co-stat-label">Total</span></div>
      <div class="co-stat-divider"></div>
      <div class="co-stat"><span class="co-stat-num co-num-green">${dpoCount}</span><span class="co-stat-label">DPO Assigned</span></div>
      <div class="co-stat-divider"></div>
      <div class="co-stat"><span class="co-stat-num co-num-blue">1</span><span class="co-stat-label">Active</span></div>
    `;
  }

  const q = (document.getElementById('companies-search')?.value || '').toLowerCase();
  const list = q ? companies.filter(c =>
    (c.name||'').toLowerCase().includes(q) ||
    (c.industry||'').toLowerCase().includes(q)
  ) : companies;

  if (!list.length) {
    body.innerHTML = `<div class="empty-state"><p>No results for "${q}"</p></div>`;
    return;
  }

  const COLORS = ['#3B6FF0','#7C3AED','#0891B2','#059669','#D97706','#DB2777'];
  const getColor = (s) => COLORS[(s||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0) % COLORS.length];

  body.innerHTML = `<div class="data-table-wrap companies-table-wrap"><table class="styled-table companies-table"><thead><tr>
    <th class="th-company">Company</th><th class="th-industry">Industry</th><th class="th-country">Country</th><th class="th-dpo">DPO</th><th class="th-date">Updated</th><th class="th-company-status">Status</th><th class="th-actions th-company-actions">Actions</th>
  </tr></thead><tbody>${list.map(c => {
    const isCurrent = (c.name||'').toLowerCase() === (currentCompanyName||'').toLowerCase();
    const color = getColor(c.name);
    const initials = (c.name||'?').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
    const lastUpdated = c.updated_at ? new Date(c.updated_at).toLocaleString('en-GB', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const cJson = encodeURIComponent(JSON.stringify(c));
    return `<tr class="${isCurrent ? 'co-row-active' : ''}">
      <td><div class="table-avatar"><div class="co-avatar" style="background:${color}18;color:${color}">${initials}</div><div><div class="table-avatar-name">${c.name}</div><div class="co-reg">${c.regNo || ''}</div></div></div></td>
      <td><span class="table-tag">${c.industry || 'General'}</span></td>
      <td class="td-muted">${c.country || '—'}</td>
      <td class="td-muted">${c.dpo_name || '—'}</td>
      <td class="td-muted co-date">${lastUpdated}</td>
      <td class="td-company-status">
        ${isCurrent ? '<span class="status-badge status-active">Active</span>' : `<button class="btn-edit" onclick="switchOrg('${c.name}')">Switch</button>`}
      </td>
      <td class="td-actions td-company-actions"><div class="row-actions co-actions">
        <button class="btn-edit" onclick="editCompany('${cJson}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="btn-delete" onclick="deleteCompany('${c.id}', '${c.name}')" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

async function deleteCompany(id, name) {
  if (id === 'undefined' || !id) {
    // Local delete for demo data
    if (confirm(`Delete local company "${name}"?`)) {
      state.companies = state.companies.filter(c => c.name !== name);
      saveState();
      renderCompanies();
      showToast(`Company "${name}" removed`, 'success');
    }
    return;
  }

  if (confirm(`Delete company "${name}"? This will remove all associated data in SQL. This action cannot be undone.`)) {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete: ' + mapSupabaseError(error), 'error');
      } else {
        state.companies = state.companies.filter(c => c.id !== id);
        if (state.user.company === name) state.user.company = '';
        saveState();
        renderCompanies();
        showToast(`Company "${name}" deleted from SQL`, 'success');
      }
    } else {
      showToast('Supabase not configured', 'error');
    }
  }
}

function editCompany(cJsonStr) {
  try {
    const c = JSON.parse(decodeURIComponent(cJsonStr));
    const titleEl = document.getElementById('modal-company-title');
    if (titleEl) titleEl.textContent = 'Update company';

    document.getElementById('company-id').value = c.id || '';
    document.getElementById('company-name').value = c.name || '';
    document.getElementById('company-country').value = c.country || 'Singapore';
    document.getElementById('company-dpo').value = c.dpo_name || '';
    document.getElementById('company-industry').value = c.industry || 'General';
    document.getElementById('company-reg-no').value = c.regNo || c.reg_no || '';

    openModal('modal-company');
  } catch(e) {
    console.error('Failed to parse company data', e);
  }
}

async function loadCompaniesFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;

  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) return;
  let query = supabase.from('companies').select('*');
  if (accountId) query = query.eq('account_id', accountId);
  const { data, error } = await query.order('name');

  if (error) {
    console.error('Failed to load companies:', error);
    return;
  }

  state.companies = data;

  const selectEl = document.getElementById('company-select');
  if (selectEl && data) {
    selectEl.innerHTML = data.map(c =>
      `<option value="${c.name}">🏢 ${c.name}</option>`
    ).join('');
    if (state.user.company) {
      selectEl.value = state.user.company;
    }
  }

  renderCompanies();
}

async function loadDataRequestsFromSupabase() {
  const supabase = getSupabaseClient();

  // Load from localStorage first
  const saved = localStorage.getItem('datarex_dataRequests');
  if (saved) {
    try {
      state.dataRequests = JSON.parse(saved);
    } catch (e) {}
  }

  if (!supabase || !isSupabaseConfigured()) {
    renderDataRequests(state.dataRequests);
    return;
  }

  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) { renderDataRequests(state.dataRequests); return; }
  let query = supabase.from('data_requests').select('*');
  if (accountId) query = query.eq('account_id', accountId);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load data requests:', error);
    renderDataRequests(state.dataRequests);
    return;
  }

  if (data && data.length > 0) {
    state.dataRequests = data;
  }
  renderDataRequests(state.dataRequests);
}

function editDataRequest(index) {
  const request = state.dataRequests[index];
  if (!request) return;

  document.getElementById('req-index').value = index;
  document.getElementById('req-name').value = request.requester_name || '';
  document.getElementById('req-email').value = request.requester_email || '';
  document.getElementById('req-type').value = request.request_type || 'Access';
  document.getElementById('req-description').value = request.description || '';
  document.getElementById('req-assigned').value = request.assigned_to || '';

  document.querySelector('.modal-dsr-title').textContent = 'Edit data subject request';
  document.getElementById('req-save-btn').textContent = 'Update Request';

  openModal('modal-data-request');
}

async function deleteDataRequest(index) {
  const request = state.dataRequests[index];
  if (!request) return;

  if (confirm(`Delete request from "${request.requester_name}"?`)) {
    // Delete from Supabase if it has a real ID
    if (supabase && isSupabaseConfigured() && request.id && !String(request.id).startsWith('local-')) {
      const { error } = await supabase.from('data_requests').delete().eq('id', request.id);
      if (error) {
        console.error('Error deleting data request from Supabase:', error);
      }
    }

    state.dataRequests.splice(index, 1);
    localStorage.setItem('datarex_dataRequests', JSON.stringify(state.dataRequests));
    renderDataRequests(state.dataRequests);
    showToast('Request deleted', 'success');
  }
}

function resetDataRequestForm() {
  document.getElementById('req-index').value = '-1';
  document.getElementById('req-name').value = '';
  document.getElementById('req-email').value = '';
  document.getElementById('req-type').value = 'Access';
  document.getElementById('req-description').value = '';
  document.getElementById('req-assigned').value = '';
  document.querySelector('.modal-dsr-title').textContent = 'New data subject request';
  document.getElementById('req-save-btn').textContent = 'Log request';
}

async function saveDataRequest() {
  const name = document.getElementById('req-name').value.trim();
  const email = document.getElementById('req-email').value.trim();
  const type = document.getElementById('req-type').value;
  const description = document.getElementById('req-description').value.trim();
  const assigned_to = document.getElementById('req-assigned').value.trim();
  const editIndex = parseInt(document.getElementById('req-index').value);

  if (!name) {
    JARVIS_LOG.error('DataRequests', 'Validation failed', new Error('Subject name is required'));
    showToast('Please enter subject name', 'error');
    return;
  }

  const requestData = {
    requester_name: name,
    requester_email: email,
    request_type: type,
    description: description,
    assigned_to: assigned_to,
    status: 'Open'
  };

  const supabase = getSupabaseClient();

  JARVIS_LOG.submit('DataRequests', editIndex >= 0 ? 'Update' : 'Insert', { requestData, editIndex });

  if (editIndex >= 0) {
    const existingRequest = state.dataRequests[editIndex];

    if (supabase && isSupabaseConfigured() && existingRequest.id && !String(existingRequest.id).startsWith('local-')) {
      const { error } = await supabase.from('data_requests').update({
        ...requestData,
        updated_at: new Date().toISOString()
      }).eq('id', existingRequest.id);

      if (error) {
        JARVIS_LOG.error('DataRequests', 'Update', error);
        console.error('Error updating data request:', error);
      } else {
        JARVIS_LOG.success('DataRequests', 'Update', { id: existingRequest.id });
      }
    }

    Object.assign(state.dataRequests[editIndex], requestData, { id: existingRequest.id });
    localStorage.setItem('datarex_dataRequests', JSON.stringify(state.dataRequests));
    renderDataRequests(state.dataRequests);
    closeModal('modal-data-request');
    resetDataRequestForm();
    showToast('Request updated!', 'success');
    return;
  }

  // Add new request
  if (supabase && isSupabaseConfigured()) {
    const { data, error } = await supabase.from('data_requests').insert([{
      account_id: getEffectiveAccountId(),
      ...requestData
    }]).select().single();

    if (error) {
      JARVIS_LOG.error('DataRequests', 'Insert', error);
      console.error('Error saving data request:', error);
      const localRequest = { ...requestData, id: 'local-' + Date.now(), created_at: new Date().toISOString() };
      state.dataRequests.unshift(localRequest);
      localStorage.setItem('datarex_dataRequests', JSON.stringify(state.dataRequests));
      renderDataRequests(state.dataRequests);
      closeModal('modal-data-request');
      resetDataRequestForm();
      showToast('Request logged (saved locally)', 'success');
    } else {
      JARVIS_LOG.success('DataRequests', 'Insert', { id: data?.id });
      const syncedRequest = { ...data, ...requestData };
      state.dataRequests.unshift(syncedRequest);
      localStorage.setItem('datarex_dataRequests', JSON.stringify(state.dataRequests));
      renderDataRequests(state.dataRequests);
      closeModal('modal-data-request');
      resetDataRequestForm();
      showToast('Request logged successfully', 'success');
    }
  } else {
    const localRequest = { ...requestData, id: 'local-' + Date.now(), created_at: new Date().toISOString() };
    state.dataRequests.unshift(localRequest);
    localStorage.setItem('datarex_dataRequests', JSON.stringify(state.dataRequests));
    renderDataRequests(state.dataRequests);
    closeModal('modal-data-request');
    resetDataRequestForm();
    showToast('Request logged', 'success');
  }
}

function renderDataRequests(requests) {
  const body = document.getElementById('datarequests-body');
  if (!body) return;
  const list = requests || [];

  const totalCount = document.getElementById('dsr-total-count');
  const overdueCount = document.getElementById('dsr-overdue-count');
  const fulfilledCount = document.getElementById('dsr-fulfilled-count');

  const openOrPending = list.filter(r => r.status === 'Open' || r.status === 'Pending').length;
  const fulfilled = list.filter(r => r.status === 'Completed' || r.status === 'Fulfilled').length;

  let overdue = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  list.forEach(r => {
    if (r.created_at && (r.status === 'Open' || r.status === 'Pending' || r.status === 'In Progress')) {
      const deadline = new Date(r.created_at);
      deadline.setDate(deadline.getDate() + 21);
      if (deadline < today) overdue++;
    }
  });

  if (totalCount) totalCount.textContent = list.length;
  if (overdueCount) overdueCount.textContent = overdue;
  if (fulfilledCount) fulfilledCount.textContent = fulfilled;

  const q = (document.getElementById('datarequests-search')?.value || '').toLowerCase();
  const filtered = q ? list.filter(r =>
    (r.requester_name||'').toLowerCase().includes(q) ||
    (r.request_type||'').toLowerCase().includes(q) ||
    (r.description||'').toLowerCase().includes(q)
  ) : list;

  if (filtered.length === 0) {
    body.innerHTML = `<div class="dsr-empty"><p>${q ? 'No results for "' + q + '"' : 'No data requests yet'}</p><small>Click "Log Request" to create your first data subject request.</small></div>`;
    return;
  }

  const getStatusBadge = (status) => {
    if (status === 'Completed' || status === 'Fulfilled') return '<span class="dsr-badge dsr-badge-fulfilled">Fulfilled</span>';
    if (status === 'In Progress') return '<span class="dsr-badge dsr-badge-progress">In Progress</span>';
    return '<span class="dsr-badge dsr-badge-open">Open</span>';
  };

  const getDeadlineInfo = (createdAt) => {
    if (!createdAt) return { text: '—', class: '' };
    const deadline = new Date(createdAt);
    deadline.setDate(deadline.getDate() + 21);
    const diff = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    if (diff < 0) return { text: 'Overdue', class: 'dsr-deadline-overdue' };
    if (diff <= 3) return { text: diff + ' days', class: 'dsr-deadline-soon' };
    if (diff <= 7) return { text: diff + ' days', class: 'dsr-deadline-soon' };
    return { text: diff + ' days', class: 'dsr-deadline-safe' };
  };

  const getRef = (index) => {
    const year = new Date().getFullYear();
    return `DSAR-${year}-${String(index + 1).padStart(4, '0')}`;
  };

  body.innerHTML = `
    <div class="dsr-table-container">
      <table class="dsr-table">
        <thead>
          <tr>
            <th class="th-narrow">REF</th>
            <th>SUBJECT</th>
            <th>TYPE</th>
            <th>RECEIVED</th>
            <th>DEADLINE</th>
            <th>STATUS</th>
            <th class="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((r, i) => {
            const deadlineInfo = getDeadlineInfo(r.created_at);
            return `
            <tr>
              <td class="dsr-ref">${getRef(i)}</td>
              <td class="dsr-subject">${r.requester_name || '—'}</td>
              <td class="dsr-type">${r.request_type || '—'}</td>
              <td class="dsr-date">${r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : '—'}</td>
              <td class="dsr-deadline ${deadlineInfo.class}">${deadlineInfo.text}</td>
              <td>${getStatusBadge(r.status)}</td>
              <td>
                <div class="row-actions td-actions">
                  <button class="btn-edit" onclick="editDataRequest(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="btn-delete" onclick="deleteDataRequest(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadBreachLogFromSupabase() {
  const supabase = getSupabaseClient();
  const localData = readLocalList('breach_log_data');
  state.breachLog = localData;
  renderBreachLog(localData);

  if (!supabase || !isSupabaseConfigured()) return;

  try {
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('breach_log').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[JARVIS] Failed to load breach log:', error.message);
      return;
    }

    const remote = Array.isArray(data) ? data : [];
    if (remote.length === 0) {
      console.log('[JARVIS] Breach log: Supabase returned 0 rows; keeping local data.');
      return;
    }

    const seen = new Set(remote.map(r => r.id).filter(Boolean));
    const localOnly = (localData || []).filter(r => !r.id || !seen.has(r.id));
    const merged = [...remote, ...localOnly];

    state.breachLog = merged;
    saveLocalList('breach_log_data', merged);
    renderBreachLog(merged);
  } catch (err) {
    console.error('[JARVIS] Breach log fetch exception:', err);
  }
}

function renderBreachLog(breaches) {
  const body = document.getElementById('breachlog-body');
  if (!body) return;
  const list = breaches || [];

  // Update summary cards
  const totalCount = document.getElementById('breach-total-count');
  const pendingCount = document.getElementById('breach-pending-count');
  const resolvedCount = document.getElementById('breach-resolved-count');

  if (totalCount) totalCount.textContent = list.length;
  if (pendingCount) pendingCount.textContent = list.filter(b => b.resolution_status === 'Pending' || b.resolution_status === 'Under Investigation').length;
  if (resolvedCount) resolvedCount.textContent = list.filter(b => b.resolution_status === 'Resolved').length;

  if (list.length === 0) {
    body.innerHTML = `<div class="breach-empty"><p>No breaches recorded</p><small>If a breach occurs, log it here immediately.</small></div>`;
    return;
  }

  const getStatusBadge = (status) => {
    if (status === 'Resolved') return '<span class="vendor-badge vendor-badge-low">Resolved</span>';
    if (status === 'Under Investigation') return '<span class="vendor-badge vendor-badge-medium">Under Investigation</span>';
    return '<span class="vendor-badge vendor-badge-high">Pending</span>';
  };

  body.innerHTML = `<table class="breach-table">
    <thead>
      <tr>
        <th>Type</th>
        <th>Description</th>
        <th>Affected</th>
        <th>Date</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${list.map((b, i) => `
        <tr>
          <td><b>${b.breach_type || '—'}</b></td>
          <td>${b.description || '—'}</td>
          <td>${b.affected_count || '—'}</td>
          <td>${b.incident_date || '—'}</td>
          <td>${getStatusBadge(b.resolution_status)}</td>
          <td>
            <div class="breach-actions">
              <button class="btn-edit" onclick="editBreach(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="btn-delete" onclick="deleteBreach(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function resetBreachForm() {
  const values = {
    'breach-index': '-1',
    'breach-type': '',
    'breach-description': '',
    'breach-affected-count': '',
    'breach-incident-date': '',
    'breach-status': 'Pending'
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  const title = document.getElementById('breach-modal-title');
  if (title) title.textContent = 'Record breach';
  const btn = document.getElementById('breach-save-btn');
  if (btn) btn.textContent = 'Save breach';
}

function editBreach(index) {
  const breach = state.breachLog?.[index];
  if (!breach) return;
  const values = {
    'breach-index': String(index),
    'breach-type': breach.breach_type || '',
    'breach-description': breach.description || '',
    'breach-affected-count': breach.affected_count || '',
    'breach-incident-date': breach.incident_date || '',
    'breach-status': breach.resolution_status || 'Pending'
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  const title = document.getElementById('breach-modal-title');
  if (title) title.textContent = 'Edit breach';
  const btn = document.getElementById('breach-save-btn');
  if (btn) btn.textContent = 'Update breach';
  openModal('modal-breach');
}

async function saveBreach() {
  const index = parseInt(document.getElementById('breach-index')?.value || '-1', 10);
  const orgId = getCurrentOrgId();
  const dbPayload = {
    breach_type: document.getElementById('breach-type')?.value.trim() || '',
    description: document.getElementById('breach-description')?.value.trim() || '',
    affected_count: Number(document.getElementById('breach-affected-count')?.value || 0),
    incident_date: document.getElementById('breach-incident-date')?.value || new Date().toISOString().slice(0, 10),
    resolution_status: document.getElementById('breach-status')?.value || 'Pending'
  };

  if (!dbPayload.breach_type || !dbPayload.description) {
    showToast('Breach type and description are required', 'error');
    return;
  }

  state.breachLog = state.breachLog || [];
  const existing = index > -1 ? state.breachLog[index] : null;
  const supabase = getSupabaseClient();

  let supabaseSucceeded = false;
  if (supabase && isSupabaseConfigured() && orgId) {
    try {
      if (existing && existing.id && !String(existing.id).startsWith('local-')) {
        const { error } = await supabase.from('breach_log')
          .update({ ...dbPayload, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('breach_log')
          .insert([{ ...dbPayload, account_id: getEffectiveAccountId() }]);
        if (error) throw error;
      }
      supabaseSucceeded = true;
    } catch (err) {
      console.error('[JARVIS] Breach Supabase Save Error', err);
    }
  }

  const localRecord = {
    ...dbPayload,
    id: existing?.id || ('local-' + Date.now()),
    created_at: existing?.created_at || new Date().toISOString()
  };
  if (index > -1) {
    state.breachLog[index] = { ...existing, ...localRecord };
  } else {
    state.breachLog.unshift(localRecord);
  }
  saveLocalList('breach_log_data', state.breachLog);
  closeModal('modal-breach');

  if (supabaseSucceeded) {
    await loadBreachLogFromSupabase();
    showToast('Breach saved', 'success');
  } else {
    renderBreachLog(state.breachLog);
    showToast(supabase && isSupabaseConfigured() ? 'Saved locally; Supabase save failed' : 'Saved locally', 'warning');
  }
}

function deleteBreach(index) {
  if (!confirm('Delete this breach record?')) return;
  state.breachLog = state.breachLog || [];
  state.breachLog.splice(index, 1);
  saveLocalList('breach_log_data', state.breachLog);
  renderBreachLog(state.breachLog);
  showToast('Breach deleted', 'success');
}

async function saveDPIA() {
  const name = document.getElementById('dpia-name').value.trim();
  const description = document.getElementById('dpia-description').value;
  const sensitive = document.getElementById('dpia-sensitive').checked;
  const monitoring = document.getElementById('dpia-monitoring').checked;
  const mitigation = document.getElementById('dpia-mitigation').value;
  const editingId = state._editingDpiaId || null;

  if (!name) {
    showToast('Please enter a project name', 'warning');
    return;
  }

  const effectiveAccountId = getEffectiveAccountId();
  if (!effectiveAccountId) {
    showToast('Your account is not linked yet — please log out and log in again', 'warning');
    return;
  }

  const riskLevel = sensitive ? 'High' : monitoring ? 'Medium' : 'Low';

  // --- Reset modal state ---
  state._editingDpiaId = null;
  const modalHead = document.querySelector('#modal-dpia .modal-head h3');
  if (modalHead) modalHead.textContent = 'New DPIA';
  closeModal('modal-dpia');
  document.getElementById('dpia-name').value = '';
  document.getElementById('dpia-description').value = '';
  document.getElementById('dpia-mitigation').value = '';
  document.getElementById('dpia-sensitive').checked = false;
  document.getElementById('dpia-monitoring').checked = false;
  document.getElementById('dpia-large-scale').checked = false;

  const supabase = getSupabaseClient();
  let dbSaveOk = false;

  if (editingId && !String(editingId).startsWith('local-')) {
    // --- UPDATE existing DB record ---
    const updates = {
      activity_name: name,
      description,
      processing_purpose: description.substring(0, 50),
      risk_level: riskLevel,
      mitigation_measures: mitigation,
    };
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('dpia_assessments').update(updates).eq('id', editingId);
      if (error) {
        JARVIS_LOG.error('DPIA', 'Update', error);
        showToast('Update failed; changes saved locally only', 'warning');
      } else {
        JARVIS_LOG.success('DPIA', 'Update', { id: editingId });
        dbSaveOk = true;
      }
    }
    // Update local state
    state.dpiaItems = (state.dpiaItems || []).map(d =>
      String(d.id) === String(editingId) ? { ...d, ...updates } : d
    );
    saveLocalList('dpia_data', state.dpiaItems);
    renderDPIA(state.dpiaItems);
  } else {
    // --- INSERT new record ---
    const dpiaData = {
      id: editingId || ('local-' + Date.now()),
      account_id: effectiveAccountId,
      activity_name: name,
      description,
      processing_purpose: description.substring(0, 50),
      is_necessary: true,
      risk_level: riskLevel,
      mitigation_measures: mitigation,
      status: 'Draft',
      created_at: new Date().toISOString()
    };
    // Optimistic local render
    state.dpiaItems = readLocalList('dpia_data');
    state.dpiaItems.unshift(dpiaData);
    saveLocalList('dpia_data', state.dpiaItems);
    renderDPIA(state.dpiaItems);

    if (supabase && isSupabaseConfigured()) {
      const { id, ...dbDpiaData } = dpiaData;
      const { error } = await supabase.from('dpia_assessments').insert([dbDpiaData]);
      if (error) {
        JARVIS_LOG.error('DPIA', 'Insert', error);
        showToast('DPIA saved locally; cloud sync failed', 'warning');
      } else {
        JARVIS_LOG.success('DPIA', 'Insert', { activity_name: name });
        dbSaveOk = true;
      }
    }
  }

  showSuccess('DPIA Assessment saved');

  if (dbSaveOk) {
    await loadDPIAFromSupabase();
  }
}

async function loadDPIAFromSupabase() {
  const supabase = getSupabaseClient();
  const localData = readLocalList('dpia_data');
  state.dpiaItems = localData;
  renderDPIA(localData);

  if (!supabase || !isSupabaseConfigured()) return;

  console.log('[JARVIS] Fetching DPIAs...');
  try {
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('dpia_assessments').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[JARVIS] DPIA Fetch Error:', error.message);
      // Keep the local render — don't wipe newly added records on a fetch error.
      return;
    }

    const remote = Array.isArray(data) ? data : [];
    if (remote.length === 0) {
      console.log('[JARVIS] DPIA: Supabase returned 0 rows; keeping local data.');
      state.dpiaItems = localData;
      renderDPIA(localData);
      return;
    }

    console.log(`[JARVIS] Fetching DPIAs... Success: ${remote.length} records retrieved.`);
    const remoteKeys = new Set(remote.map(getDpiaMergeKey));
    const remoteIds = new Set(remote.map(r => String(r.id || '')).filter(Boolean));
    const localOnly = (localData || []).filter(item => {
      const id = String(item.id || '');
      if (id && remoteIds.has(id)) return false;
      return !remoteKeys.has(getDpiaMergeKey(item));
    });
    const merged = [...remote, ...localOnly];
    state.dpiaItems = merged;
    renderDPIA(merged);
    saveLocalList('dpia_data', merged);
  } catch (err) {
    console.error('[JARVIS] DPIA Exception:', err);
    // Keep the local render — don't wipe on exception.
  }
}

function getDpiaMergeKey(item = {}) {
  return [
    item.account_id || '',
    String(item.activity_name || '').trim().toLowerCase(),
    item.created_at || ''
  ].join('|');
}

function renderDPIA(dpiaItems) {
  const body = document.getElementById('dpiapage-body');
  if (!body) return;
  const list = dpiaItems || [];

  const summaryEl = document.getElementById('dpia-summary');
  if (summaryEl) {
    const highRisk = list.filter(item => item.risk_level === 'High').length;
    summaryEl.innerHTML = `
      <div class="vendor-stat-card"><div class="vendor-stat-label">Total DPIAs</div><div class="vendor-stat-value">${list.length}</div></div>
      <div class="vendor-stat-card"><div class="vendor-stat-label">High Risk</div><div class="vendor-stat-value" style="color:#ef4444">${highRisk}</div></div>
    `;
  }

  const q = (document.getElementById('dpia-search')?.value || '').toLowerCase();
  const filtered = q ? list.filter(item =>
    (item.activity_name||'').toLowerCase().includes(q) ||
    (item.description||'').toLowerCase().includes(q)
  ) : list;

  if (filtered.length === 0) {
    body.innerHTML = `<div class="empty-state"><div style="font-size:36px">🛡️</div><p>${q ? 'No results for "' + q + '"' : 'No DPIAs yet'}</p></div>`;
    return;
  }

  const riskClass = { 'High': 'status-error', 'Medium': 'status-pending', 'Low': 'status-active' };
  body.innerHTML = `<div class="data-table-wrap"><table class="styled-table">
    <thead>
      <tr>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Activity</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Description</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Risk</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Date</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; width:140px;">Actions</th>
      </tr>
    </thead>
    <tbody>${filtered.map(item => `
    <tr>
      <td class="td-bold">${item.activity_name || '—'}</td>
      <td class="td-muted">${item.description || '—'}</td>
      <td><span class="status-badge ${riskClass[item.risk_level] || 'status-inactive'}">${item.risk_level || '—'}</span></td>
      <td class="td-muted co-date">${item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-edit" onclick="editDPIA('${item.id}')">Edit</button>
        <button class="btn-edit" style="color:#ef4444;border-color:#ef4444;" onclick="deleteDPIA('${item.id}')">Delete</button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function editDPIA(id) {
  const item = (state.dpiaItems || []).find(d => String(d.id) === String(id));
  if (!item) { showToast('DPIA not found', 'warning'); return; }

  // Pre-fill modal fields
  document.getElementById('dpia-name').value = item.activity_name || '';
  document.getElementById('dpia-description').value = item.description || '';
  document.getElementById('dpia-mitigation').value = item.mitigation_measures || '';
  document.getElementById('dpia-sensitive').checked  = item.risk_level === 'High';
  document.getElementById('dpia-monitoring').checked = item.risk_level === 'Medium';
  document.getElementById('dpia-large-scale').checked = false;

  // Mark as edit mode and update modal title
  state._editingDpiaId = String(id);
  const modalHead = document.querySelector('#modal-dpia .modal-head h3');
  if (modalHead) modalHead.textContent = 'Edit DPIA';

  openModal('modal-dpia');
}
window.editDPIA = editDPIA;

async function deleteDPIA(id) {
  if (!confirm('Delete this DPIA assessment? This cannot be undone.')) return;

  // Remove locally
  state.dpiaItems = (state.dpiaItems || []).filter(d => String(d.id) !== String(id));
  saveLocalList('dpia_data', state.dpiaItems);
  renderDPIA(state.dpiaItems);

  // Remove from DB (skip local-xxx ids — they were never persisted)
  if (!String(id).startsWith('local-')) {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      const { error } = await supabase.from('dpia_assessments').delete().eq('id', id);
      if (error) {
        JARVIS_LOG.error('DPIA', 'Delete', error);
        showToast('Deleted locally; cloud sync failed', 'warning');
        return;
      }
    }
  }
  showToast('DPIA deleted', 'success');
}
window.deleteDPIA = deleteDPIA;

/* ───────────────────────────────────────────────
   DEICA / DPIA WORKFLOW
   ─────────────────────────────────────────────── */
const DEICA_STORAGE_KEY = 'dpia_screenings';
const DEICA_QUAL_FACTORS = [
  ['legal_or_significant_impact', 'Legal or significant impact on the subject'],
  ['systematic_monitoring', 'Systematic monitoring of subjects'],
  ['innovative_technology', 'Innovative or novel technology'],
  ['restriction_of_rights', "Restriction of subjects' rights"],
  ['behaviour_or_location_tracking', 'Behaviour or location tracking'],
  ['children_or_vulnerable', 'Children or other vulnerable groups'],
  ['automated_decision_making', 'Automated decision-making with legal effect']
];
const DEICA_KEYS = [
  'subjects_over_20k',
  'sensitive_subjects_over_10k',
  ...DEICA_QUAL_FACTORS.map(([key]) => key)
];
let deicaCurrent = null;
let deicaBound = false;

function getDEICAModal() {
  const modal = document.getElementById('deica-modal');
  if (modal && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  return modal;
}

function readDEICAScreenings() {
  try {
    return JSON.parse(localStorage.getItem(DEICA_STORAGE_KEY) || '[]');
  } catch (err) {
    console.error('[JARVIS] Failed to parse DEICA screenings', err);
    return [];
  }
}

function saveDEICAScreenings(rows) {
  localStorage.setItem(DEICA_STORAGE_KEY, JSON.stringify(rows || []));
}

function blankDEICAScreening() {
  return {
    id: '',
    activity_name: '',
    justification: '',
    decision: 'pending',
    ...Object.fromEntries(DEICA_KEYS.map(key => [key, false]))
  };
}

function decideDEICA(screening) {
  if (screening.subjects_over_20k || screening.sensitive_subjects_over_10k) return 'required';
  if (DEICA_QUAL_FACTORS.some(([key]) => screening[key])) return 'required';
  return 'not_required';
}

function deicaEscape(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

async function renderDEICA() {
  const page = document.getElementById('page-deica');
  const list = document.getElementById('deica-list');
  if (!page || !list) return;

  bindDEICAEvents();

  // Render local immediately so the page never appears empty while we fetch.
  const localRows = readDEICAScreenings();
  renderDEICACards(localRows);

  const remoteRows = await fetchDEICAFromSupabase();
  if (!remoteRows.length && !localRows.length) return;

  const merged = mergeDEICARows(remoteRows, localRows);
  // Mirror Supabase rows into localStorage so a hard refresh on a clean
  // browser still shows them — this is the surviving-the-cache fix the user
  // hit. We only overwrite when remote actually returned data, so an offline
  // session doesn't wipe the local copy.
  if (remoteRows.length) saveDEICAScreenings(merged);
  renderDEICACards(merged);
}

function mergeDEICARows(remote, local) {
  // Prefer the freshest version of each screening across the two sources.
  const byId = new Map();
  for (const row of [...(remote || []), ...(local || [])]) {
    if (!row || !row.id) continue;
    const existing = byId.get(row.id);
    if (!existing) { byId.set(row.id, row); continue; }
    const existingTs = Date.parse(existing.updated_at || existing.created_at || 0) || 0;
    const candidateTs = Date.parse(row.updated_at || row.created_at || 0) || 0;
    if (candidateTs >= existingTs) byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ad = Date.parse(a.created_at || 0) || 0;
    const bd = Date.parse(b.created_at || 0) || 0;
    return bd - ad;
  });
}

async function fetchDEICAFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured() || !state.user?.id) return [];
  try {
    let query = supabase.from('dpia_screenings').select('*').eq('user_id', state.user.id);
    const accountId = getEffectiveAccountId();
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      JARVIS_LOG.error('DEICA', 'Load from Supabase', error);
      return [];
    }
    return data || [];
  } catch (err) {
    JARVIS_LOG.error('DEICA', 'Load exception', err);
    return [];
  }
}

function renderDEICACards(rows) {
  const list = document.getElementById('deica-list');
  if (!list) return;
  if (!rows.length) {
    list.className = 'deica-empty';
    list.innerHTML = 'No DEICA screenings yet. Run one whenever you launch a new processing activity.';
    return;
  }
  list.className = 'deica-list';
  list.innerHTML = rows.map(row => {
    const tags = [];
    if (row.subjects_over_20k) tags.push('>20k subjects');
    if (row.sensitive_subjects_over_10k) tags.push('>10k sensitive');
    DEICA_QUAL_FACTORS.forEach(([key, label]) => {
      if (row[key]) tags.push(label);
    });
    const required = row.decision === 'required';
    const justification = deicaEscape(row.justification || 'No justification recorded yet.');
    return `
      <div class="deica-card">
        <div class="deica-card-head">
          <div class="deica-card-title">${deicaEscape(row.activity_name || 'Untitled activity')}</div>
          <span class="deica-badge ${required ? 'required' : 'not-required'}">${required ? 'DPIA required' : 'Not required'}</span>
        </div>
        <div class="deica-tags">
          ${tags.length ? tags.map(tag => `<span class="deica-tag">${deicaEscape(tag)}</span>`).join('') : '<span class="deica-tag">No risk factors selected</span>'}
        </div>
        <div class="deica-note"><strong>Justification:</strong> ${justification}</div>
        <div class="deica-card-actions">
          <button class="deica-link-btn deica-edit-btn" type="button" data-id="${deicaEscape(row.id)}">Edit</button>
          <button class="deica-link-btn deica-delete-btn" type="button" data-id="${deicaEscape(row.id)}" style="color:#ef4444">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function bindDEICAEvents() {
  if (deicaBound) return;

  const modal = getDEICAModal();
  document.getElementById('deica-new-btn')?.addEventListener('click', () => openDEICAModal(blankDEICAScreening()));
  modal?.querySelector('#deica-cancel-btn')?.addEventListener('click', closeDEICAModal);
  modal?.querySelector('#deica-save-btn')?.addEventListener('click', saveDEICADecision);
  document.getElementById('deica-list')?.addEventListener('click', (event) => {
    const editBtn = event.target?.closest?.('.deica-edit-btn');
    if (editBtn?.dataset?.id) { editDEICA(editBtn.dataset.id); return; }
    const delBtn = event.target?.closest?.('.deica-delete-btn');
    if (delBtn?.dataset?.id) deleteDEICA(delBtn.dataset.id);
  });
  modal?.addEventListener('click', (event) => {
    if (event.target?.id === 'deica-modal') closeDEICAModal();
  });

  deicaBound = true;
}

function openDEICAModal(screening) {
  deicaCurrent = { ...screening };
  const modal = getDEICAModal();
  const title = document.getElementById('deica-modal-title');
  const activity = document.getElementById('deica-activity-name');
  const justification = document.getElementById('deica-justification');
  const qualWrap = document.getElementById('deica-qual-wrap');
  if (!modal || !activity || !justification || !qualWrap) return;

  if (title) title.textContent = deicaCurrent.id ? 'Edit DPIA screening' : 'New DPIA screening';
  activity.value = deicaCurrent.activity_name || '';
  justification.value = deicaCurrent.justification || '';
  qualWrap.innerHTML = DEICA_QUAL_FACTORS.map(([key, label]) => `
    <div class="deica-row">
      <span>${deicaEscape(label)}</span>
      <button class="deica-switch" type="button" data-key="${key}" aria-label="Toggle ${deicaEscape(label)}"></button>
    </div>
  `).join('');

  modal.querySelectorAll('.deica-switch').forEach(button => {
    const key = button.dataset.key;
    button.classList.toggle('on', Boolean(deicaCurrent[key]));
    button.onclick = () => {
      deicaCurrent[key] = !deicaCurrent[key];
      button.classList.toggle('on', Boolean(deicaCurrent[key]));
      updateDEICADecision();
    };
  });

  updateDEICADecision();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeDEICAModal() {
  const modal = getDEICAModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function updateDEICADecision() {
  if (!deicaCurrent) return;
  const decision = decideDEICA(deicaCurrent);
  const box = document.getElementById('deica-decision-box');
  const icon = document.getElementById('deica-decision-icon');
  const text = document.getElementById('deica-decision-text');
  const justifyWrap = document.getElementById('deica-justify-wrap');

  if (box) box.className = `deica-decision ${decision === 'required' ? 'required' : 'not-required'}`;
  if (icon) icon.className = `fa-solid ${decision === 'required' ? 'fa-triangle-exclamation' : 'fa-circle-check'}`;
  if (text) text.textContent = decision === 'required' ? 'DPIA REQUIRED' : 'DPIA not required';
  if (justifyWrap) justifyWrap.style.display = 'block';
}

async function saveDEICADecision() {
  if (!deicaCurrent) return;
  const activity = document.getElementById('deica-activity-name')?.value.trim() || '';
  const justification = document.getElementById('deica-justification')?.value || '';
  if (!activity) {
    showToast('Activity name is required', 'error');
    return;
  }

  const rows = readDEICAScreenings();
  deicaCurrent.activity_name = activity;
  deicaCurrent.justification = justification;
  deicaCurrent.decision = decideDEICA(deicaCurrent);
  deicaCurrent.updated_at = new Date().toISOString();
  const isUpdate = Boolean(deicaCurrent.id);
  if (!isUpdate) {
    deicaCurrent.id = (window.crypto?.randomUUID && window.crypto.randomUUID()) || `deica-${Date.now()}`;
    deicaCurrent.created_at = new Date().toISOString();
  }

  // Best-effort Supabase sync. If it succeeds, the row also survives
  // localStorage being cleared (the user's "data is gone after hard refresh"
  // case). If it fails (no session, offline, missing account), the local
  // copy is still saved below so the UI continues to work.
  let syncedRow = null;
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user?.id) {
    const accountId = getEffectiveAccountId() || state.accountId || null;
    const payload = {
      id: deicaCurrent.id,
      user_id: state.user.id,
      account_id: accountId || null,
      activity_name: deicaCurrent.activity_name,
      justification: deicaCurrent.justification,
      decision: deicaCurrent.decision,
      ...Object.fromEntries(DEICA_KEYS.map(key => [key, Boolean(deicaCurrent[key])])),
      updated_at: deicaCurrent.updated_at
    };
    if (!isUpdate) payload.created_at = deicaCurrent.created_at;
    try {
      const { data, error } = await supabase
        .from('dpia_screenings')
        .upsert(payload, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) throw error;
      syncedRow = data;
    } catch (err) {
      JARVIS_LOG.error('DEICA', 'Save to Supabase', err, { activity });
      console.warn('[JARVIS] DEICA Supabase sync failed, kept local only', err);
    }
  }

  // Always write to localStorage so the UI is responsive and survives a
  // disconnected session.
  const merged = isUpdate
    ? rows.map(row => row.id === deicaCurrent.id ? (syncedRow || deicaCurrent) : row)
    : [(syncedRow || deicaCurrent), ...rows];
  saveDEICAScreenings(merged);
  if (syncedRow) Object.assign(deicaCurrent, syncedRow);

  closeDEICAModal();
  renderDEICA();
  showToast(syncedRow ? 'DEICA decision saved' : 'Saved locally (cloud sync unavailable)', syncedRow ? 'success' : 'info');
}

function editDEICA(id) {
  const row = readDEICAScreenings().find(item => String(item.id) === String(id));
  if (!row) {
    showToast('DEICA screening not found', 'warning');
    return;
  }
  openDEICAModal(row);
}

window.editDEICA = editDEICA;

async function deleteDEICA(id) {
  if (!confirm('Delete this DPIA screening? This cannot be undone.')) return;

  // Remove from localStorage immediately so the UI is responsive.
  const rows = readDEICAScreenings().filter(r => String(r.id) !== String(id));
  saveDEICAScreenings(rows);

  // Best-effort delete from Supabase.
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    const { error } = await supabase.from('dpia_screenings').delete().eq('id', id);
    if (error) {
      JARVIS_LOG.error('DEICA', 'Delete', error);
      showToast('Deleted locally; cloud sync failed', 'warning');
    }
  }

  renderDEICA();
  showToast('Screening deleted', 'success');
}

window.deleteDEICA = deleteDEICA;

async function loadCrossBorderFromSupabase() {
  const supabase = getSupabaseClient();
  const localData = readLocalList('cross_border_data');
  state.crossBorderTransfers = localData;
  renderCrossBorder(localData);

  if (!supabase || !isSupabaseConfigured()) return;

  console.log('[JARVIS] Fetching Cross-Border Transfers...');
  try {
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('cross_border_transfers').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[JARVIS] Cross-Border Fetch Error:', error.message);
      renderCrossBorder([]);
      return;
    }

    if (data) {
      console.log(`[JARVIS] Fetching Cross-Border... Success: ${data.length} records retrieved.`);
      state.crossBorderTransfers = data;
      renderCrossBorder(data);
    }
  } catch (err) {
    console.error('[JARVIS] Cross-Border Exception:', err);
    renderCrossBorder([]);
  }
}

function renderCrossBorder(transfers) {
  const body = document.getElementById('crossborder-tbody');
  if (!body) return;
  const list = transfers || [];

  const totalCount = document.getElementById('crossborder-total-count');
  const countryCount = document.getElementById('crossborder-countries-count');
  if (totalCount) totalCount.textContent = list.length;
  if (countryCount) {
    countryCount.textContent = new Set(list.map(t => t.destination_country).filter(Boolean)).size;
  }

  const summaryEl = document.getElementById('crossborder-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="vendor-stat-card"><div class="vendor-stat-label">Total Transfers</div><div class="vendor-stat-value">${list.length}</div></div>
    `;
  }

  const q = (document.getElementById('crossborder-search')?.value || '').toLowerCase();
  const filtered = q ? list.filter(t =>
    (t.destination_country||'').toLowerCase().includes(q) ||
    (t.recipient_name||'').toLowerCase().includes(q)
  ) : list;

  if (filtered.length === 0) {
    body.innerHTML = `<div class="empty-state"><div style="font-size:36px">🌍</div><p>No transfers found</p></div>`;
    return;
  }

  const statusClass = { 'Active': 'status-active', 'Pending': 'status-pending', 'Inactive': 'status-inactive' };
  body.innerHTML = `<div class="data-table-wrap"><table class="styled-table">
    <thead>
      <tr>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Destination</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Recipient</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Data Types</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em;">Status</th>
        <th style="background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:10px; letter-spacing:0.08em; width:100px;">Actions</th>
      </tr>
    </thead>
    <tbody>${filtered.map((t, i) => `
    <tr>
      <td class="td-bold">${t.destination_country || '—'}</td>
      <td>${t.recipient_name || '—'}</td>
      <td class="td-muted">${t.data_categories || '—'}</td>
      <td><span class="status-badge ${statusClass[t.status] || 'status-inactive'}">${t.status || '—'}</span></td>
      <td><button class="btn-edit" onclick="editCrossBorder(${i})">Edit</button></td>
	    </tr>`).join('')}</tbody></table></div>`;
}

function resetCrossBorderForm() {
  const values = {
    'crossborder-index': '-1',
    'crossborder-country': '',
    'crossborder-recipient': '',
    'crossborder-data': '',
    'crossborder-safeguards': '',
    'crossborder-status': 'Active'
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  const title = document.getElementById('crossborder-modal-title');
  if (title) title.textContent = 'Log transfer';
  const btn = document.getElementById('crossborder-save-btn');
  if (btn) btn.textContent = 'Save transfer';
}

function editCrossBorder(index) {
  const transfer = state.crossBorderTransfers?.[index];
  if (!transfer) return;
  const values = {
    'crossborder-index': String(index),
    'crossborder-country': transfer.destination_country || '',
    'crossborder-recipient': transfer.recipient_name || '',
    'crossborder-data': transfer.data_categories || '',
    'crossborder-safeguards': transfer.safeguards || '',
    'crossborder-status': transfer.status || 'Active'
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
  const title = document.getElementById('crossborder-modal-title');
  if (title) title.textContent = 'Edit transfer';
  const btn = document.getElementById('crossborder-save-btn');
  if (btn) btn.textContent = 'Update transfer';
  openModal('modal-crossborder');
}

async function saveCrossBorder() {
  const index = parseInt(document.getElementById('crossborder-index')?.value || '-1', 10);
  const orgId = getCurrentOrgId();
  const rawCategories = document.getElementById('crossborder-data')?.value.trim() || '';
  // DB column is TEXT[]; UI sends a comma-separated string.
  const categoriesArr = rawCategories ? rawCategories.split(',').map(s => s.trim()).filter(Boolean) : [];

  const dbPayload = {
    destination_country: document.getElementById('crossborder-country')?.value.trim() || '',
    recipient_name: document.getElementById('crossborder-recipient')?.value.trim() || '',
    data_categories: categoriesArr,
    safeguards: document.getElementById('crossborder-safeguards')?.value.trim() || '',
    status: document.getElementById('crossborder-status')?.value || 'Active'
  };

  if (!dbPayload.destination_country || !dbPayload.recipient_name) {
    showToast('Destination country and recipient are required', 'error');
    return;
  }

  state.crossBorderTransfers = state.crossBorderTransfers || [];
  const existing = index > -1 ? state.crossBorderTransfers[index] : null;
  const supabase = getSupabaseClient();

  let supabaseSucceeded = false;
  if (supabase && isSupabaseConfigured() && orgId) {
    try {
      if (existing && existing.id && !String(existing.id).startsWith('local-')) {
        const { error } = await supabase.from('cross_border_transfers')
          .update({ ...dbPayload, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cross_border_transfers')
          .insert([{ ...dbPayload, account_id: getEffectiveAccountId() }]);
        if (error) throw error;
      }
      supabaseSucceeded = true;
    } catch (err) {
      console.error('[JARVIS] CrossBorder Supabase Save Error', err);
    }
  }

  const localRecord = {
    ...dbPayload,
    id: existing?.id || ('local-' + Date.now()),
    created_at: existing?.created_at || new Date().toISOString()
  };
  if (index > -1) {
    state.crossBorderTransfers[index] = { ...existing, ...localRecord };
  } else {
    state.crossBorderTransfers.unshift(localRecord);
  }
  saveLocalList('cross_border_data', state.crossBorderTransfers);
  closeModal('modal-crossborder');

  if (supabaseSucceeded) {
    await loadCrossBorderFromSupabase();
    showToast('Transfer saved', 'success');
  } else {
    renderCrossBorder(state.crossBorderTransfers);
    showToast(supabase && isSupabaseConfigured() ? 'Saved locally; Supabase save failed' : 'Saved locally', 'warning');
  }
}

// JARVIS_LOG consolidated at top of file

async function loadAlertsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;

  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) return;
  let query = supabase.from('alerts').select('*');
  if (accountId) query = query.eq('account_id', accountId);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load alerts:', error);
    return;
  }

  state.alerts = data;
  renderAlerts();
}

async function loadCasesFromSupabase() {
  const supabase = getSupabaseClient();
  const localData = readLocalList('cases_data');
  state.cases = localData;
  renderCases(localData);

  if (!supabase || !isSupabaseConfigured()) return;

  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) return;
  let query = supabase.from('cases').select('*');
  if (accountId) query = query.eq('account_id', accountId);
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load cases:', error);
    return;
  }

  state.cases = data || [];
  saveLocalList('cases_data', state.cases);
  renderCases(state.cases);
}

function renderCases(cases) {
  const body = document.getElementById('cases-body');
  if (!body) return;
  const list = cases || [];

  // Summary
  const summaryEl = document.getElementById('cases-summary');
  if (summaryEl) {
    const highPriority = list.filter(c => c.priority === 'High').length;
    summaryEl.innerHTML = `
      <div class="co-stat"><span class="co-stat-num">${list.length}</span><span class="co-stat-label">Total Cases</span></div>
      <div class="co-stat-divider"></div>
      <div class="co-stat"><span class="co-stat-num co-num-red">${highPriority}</span><span class="co-stat-label">High Priority</span></div>
    `;
  }

  // Search
  const q = (document.getElementById('cases-search')?.value || '').toLowerCase();
  const filtered = q ? list.filter(c =>
    (c.case_number||'').toLowerCase().includes(q) ||
    (c.description||'').toLowerCase().includes(q)
  ) : list;

  if (filtered.length === 0) {
    body.innerHTML = `<div class="empty-state"><div style="font-size:36px">📂</div><p>${q ? 'No results for "' + q + '"' : 'No active cases'}</p><small>Cases will appear here when investigations or requests need tracking.</small></div>`;
    return;
  }

  const priorityClass = { 'High': 'status-error', 'Medium': 'status-pending', 'Low': 'status-active' };
  body.innerHTML = `<div class="data-table-wrap"><table class="styled-table"><thead><tr>
    <th class="th-case">Case No.</th><th class="th-type">Type</th><th>Description</th><th class="th-assigned">Assigned</th><th class="th-narrow">Priority</th><th class="th-narrow">Status</th>
  </tr></thead><tbody>${filtered.map(c => `
    <tr>
      <td class="td-bold td-mono">${c.case_number}</td>
      <td><span class="table-tag">${c.case_type}</span></td>
      <td class="td-muted td-desc">${c.description || '—'}</td>
      <td class="td-muted">${c.assigned_to || '—'}</td>
      <td><span class="status-badge ${priorityClass[c.priority] || 'status-inactive'}">${c.priority}</span></td>
      <td><span class="status-badge status-inactive">${c.status}</span></td>
	    </tr>`).join('')}</tbody></table></div>`;
}

function resetCaseForm() {
  const values = {
    'case-type': '',
    'case-description': '',
    'case-assigned': '',
    'case-priority': 'Medium',
    'case-status': 'Open'
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

async function saveCase() {
  const orgId = getCurrentOrgId();
  const caseData = {
    case_number: `CASE-${new Date().getFullYear()}-${String((state.cases?.length || 0) + 1).padStart(4, '0')}`,
    case_type: document.getElementById('case-type')?.value.trim() || '',
    description: document.getElementById('case-description')?.value.trim() || '',
    assigned_to: document.getElementById('case-assigned')?.value.trim() || '',
    priority: document.getElementById('case-priority')?.value || 'Medium',
    status: document.getElementById('case-status')?.value || 'Open'
  };

  if (!caseData.case_type || !caseData.description) {
    showToast('Case type and description are required', 'error');
    return;
  }

  const supabase = getSupabaseClient();
  let savedRow = null;
  if (supabase && isSupabaseConfigured() && orgId) {
    const { data, error } = await supabase.from('cases')
      .insert([{ ...caseData, account_id: getEffectiveAccountId() }])
      .select()
      .single();
    if (error) {
      console.error('Save case error:', error);
    } else {
      savedRow = data;
    }
  }

  state.cases = state.cases || [];
  state.cases.unshift(savedRow || { ...caseData, id: 'local-' + Date.now(), created_at: new Date().toISOString() });
  saveLocalList('cases_data', state.cases);
  closeModal('modal-case');

  if (savedRow) {
    await loadCasesFromSupabase();
    showToast('Case created', 'success');
  } else {
    renderCases(state.cases);
    showToast(supabase && isSupabaseConfigured() ? 'Saved locally; Supabase save failed' : 'Saved locally', 'warning');
  }
}

/* ───────────────────────────────────────────────
   CONSENT
   ─────────────────────────────────────────────── */
function renderConsent() {
  const body = document.getElementById('consent-body');
  body.innerHTML = '';

  const icons = ['📧', '👥', '📊'];

  CONSENT_DATA.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'consent-item';

    const iconColors = ['#e3f2fd', '#f3e5f5', '#e8f5e9'];
    const iconBg = iconColors[index % iconColors.length];

    div.innerHTML = `
      <div class="consent-header-row">
        <div class="consent-icon" style="background:${iconBg}">${icons[index % icons.length]}</div>
        <div style="flex:1">
          <div class="consent-head" style="margin-bottom:8px;">
            <div>
              <div class="consent-title">${item.title}</div>
              <div class="consent-purpose">${item.purpose}</div>
            </div>
            <span class="badge badge-green">Active</span>
          </div>
          <div class="toggle-row" style="background:white; border:1px solid var(--border-light); padding:8px 12px; margin-bottom:0;">
            <span style="font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em;">Consent Settings</span>
            <span style="font-size:12px; color:var(--muted);">${item.toggles.filter(t=>t.checked).length} of ${item.toggles.length} enabled</span>
          </div>
        </div>
      </div>
      <div style="margin-top:12px;">
        ${item.toggles.map((t, i) => `
          <div class="toggle-row">
            <div class="toggle-label">
              <span class="toggle-status ${t.checked ? 'on' : 'off'}">${t.checked ? 'ON' : 'OFF'}</span>
              <span>${t.label}</span>
            </div>
            <label class="toggle-wrap"><input type="checkbox" ${t.checked ? 'checked' : ''} onchange="updateConsentToggle(${index}, ${i}, this.checked)"><span class="toggle-slider"></span></label>
          </div>`).join('')}
      </div>
      <textarea class="consent-note" placeholder="Add notes about consent collection, opt-out procedures, or compliance notes…" rows="2"></textarea>
      <div class="consent-footer">
        <button class="btn btn-outline" style="font-size:12px; padding:6px 12px;" onclick="saveConsentNote(this)">Save Notes</button>
      </div>`;
    body.appendChild(div);
  });
  updateConsentStats();
  renderOptOutLog();
}

function updateConsentToggle(categoryIndex, toggleIndex, checked) {
  CONSENT_DATA[categoryIndex].toggles[toggleIndex].checked = checked;
  const toggleRow = event.target.closest('.toggle-row');
  const statusEl = toggleRow.querySelector('.toggle-status');
  statusEl.className = 'toggle-status ' + (checked ? 'on' : 'off');
  statusEl.textContent = checked ? 'ON' : 'OFF';
  showSuccess('Consent setting updated');
}

function saveConsentNote(btn) {
  const note = btn.closest('.consent-item').querySelector('.consent-note').value;
  showSuccess('Notes saved');
}

/* ───────────────────────────────────────────────
   RETENTION
   ─────────────────────────────────────────────── */
function renderRetention() {
  const body = document.getElementById('retention-body');
  if (!body) return;
  body.innerHTML = '';

  const html = `
    <div class="data-table-wrap">
      <table class="styled-table">
        <thead>
          <tr>
            <th>Data Category</th>
            <th class="th-desc">Description</th>
            <th class="th-narrow">Status</th>
            <th class="th-period">Retention Period</th>
          </tr>
        </thead>
        <tbody>
          ${RETENTION_DATA.map(item => `
            <tr>
              <td class="td-bold">${item.title}</td>
              <td class="td-muted td-desc">${item.sub}</td>
              <td>
                <span class="status-badge ${item.active ? 'status-active' : 'status-inactive'}">
                  ${item.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <div class="retention-input-wrap">
                  <input class="months-input" type="number" value="${item.months}" min="1" max="360">
                  <span class="td-muted">mo</span>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  body.innerHTML = html;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// DPO logic moved to dpo_logic.js

/* ───────────────────────────────────────────────
   DOCUMENTS
   ─────────────────────────────────────────────── */
const DOCUMENTS_LOCAL_KEY = 'datarex_documents';

function getDocumentScope() {
  return {
    accountId: (typeof getEffectiveAccountId === 'function' && getEffectiveAccountId()) || state.accountId || state.viewAsAccountId || '',
    userId: state.user?.id || ''
  };
}

function readLocalDocuments() {
  try {
    const direct = JSON.parse(localStorage.getItem(DOCUMENTS_LOCAL_KEY) || '[]');
    const savedState = JSON.parse(localStorage.getItem('dataRexState') || '{}');
    const fromState = Array.isArray(savedState.documents) ? savedState.documents : [];
    const merged = [...direct, ...fromState];
    const seen = new Set();
    const deduped = merged.filter(doc => {
      const key = doc.id || doc.storagePath || `${doc.name}-${doc.uploadedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(doc.name);
    });
    // One-shot migration: if `dataRexState.documents` still holds entries
    // (legacy store from before commit 3b23551), copy them into the canonical
    // documents-local key so a later saveState() — which strips `documents`
    // from `dataRexState` to avoid quota issues — can't drop them.
    if (fromState.length && deduped.length > direct.length) {
      try { localStorage.setItem(DOCUMENTS_LOCAL_KEY, JSON.stringify(deduped)); }
      catch (err) { console.error('[JARVIS] Doc migration write failed', err); }
    }
    return deduped;
  } catch (err) {
    console.error('[JARVIS] Failed to read local documents', err);
    return [];
  }
}

function writeLocalDocuments(docs) {
  const safeDocs = (docs || []).filter(doc => doc && doc.name);
  // Only the documents-local key carries the heavy `dataUrl` payload.
  // saveState() serialises the entire `state` object into `dataRexState`,
  // and including base64 file blobs there double-stores them and blows the
  // localStorage quota (~5–10 MB per origin) on the second small upload.
  try {
    localStorage.setItem(DOCUMENTS_LOCAL_KEY, JSON.stringify(safeDocs));
  } catch (err) {
    // Quota exhausted — drop dataUrls (metadata only) and retry once so
    // the doc still appears in the list rather than vanishing entirely.
    console.error('[JARVIS] documents localStorage quota; saving metadata only', err);
    const stripped = safeDocs.map(({ dataUrl, ...rest }) => rest);
    try { localStorage.setItem(DOCUMENTS_LOCAL_KEY, JSON.stringify(stripped)); }
    catch (err2) { console.error('[JARVIS] metadata write also failed', err2); }
  }
  state.documents = safeDocs; // in-memory mirror keeps dataUrls for download
}

function docMatchesScope(doc) {
  const { accountId, userId } = getDocumentScope();
  if (accountId && doc.accountId && String(doc.accountId) !== String(accountId)) return false;
  if (userId && doc.userId && String(doc.userId) !== String(userId)) return false;
  return true;
}

function mergeDocuments(primary, secondary) {
  // Dedupe by id/storagePath/name. When two entries share a key, keep the
  // primary record but fill in missing fields from the secondary — most
  // importantly `dataUrl`, which only the local copy carries. Without this
  // a synced doc's row hides the local dataUrl and Download has to fall
  // through to the (popup-prone) signed-URL path.
  const byKey = new Map();
  const order = [];
  for (const doc of [...primary, ...secondary]) {
    if (!doc || !doc.name) continue;
    const key = doc.id || doc.storagePath || `${doc.name}-${doc.uploadedAt}`;
    if (byKey.has(key)) {
      const existing = byKey.get(key);
      if (!existing.dataUrl && doc.dataUrl) existing.dataUrl = doc.dataUrl;
      if (!existing.storagePath && doc.storagePath) existing.storagePath = doc.storagePath;
    } else {
      const copy = { ...doc };
      byKey.set(key, copy);
      order.push(copy);
    }
  }
  return order;
}

function getDocType(fileName = '', mimeType = '') {
  const ext = String(fileName).split('.').pop()?.toLowerCase() || '';
  const mime = String(mimeType).toLowerCase();
  if (mime.includes('pdf') || ext === 'pdf') return 'PDF';
  if (mime.includes('word') || ['doc', 'docx'].includes(ext)) return 'Word';
  if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'Excel';
  if (mime.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'Image';
  if (mime.includes('text') || ['txt', 'md'].includes(ext)) return 'Text';
  return ext ? ext.toUpperCase() : 'File';
}

// localStorage is the source of truth for documents on this app — keep the
// dataUrl for any file that fits. Cap at 8 MB raw (~10.7 MB base64) to leave
// headroom under the typical 10 MB localStorage quota even with multiple docs.
const DOC_LOCAL_MAX_BYTES = 8 * 1024 * 1024;
function fileToDataUrl(file) {
  return new Promise(resolve => {
    if (!file || file.size > DOC_LOCAL_MAX_BYTES) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

async function renderDocuments() {
  const body = document.getElementById('documents-list');
  if (!body) return;

  const supabase = getSupabaseClient();
  const localDocs = readLocalDocuments().filter(docMatchesScope);
  let docs = localDocs;

  if (supabase && isSupabaseConfigured() && state.user.id) {
    const filterCat = document.getElementById('doc-filter')?.value || '';
    const accountId = getEffectiveAccountId();
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', state.user.id);
    if (accountId) query = query.eq('account_id', accountId);
    query = query.order('created_at', { ascending: false });

    if (filterCat) query = query.eq('category', filterCat);

    const { data, error } = await query;
    if (!error && data) {
      docs = data.map(r => ({
        id: r.id,
        uploader: r.uploader_name,
        name: r.name,
        type: r.doc_type,
        category: r.category,
        size: r.file_size,
        uploadedAt: r.created_at,
        storagePath: r.storage_path,
        accountId: r.account_id,
        userId: r.user_id,
        source: 'supabase',
        uploadStatus: 'Synced'
      }));
      docs = mergeDocuments(docs, localDocs);
    } else if (error) {
      JARVIS_LOG.error('Documents', 'Load from Supabase', error);
    }
  }

  // Always mirror the rendered list into state.documents so download/delete
  // can resolve a doc by id even when Supabase is unreachable.
  state.documents = docs;

  // Summary
  const countEl = document.getElementById('doc-count');
  if (countEl) countEl.textContent = `${docs.length} document${docs.length !== 1 ? 's' : ''}`;

  // Search
  const q = (document.getElementById('doc-search')?.value || '').toLowerCase();
  const filtered = q ? docs.filter(d =>
    (d.name||'').toLowerCase().includes(q) ||
    (d.category||'').toLowerCase().includes(q)
  ) : docs;

  if (filtered.length === 0) {
    body.innerHTML = `<div class="empty-state"><div style="font-size:36px">📂</div><p>${q ? 'No results for "' + q + '"' : 'No documents yet'}</p><small>Upload your first compliance document to get started.</small></div>`;
    return;
  }

  const fmtSize = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(1) + ' MB';
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});

  body.innerHTML = `<div class="data-table-wrap"><table><thead><tr>
    <th>Document</th><th>Category</th><th>Size</th><th>Uploaded</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>${filtered.map((doc, i) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:18px;">${getDocIcon(doc.type)}</div>
          <div class="table-avatar-name">${doc.name}</div>
        </div>
      </td>
      <td><span class="table-tag">${doc.category}</span></td>
      <td class="td-muted">${fmtSize(doc.size)}</td>
      <td class="td-muted co-date">${fmtDate(doc.uploadedAt)}</td>
      <td><span class="status-badge ${doc.uploadStatus === 'Local copy' ? 'status-inactive' : 'status-active'}">${doc.uploadStatus || 'Synced'}</span></td>
      <td>
        <div class="row-actions co-actions">
          <button class="btn-edit" onclick="downloadDocument('${doc.id}')">Download</button>
          <button class="btn-delete" onclick="deleteDocument('${doc.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
}

function getDocIcon(type) {
  if (type?.includes('PDF')) return '📕';
  if (type?.includes('Word')) return '📘';
  if (type?.includes('Excel') || type?.includes('Spreadsheet')) return '📗';
  if (type?.includes('Image')) return '🖼️';
  return '📄';
}

// Trigger a browser download by adding a temporary <a> to the DOM. Detached
// anchors are silently ignored in some browsers (notably Firefox) and the
// `download` attribute on a popup window can be blocked, so this is the
// reliable way to fire a download from JS.
function triggerDownload(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener';
  if (filename) link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => link.remove(), 0);
}

async function downloadDocument(docId) {
  const doc = state.documents.find(d => String(d.id) === String(docId));
  if (!doc) return;
  // dataUrl can have been stripped from state.documents during render (e.g.
  // when the synced row from Supabase replaced the local one). Fall back to
  // the canonical localStorage record before giving up.
  let dataUrl = doc.dataUrl || '';
  if (!dataUrl) {
    try {
      const local = (JSON.parse(localStorage.getItem(DOCUMENTS_LOCAL_KEY) || '[]') || [])
        .find(d => String(d.id) === String(docId) || (d.storagePath && d.storagePath === doc.storagePath));
      if (local?.dataUrl) dataUrl = local.dataUrl;
    } catch (_) {}
  }
  if (dataUrl) {
    triggerDownload(dataUrl, doc.name || 'document');
    return;
  }
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && doc.storagePath) {
    // Bucket is private (see 20260509000005_documents_storage_bucket.sql).
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storagePath, 60, { download: doc.name || true });
    if (error || !data?.signedUrl) {
      showToast('Could not generate download link', 'error');
      return;
    }
    triggerDownload(data.signedUrl, doc.name || 'document');
  } else {
    showToast('File content was not stored locally for this document', 'info');
  }
}

async function deleteDocument(docId) {
  if (!confirm('Delete this document?')) return;
  const supabase = getSupabaseClient();
  const doc = state.documents.find(d => String(d.id) === String(docId));
  if (supabase && isSupabaseConfigured() && doc?.source === 'supabase') {
    if (doc?.storagePath) await supabase.storage.from('documents').remove([doc.storagePath]);
    await supabase.from('documents').delete().eq('id', docId);
  }
  const remaining = readLocalDocuments().filter(d => String(d.id) !== String(docId));
  writeLocalDocuments(remaining);
  renderDocuments();
  showSuccess('Document deleted');
}

function updateFileName(input) {
  const display = document.getElementById('file-name-display');
  if (input.files.length > 0) {
    display.value = input.files[0].name;
    display.style.borderColor = 'var(--green)';
  } else {
    display.value = 'No file chosen';
    display.style.borderColor = 'var(--border)';
  }
}

async function handleFileUpload() {
  const fileInput = document.getElementById('file-input');
  const categorySelect = document.getElementById('doc-category');
  const files = fileInput.files;

  if (!files.length) {
    showToast('Please select a file to upload', 'warning');
    return;
  }

  const supabase = getSupabaseClient();
  const category = categorySelect.value;
  const uploaderName = state.user?.name || 'Current user';
  const { accountId, userId } = getDocumentScope();
  // Best-effort cloud sync. localStorage is always written. We attempt the
  // Supabase upload whenever there is a real session; if the user has no
  // user_profiles row and account_id is missing, the DB insert will throw
  // (NOT NULL) and the catch block keeps the file as a Local copy.
  const canTrySync = Boolean(supabase && isSupabaseConfigured() && userId);
  let syncedCount = 0;
  let localOnlyCount = 0;
  const failures = [];
  const nextLocalDocs = readLocalDocuments();

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const storagePath = `${userId || 'local'}/${uniqueName}`;
    const createdAt = new Date().toISOString();
    const localDoc = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uploader: uploaderName,
      name: file.name,
      type: getDocType(file.name, file.type),
      category,
      size: file.size,
      uploadedAt: createdAt,
      storagePath: '',
      accountId,
      userId,
      source: 'local',
      uploadStatus: 'Local copy',
      dataUrl: await fileToDataUrl(file)
    };

    if (canTrySync) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const payload = {
          user_id: userId,
          uploader_name: uploaderName,
          name: file.name,
          doc_type: localDoc.type,
          category,
          file_size: file.size,
          storage_path: storagePath
        };
        // documents.account_id is NOT NULL in the schema, so we only attach
        // it when we actually have one. Missing account → insert throws,
        // catch block treats it as a local-only save.
        if (accountId) payload.account_id = accountId;

        const { data: inserted, error: dbError } = await supabase
          .from('documents')
          .insert(payload)
          .select('*')
          .single();

        if (dbError) {
          // Don't leave an orphan storage object when the metadata insert fails.
          await supabase.storage.from('documents').remove([storagePath]).catch(() => {});
          throw dbError;
        }

        localDoc.id = inserted?.id || localDoc.id;
        localDoc.storagePath = inserted?.storage_path || storagePath;
        localDoc.accountId = inserted?.account_id || accountId;
        localDoc.userId = inserted?.user_id || userId;
        localDoc.uploadedAt = inserted?.created_at || createdAt;
        localDoc.source = 'supabase';
        localDoc.uploadStatus = 'Synced';
        syncedCount++;
      } catch (err) {
        console.error('Document upload/save error:', err);
        JARVIS_LOG.error('Documents', 'Upload', err, { file: file.name, accountId });
        failures.push({ name: file.name, message: err?.message || 'Unknown error' });
        localOnlyCount++;
      }
    } else {
      localOnlyCount++;
    }

    nextLocalDocs.unshift(localDoc);
  }

  writeLocalDocuments(nextLocalDocs);
  await renderDocuments();

  if (failures.length) {
    const head = failures[0];
    const tail = failures.length > 1 ? ` (+${failures.length - 1} more)` : '';
    showToast(`Cloud sync failed for ${head.name}: ${head.message}${tail}. Saved locally.`, 'error');
  } else if (syncedCount > 0) {
    showSuccess(`${syncedCount} file(s) uploaded`);
  } else {
    showToast(`${localOnlyCount} file(s) saved locally (no cloud session)`, 'info');
  }

  fileInput.value = '';
  updateFileName(fileInput);
}

/* ───────────────────────────────────────────────
   NAVIGATION PERMISSIONS
   ─────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', section: 'Overview' },
  { id: 'checklist', label: 'Checklist', section: 'Overview' },
  { id: 'companies', label: 'Companies', section: 'Foundation' },
  { id: 'datasources', label: 'Data Sources', section: 'Foundation' },
  { id: 'dataregister', label: 'Data Register', section: 'Foundation' },
  { id: 'consent', label: 'Consent', section: 'Foundation' },
  { id: 'access', label: 'Access Control', section: 'Foundation' },
  { id: 'retention', label: 'Retention', section: 'Foundation' },
  { id: 'datarequests', label: 'Data Requests', section: 'Operations' },
  { id: 'breachlog', label: 'Breach Log', section: 'Operations' },
  { id: 'dpiapage', label: 'DPIA', section: 'Operations' },
  { id: 'deica', label: 'DPIA Workflow (DEICA)', section: 'Operations' },
  { id: 'crossborder', label: 'Cross-border', section: 'Operations' },
  { id: 'vendors', label: 'Vendors', section: 'Operations' },
  { id: 'training', label: 'Training', section: 'Operations' },
  { id: 'documents', label: 'Documents', section: 'Records' },
  { id: 'audit', label: 'Audit Report', section: 'Records' },
  { id: 'alerts', label: 'Alerts', section: 'Monitoring', hasBadge: true },
  { id: 'cases', label: 'Cases', section: 'Monitoring' },
  { id: 'monitoring', label: 'Monitoring', section: 'Monitoring' },
  { id: 'accounts', label: 'Accounts', section: 'Admin', superadminOnly: true },
  { id: 'people', label: 'People', section: 'Admin', accountadminOnly: true }
];

function openAddRoleModal() {
  openModal('modal-add-role');
  document.getElementById('new-role-name').value = '';
}

function addNewRole() {
  const name = document.getElementById('new-role-name').value.trim();
  if (!name) {
    showToast('Please enter a role name', 'error');
    return;
  }

  if (!state.customRoles) state.customRoles = [];
  if (!state.customRoles.includes(name)) {
    state.customRoles.push(name);
    saveState();

    const select = document.getElementById('nav-role-select');
    if (select) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
      select.value = name;
    }

    showSuccess(`Role "${name}" created!`);
  }

  closeModal('modal-add-role');
  loadNavPermissions();
}

function loadNavPermissionsFromDB(role) {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured() || !state.user.id) return Promise.resolve();

  return supabase
    .from('nav_permissions')
    .select('nav_item, is_visible')
    .eq('org_id', state.user.id)
    .eq('access_level', role)
    .then(({ data, error }) => {
      if (!error && data && data.length > 0) {
        if (!state.navPermissions) state.navPermissions = {};
        state.navPermissions[role] = {};
        data.forEach(item => {
          state.navPermissions[role][item.nav_item] = item.is_visible;
        });
      }
    });
}

function loadNavPermissions() {
  const select = document.getElementById('nav-role-select');
  const currentRole = select?.value || 'Accountadmin';

  const matrix = document.getElementById('nav-permissions-matrix');
  if (!matrix) return;

  // Try to load from DB first
  if (state.user.id && state.navPermissions && !state.navPermissions[currentRole]) {
    loadNavPermissionsFromDB(currentRole);
  }

  const savedConfig = state.navPermissions?.[currentRole] || {};

  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];
  const sectionIcons = {
    'Overview': '📊',
    'Foundation': '🏗️',
    'Operations': '⚙️',
    'Records': '📋',
    'Monitoring': '📈'
  };
  const sectionColors = {
    'Overview': 'blue',
    'Foundation': 'green',
    'Operations': 'amber',
    'Records': 'blue',
    'Monitoring': 'red'
  };

  let html = '';

  sections.forEach(section => {
    const items = NAV_ITEMS.filter(i => i.section === section);
    const enabledCount = items.filter(i => savedConfig[i.id] !== false).length;

    html += `
      <div class="perm-section">
        <div class="perm-section-header">${sectionIcons[section] || '📁'} ${section} <span style="font-weight:400;margin-left:8px;">(${enabledCount}/${items.length} enabled)</span></div>
        <div class="perm-grid">`;

    items.forEach(item => {
      const isVisible = savedConfig[item.id] !== false;
      const color = sectionColors[section] || 'blue';
      html += `
        <div class="perm-card">
          <div class="perm-card-label">
            <span class="perm-card-icon ${color}">${sectionIcons[section] || '📁'}</span>
            <span>${item.label}</span>
          </div>
          <label class="toggle-wrap">
            <input type="checkbox" class="nav-perm-toggle" data-nav="${item.id}" ${isVisible ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>`;
    });

    html += '</div></div>';
  });

  matrix.innerHTML = html;
}

async function saveNavConfig() {
  const select = document.getElementById('nav-role-select');
  const currentRole = select?.value || 'Accountadmin';

  const btn = event.target;
  btn.disabled = true;
  btn.innerHTML = '⏳ Saving...';

  const config = {};
  document.querySelectorAll('.nav-perm-toggle').forEach(toggle => {
    config[toggle.dataset.nav] = toggle.checked;
  });

  if (!state.navPermissions) state.navPermissions = {};
  state.navPermissions[currentRole] = config;
  saveState();

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user.id) {
    try {
      const records = NAV_ITEMS.map(item => ({
        org_id: state.user.id,
        access_level: currentRole,
        nav_item: item.id,
        is_visible: config[item.id] !== false
      }));

      const { error } = await supabase
        .from('nav_permissions')
        .upsert(records, { onConflict: 'org_id,access_level,nav_item' });

      if (error) {
        console.error('Failed to save permissions:', error);
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  }

  btn.disabled = false;
  btn.innerHTML = '💾 Save Permissions';
  showSuccess('Permissions saved to database!');
}

function applyNavPermissions() {
  const userLevel = state.currentUserLevel || 'Accountadmin';
  const savedConfig = state.navPermissions?.[userLevel];
  const isSuperadmin = state.role === 'Superadmin';
  const isAccountadmin = state.role === 'Accountadmin';

  NAV_ITEMS.forEach(item => {
    const navEl = document.getElementById('nav-' + item.id);
    if (navEl) {
      if (item.superadminOnly && !isSuperadmin) {
        navEl.style.display = 'none';
      } else if (item.accountadminOnly && !isSuperadmin && !isAccountadmin) {
        navEl.style.display = 'none';
      } else {
        navEl.style.display = (savedConfig && savedConfig[item.id] === false) ? 'none' : '';
      }
    }
  });

  // Show Admin label for Superadmin and Accountadmin (People page lives there).
  const adminLabel = document.getElementById('nav-section-admin');
  if (adminLabel) adminLabel.style.display = (isSuperadmin || isAccountadmin) ? '' : 'none';
}

function setUserLevel(level) {
  state.currentUserLevel = level;
  saveState();
  applyNavPermissions();
}

/* ───────────────────────────────────────────────
   ACCESS CONTROL
   ─────────────────────────────────────────────── */
function updateModalPermissions() {
  const level = document.getElementById('person-access').value;
  const checks = {
    'perm-dashboard': true,
    'perm-checklist': level === 'Accountadmin' || level === 'useradmin' || level === 'user',
    'perm-dataregister': level === 'Accountadmin' || level === 'user',
    'perm-datasources': level === 'Accountadmin',
    'perm-consent': level === 'Accountadmin',
    'perm-retention': level === 'Accountadmin' || level === 'security_user'
  };
  for (const [id, val] of Object.entries(checks)) {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  }
}

async function savePerson() {
  const name   = document.getElementById('person-name').value.trim();
  const role   = document.getElementById('person-role').value.trim();
  const access = document.getElementById('person-access').value;
  if (!name) {
    showToast('Please enter a name.', 'error');
    return;
  }

  const isChecked = (id) => document.getElementById(id)?.checked || false;
  const permissions = {
    Dashboard: isChecked('perm-dashboard'),
    Checklist: isChecked('perm-checklist'),
    DataRegister: isChecked('perm-dataregister'),
    DataSources: isChecked('perm-datasources'),
    Consent: isChecked('perm-consent'),
    Retention: isChecked('perm-retention')
  };

  const supabase = getSupabaseClient();
  const orgId = (typeof getCurrentOrgId === 'function') ? getCurrentOrgId() : state.user?.id;
  if (supabase && isSupabaseConfigured() && orgId) {
    const { data, error } = await supabase.from('team_members').insert([{
      account_id: getEffectiveAccountId(),
      name: name,
      role_department: role || 'Team member',
      access_level: access,
      permissions: permissions
    }]).select().single();

    if (error) {
      console.error('Save error:', error);
      showToast('Failed to save team member', 'error');
    } else if (data) {
      state.team.push({
        id: data.id,
        name, role: role || 'Team member', level: access, permissions
      });
      showToast('Team member added!', 'success');
    }
  } else {
    state.team.push({ id: 'local-' + Date.now(), name, role: role || 'Team member', level: access, permissions });
    showToast('Team member added', 'success');
  }

  saveState();
  renderTeam();
  closeModal('modal-person');
  document.getElementById('person-name').value = '';
  document.getElementById('person-role').value = '';
}

async function renderTeam() {
  const body = document.getElementById('access-body');
  if (!body) return;
  body.innerHTML = '';

  const supabase = getSupabaseClient();
  const orgId = (typeof getCurrentOrgId === 'function') ? getCurrentOrgId() : state.user?.id;
  if (supabase && isSupabaseConfigured() && orgId) {
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('team_members').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      state.team = data.map(t => ({
        id: t.id,
        name: t.name,
        role: t.role_department || 'Team member',
        level: t.access_level || 'user',
        permissions: t.permissions || {}
      }));
    }
  }

  state.team = (state.team || []).map((t, i) => ({ ...t, id: t.id || `local-team-${i}` }));

  state.team.forEach(t => {
    const div = document.createElement('div');
    div.className = 'access-item';

    let permsHtml = '';
    if (t.permissions) {
      const activePerms = Object.entries(t.permissions).filter(([k, v]) => v).map(([k, v]) => k);
      if (activePerms.length > 0) {
        permsHtml = `<div class="access-perms">
          ${activePerms.map(p => `<span class="access-perm-tag">${p}</span>`).join('')}
        </div>`;
      }
    }

    div.innerHTML = `
      <div class="access-avatar">${t.name[0].toUpperCase()}</div>
      <div class="access-info">
        <div class="access-name">${t.name} <span class="badge badge-blue">${t.level}</span></div>
        <div class="access-role">${t.role}</div>
        ${permsHtml}
      </div>
      <button class="btn btn-ghost" style="padding:8px 12px;font-size:13px;" onclick="removeTeamMember('${t.id}')">✕ Remove</button>`;
    body.appendChild(div);
  });

  if (state.team.length === 0) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);"><div style="font-size:48px;margin-bottom:12px;">👥</div><div style="font-size:14px;font-weight:500;">No team members yet</div><div style="font-size:13px;margin-top:4px;">Add your first team member to get started.</div></div>';
  }
}

async function removeTeamMember(id) {
  if (!confirm('Remove this team member?')) return;

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && id && !String(id).startsWith('local-')) {
    const { error } = await supabase.from('team_members').delete().eq('id', id);
    if (error) {
      console.error('Delete team member failed:', error);
      showToast('Failed to remove team member', 'error');
      return;
    }
  }

  state.team = (state.team || []).filter(t => String(t.id) !== String(id));
  saveState();
  renderTeam();
  showToast('Team member removed', 'success');
}

/* ───────────────────────────────────────────────
   PEOPLE MANAGEMENT (Accountadmin + Superadmin)
   ─────────────────────────────────────────────── */
let _allPeople = [];

async function loadAllPeople() {
  if (state.role !== 'Accountadmin' && state.role !== 'Superadmin') return;
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) {
    document.getElementById('people-list').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);">Supabase not configured.</div>';
    return;
  }

  let q = supabase
    .from('user_profiles')
    .select('id, email, role, status, account_id, accounts(name)')
    .order('email');

  if (state.role !== 'Superadmin') {
    const accountId = getEffectiveAccountId();
    if (!accountId) {
      document.getElementById('people-list').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--muted);">No account selected.</div>';
      return;
    }
    q = q.eq('account_id', accountId);
  } else if (state.viewAsAccountId) {
    q = q.eq('account_id', state.viewAsAccountId);
  }

  const { data, error } = await q;

  if (error) {
    console.error('Failed to load people:', error);
    document.getElementById('people-list').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);">Failed to load users.</div>';
    return;
  }

  _allPeople = data || [];
  renderPeopleList(_allPeople);
}

function filterPeopleTable() {
  const search = (document.getElementById('people-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('people-status-filter')?.value || 'all';
  const filtered = _allPeople.filter(u => {
    if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
    const haystack = [u.email, u.role, u.accounts?.name].filter(Boolean).join(' ').toLowerCase();
    return !search || haystack.includes(search);
  });
  renderPeopleList(filtered);
}

function renderPeopleList(people) {
  const list = document.getElementById('people-list');
  if (!list) return;

  if (!people.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No users found.</div>';
    return;
  }

  list.innerHTML = people.map(u => {
    const status = u.status || 'active';
    const accountName = u.accounts?.name || u.account_id || '—';
    const initials = (u.email || '?')[0].toUpperCase();
    return `
    <article class="account-row ${status === 'suspended' ? 'is-suspended' : ''}" data-uid="${u.id}">
      <button class="account-main" type="button" style="cursor:default;pointer-events:none;">
        <span class="account-avatar">${initials}</span>
        <span class="account-copy">
          <span class="account-name">${escapeHtml(u.email || '—')}</span>
          <span class="account-meta">${escapeHtml(accountName)} · ${escapeHtml(u.role || 'user')}</span>
        </span>
      </button>
      <div class="account-status">
        <span class="account-status-badge ${status === 'active' ? 'active' : 'suspended'}">${escapeHtml(status)}</span>
      </div>
      <div class="account-actions">
        <button class="btn-secondary account-action-primary" onclick="resetUserPassword('${u.id}')">Reset PW</button>
        ${status === 'active'
          ? `<button class="btn-secondary" onclick="setUserStatus('${u.id}', 'deactivate')">Deactivate</button>`
          : `<button class="btn-secondary" onclick="setUserStatus('${u.id}', 'activate')">Activate</button>`
        }
      </div>
    </article>`;
  }).join('');
}

async function resetUserPassword(userId) {
  const newPw = window.prompt('New password for user (min 8 chars):');
  if (!newPw || newPw.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }

  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { showToast('Session expired. Please refresh and try again.', 'error'); return; }
  const supaUrl = (window.ENV?.SUPABASE_URL) || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');

  const res = await fetch(`${supaUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'manage-user', action: 'reset-password', user_id: userId, new_password: newPw }),
  });
  const out = await res.json();
  if (!res.ok) { showToast(out.error || 'Failed to reset password', 'error'); return; }
  showToast('Password reset successfully', 'success');
}

async function setUserStatus(userId, action) {
  const label = action === 'activate' ? 'Activate' : 'Deactivate';
  if (!confirm(`${label} this user?`)) return;

  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { showToast('Session expired. Please refresh and try again.', 'error'); return; }
  const supaUrl = (window.ENV?.SUPABASE_URL) || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');

  const res = await fetch(`${supaUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'manage-user', action, user_id: userId }),
  });
  const out = await res.json();
  if (!res.ok) { showToast(out.error || `Failed to ${action} user`, 'error'); return; }
  showToast(`User ${action}d`, 'success');
  await loadAllPeople();
}

/* ───────────────────────────────────────────────
   ALERTS
   ─────────────────────────────────────────────── */
function renderAlerts() {
  const body = document.getElementById('alerts-body');
  if (!body) return;

  const badge = document.getElementById('alert-badge');
  if (badge) {
    const count = state.alerts.length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (state.alerts.length === 0) {
    body.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;">
        <div class="empty-icon" style="font-size:64px;margin-bottom:16px;">✨</div>
        <div class="empty-title" style="font-size:16px;font-weight:600;">All clear!</div>
        <div class="empty-sub" style="margin-top:8px;">No alerts at the moment. You're up to date.</div>
      </div>`;
    return;
  }

  body.innerHTML = state.alerts.map(alert => `
    <div class="alert-item ${alert.type}">
      <div class="alert-icon">${alert.type === 'error' ? '🔴' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
      <div class="alert-content">
        <div class="alert-title">${alert.title}</div>
        <div class="alert-message">${alert.message}</div>
        <a href="#" class="alert-link" onclick="event.preventDefault();showPage('${alert.link}');">${alert.linkText} →</a>
      </div>
      <button class="alert-dismiss" onclick="dismissAlert('${alert.id}')">✕</button>
    </div>
  `).join('');
}

function dismissAlert(alertId) {
  state.alerts = state.alerts.filter(a => a.id !== alertId);
  saveState();
  renderAlerts();
  showSuccess('Alert dismissed');
}

function updateAlertBadge() {
  const badge = document.getElementById('alert-badge');
  if (badge) {
    const count = state.alerts.length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

/* ───────────────────────────────────────────────
   AUDIT REPORT
   ─────────────────────────────────────────────── */
async function renderAudit() {
  // Mirror renderChecklist's fetch so the audit reflects the user's actual
  // ticks even when they open Audit Report directly (before visiting the
  // Checklist page) or on a fresh browser where localStorage is empty but
  // Supabase has the data.
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user?.id) {
    try {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('item_id, completed')
        .eq('user_id', state.user.id);
      if (!error && Array.isArray(data)) {
        data.forEach(item => { state.checks[item.item_id] = item.completed; });
        // Persist the freshly-loaded ticks so Dashboard / score widgets stay
        // in sync without an extra fetch.
        saveState();
      }
    } catch (err) {
      JARVIS_LOG.error('Audit', 'Load checklist from Supabase', err);
    }
  }

  // Only count the items that exist in the current CHECKLIST so legacy keys
  // from older builds don't skew total/done.
  const checklistIds = CHECKLIST.flatMap(s => s.items.map(i => i.id));
  const total = checklistIds.length;
  const done = checklistIds.filter(id => state.checks[id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const risk = pct >= 80 ? 'Low' : pct >= 50 ? 'Medium' : 'High';
  const riskClass = pct >= 80 ? 'low' : pct >= 50 ? 'medium' : 'high';
  const riskColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

  let recordsCount = (state.records || []).length;
  if (supabase && isSupabaseConfigured() && state.user?.id) {
    const { count, error } = await supabase
      .from('data_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', state.user.id);
    if (!error && typeof count === 'number') recordsCount = count;
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  let html = `
    <div class="audit-report">
      <div class="audit-header">
        <div class="audit-badge">📊 PDPA COMPLIANCE REPORT</div>
        <h1>${state.user.company || 'Your Company'}</h1>
        <p class="audit-meta">Generated on ${dateStr} by ${state.user.name || 'DPO'}</p>
      </div>

      <div class="audit-score-card">
        <div class="score-ring" style="--score:${pct}; --color:${riskColor}">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" stroke-width="8"/>
            <circle cx="50" cy="50" r="45" fill="none" stroke="${riskColor}" stroke-width="8" stroke-dasharray="${pct * 2.83} 283" stroke-linecap="round" transform="rotate(-90 50 50)"/>
          </svg>
          <div class="score-value">
            <span class="score-num">${pct}%</span>
            <span class="score-label">Score</span>
          </div>
        </div>
        <div class="score-details">
          <div class="score-item">
            <span class="score-item-num">${done}/${total}</span>
            <span class="score-item-label">Items Completed</span>
          </div>
          <div class="score-item">
            <span class="score-item-num">${recordsCount}</span>
            <span class="score-item-label">Data Records</span>
          </div>
          <div class="score-item risk-item" style="--risk-color:${riskColor}">
            <span class="score-item-num">${risk}</span>
            <span class="score-item-label">Risk Level</span>
          </div>
        </div>
      </div>

      <div class="audit-sections">`;

  CHECKLIST.forEach(section => {
    const doneCnt = section.items.filter(i => state.checks[i.id]).length;
    const sectionPct = Math.round((doneCnt / section.items.length) * 100);
    const sectionColor = sectionPct >= 80 ? '#22c55e' : sectionPct >= 50 ? '#f59e0b' : '#ef4444';

    html += `
      <div class="audit-section">
        <div class="audit-section-header">
          <h3>${section.section}</h3>
          <div class="audit-section-progress">
            <div class="progress-bar"><div class="progress-fill" style="width:${sectionPct}%;background:${sectionColor}"></div></div>
            <span>${doneCnt}/${section.items.length}</span>
          </div>
        </div>
        <ul class="audit-checklist">`;

    section.items.forEach(item => {
      const isDone = state.checks[item.id];
      html += `
        <li class="${isDone ? 'done' : ''}">
          <span class="check-icon">${isDone ? '✓' : '○'}</span>
          <span class="check-text">${item.q}</span>
          ${item.hint ? `<span class="check-hint">${item.hint}</span>` : ''}
        </li>`;
    });

    html += `</ul></div>`;
  });

  html += `
      </div>
      <div class="audit-footer">
        <p>This report was generated by DataRex PDPA Compliance Portal</p>
        <button class="btn-print" onclick="window.print()">🖨️ Print Report</button>
      </div>
    </div>`;

  document.getElementById('report-content').innerHTML = html;
}

/* ───────────────────────────────────────────────
   NAVIGATION SETTINGS
   ─────────────────────────────────────────────── */

function setUserLevel(level) {
  state.currentUserLevel = level;
  saveState();
  applyNavPermissions();
}

/* ───────────────────────────────────────────────
   GLOBAL EVENT LISTENERS
   ─────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const active = document.querySelector('.screen.active');
    if (active && active.id === 'screen-login') doLogin();
    if (active && active.id === 'screen-register') doRegister();
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => {
      if (m.id) closeModal(m.id);
      else m.classList.remove('open');
    });
  }
});

document.addEventListener('click', e => {
  if (e.target.classList?.contains('modal-overlay')) {
    const modalId = e.target.id;
    if (modalId) closeModal(modalId);
  }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Handle browser back/forward buttons
// TEMPORARILY DISABLED FOR DEBUGGING
// window.addEventListener('hashchange', () => {
//   const hash = window.location.hash.replace('#/', '');
//   if (!hash || hash === 'landing') {
//     goTo('screen-landing', true);
//   } else if (['login', 'onboarding'].includes(hash)) {
//     goTo('screen-' + hash, true);
//   } else {
//     if (state.isLoggedIn) {
//       goTo('screen-app', true);
//       showPage(hash, null, true);
//     } else {
//       goTo('screen-landing', true);
//     }
//   }
// });

// Global Error Handler for debugging
window.onerror = function(msg, url, line, col, error) {
  console.error("GLOBAL ERROR: ", msg, " at ", url, ":", line);
  return false;
};

// ─── CONSOLIDATED APP INITIALIZATION ─────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Create Debug Overlay
  document.body.insertAdjacentHTML('afterbegin', `
    <div id="jarvis-status" style="position:fixed; top:0; left:0; width:100%; height:3px; background:#e2e8f0; z-index:9999; overflow:hidden;">
      <div id="jarvis-progress" style="width:0%; height:100%; background:#2563eb; transition:width 0.3s ease;"></div>
    </div>
    <div id="jarvis-debug" style="position:fixed; bottom:10px; right:10px; background:rgba(15,23,42,0.9); color:#fff; font-size:10px; padding:8px 12px; border-radius:6px; z-index:9999; pointer-events:none; font-family:monospace; box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
      [JARVIS] Initializing...
    </div>
  `);

  const updateDebug = (msg, progress) => {
    console.log('[JARVIS] ' + msg);
    const debug = document.getElementById('jarvis-debug');
    const prog = document.getElementById('jarvis-progress');
    if (debug) debug.innerText = '[JARVIS] ' + msg;
    if (prog) prog.style.width = progress + '%';
  };

  try {
    updateDebug('Loading state...', 10);
    loadState();

    updateDebug('Loading core components...', 25);
    await loadAllPages();

    updateDebug('Initializing Auth...', 60);
    initAuthListener();

    updateDebug('Checking credentials...', 80);
    if (typeof checkAuth === 'function') checkAuth();

    updateDebug('System Ready.', 100);
    setTimeout(() => {
      document.getElementById('jarvis-status')?.remove();
      document.getElementById('jarvis-debug')?.remove();
    }, 2000);
  } catch (err) {
    updateDebug('ERROR: ' + err.message, 0);
    console.error('[JARVIS] Boot Error:', err);
  }

  // 1. Restore Hash Routing Logic
  window.addEventListener('hashchange', handleHashRoute);
  window.addEventListener('popstate', handleHashRoute);

  if (loadSession()) {
    launchApp();
  } else {
    handleHashRoute();
  }

  // 2. Attach Global Event Handlers
  document.addEventListener('click', (e) => {
    if (e.target.id === 'demo-btn' || e.target.closest('#demo-btn')) demoLogin();
    if (e.target.id === 'login-btn' || e.target.closest('#login-btn')) doLogin();
    if (e.target.id === 'finish-onboard' || e.target.closest('#finish-onboard')) finishOnboard();
  });

  const dpoForm = document.getElementById('dpo-form');
  if (dpoForm) dpoForm.addEventListener('submit', (e) => { e.preventDefault(); saveDPO(); });

  if (window.envLoaded) fillCredentials();
  else document.addEventListener('envReady', fillCredentials);
});

// ─── GLOBALIZED CORE FUNCTIONS (Extracted from listener) ───────

function handleHashRoute() {
  const raw = window.location.hash.replace('#/', '').replace('#', '');
  const hash = raw || 'landing';
  console.log("Routing to hash:", hash);

  const authScreens = ['landing', 'login', 'register', 'onboarding'];
  if (authScreens.includes(hash)) {
    goTo('screen-' + hash, true);
    return;
  }

  if (!state.isLoggedIn) {
    goTo('screen-landing', true);
    return;
  }

  goTo('screen-app', true);
  showPage(hash, null, true);
}

function fillCredentials() {
  const emailInput = document.getElementById('login-email');
  const pwInput = document.getElementById('login-password');
  if (window.ENV?.APP_EMAIL) {
    if (emailInput) emailInput.value = window.ENV.APP_EMAIL;
    if (pwInput) pwInput.value = window.ENV.APP_PASSWORD;
  }
}

async function loadAllSampleData() {
  if (!state.isLoggedIn) { showToast('Please login first', 'error'); return; }
  if (!confirm('Load sample data?')) return;

  const companyId = (typeof getCurrentOrgId === 'function') ? getCurrentOrgId() : state.user?.company;
  const accountId = getEffectiveAccountId();
  showToast('Loading sample data...', 'info');

  // Each entry: [tableName, seederFn, arg]
  // Tables that migrated from org_id → account_id receive accountId; others companyId.
  const seeders = [
    ['data_records',           seedDataRecordsToSupabase,          companyId],
    ['processing_activities',  seedProcessingActivitiesToSupabase, companyId],
    ['data_requests',          seedDataRequestsToSupabase,         accountId],
    ['breach_log',             seedBreachLogToSupabase,            accountId],
    ['dpia_assessments',       seedDPIAToSupabase,                 accountId],
    ['cross_border_transfers', seedCrossBorderToSupabase,          accountId],
    ['vendors',                seedVendorsToSupabase,              accountId],
    ['training_records',       seedTrainingToSupabase,             accountId],
    ['alerts',                 seedAlertsToSupabase,               accountId],
    ['cases',                  seedCasesToSupabase,                accountId],
    ['team_members',           seedTeamMembersToSupabase,          accountId],
    ['dpo',                    seedDPOToSupabase,                  companyId],
    ['documents',              seedDocumentsToSupabase,            companyId]
  ];

  const counts = {};
  let totalInserted = 0;
  for (const [table, fn, arg] of seeders) {
    try {
      const inserted = await fn(arg);
      counts[table] = inserted || 0;
      totalInserted += counts[table];
    } catch (err) {
      console.error(`[sample_data] ${table} seeder threw:`, err);
      counts[table] = 0;
    }
  }
  console.table(counts);
  showToast(`Sample data loaded (${totalInserted} new rows across ${seeders.length} tables)`, 'success');
}
window.loadAllSampleData = loadAllSampleData;


// Global click listener to close dropdowns
document.addEventListener('click', (e) => {
  if (!e.target.closest('.org-context')) {
    const dropdown = document.getElementById('org-dropdown');
    if (dropdown) dropdown.classList.remove('open');
  }
});
