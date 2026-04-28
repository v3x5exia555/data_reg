/* ============================================================
   app.js — DataRex PDPA Portal
   All application logic: state, navigation, rendering, events
   ============================================================ */

/* ───────────────────────────────────────────────
   STATE
   ─────────────────────────────────────────────── */
const state = {
  isLoggedIn: false,
  user: { name: 'Demo DPO', company: 'Acme Pte Ltd', email: 'dpo@acme.com' },
  bizType: null,
  currentUserLevel: 'Accountadmin',
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
  ]
};

// ─── LOCAL STORAGE PERSISTENCE ────────────────────────────────
function loadState() {
  const saved = localStorage.getItem('dataRexState');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge saved state into default state
      if (typeof parsed.isLoggedIn !== 'undefined') state.isLoggedIn = parsed.isLoggedIn;
      if (parsed.user) Object.assign(state.user, parsed.user);
      if (parsed.bizType) state.bizType = parsed.bizType;
      if (parsed.checks) Object.assign(state.checks, parsed.checks);
      if (parsed.records) state.records = parsed.records;
      if (parsed.team) state.team = parsed.team;
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
}
function saveState() {
  localStorage.setItem('dataRexState', JSON.stringify(state));
}
function switchOrg(company) {
  state.user.company = company;
  state.company = company;
  saveState();
  renderCompanies();
  renderRegister();
  renderDocuments();
  const selectEl = document.getElementById('company-select');
  if (selectEl) selectEl.value = company;
  showToast(`Switched to ${company}`, 'success');
}
// Pre-populate demo user if not exists
if (!localStorage.getItem('datarex_users')) {
  localStorage.setItem('datarex_users', JSON.stringify([
    { name: 'Demo DPO', company: 'Acme Pte Ltd', email: 'admin@datarex.com', password: 'Admin123!@#', industry: 'Technology', size: '11-50', regNo: '202001000001 (A)' }
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
        name: session.user.user_metadata?.name || session.user.email,
        company: session.user.user_metadata?.company || ''
      };
      saveState();
      
      if (document.getElementById('screen-app')) {
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

document.addEventListener('DOMContentLoaded', initAuthListener);

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
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) {
    renderConsent(); // Fallback to static data
    return;
  }
  
  const { data, error } = await supabase
    .from('consent_settings')
    .select('*')
    .order('category');
  
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
}

async function updateConsentDb(id, checked) {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { error } = await supabase
    .from('consent_settings')
    .update({ is_enabled: checked })
    .eq('id', id);
  
  if (error) {
    console.error('Update failed:', error);
    showToast('Failed to update consent', 'error');
  } else {
    showToast('Consent updated', 'success');
  }
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

function showPage(pageId, navEl, noPush) {
  document.querySelectorAll('.page-shell').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  
  if (!navEl) navEl = document.getElementById('nav-' + pageId);
  if (navEl) navEl.classList.add('active');
  
  if (pageId === 'audit') renderAudit();
  if (pageId === 'companies') loadCompaniesFromSupabase();
  if (pageId === 'consent') loadConsentFromSupabase();
  if (pageId === 'datarequests') loadDataRequestsFromSupabase();
  if (pageId === 'breachlog') loadBreachLogFromSupabase();
  if (pageId === 'dpiapage') loadDPIAFromSupabase();
  if (pageId === 'crossborder') loadCrossBorderFromSupabase();
  if (pageId === 'vendors') loadVendorsFromSupabase();
  if (pageId === 'training') loadTrainingFromSupabase();
  if (pageId === 'alerts') loadAlertsFromSupabase();
  if (pageId === 'cases') loadCasesFromSupabase();
  
  // Show/hide admin-only elements based on user level
  const isAdmin = state.currentUserLevel === 'Accountadmin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  
  if (!noPush) {
    history.pushState(null, '', '#/' + pageId);
  }
}

async function doLogout() {
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  state.isLoggedIn = false;
  state.user = { name: '', company: '', email: '' };
  saveState();
  goTo('screen-landing');
}

/* ───────────────────────────────────────────────
   AUTH: SHARED HELPERS
   ─────────────────────────────────────────────── */
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
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
  clearErrors('login-email', 'login-pw');
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;
  console.log('Email:', email);
  console.log('Password:', pw ? 'provided' : 'empty');

  if (!isValidEmail(email)) { showError('login-email'); console.log('Invalid email'); return; }
  if (!pw || pw.length < 4) { showError('login-pw'); console.log('Invalid password'); return; }

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

    // Use direct fetch since supabase client may not be initialized yet
    const SUPABASE_URL = 'https://xvjfosmzmfitrcivsgpu.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_faN2IaAJ6HGApHqzmbvVFQ_vdMleyGH';
    
    const url = `${SUPABASE_URL}/rest/v1/app_credentials?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(pw)}&is_active=eq.true&limit=1`;
    console.log('Calling API:', url);
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    const result = await response.json();
    console.log('API Result:', result);

    if (response.ok && result && result.length > 0) {
      data = result[0];
      console.log('Login SUCCESS (Supabase):', data.email);
    } else {
      // Try localStorage users
      const localUsers = JSON.parse(localStorage.getItem('datarex_users') || '[]');
      const localUser = localUsers.find(u => u.email === email && u.password === pw);
      if (localUser) {
        data = localUser;
        console.log('Login SUCCESS (local):', data.email);
      } else {
        console.log('Login FAILED - no data returned');
      }
    }

    btn.classList.remove('loading');
    btn.disabled = false;

    if (!data) {
      showError('login-pw');
      document.getElementById('login-pw-error').innerHTML =
        '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Invalid email or password.';
      console.log('=== LOGIN DEBUG END (FAILED) ===');
      return;
    }

    console.log('Creating session...');
    createSession(email);
    
    // Update state with user info from login
    if (data) {
      state.user = {
        name: data.name || data.company || 'User',
        company: data.company || 'My Company',
        email: email,
        industry: data.industry,
        companySize: data.size,
        regNo: data.regNo || '',
        id: 'user-' + Date.now()
      };
      saveState();
    }
    
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('login-footer').style.display = 'none';
    document.getElementById('login-success').classList.add('show');
    console.log('Launching app...');
    setTimeout(() => launchApp(), 1200);
    console.log('=== LOGIN DEBUG END (SUCCESS) ===');
  } catch (error) {
    btn.classList.remove('loading');
    btn.disabled = false;
    console.error('Login EXCEPTION:', error);
    console.log('=== LOGIN DEBUG END (ERROR) ===');
    showToast('Login failed. Please try again.', 'error');
  }
}

/* ───────────────────────────────────────────────
   AUTH: LOGOUT
   ─────────────────────────────────────────────── */
async function doLogout() {
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
function doRegister() {
  const name = document.getElementById('register-name').value.trim();
  const company = document.getElementById('register-company').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const pw = document.getElementById('register-password').value;
  const pwConfirm = document.getElementById('register-confirm').value;
  const industry = document.getElementById('register-industry').value;
  const size = document.getElementById('register-size').value;
  const regNo = document.getElementById('register-reg-no').value.trim();
  
  if (!name) { showToast('Please enter your name', 'error'); return; }
  if (!company) { showToast('Please enter company name', 'error'); return; }
  if (!industry) { showToast('Please select your industry', 'error'); return; }
  if (!size) { showToast('Please select company size', 'error'); return; }
  if (!isValidEmail(email)) { showToast('Please enter a valid email', 'error'); return; }
  if (!pw || pw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  if (pw !== pwConfirm) { showToast('Passwords do not match', 'error'); return; }
  
  // Save user data to localStorage for login validation
  const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
  const exists = users.find(u => u.email === email);
  if (exists) { showToast('Email already registered', 'error'); return; }
  
  users.push({ name, company, email, password: pw, industry, size, regNo });
  localStorage.setItem('datarex_users', JSON.stringify(users));
  
  // Set current user
  state.user = {
    name: name,
    company: company,
    email: email,
    industry: industry,
    companySize: size,
    regNo: regNo,
    id: 'user-' + Date.now()
  };
  state.isLoggedIn = true;
  saveState();
  
  showToast('Account created!', 'success');
  goTo('screen-onboarding');
}

function demoLogin()     { 
  createSession('admin@datarex.com');
  // Set demo user state with regNo
  state.user = {
    name: 'Demo DPO',
    company: 'Acme Pte Ltd',
    email: 'admin@datarex.com',
    industry: 'Technology',
    companySize: '11-50',
    regNo: '202001000001 (A)',
    id: 'demo-user'
  };
  saveState();
  launchApp(); 
}

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

  const firstName = state.user.name.split(' ')[0] || 'Demo';
  document.getElementById('sidebar-name').textContent   = state.user.name;
  document.getElementById('sidebar-org').textContent    = state.user.company;
  document.getElementById('sidebar-avatar').textContent = firstName[0].toUpperCase();
  document.getElementById('dash-name').textContent      = firstName;
  document.getElementById('dash-date').textContent =
    'Today is ' + new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + '.';

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
}

/* ───────────────────────────────────────────────
   SCORE & STATS
   ─────────────────────────────────────────────── */
function updateScore() {
  const total = Object.keys(state.checks).length;
  const done  = Object.values(state.checks).filter(Boolean).length;
  const pct   = Math.round((done / total) * 100);

  document.getElementById('score-display').textContent   = pct + '%';
  document.getElementById('score-bar').style.width       = pct + '%';
  document.getElementById('tasks-done-label').textContent = `${done} of ${total} tasks done`;
  document.getElementById('stat-completed').textContent   = done;
  document.getElementById('stat-pending').textContent     = total - done;
  document.getElementById('prog-label').textContent       = `${done} of ${total} done`;
  document.getElementById('prog-pct').textContent         = pct + '%';
  document.getElementById('prog-fill').style.width        = pct + '%';
  document.getElementById('glance-progress').textContent  = `${done}/${total} →`;

  const badge = document.getElementById('risk-badge');
  if (pct >= 80)      { badge.textContent = 'Low risk';    badge.className = 'badge badge-green'; }
  else if (pct >= 50) { badge.textContent = 'Medium risk'; badge.className = 'badge badge-amber'; }
  else                { badge.textContent = 'High risk';   badge.className = 'badge badge-red'; }
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
async function renderRegister() {
  const tbody = document.getElementById('register-body');
  tbody.innerHTML = '';
  
  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user.id) {
    const { data, error } = await supabase
      .from('data_records')
      .select('*')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      state.records = data.map(r => ({
        id: r.id,
        type: r.data_type,
        purpose: r.purpose || '',
        storage: r.storage || '',
        access: r.access_level || '',
        retention: r.retention_months || 12,
        consent: r.consent_obtained || false,
        note: r.note || ''
      }));
    }
  }
  
  state.records.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.type}</strong></td>
      <td style="color:var(--muted)">${r.purpose}</td>
      <td style="color:var(--muted)">${r.storage}</td>
      <td style="color:var(--muted)">${r.access}</td>
      <td style="color:var(--muted)">${r.retention} mo</td>
      <td><span class="badge ${r.consent ? 'badge-green' : 'badge-red'}">${r.consent ? 'Yes' : 'Missing'}</span></td>
      <td><button class="del-btn" onclick="deleteRecord(${i})" title="Delete">✕</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('glance-records').textContent = state.records.length + ' →';
}

