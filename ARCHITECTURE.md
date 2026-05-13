# DataRex — PDPA Compliance Portal: Full Stack Architecture

## 1. Overview

DataRex is a **static SPA** (Single Page Application) that provides PDPA compliance management. It uses **Supabase** as its backend (Auth, PostgreSQL database, Edge Functions, Storage) and runs on two production targets: a **VPS** (self-hosted HTTP server) and **Hostinger** shared hosting (Apache/Nginx).

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla JavaScript (no framework), HTML5, CSS3 |
| **Font / Icons** | Inter (Google Fonts), Font Awesome 6 |
| **Backend** | Supabase (PostgreSQL 17, Auth, Edge Functions, Storage) |
| **Edge Functions** | Deno (TypeScript) — `create-user` function |
| **Auth** | Supabase Auth (email/password) + localStorage fallback |
| **State** | In-memory `state` object + localStorage persistence |
| **Document Upload** | PHP (`upload.php`) for Hostinger file uploads |
| **Testing** | Python pytest + Playwright (E2E) |
| **Deployment** | rsync + sshpass to VPS and Hostinger |

---

## 3. Project Structure

```
data-reg/
├── index.html                 # Main entry point (sidebar layout, script tags)
├── modals.html                # All modal dialogs (loaded dynamically)
├── env.json                   # Supabase credentials (SUPABASE_URL, ANON_KEY)
├── upload.php                 # PHP file upload handler for Hostinger
├── start.sh                   # Local dev server (python3 -m http.server 8060)
│
├── css/
│   └── style.css              # All styles (5177 lines — design tokens + components)
│
├── js/
│   ├── app.js                 # Core application logic (6026 lines)
│   ├── env.js                 # Loads env.json into window.ENV
│   ├── superadmin_logic.js    # Superadmin account/people management (view-as)
│   ├── dpo_logic.js           # DPO appointment management
│   ├── vendor_logic.js        # Vendor management CRUD
│   ├── training_logic.js      # Training records CRUD
│   ├── activities_logic.js    # Processing activities CRUD
│   ├── sample_data.js         # Sample data seeder
│   └── test.js                # Test utilities
│
├── pages/
│   ├── auth__landing.html     # Landing/splash page
│   ├── auth__login.html       # Login form (pre-filled admin@datarex.com)
│   ├── auth__register.html    # Registration form
│   ├── auth__onboarding.html  # Onboarding flow
│   ├── 00__dashboard.html     # Main dashboard
│   ├── 01__checklist.html     # Compliance checklist
│   ├── 02__companies.html     # Company management
│   ├── 03__datasources.html   # Data sources overview
│   ├── 04__dataregister.html  # Data register (personal data inventory)
│   ├── 05__consent.html       # Consent management
│   ├── 06__access.html        # Access control (team members, nav permissions)
│   ├── 06__crossborder.html   # Cross-border data transfers
│   ├── 07__retention.html     # Retention policy management
│   ├── 07__vendors.html       # Vendor management
│   ├── 08__dpo.html           # DPO & Governance
│   ├── 08__training.html      # Training records
│   ├── 09__datarequests.html  # Data subject requests
│   ├── 10__breachlog.html     # Breach management
│   ├── 11__dpiapage.html      # DPIA screening
│   ├── 11__deica.html         # DPIA Workflow (DEICA methodology)
│   ├── 12__crossborder.html   # (legacy)
│   ├── 13__vendors.html       # (legacy)
│   ├── 14__training.html      # (legacy)
│   ├── 15__documents.html     # Document management
│   ├── 16__audit.html         # Audit report
│   ├── 17__alerts.html        # Alerts
│   ├── 18__cases.html         # Cases
│   ├── 19__monitoring.html    # Risk monitoring
│   ├── 20__accounts.html      # Account management (Superadmin)
│   ├── 21__processing.html    # Processing activities
│   └── 22__people.html        # People management (Superadmin)
│
├── supabase/
│   ├── config.toml            # Supabase local config
│   ├── migrations/            # 48 migrations (database schema evolution)
│   ├── functions/
│   │   └── create-user/
│   │       └── index.ts       # Edge function (3 modes: account, user, manage-user)
│   └── .temp/                 # Linked project metadata
│
├── docs/
│   ├── deployment-ssh-workflow.md
│   ├── ER_DIAGRAM.md
│   ├── supabase-migration-pipeline.md
│   ├── multi-tenant-smoke.md
│   ├── alert_requirements.md
│   └── superpowers/
│
├── deploy-hostinger.sh        # Rsync deploy to Hostinger
├── deploy-uat.sh              # UAT test runner
├── pytest.ini                 # Pytest configuration
├── run_tests.py               # Test runner
├── test_*.py                  # 10 test files (API + E2E)
└── .gitignore
```

