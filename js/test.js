// DataRex Feature Test Script
// Run this in browser console or use as a checklist

const tests = {
  // 1. Core Features
  core: {
    login: () => document.getElementById('login-email') ? true : false,
    loginBtn: () => document.getElementById('login-btn') ? true : false,
    logout: () => typeof doLogout === 'function' ? true : false,
  },
  
  // 2. Pages (should exist in HTML)
  pages: {
    dashboard: () => document.getElementById('page-dashboard') ? true : false,
    checklist: () => document.getElementById('page-checklist') ? true : false,
    companies: () => document.getElementById('page-companies') ? true : false,
    dataregister: () => document.getElementById('page-dataregister') ? true : false,
    consent: () => document.getElementById('page-consent') ? true : false,
    access: () => document.getElementById('page-access') ? true : false,
    retention: () => document.getElementById('page-retention') ? true : false,
    documents: () => document.getElementById('page-documents') ? true : false,
    audit: () => document.getElementById('page-audit') ? true : false,
  },
  
  // 3. JS Functions (should be defined)
  functions: {
    doLogin: () => typeof doLogin === 'function',
    doLogout: () => typeof doLogout === 'function',
    saveRecord: () => typeof saveRecord === 'function',
    savePerson: () => typeof savePerson === 'function',
    saveCompany: () => typeof saveCompany === 'function',
    switchOrg: () => typeof switchOrg === 'function',
    renderRegister: () => typeof renderRegister === 'function',
    renderCompanies: () => typeof renderCompanies === 'function',
    loadCompaniesFromSupabase: () => typeof loadCompaniesFromSupabase === 'function',
    loadConsentFromSupabase: () => typeof loadConsentFromSupabase === 'function',
    loadDataRequestsFromSupabase: () => typeof loadDataRequestsFromSupabase === 'function',
    loadBreachLogFromSupabase: () => typeof loadBreachLogFromSupabase === 'function',
    loadDPIAFromSupabase: () => typeof loadDPIAFromSupabase === 'function',
    loadCrossBorderFromSupabase: () => typeof loadCrossBorderFromSupabase === 'function',
    loadVendorsFromSupabase: () => typeof loadVendorsFromSupabase === 'function',
    loadTrainingFromSupabase: () => typeof loadTrainingFromSupabase === 'function',
    loadAlertsFromSupabase: () => typeof loadAlertsFromSupabase === 'function',
    loadCasesFromSupabase: () => typeof loadCasesFromSupabase === 'function',
  },
  
  // 4. DOM Elements (for modals)
  modals: {
    recordModal: () => document.getElementById('modal-record') ? true : false,
    companyModal: () => document.getElementById('modal-company') ? true : false,
    personModal: () => document.getElementById('modal-person') ? true : false,
  },
  
  // 5. State Check
  state: () => typeof state === 'object' && state !== null,
};

// Run all tests
function runTests() {
  let passed = 0;
  let failed = 0;
  const results = [];
  
  console.log('=== DataRex Feature Test ===\n');
  
  for (const [category, tests] of Object.entries(tests)) {
    if (category === 'state') continue;
    console.log(`\n--- ${category.toUpperCase()} ---`);
    
    for (const [name, fn] of Object.entries(tests)) {
      try {
        const result = fn();
        if (result) {
          console.log(`✓ ${name}`);
          passed++;
        } else {
          console.log(`✗ ${name}`);
          failed++;
        }
      } catch (e) {
        console.log(`✗ ${name}: ${e.message}`);
        failed++;
      }
    }
  }
  
  // Test state
  try {
    const st = state;
    console.log('\n--- STATE ---');
    console.log(`✓ state defined: ${typeof st === 'object'}`);
    console.log(`✓ isLoggedIn: ${st.isLoggedIn}`);
    console.log(`✓ user.company: ${st.user?.company}`);
    console.log(`✓ currentUserLevel: ${st.currentUserLevel}`);
    passed++;
  } catch (e) {
    console.log(`✗ state: ${e.message}`);
    failed++;
  }
  
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  return failed === 0;
}

// Export for browser console
if (typeof window !== 'undefined') {
  window.testDataRex = runTests;
  console.log('Run: testDataRex()');
}