async function deleteRecord(i) {
  const record = state.records[i];
  if (confirm(`Delete "${record?.type || 'this record'}"?`)) {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured() && state.user.id && record?.id) {
      await supabase.from('data_records').delete().eq('id', record.id);
    }
    state.records.splice(i, 1);
    saveState();
    renderRegister();
    renderConsent();
    renderRetention();
    showToast('Record deleted', 'success');
  }
}

/* ───────────────────────────────────────────────
   MODALS
   ─────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function saveRecord() {
  const type      = document.getElementById('rec-type').value.trim();
  const purpose   = document.getElementById('rec-purpose').value.trim();
  const storage   = document.getElementById('rec-storage').value.trim();
  const access    = document.getElementById('rec-access').value.trim();
  const retention = parseInt(document.getElementById('rec-retention').value) || 12;
  const consent   = document.getElementById('rec-consent').checked;
  const note      = document.getElementById('rec-note').value.trim();

  if (!type) {
    showToast('Please enter the type of data.', 'error');
    return;
  }

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user.id) {
    const { data, error } = await supabase.from('data_records').insert([{
      user_id: state.user.id,
      data_type: type,
      purpose: purpose,
      storage: storage,
      access_level: access,
      retention_months: retention,
      consent_obtained: consent,
      note: note
    }]).select().single();

    if (error) {
      console.error('Save error:', error);
      state.records.unshift({ type, purpose, storage, access, retention, consent, note });
      showToast('Record saved locally', 'success');
    } else if (data) {
      state.records.unshift({
        id: data.id,
        type, purpose, storage, access, retention, consent, note
      });
      showToast('Record saved!', 'success');
    }
  } else {
    state.records.push({ type, purpose, storage, access, retention, consent, note });
    showToast('Record saved locally', 'success');
  }
  
  saveState();
  renderRegister();
  renderConsent();
  renderRetention();
  closeModal('modal-record');
  ['rec-type','rec-purpose','rec-storage','rec-access','rec-note'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('rec-retention').value = '12';
  document.getElementById('rec-consent').checked = false;
}

async function saveCompany() {
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
      const { data, error } = await supabase.from('companies').insert([{
        name: name,
        industry: industry,
        country: country,
        dpo_name: dpo,
        reg_no: regNo
      }]).select().single();
      
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
        state.companies = state.companies || [];
        state.companies.push(data);
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
  const body = document.getElementById('companies-body');
  if (!body) return;
  
  // Get current company from state - handle multiple sources
  const currentCompanyName = state.user?.company || state.company || 'Acme Pte Ltd';
  const companies = state.companies || [{ name: 'Acme Pte Ltd', regNo: '202001000001 (A)', industry: 'General', country: 'Singapore', dpo_name: 'Demo DPO' }];
  
  const getSortIcon = (col) => {
    if (companiesSortCol !== col) return '↕';
    return companiesSortAsc ? '↑' : '↓';
  };
  
  body.innerHTML = companies.map(c => {
    const isCurrent = (c.name || '').toLowerCase() === (currentCompanyName || '').toLowerCase();
    return `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td style="font-family:monospace;font-size:13px;">${c.regNo || c.reg_no || '-'}</td>
      <td>${c.industry || '-'}</td>
      <td>${c.country || '-'}</td>
      <td>${c.dpo_name || 'Not assigned'}</td>
      <td>
        ${isCurrent ? '<span style="color:var(--blue);font-weight:500;">Active</span>' : `<button class="btn btn-outline btn-sm" onclick="switchOrg('${c.name}')">Switch</button>`}
      </td>
    </tr>
  `}).join('');
}

async function loadCompaniesFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');
  
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
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('data_requests')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to load data requests:', error);
    return;
  }
  
  renderDataRequests(data);
}

function renderDataRequests(requests) {
  const body = document.getElementById('datarequests-body');
  if (!body) return;
  
  if (!requests || requests.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-icon" style="font-size:64px;margin-bottom:16px;">📧</div><div class="empty-title" style="font-size:16px;font-weight:600;">No data requests yet</div><div class="empty-sub" style="margin-top:8px;">Track requests from individuals to access, correct, or delete their data.</div></div>';
    return;
  }
  
  const statusColors = { 'Pending': 'var(--amber)', 'In Progress': 'var(--blue)', 'Completed': 'var(--green)' };
  body.innerHTML = requests.map(r => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          <div style="font-weight:600;">${r.request_type} Request</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">${r.requester_name} · ${r.requester_email}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">${r.description}</div>
        </div>
        <span style="font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;background:${statusColors[r.status] || 'var(--border)'};color:white;">${r.status}</span>
      </div>
    </div>
  `).join('');
}

async function loadBreachLogFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('breach_log')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to load breach log:', error);
    return;
  }
  
  renderBreachLog(data);
}

function renderBreachLog(breaches) {
  const body = document.getElementById('breachlog-body');
  if (!body) return;
  
  if (!breaches || breaches.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-icon" style="font-size:64px;margin-bottom:16px;">⚠️</div><div class="empty-title" style="font-size:16px;font-weight:600;">No breaches recorded</div><div class="empty-sub" style="margin-top:8px;">Record data breaches for compliance reporting.</div></div>';
    return;
  }
  
  const statusColors = { 'Under Investigation': 'var(--amber)', 'Resolved': 'var(--green)', 'Pending': 'var(--red)' };
  body.innerHTML = breaches.map(b => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <div><strong>${b.breach_type}</strong></div>
        <span style="font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;background:${statusColors[b.resolution_status] || 'var(--border)'};color:white;">${b.resolution_status}</span>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-top:8px;">${b.description}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:8px;">Affected: ${b.affected_count} records · ${b.incident_date}</div>
    </div>
  `).join('');
}

async function loadDPIAFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('dpia_assessments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to load DPIA:', error);
    return;
  }
  
  renderDPIA(data);
}

function renderDPIA(dpiaItems) {
  const body = document.getElementById('dpiapage-body');
  if (!body) return;
  
  if (!dpiaItems || dpiaItems.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-icon" style="font-size:64px;margin-bottom:16px;">🔍</div><div class="empty-title" style="font-size:16px;font-weight:600;">No DPIA assessments</div><div class="empty-sub" style="margin-top:8px;">Conduct impact assessments for high-risk processing.</div></div>';
    return;
  }
  
  const riskColors = { 'Low': 'var(--green)', 'Medium': 'var(--amber)', 'High': 'var(--red)' };
  body.innerHTML = dpiaItems.map(d => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <div><strong>${d.activity_name}</strong></div>
        <span style="font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;background:${riskColors[d.risk_level] || 'var(--border)'};color:white;">${d.risk_level} Risk</span>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-top:8px;">${d.description}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:8px;">Status: ${d.status}</div>
    </div>
  `).join('');
}

async function loadCrossBorderFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('cross_border_transfers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to load cross border:', error);
    return;
  }
  
  renderCrossBorder(data);
}

function renderCrossBorder(transfers) {
  const body = document.getElementById('crossborder-body');
  if (!body) return;
  
  if (!transfers || transfers.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-icon" style="font-size:64px;margin-bottom:16px;">🌍</div><div class="empty-title" style="font-size:16px;font-weight:600;">No cross-border transfers</div><div class="empty-sub" style="margin-top:8px;">Track data transferred outside Malaysia.</div></div>';
    return;
  }
  
  body.innerHTML = transfers.map(t => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <div><strong>${t.destination_country}</strong></div>
        <span style="font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;background:var(--blue);color:white;">${t.status}</span>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-top:8px;">${t.recipient_name}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">Data: ${(t.data_categories || []).join(', ')}</div>
    </div>
  `).join('');
}

async function loadVendorsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('vendor_name');
  
  if (error) {
    console.error('Failed to load vendors:', error);
    return;
  }
  
  renderVendors(data);
}

function renderVendors(vendors) {
  const body = document.getElementById('vendors-body');
  if (!body) return;
  
  if (!vendors || vendors.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-icon" style="font-size:64px;margin-bottom:16px;">🤝</div><div class="empty-title" style="font-size:16px;font-weight:600;">No vendors yet</div><div class="empty-sub" style="margin-top:8px;">Manage third-party data processors.</div></div>';
    return;
  }
  
  body.innerHTML = vendors.map(v => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <div><strong>${v.vendor_name}</strong></div>
        <span style="font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;background:${v.has_dpa ? 'var(--green)' : 'var(--amber)'};color:white;">${v.has_dpa ? 'DPA' : 'No DPA'}</span>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-top:8px;">${v.service_type}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">Data: ${(v.data_processed || []).join(', ')}</div>
    </div>
  `).join('');
}

async function loadTrainingFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('training_records')
    .select('*')
    .order('training_date', { ascending: false });
  
  if (error) {
    console.error('Failed to load training:', error);
    return;
  }
  
  renderTraining(data);
}

function renderTraining(records) {
  const body = document.getElementById('training-body');
  if (!body) return;
  
  if (!records || records.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-icon" style="font-size:64px;margin-bottom:16px;">📚</div><div class="empty-title" style="font-size:16px;font-weight:600;">No training records</div><div class="empty-sub" style="margin-top:8px;">Track staff training on data protection.</div></div>';
    return;
  }
  
  const statusColors = { 'Completed': 'var(--green)', 'In Progress': 'var(--blue)' };
  body.innerHTML = records.map(t => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <div><strong>${t.employee_name}</strong></div>
        <span style="font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;background:${statusColors[t.status] || 'var(--border)'};color:white;">${t.status}</span>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-top:8px;">${t.training_type}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">${t.training_date} · Expires: ${t.expires_at || 'N/A'}</div>
    </div>
  `).join('');
}

async function loadAlertsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to load alerts:', error);
    return;
  }
  
  state.alerts = data;
  renderAlerts();
}

async function loadCasesFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return;
  
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to load cases:', error);
    return;
  }
  
  renderCases(data);
}

function renderCases(cases) {
  const body = document.getElementById('cases-body');
  if (!body) return;
  
  if (!cases || cases.length === 0) {
    body.innerHTML = '<div class="empty-state" style="padding:60px 20px;"><div class="empty-icon" style="font-size:64px;margin-bottom:16px;">📁</div><div class="empty-title" style="font-size:16px;font-weight:600;">No cases yet</div><div class="empty-sub" style="margin-top:8px;">Manage compliance cases and investigations.</div></div>';
    return;
  }
  
  const priorityColors = { 'High': 'var(--red)', 'Medium': 'var(--amber)', 'Low': 'var(--green)' };
  body.innerHTML = cases.map(c => `
    <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;">
        <div><strong>${c.case_number}</strong></div>
        <span style="font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px;background:${priorityColors[c.priority] || 'var(--border)'};color:white;">${c.priority}</span>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-top:8px;">${c.case_type}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px;">${c.description}</div>
      <div style="font-size:12px;margin-top:8px;">Status: ${c.status} · Assigned: ${c.assigned_to}</div>
    </div>
  `).join('');
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
  body.innerHTML = '';
  RETENTION_DATA.forEach(item => {
    const div = document.createElement('div');
    div.className = 'retention-item';
    div.innerHTML = `
      <div class="ret-info">
        <div class="ret-title">
          ${item.title}
          ${item.active
            ? '<span class="badge badge-green">Active</span>'
            : '<span class="badge" style="background:var(--bg);color:var(--muted)">Inactive</span>'}
        </div>
        <div class="ret-sub">${item.sub}</div>
      </div>
      <div class="ret-control">
        <input class="months-input" type="number" value="${item.months}" min="1" max="360">
        <span class="months-label">months</span>
      </div>`;
    body.appendChild(div);
  });
}

/* ───────────────────────────────────────────────
   DOCUMENTS
   ─────────────────────────────────────────────── */