---

## 4. Architecture

### 4.1 Frontend SPA

The app is a **vanilla JS SPA**. There is no framework (React, Vue, etc.). The flow:

1. **`index.html`** is loaded — it contains the sidebar layout shell and all `<script>` tags.
2. **`env.js`** runs first, fetching `env.json` to populate `window.ENV` with Supabase credentials.
3. **`app.js`** runs as the main orchestrator (~6026 lines):
   - Calls `loadAllPages()` which fetches all `pages/*.html` fragments via `fetch()` and appends them to the DOM.
   - Pages are hidden/shown via CSS class `.active`.
   - Modal dialogs (`modals.html`) are loaded into `#modal-container`.
4. Navigation uses `showPage(pageId)` which:
   - Checks role-based hard blocks (`ROLE_HARD_BLOCKS`).
   - Checks nav permissions from `state.navPermissions`.
   - Hides all pages, shows the target page.
   - Triggers page-specific data loaders (e.g., `loadVendorsFromSupabase()`).
   - Updates URL hash (`#/pageId`).

### 4.2 State Management

A global `state` object holds all application state:

```js
const state = {
  isLoggedIn: false,
  user: { name, company, email, id, ... },
  role: null,           // 'Superadmin' | 'Accountadmin' | 'user'
  accountId: null,      // UUID from user_profiles
  viewAsAccountId: null,// Superadmin override
  navPermissions: null, // { role: { pageId: true/false } }
  session: { sessionId, token, createdAt, expiresAt },
  documents: [],
  alerts: [],
  dataRequests: [],
  vendors: [],
  trainingRecords: [],
  dpoRecords: [],
  processingActivities: [],
  dpiaItems: [],
  breachLog: [],
  crossBorderTransfers: [],
  cases: [],
  optouts: [],
  // ...more
};
```

State is persisted to `localStorage` key `dataRexState` via `saveState()` / `loadState()`.

### 4.3 Page Loading

`PAGES_TO_LOAD` array defines which pages to fetch at startup:

```js
const PAGES_TO_LOAD = [
  'auth__landing', 'auth__login', 'auth__register', 'auth__onboarding',
  '00__dashboard', '01__checklist', '02__companies', '03__datasources',
  '04__dataregister', '05__consent', '06__access', '07__retention',
  '07__vendors', '08__dpo', '08__training', '09__datarequests',
  '10__breachlog', '11__dpiapage', '11__deica', '06__crossborder',
  '15__documents', '16__audit', '17__alerts', '18__cases',
  '19__monitoring', '21__processing', '20__accounts', '22__people'
];
```

Pages are fetched via `fetch('pages/{pageId}.html?v={version}')`, scripts are stripped, and elements are appended to the DOM. Auth pages go into `#app`, app pages into `#main-content-area`.

### 4.4 Data Flow

Data flows in two modes:

**Supabase mode** (production):
- User logs in via `supabase.auth.signInWithPassword()`.
- Profile is fetched from `user_profiles` table.
- All CRUD operations hit Supabase REST API via `supabase.from(table).select/insert/update/upsert/delete()`.
- Supabase RLS policies enforce multi-tenant isolation.

**localStorage mode** (demo/fallback):
- User data stored in `datarex_users` localStorage key.
- Documents stored in `datarex_documents`.
- Login validates against stored password hashes (SHA-256).
- Used when Supabase is unavailable or user has no auth account.

### 4.5 CSS Design System

The CSS (`style.css`, 5177 lines) uses CSS custom properties (design tokens):

