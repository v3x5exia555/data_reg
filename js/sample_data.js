// sample_data.js — one-shot sample-data population for empty Supabase tables.
// Loaded after env.js / supabase-js. Each seed<Table>ToSupabase(companyId)
// is idempotent: if rows already exist for the supplied scope, it does nothing.
// Wire-up: js/app.js#loadAllSampleData calls every seeder; the existing
// "Load Sample Data" sidebar button drives that flow.

(function () {
  'use strict';

  // -- Sample row sets keyed by table name. Counts kept small (3-5) so the UI
  //    is non-empty without overwhelming demo views. Field names match the
  //    columns declared in supabase/migrations/*.sql.
  const SAMPLE_DATA = {
    data_records: [
      { data_type: 'Email address', purpose: 'Marketing communications', storage: 'Mailchimp', access_level: 'Marketing team', retention_months: 24, consent_obtained: true, note: 'Opt-in via website form' },
      { data_type: 'Phone number', purpose: 'Order updates',           storage: 'Internal CRM', access_level: 'Customer support', retention_months: 12, consent_obtained: true, note: 'SMS notifications' },
      { data_type: 'IC number',    purpose: 'Identity verification',   storage: 'Encrypted vault', access_level: 'Admin only', retention_months: 84, consent_obtained: true, note: 'KYC compliance' },
      { data_type: 'Address',      purpose: 'Delivery',                storage: 'Order DB', access_level: 'Logistics team', retention_months: 36, consent_obtained: true, note: 'Shipping records' }
    ],

    processing_activities: [
      { name: 'Customer onboarding', purpose: 'Account creation and KYC', nature: ['Collection', 'Storage'], who: ['Customers'], freq: 'Daily', storage: 'Cloud DB', legal: ['Consent', 'Contract'], data: ['Name', 'IC', 'Email'], recip: ['Internal'], gov: [], ret_type: 'Years', ret_years: 7, total: 1500, sensitive: 200, cross_border: false, country: '', safeguards: [] },
      { name: 'Marketing campaigns', purpose: 'Promotional outreach',    nature: ['Use', 'Sharing'],     who: ['Customers'], freq: 'Weekly', storage: 'Mailchimp', legal: ['Consent'], data: ['Email', 'Name'], recip: ['Mailchimp'], gov: [], ret_type: 'Years', ret_years: 2, total: 5000, sensitive: 0, cross_border: true, country: 'USA', safeguards: ['SCCs'] },
      { name: 'Payroll processing',  purpose: 'Employee compensation',   nature: ['Storage', 'Use'],     who: ['Employees'], freq: 'Monthly', storage: 'HR system', legal: ['Contract', 'Legal obligation'], data: ['Name', 'Bank account', 'IC'], recip: ['Bank', 'IRAS'], gov: ['IRAS'], ret_type: 'Years', ret_years: 5, total: 50, sensitive: 50, cross_border: false, country: '', safeguards: [] }
    ],

    data_requests: [
      { request_type: 'Access',     requester_name: 'John Tan',  requester_email: 'john@example.com',  description: 'Request to view all personal data on file', status: 'Completed' },
      { request_type: 'Correction', requester_name: 'Mary Lim',  requester_email: 'mary@example.com',  description: 'Update phone number to new mobile',         status: 'In Progress' },
      { request_type: 'Deletion',   requester_name: 'Alex Wong', requester_email: 'alex@example.com',  description: 'Withdraw marketing preferences and remove email', status: 'Pending' }
    ],

    breach_log: [
      { breach_type: 'Unauthorized Access',   description: 'Server breach affecting customer emails',  data_categories: ['Email', 'Phone'],         affected_count: 150, reported_to_authorities: true,  notified_affected: false, incident_date: '2026-03-15', resolution_status: 'Resolved' },
      { breach_type: 'Accidental Disclosure', description: 'Email sent to wrong recipient list',       data_categories: ['Name', 'Email'],          affected_count: 5,   reported_to_authorities: false, notified_affected: false, incident_date: '2026-04-01', resolution_status: 'Resolved' },
      { breach_type: 'Ransomware Attack',     description: 'Encrypted customer database',              data_categories: ['Name', 'IC', 'Address'], affected_count: 200, reported_to_authorities: false, notified_affected: true,  incident_date: '2026-04-20', resolution_status: 'Under Investigation' }
    ],

    dpia_assessments: [
      { activity_name: 'Customer Profiling',  description: 'AI-based product recommendations',     processing_purpose: 'Improve customer experience', is_necessary: true,  risk_level: 'Low',    mitigation_measures: 'Data minimization, anonymization', status: 'Approved' },
      { activity_name: 'Employee Monitoring', description: 'GPS tracking for delivery staff',      processing_purpose: 'Safety and efficiency',       is_necessary: false, risk_level: 'High',   mitigation_measures: 'Consent forms, limited access, retention 30 days', status: 'Pending Review' }
    ],

    cross_border_transfers: [
      { destination_country: 'Singapore', recipient_name: 'CloudTech Pte Ltd', data_categories: ['Name', 'Email'], transfer_purpose: 'Cloud hosting',   safeguards: 'SCCs, Encryption',          status: 'Active' },
      { destination_country: 'USA',       recipient_name: 'AWS Asia Pacific',  data_categories: ['All data types'], transfer_purpose: 'Cloud storage',   safeguards: 'Standard Contractual Clauses', status: 'Active' },
      { destination_country: 'India',     recipient_name: 'Support Center',    data_categories: ['Name', 'Phone'], transfer_purpose: 'Customer support', safeguards: 'DPA, Encryption',           status: 'Active' }
    ],

    vendors: [
      { vendor_name: 'AWS Singapore',    service_type: 'Cloud Hosting',   contact_email: 'support@aws.com',       data_processed: ['All data types'], has_dpa: true,  status: 'Active' },
      { vendor_name: 'Mailchimp',        service_type: 'Email Marketing', contact_email: 'support@mailchimp.com', data_processed: ['Email', 'Name'],  has_dpa: true,  status: 'Active' },
      { vendor_name: 'Salesforce Asia',  service_type: 'CRM',             contact_email: 'asia@salesforce.com',   data_processed: ['Customer data'], has_dpa: true,  status: 'Active' },
      { vendor_name: 'Twilio',           service_type: 'SMS Notifications', contact_email: 'support@twilio.com', data_processed: ['Phone'],         has_dpa: false, status: 'Inactive' }
    ],

    training_records: [
      { employee_name: 'John Tan',   training_type: 'PDPA Fundamentals',        training_date: '2026-01-15', status: 'Completed',   expires_at: '2027-01-15' },
      { employee_name: 'Mary Lim',   training_type: 'Data Protection Officer',  training_date: '2026-02-20', status: 'Completed',   expires_at: '2028-02-20' },
      { employee_name: 'Alex Wong',  training_type: 'Privacy Awareness',        training_date: '2026-03-10', status: 'Completed',   expires_at: '2027-03-10' },
      { employee_name: 'Sarah Chen', training_type: 'PDPA Fundamentals',        training_date: '2026-04-05', status: 'In Progress', expires_at: null }
    ],

    alerts: [
      { alert_type: 'Deadline',  title: 'Annual PDPA Review Due',   message: 'Your annual compliance review is due next month', priority: 'High',   due_date: '2026-12-31' },
      { alert_type: 'Training',  title: 'Staff Training Expiring',  message: 'John Tan PDPA certificate expires in 30 days',    priority: 'Medium', due_date: '2026-06-15' },
      { alert_type: 'Retention', title: 'Data Retention Review',    message: 'Review customer data older than retention period', priority: 'Low',   due_date: '2026-07-01' }
    ],

    cases: [
      { case_number: 'CASE-2026-001', case_type: 'Data Subject Request', description: 'Customer requests data deletion under PDPA',           status: 'Open',                priority: 'High',   assigned_to: 'Mary Lim' },
      { case_number: 'CASE-2026-002', case_type: 'Complaint',            description: 'Customer complaint about unauthorised marketing email', status: 'Under Investigation', priority: 'High',   assigned_to: 'John Tan' },
      { case_number: 'CASE-2026-003', case_type: 'Internal Audit',       description: 'Annual compliance audit',                              status: 'In Progress',         priority: 'Medium', assigned_to: 'Sarah Chen' }
    ],

    team_members: [
      { name: 'Mary Lim',   email: 'mary@acme.com',   role_department: 'DPO / Compliance',   access_level: 'Accountadmin' },
      { name: 'John Tan',   email: 'john@acme.com',   role_department: 'IT Security',        access_level: 'Editor' },
      { name: 'Sarah Chen', email: 'sarah@acme.com',  role_department: 'Customer Support',   access_level: 'Viewer' }
    ],

    dpo: [
      { name: 'Mary Lim', email: 'dpo@acme.com', phone: '+65 8123 4567', nationality: 'Singaporean', appointment_letter_url: '' },
      { name: 'John Tan', email: 'dpo2@acme.com', phone: '+65 8765 4321', nationality: 'Singaporean', appointment_letter_url: '' }
    ],

    documents: [
      { uploader_name: 'Mary Lim', name: 'Privacy Policy v2.pdf',          doc_type: 'pdf', category: 'Privacy Policy', file_size: 245760,  storage_path: '' },
      { uploader_name: 'John Tan', name: 'Consent Form Template.docx',     doc_type: 'docx', category: 'Consent Form',  file_size: 102400,  storage_path: '' },
      { uploader_name: 'Mary Lim', name: 'Vendor DPA Agreement.pdf',       doc_type: 'pdf', category: 'DPA',            file_size: 512000,  storage_path: '' }
    ]
  };

  // -- Idempotency: skip insert when ANY row already exists for the scope.
  async function alreadyHasRows(supabase, table, filterCol, filterVal) {
    const q = supabase.from(table).select('id', { count: 'exact', head: true });
    const filtered = filterCol ? q.eq(filterCol, filterVal) : q;
    const { count, error } = await filtered;
    if (error) {
      console.warn(`[sample_data] count check failed on ${table}:`, error.message);
      return false; // best-effort: try to seed
    }
    return (count || 0) > 0;
  }

  function getSb() {
    return (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
  }

  function configured() {
    return typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
  }

  // Generic insert helper. Returns inserted row count.
  async function seedTable(table, rows, scopeCol, scopeVal) {
    const supabase = getSb();
    if (!supabase || !configured()) {
      console.warn(`[sample_data] supabase not configured; skipping ${table}`);
      return 0;
    }
    if (await alreadyHasRows(supabase, table, scopeCol, scopeVal)) {
      console.log(`[sample_data] ${table} already populated for ${scopeCol}=${scopeVal}; skipping`);
      return 0;
    }
    const payload = rows.map(r => ({ ...r, [scopeCol]: scopeVal }));
    const { data, error } = await supabase.from(table).insert(payload).select();
    if (error) {
      console.error(`[sample_data] insert into ${table} failed:`, error.message);
      return 0;
    }
    console.log(`[sample_data] ${table}: inserted ${data?.length || 0} rows`);
    return data?.length || 0;
  }

  // -- Per-table seeders. Each accepts companyId (UUID for org_id, string for
  //    company_id, or null for user-scoped tables which fall back to state.user.id).
  async function seedDataRecordsToSupabase(_companyId) {
    const userId = (typeof state !== 'undefined' && state.user?.id) || null;
    if (!userId) { console.warn('[sample_data] data_records needs state.user.id'); return 0; }
    return seedTable('data_records', SAMPLE_DATA.data_records, 'user_id', userId);
  }

  async function seedProcessingActivitiesToSupabase(companyId) {
    const userId = (typeof state !== 'undefined' && state.user?.id) || null;
    if (!userId) { console.warn('[sample_data] processing_activities needs state.user.id'); return 0; }
    // processing_activities requires both user_id AND company_id; inject both.
    const supabase = getSb();
    if (!supabase || !configured()) return 0;
    if (await alreadyHasRows(supabase, 'processing_activities', 'company_id', String(companyId || ''))) {
      console.log('[sample_data] processing_activities already populated; skipping');
      return 0;
    }
    const payload = SAMPLE_DATA.processing_activities.map(r => ({
      ...r,
      user_id: userId,
      company_id: String(companyId || ''),
    }));
    const { data, error } = await supabase.from('processing_activities').insert(payload).select();
    if (error) { console.error('[sample_data] processing_activities insert failed:', error.message); return 0; }
    console.log(`[sample_data] processing_activities: inserted ${data?.length || 0} rows`);
    return data?.length || 0;
  }

  async function seedDataRequestsToSupabase(companyId) {
    return seedTable('data_requests', SAMPLE_DATA.data_requests, 'org_id', companyId);
  }

  async function seedBreachLogToSupabase(companyId) {
    return seedTable('breach_log', SAMPLE_DATA.breach_log, 'org_id', companyId);
  }

  async function seedDPIAToSupabase(companyId) {
    return seedTable('dpia_assessments', SAMPLE_DATA.dpia_assessments, 'org_id', companyId);
  }

  async function seedCrossBorderToSupabase(companyId) {
    return seedTable('cross_border_transfers', SAMPLE_DATA.cross_border_transfers, 'org_id', companyId);
  }

  async function seedVendorsToSupabase(companyId) {
    return seedTable('vendors', SAMPLE_DATA.vendors, 'org_id', companyId);
  }

  async function seedTrainingToSupabase(companyId) {
    return seedTable('training_records', SAMPLE_DATA.training_records, 'org_id', companyId);
  }

  async function seedAlertsToSupabase(companyId) {
    return seedTable('alerts', SAMPLE_DATA.alerts, 'org_id', companyId);
  }

  async function seedCasesToSupabase(companyId) {
    return seedTable('cases', SAMPLE_DATA.cases, 'org_id', companyId);
  }

  async function seedTeamMembersToSupabase(companyId) {
    return seedTable('team_members', SAMPLE_DATA.team_members, 'org_id', companyId);
  }

  async function seedDPOToSupabase(companyId) {
    return seedTable('dpo', SAMPLE_DATA.dpo, 'company_id', String(companyId || ''));
  }

  async function seedDocumentsToSupabase(_companyId) {
    const userId = (typeof state !== 'undefined' && state.user?.id) || null;
    if (!userId) { console.warn('[sample_data] documents needs state.user.id'); return 0; }
    return seedTable('documents', SAMPLE_DATA.documents, 'user_id', userId);
  }

  // Expose everything on window so app.js / loadAllSampleData can call them.
  window.SAMPLE_DATA = SAMPLE_DATA;
  window.seedDataRecordsToSupabase = seedDataRecordsToSupabase;
  window.seedProcessingActivitiesToSupabase = seedProcessingActivitiesToSupabase;
  window.seedDataRequestsToSupabase = seedDataRequestsToSupabase;
  window.seedBreachLogToSupabase = seedBreachLogToSupabase;
  window.seedDPIAToSupabase = seedDPIAToSupabase;
  window.seedCrossBorderToSupabase = seedCrossBorderToSupabase;
  window.seedVendorsToSupabase = seedVendorsToSupabase;
  window.seedTrainingToSupabase = seedTrainingToSupabase;
  window.seedAlertsToSupabase = seedAlertsToSupabase;
  window.seedCasesToSupabase = seedCasesToSupabase;
  window.seedTeamMembersToSupabase = seedTeamMembersToSupabase;
  window.seedDPOToSupabase = seedDPOToSupabase;
  window.seedDocumentsToSupabase = seedDocumentsToSupabase;
})();