function renderDocuments() {
  const listEl = document.getElementById('documents-list');
  const emptyEl = document.getElementById('documents-empty');
  
  if (!listEl) return;
  
  if (state.documents.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  
  if (emptyEl) emptyEl.style.display = 'none';
  
  listEl.innerHTML = state.documents.map((doc, i) => `
    <div class="doc-item">
      <div class="doc-icon">📄</div>
      <div class="doc-info">
        <div class="doc-name">${doc.name}</div>
        <div class="doc-meta">${doc.type} · ${formatFileSize(doc.size)} · ${formatDate(doc.uploadedAt)}</div>
      </div>
      <button class="doc-delete" onclick="deleteDocument(${i})">✕</button>
    </div>
  `).join('');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function handleFileUpload(event) {
  const fileInput = document.getElementById('file-input');
  const categorySelect = document.getElementById('doc-category');
  const files = fileInput.files;
  if (!files.length) {
    showToast('Please select a file to upload', 'warning');
    return;
  }

  const supabase = getSupabaseClient();
  const category = categorySelect.value;
  const uploaderName = state.user.name;

  showToast(`Uploading ${files.length} file(s)...`, 'info');

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const storagePath = `${state.user.id}/${uniqueName}`;

    let storageUrl = null;

    if (supabase && isSupabaseConfigured()) {
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        showToast(`Failed to upload ${file.name}`, 'error');
        continue;
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
      storageUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from('documents').insert({
        user_id: state.user.id,
        uploader_name: uploaderName,
        name: file.name,
        doc_type: getDocType(file.name),
        category: category,
        file_size: file.size,
        storage_path: storagePath
      });

      if (dbError) {
        console.error('Database save error:', dbError);
        showToast(`File saved but metadata failed for ${file.name}`, 'warning');
      }
    }

    const doc = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      uploader: uploaderName,
      name: file.name,
      type: getDocType(file.name),
      category: category,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      storagePath: storageUrl
    };

    state.documents.push(doc);
  }

  saveState();
  renderDocuments();
  showSuccess(`${files.length} file(s) uploaded successfully!`);
  fileInput.value = '';
}