```css
:root {
  --primary:        #007bff;
  --primary-dark:   #0056b3;
  --primary-light:  #e3f2fd;
  --bg:             #f8fafc;
  --bg-card:        #ffffff;
  --border:         #e2e8f0;
  --text:           #1e293b;
  --text-muted:     #64748b;
  --success:        #10b981;
  --warning:        #f59e0b;
  --danger:         #ef4444;
  --sidebar-w:      260px;
  --font:           'Inter', sans-serif;
  --mono:           'SF Mono', monospace;
  /* radius scale, spacing scale */
}
```

Components: metric-card, stat-card, data-table, modal, toast, sidebar-nav, auth-card, form-input, toggle, badge, etc.

---

## 5. Authentication & Roles

### 5.1 Login Flow

1. `doLogin()` reads email/password from the login form.
2. Attempts `supabase.auth.signInWithPassword()`.
3. If Supabase fails, falls back to `datarex_users` localStorage check.
4. On success, calls `createSession(email)` and fetches `user_profiles` row.
5. Sets `state.role`, `state.accountId`, loads nav permissions.
6. Calls `launchApp()` which shows the sidebar and navigates to dashboard.

### 5.2 Roles

| Role | Description | Hard-Blocked Pages |
|------|-------------|-------------------|
| **Superadmin** | Full access to everything, can view-as any account | none |
| **Accountadmin** | Manages one account (team, settings) | none |
| **useradmin** | Limited admin (no company/account management) | companies, accounts, people |
| **security_user** | Security-focused (no companies/accounts/people) | companies, accounts, people |
| **user** | Basic user (data input only) | access, companies, accounts, people |

Hard blocks defined in `ROLE_HARD_BLOCKS`:
```js
const ROLE_HARD_BLOCKS = {
  user:          new Set(['access', 'companies', 'accounts', 'people']),
  security_user: new Set(['companies', 'accounts', 'people']),
  useradmin:     new Set(['companies', 'accounts', 'people']),
};
```

### 5.3 Nav Permissions (Configurable)

Admins can configure which nav items are visible per role via the Access Control page. Settings are stored in the `nav_permissions` table, scoped by `account_id`.

The `loadNavPermissionsFromDB(role)` function fetches permissions from Supabase, and `applyNavPermissions()` hides nav items based on both hard blocks and configurable settings.

### 5.4 Demo Login

`demoLogin()` creates a local session for `admin@datarex.com` with hardcoded user data. It does NOT use Supabase Auth — purely localStorage mode with hash `Admin123!@#`.

### 5.5 Seeded Accounts

| Email | Password | Role |
|-------|----------|------|
| `superadmin@datarex.com` | `DataRex@2026!` | Superadmin |
| `admin@datarex.com` | `AccountAdmin123!` | Accountadmin |
| (registration) | user-defined | user |

---

## 6. Database (PostgreSQL 17 — Supabase)

### 6.1 Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `accounts` | Multi-tenant accounts | id, name, seat_limit, accountadmin_user_id |
| `user_profiles` | User roles & account membership | id (FK auth.users), email, role, account_id, status |
| `companies` | Companies within an account | id, name, account_id, reg_no, dpo_name |
| `nav_permissions` | Configurable nav visibility per role | account_id, access_level, nav_item, is_visible |

### 6.2 Data Tables (all scoped by account_id)

| Table | Purpose |
|-------|---------|
| `data_records` | Personal data inventory |
| `documents` | Uploaded compliance documents |
| `breach_log` | Data breach incidents |
| `dpia_assessments` | DPIA screening assessments |
| `data_requests` | Data subject access requests |
| `cross_border_transfers` | Cross-border data transfers |
| `vendors` | Third-party vendor management |
| `training_records` | Employee training records |
| `alerts` | Compliance alerts |
| `cases` | Investigation cases |
| `consent_settings` | Consent management settings |
| `dpo` | DPO appointment records |
| `processing_activities` | Processing activity records |
| `system_logs` | JARVIS audit logging |
| `team_members` | Legacy team table |
| `retention_rules` | Data retention rules |
| `app_credentials` | Application credentials |

### 6.3 RLS Strategy

All tenant-scoped tables have RLS policies that check `account_id` against the requesting user's `user_profiles.account_id`. Superadmin bypasses this restriction and can see all accounts.

Key policies:
- **Accountadmin**: Can CRUD only their own account's data
- **user**: Can SELECT only their own account's data
- **Superadmin**: Full access across all accounts

The `nav_permissions` table uses account-scoped policies with `account_id` FK.

### 6.4 Migration Pipeline

48 migrations in `supabase/migrations/` track schema evolution. Key milestones:
- `20260426*` — Initial schema (users, roles, data_records)
- `20260427*` — Documents, credentials, RLS setup
- `20260428*` — Companies, additional tables
- `20260508*` — Multi-tenant rewrite (accounts table, account_id columns)
- `20260509*` — Superadmin creation, RLS lockdown, auto-create profile trigger
- `20260512*` — Seat limits, orphaned profile fixes
- `20260513*` — Nav permissions account-scoped, admin@datarex.com promotion

Apply via: `supabase db push`

---

## 7. Edge Function: `create-user`

**Location:** `supabase/functions/create-user/index.ts`

**Three modes:**

1. **`mode: 'account'`** (Superadmin only)
   - Creates a new `accounts` row
   - Creates `auth.users` entry
   - Upserts `user_profiles` with `role='Accountadmin'`
   - Wires `accountadmin_user_id` on the account
   - Creates default company + consent settings
   - Returns `{ account_id, user_id, email, temp_password }`

2. **`mode: 'user'`** (Accountadmin or Superadmin)
   - Checks seat limit on the account
   - Creates `auth.users` entry
   - Upserts `user_profiles` with specified role
   - Returns `{ user_id, email, temp_password }`

3. **`mode: 'manage-user'`** (Admin only, not self)
   - `reset-password` — Updates password
   - `activate` — Unbans user, sets status='active'
   - `deactivate` — Bans user (~100 years), sets status='suspended'
   - `delete` — Deletes profile then auth user
   - `update` — Updates role/first_name/last_name

---

## 8. Key JavaScript Modules

### `js/app.js` (6026 lines)
The brain of the application. Contains:
- JARVIS logging system (Supabase `system_logs` table)
- State management (`state` object, `saveState()`, `loadState()`)
- Page loading and navigation (`loadAllPages()`, `showPage()`)
- Auth flows (`doLogin()`, `demoLogin()`, `doLogout()`, `doRegister()`)
- Session management (`createSession()`, `loadSession()`, `clearSession()`)
- Supabase client helpers (`getSupabaseClient()`, `isSupabaseConfigured()`)
- Toast notifications (`showToast()`)
- Data CRUD for: records, companies, consent, data requests, breach log, DPIA, cross-border, alerts, cases, retention, documents
- Access control (`updateModalPermissions()`, `applyNavPermissions()`, `loadNavPermissionsFromDB()`)
- Team management (`renderTeam()`, `savePerson()`, `saveEditTeamMember()`, `editSeatLimit()`)
- Dashboard rendering (`loadDashboardFromSupabase()`)
- `getEffectiveAccountId()` — returns `viewAsAccountId` for Superadmin or `accountId` for others

### `js/env.js`
Fetches `env.json` and sets `window.ENV` with Supabase credentials and initializes `supabaseClient`.

### `js/superadmin_logic.js`
Superadmin-specific features: view-as-account, account management, people management.

### `js/dpo_logic.js`
DPO appointment CRUD — create, edit, delete DPO records with Supabase.

### `js/vendor_logic.js`
Vendor management CRUD — add/edit/delete vendors with risk ratings.

### `js/training_logic.js`
Training records CRUD — employee training tracking with expiry dates.

### `js/activities_logic.js`
Processing activities CRUD — data processing activity register.

### `js/sample_data.js`
Sample data generator that populates all tables with demo data for testing.

---

## 9. Modals

All modals are in `modals.html` (532 lines), loaded into `#modal-container`:

| Modal ID | Purpose |
|----------|---------|
| `modal-record` | Add/edit data register record |
| `modal-company` | Add/edit company |
| `modal-person` | Create team login (via Edge Function) |
| `modal-edit-member` | Edit existing team member |
| `modal-add-role` | Add custom role |
| `modal-dpia` | New DPIA assessment |
| `modal-data-request` | New data subject request |
| `modal-log-optout` | Log marketing opt-out |
| `modal-crossborder` | Log cross-border transfer |
| `modal-breach` | Record data breach |
| `modal-case` | Create investigation case |
| `modal-vendor` | Add/edit vendor |
| `modal-training` | Add training record |
| `modal-dpo` | DPO appointment |