function getDocType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    pdf: 'PDF Document',
    doc: 'Word Document', docx: 'Word Document',
    xls: 'Excel Spreadsheet', xlsx: 'Excel Spreadsheet',
    png: 'Image', jpg: 'Image', jpeg: 'Image'
  };
  return types[ext] || 'Other Document';
}

async function renderDocuments() {
  const listEl = document.getElementById('documents-list');
  const emptyEl = document.getElementById('documents-empty');
  const countEl = document.getElementById('doc-count');
  const filterCat = document.getElementById('doc-filter')?.value || '';

  if (!listEl) return;

  const supabase = getSupabaseClient();
  let docs = [];

  if (supabase && isSupabaseConfigured() && state.user.id) {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false });

    if (filterCat) {
      query = query.eq('category', filterCat);
    }

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
        storagePathRaw: r.storage_path
      }));
      state.documents = docs;
    }
  } else {
    docs = filterCat ? state.documents.filter(d => d.category === filterCat) : state.documents;
  }

  if (countEl) countEl.textContent = `${docs.length} document${docs.length !== 1 ? 's' : ''}`;

  if (docs.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = docs.map(doc => `
    <div class="doc-item" data-doc-id="${doc.id}">
      <div class="doc-icon">${getDocIcon(doc.type)}</div>
      <div class="doc-info">
        <div class="doc-name">${doc.name}</div>
        <div class="doc-meta">
          <span class="doc-cat-badge">${doc.category || 'Other'}</span>
          ${doc.size ? `<span>${formatFileSize(doc.size)}</span>` : ''}
          <span>${formatDate(doc.uploadedAt)}</span>
          <span>by ${doc.uploader || 'Unknown'}</span>
        </div>
      </div>
      <div class="doc-actions">
        ${doc.storagePath ? `<a href="${doc.storagePath}" target="_blank" class="doc-download" title="Download">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>` : ''}
        <button class="doc-delete" onclick="deleteDocument('${doc.id}')" title="Delete">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function getDocIcon(type) {
  if (type?.includes('PDF')) return '📕';
  if (type?.includes('Word')) return '📘';
  if (type?.includes('Excel') || type?.includes('Spreadsheet')) return '📗';
  if (type?.includes('Image')) return '🖼️';
  return '📄';
}

async function deleteDocument(docId) {
  if (!confirm('Delete this document?')) return;

  const supabase = getSupabaseClient();
  const doc = state.documents.find(d => d.id === docId);

  if (supabase && isSupabaseConfigured()) {
    if (doc?.storagePathRaw) {
      await supabase.storage.from('documents').remove([doc.storagePathRaw]);
    }
    await supabase.from('documents').delete().eq('id', docId);
  }

  state.documents = state.documents.filter(d => d.id !== docId);
  saveState();
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
  const uploaderName = state.user.name;
  let uploadedCount = 0;

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const storagePath = `${state.user.id}/${uniqueName}`;

    if (supabase && isSupabaseConfigured()) {
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        showToast(`Failed: ${file.name}`, 'error');
        continue;
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);

      const { error: dbError } = await supabase.from('documents').insert({
        user_id: state.user.id,
        uploader_name: uploaderName,
        name: file.name,
        doc_type: getDocType(file.name),
        category: category,
        file_size: file.size,
        storage_path: storagePath
      });

      if (dbError) {
        console.error('DB error:', dbError);
        showToast(`Saved locally: ${file.name}`, 'warning');
      }

      uploadedCount++;
    }
  }

  state.documents = [];
  saveState();
  await renderDocuments();
  showSuccess(`${uploadedCount} file(s) uploaded!`);
  fileInput.value = '';
}

/* ───────────────────────────────────────────────
   NAVIGATION PERMISSIONS
   ─────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', section: 'Overview' },
  { id: 'checklist', label: 'Checklist', section: 'Overview' },
  { id: 'datasources', label: 'Data Sources', section: 'Foundation' },
  { id: 'dataregister', label: 'Data Register', section: 'Foundation' },
  { id: 'consent', label: 'Consent', section: 'Foundation' },
  { id: 'access', label: 'Access Control', section: 'Foundation' },
  { id: 'retention', label: 'Retention', section: 'Foundation' },
  { id: 'datarequests', label: 'Data Requests', section: 'Operations' },
  { id: 'breachlog', label: 'Breach Log', section: 'Operations' },
  { id: 'dpiapage', label: 'DPIA', section: 'Operations' },
  { id: 'crossborder', label: 'Cross-border', section: 'Operations' },
  { id: 'vendors', label: 'Vendors', section: 'Operations' },
  { id: 'training', label: 'Training', section: 'Operations' },
  { id: 'documents', label: 'Documents', section: 'Records' },
  { id: 'audit', label: 'Audit Report', section: 'Records' },
  { id: 'alerts', label: 'Alerts', section: 'Monitoring', hasBadge: true },
  { id: 'cases', label: 'Cases', section: 'Monitoring' },
  { id: 'monitoring', label: 'Monitoring', section: 'Monitoring' }
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
  
  NAV_ITEMS.forEach(item => {
    const navEl = document.getElementById('nav-' + item.id);
    if (navEl) {
      navEl.style.display = (savedConfig && savedConfig[item.id] === false) ? 'none' : '';
    }
  });
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

  const permissions = {
    Dashboard: document.getElementById('perm-dashboard').checked,
    Checklist: document.getElementById('perm-checklist').checked,
    DataRegister: document.getElementById('perm-dataregister').checked,
    DataSources: document.getElementById('perm-datasources').checked,
    Consent: document.getElementById('perm-consent').checked,
    Retention: document.getElementById('perm-retention').checked
  };

  const supabase = getSupabaseClient();
  if (supabase && isSupabaseConfigured() && state.user.id) {
    const { data, error } = await supabase.from('team_members').insert([{
      org_id: state.user.id,
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
    state.team.push({ name, role: role || 'Team member', level: access, permissions });
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
  if (supabase && isSupabaseConfigured() && state.user.id) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('org_id', state.user.id)
      .order('created_at', { ascending: false });
    
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
function renderAudit() {
  const total = Object.keys(state.checks).length;
  const done = Object.values(state.checks).filter(Boolean).length;
  const pct = Math.round((done / total) * 100);
  const risk = pct >= 80 ? 'Low' : pct >= 50 ? 'Medium' : 'High';
  const riskClass = pct >= 80 ? 'low' : pct >= 50 ? 'medium' : 'high';
  const riskColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  
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
            <span class="score-item-num">${state.records.length}</span>
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
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Auto-login & Routing check on boot
if (state.isLoggedIn) {
  setTimeout(() => launchApp(), 50);
} else {
  setTimeout(() => {
    const hash = window.location.hash.replace('#/', '');
    if (hash === 'login') {
      goTo('screen-' + hash, true);
    }
  }, 50);
}

// Handle browser back/forward buttons
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#/', '');
  if (!hash || hash === 'landing') {
    goTo('screen-landing', true);
  } else if (['login', 'onboarding'].includes(hash)) {
    goTo('screen-' + hash, true);
  } else {
    if (state.isLoggedIn) {
      goTo('screen-app', true);
      showPage(hash, null, true);
    } else {
      goTo('screen-landing', true);
    }
  }
});

// Credentials auto-fill and session check on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing session
  if (loadSession()) {
    launchApp();
    return;
  }

  // Demo button
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', () => demoLogin());
  }

  // Login button
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => doLogin());
  }

  // Finish onboarding
  const finishBtn = document.getElementById('finish-onboard');
  if (finishBtn) {
    finishBtn.addEventListener('click', () => finishOnboard());
  }

  // Auto-fill credentials from ENV when available
  function fillCredentials() {
    if (window.ENV?.APP_EMAIL) {
      const emailInput = document.getElementById('login-email');
      const pwInput = document.getElementById('login-password');
      if (emailInput) emailInput.value = window.ENV.APP_EMAIL;
      if (pwInput) pwInput.value = window.ENV.APP_PASSWORD;
    }
  }

  if (window.envLoaded) {
    fillCredentials();
  } else {
    document.addEventListener('envReady', fillCredentials);
  }
});