---

## 10. Testing

Python pytest + Playwright framework:

| File | Type | Description |
|------|------|-------------|
| `test_api.py` | API | Supabase API integration tests (33 tests) |
| `test_datarex.py` | E2E | Playwright browser tests (45 tests) |
| `test_breach_modal_standardize.py` | E2E | Breach modal validation |
| `test_deica_full.py` | E2E | DEICA workflow tests |
| `test_documents_e2e.py` | E2E | Document upload E2E |
| `test_documents_register_logout.py` | E2E | Document persistence across sessions |
| `test_download_merge.py` | E2E | Download/merge functionality |
| `test_security_critical.py` | E2E | Security-critical tests |
| `test_sample_data.py` | Unit | Sample data generation |
| `test_login.js` | JS | Login flow (JS) |

Run: `python3 -m pytest` or `./deploy-uat.sh`

---

## 11. Deployment

### 11.1 Production Targets

| Target | URL | Type |
|--------|-----|------|
| **Hostinger** | `https://mediumturquoise-elephant-638443.hostingersite.com` | Shared hosting (Apache/Nginx) |
| **VPS** | `http://76.13.183.75:8060` | Root server (python3 http.server) |

### 11.2 Deploy Commands

**Hostinger:**
```bash
rsync -avz --delete --exclude '.git' --exclude '.env' \
  --exclude '__pycache__' --exclude '*.pyc' --exclude 'venv/' \
  --exclude 'scratch/' --exclude 'test_*' --exclude '*.png' \
  -e "sshpass -p 'External2605.' ssh -o StrictHostKeyChecking=no -p 65002" \
  ./ u713770290@145.79.25.167:domains/mediumturquoise-elephant-638443.hostingersite.com/public_html/
```

**VPS:**
```bash
rsync -avz --delete --exclude '.git' --exclude '.env' \
  --exclude '__pycache__' --exclude 'venv' --exclude '.pytest_cache' \
  --exclude 'test_*' --exclude '*.md' \
  -e "sshpass -p 'Sunflower@7-bloom' ssh -o StrictHostKeyChecking=no" \
  ./ root@76.13.183.75:/root/data_reg/

# Then restart server:
ssh root@76.13.183.75 "cd /root/data_reg && pkill -f 'http.server 8060'; \
  nohup python3 -m http.server 8060 --directory . > server.log 2>&1 &"
```

### 11.3 File Uploads

Hostinger uses `upload.php` which stores files in `_document_system/{module}/` directory on the server. The VPS uses the same PHP script if PHP is available, otherwise relies on Supabase Storage.

---

## 12. Version Cache Busting

Pages use cachebuster query params:
- `app.js?v=60` — Main app script
- `css/style.css?v=26` — Stylesheet
- `modals.html?v=42` — Modals
- Page HTML files use `PAGE_ASSET_VERSION = '42'`

Bump the version number when deploying changes to force browsers to re-fetch.

---

## 13. Key URLs / Accounts

| Page | URL Fragment | Credentials |
|------|-------------|-------------|
| Login | `#/login` | admin@datarex.com / AccountAdmin123! |
| Superadmin login | `#/login` | superadmin@datarex.com / DataRex@2026! |
| Demo login | (button click) | admin@datarex.com / Admin123!@# |
| Dashboard | `#/dashboard` | |
| Access Control | `#/access` | |
| DPIA | `#/dpiapage` | |
| Documents | `#/documents` | |
| Accounts (Superadmin) | `#/accounts` | |

---

## 14. Application Flow

```
Landing → Login → Dashboard
                    ├── DPO & Governance
                    ├── Companies
                    ├── Data Register
                    ├── Processing Activities
                    ├── DPIA Screening → DEICA Workflow
                    ├── Data Subject Requests
                    ├── Breach Management
                    ├── Vendors
                    ├── Cross-Border Transfers
                    ├── Retention
                    ├── Training
                    ├── Documents
                    ├── Checklist
                    ├── Access Control (Team + Nav Permissions)
                    ├── Consent Management
                    ├── Alerts / Cases
                    ├── Risk Monitoring
                    ├── Audit Report
                    ├── Accounts (Superadmin only)
                    └── People (Superadmin only)
```
