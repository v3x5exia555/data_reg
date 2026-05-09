# Privacy Management Dashboard — UAT Manual Test Checklist

## Test Execution Instructions

1. Open the application in a browser
2. Navigate through each test scenario
3. Mark **PASS** or **FAIL** for each item
4. Note any defects or observations in the Comments column
5. Screenshot any visual inconsistencies

---

## TEST SUITE 1: Design Token Validation

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| DTV-01 | Check `--primary` color | `#007bff` | ☐ | |
| DTV-02 | Check `--bg` background | `#f8fafc` | ☐ | |
| DTV-03 | Check `--bg-card` | `#ffffff` | ☐ | |
| DTV-04 | Check `--border` | `#e2e8f0` | ☐ | |
| DTV-05 | Check `--radius-xl` | `12px` | ☐ | |
| DTV-06 | Check `--muted` (undefined previously) | `#64748b` | ☐ | |
| DTV-07 | Check `--placeholder` (undefined previously) | `#94a3b8` | ☐ | |
| DTV-08 | Check `--card` alias | `#ffffff` | ☐ | |
| DTV-09 | Check `--input-bg` alias | `#ffffff` | ☐ | |

---

## TEST SUITE 2: Stat Card Component (Reference: image_0b5181.png)

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| SC-01 | Stat card background | White (`#ffffff`) | ☐ | |
| SC-02 | Stat card border | `1px solid #e2e8f0` | ☐ | |
| SC-03 | Stat card border-radius | `12px` | ☐ | |
| SC-04 | Stat card padding | `16px` | ☐ | |
| SC-05 | Stat icon background | Light tint of icon color | ☐ | |
| SC-06 | Stat icon border-radius | `8px` | ☐ | |
| SC-07 | Stat label font | `10px`, uppercase, `700` weight | ☐ | |
| SC-08 | Stat value font | `24px`, `700` weight | ☐ | |
| SC-09 | Cards display in row with `12px` gap | Flexbox, equal width | ☐ | |

---

## TEST SUITE 3: Navigation Integrity (Reference: image_62d590.png)

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| NAV-01 | Sidebar displays all categories | GOVERNANCE, DATA FOUNDATION, DPIA & RISK, OPERATIONS, CONTROLS, MONITORING, SUPPORT, BILLING | ☐ | |
| NAV-02 | Section labels font-weight | `700` (bold) | ☐ | |
| NAV-03 | Section labels color | `#9e9e9e` (gray) | ☐ | |
| NAV-04 | Active nav item style | Light blue background, darker text | ☐ | |
| NAV-05 | "Processing Activities" navigates correctly | Route to `#processing_activities` | ☐ | |
| NAV-06 | DPIA Expiry Tracker visible | Listed in DPIA & RISK section | ☐ | |
| NAV-07 | DPIA Workflow visible | Listed in DPIA & RISK section | ☐ | |
| NAV-08 | "Load Sample Data" button styled | Green background, visible | ☐ | |

---

## TEST SUITE 4: Processing Activities Page

### 4.1 Page Load

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| PA-01 | Page header | "Processing Activities" | ☐ | |
| PA-02 | Page description | "Record of every personal-data processing activity." | ☐ | |
| PA-03 | Stat cards display (3 cards) | Total Activities, Cross-border, With Sensitive Data | ☐ | |
| PA-04 | Search box present | 320px width, placeholder text | ☐ | |
| PA-05 | "Try Sample Data" button | Blue/secondary style | ☐ | |
| PA-06 | "Add Activity" button | Blue/primary style | ☐ | |

### 4.2 Modal Flow (Reference: Screenshot 2026-05-04 at 10.54.27 PM.png)

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| PA-07 | Modal opens on "Add Activity" click | Modal appears with overlay | ☐ | |
| PA-08 | Modal header | "New Processing Activity" | ☐ | |
| PA-09 | Setup Progress stepper visible | 10 steps shown | ☐ | |
| PA-10 | Step indicators use light theme | Warning yellow for pending | ☐ | |
| PA-11 | Section 1: Basics form | Name (required), Purpose fields | ☐ | |
| PA-12 | Section 2: Nature grid | 9 chip options (Collection, Storage, etc.) | ☐ | |
| PA-13 | Section 3: Scope grid | 4 data subject types | ☐ | |
| PA-14 | Section 4: Context grid | 4 context options | ☐ | |
| PA-15 | Section 5: Legal basis grid | 7 legal basis options | ☐ | |
| PA-16 | Section 6: Data categories | 10 data types with sensitivity indicators | ☐ | |
| PA-17 | Section 7: Recipients | 6 recipient options | ☐ | |
| PA-18 | Section 8: Retention | Dropdown + years input | ☐ | |
| PA-19 | Section 9: Volume | Total + Sensitive inputs | ☐ | |
| PA-20 | DPIA indicator | Color changes based on thresholds | ☐ | |
| PA-21 | Section 10: Cross-border | Checkbox + country dropdown | ☐ | |
| PA-22 | Modal footer buttons | "Discard Draft", "Save Activity" | ☐ | |
| PA-23 | Modal close button | X icon in top right | ☐ | |

### 4.3 Form Validation

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| PA-24 | Submit without required field | Alert: "Please enter an activity name" | ☐ | |
| PA-25 | Fill all required, submit | Activity saved, modal closes | ☐ | |
| PA-26 | Discard draft | Confirmation prompt, modal closes | ☐ | |
| PA-27 | Click overlay to close | Modal closes | ☐ | |

---

## TEST SUITE 5: Sample Data Loading

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| SD-01 | Click "Try Sample Data" | 3 activities appear in grid | ☐ | |
| SD-02 | Stats counters update | Total: 3, Cross-border: 2, Sensitive: 1 | ☐ | |
| SD-03 | Activity cards display | Card title, description, metrics visible | ☐ | |
| SD-04 | "Cross-border" badge | Shown on applicable cards | ☐ | |
| SD-05 | Edit button works | Opens modal with populated data | ☐ | |
| SD-06 | Delete button works | Confirmation prompt, removes card | ☐ | |

---

## TEST SUITE 6: Edge Cases

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| EC-01 | Empty state | "No Processing Activities Recorded" message | ☐ | |
| EC-02 | Very long activity name | Text truncates or wraps gracefully | ☐ | |
| EC-03 | XSS attempt in text field | Script tags escaped/removed | ☐ | |
| EC-04 | DPIA threshold: 0 subjects | Green "Below threshold" | ☐ | |
| EC-05 | DPIA threshold: 15,000 total | Yellow "Approaching threshold" | ☐ | |
| EC-06 | DPIA threshold: 25,000 total | Red "Above threshold" | ☐ | |
| EC-07 | DPIA threshold: 15,000 sensitive | Red "Above threshold" | ☐ | |
| EC-08 | Rapid form submissions | Debounced, no duplicate saves | ☐ | |
| EC-09 | Network error simulation | Error handling, user feedback | ☐ | |

---

## TEST SUITE 7: Accessibility (a11y)

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| A11Y-01 | All buttons have labels | aria-label, title, or text content | ☐ | |
| A11Y-02 | Form inputs have labels | Associated label elements | ☐ | |
| A11Y-03 | Focus states visible | Blue outline on tab focus | ☐ | |
| A11Y-04 | Color contrast (WCAG AA) | Body text on background ≥ 4.5:1 | ☐ | |
| A11Y-05 | Modal focus trap | Tab cycles within modal | ☐ | |
| A11Y-06 | Escape key closes modal | ESC key listener active | ☐ | |
| A11Y-07 | Screen reader announces errors | Error messages accessible | ☐ | |

---

## TEST SUITE 8: Visual Consistency Across Pages

| Test ID | Test Scenario | Page | Expected Result | Status | Comments |
|---------|---------------|------|-----------------|--------|----------|
| VC-01 | Page header h1 font-size | Data Requests | `24px` | ☐ | |
| VC-02 | Page header h1 font-size | Breach Log | `24px` | ☐ | |
| VC-03 | Page header h1 font-size | DPIA Page | `24px` | ☐ | |
| VC-04 | Page header h1 font-size | Processing Activities | `24px` | ☐ | |
| VC-05 | Stat card border-radius | All pages | `12px` | ☐ | |
| VC-06 | Badge border-radius | All pages | `20px` (pill) | ☐ | |
| VC-07 | Button border-radius | All pages | `8px` | ☐ | |
| VC-08 | Input border-radius | All pages | `8px` | ☐ | |
| VC-09 | Empty state icon size | All pages | `48px` | ☐ | |
| VC-10 | Search box width | All pages | `320px` | ☐ | |

---

## TEST SUITE 9: Consent Page (05__consent.html)

| Test ID | Test Scenario | Expected Result | Status | Comments |
|---------|---------------|-----------------|--------|----------|
| CP-01 | Page header | "Purpose & Consent" | ☐ | |
| CP-02 | Direct Marketing card | White bg, proper styling | ☐ | |
| CP-03 | Stat cards use standard class | `.stat-card-inline` | ☐ | |
| CP-04 | Stat card border | `1px solid #e2e8f0` | ☐ | |
| CP-05 | Stat card border-radius | `12px` | ☐ | |
| CP-06 | Stat label style | `10px`, uppercase | ☐ | |
| CP-07 | "Log Opt-out" button | Primary style | ☐ | |
| CP-08 | Empty state in opt-out log | "No opt-outs logged yet" | ☐ | |

---

## TEST SUITE 10: Cross-Page Modal Consistency

| Test ID | Test Scenario | Modal | Expected Result | Status | Comments |
|---------|---------------|-------|-----------------|--------|----------|
| MC-01 | Modal overlay background | Processing | `rgba(0,0,0,0.4)` | ☐ | |
| MC-02 | Modal container width | Processing | `800px` max | ☐ | |
| MC-03 | Modal border-radius | Processing | `12px` | ☐ | |
| MC-04 | Modal header padding | Processing | `20px 24px` | ☐ | |
| MC-05 | Modal body padding | Processing | `24px` | ☐ | |
| MC-06 | Modal footer padding | Processing | `20px 24px` | ☐ | |
| MC-07 | Close button style | Processing | `24px` font, no border | ☐ | |

---

## TEST SUITE 11: Happy Path — Complete User Flow

| Test ID | Test Scenario | Steps | Expected Result | Status | Comments |
|---------|---------------|-------|-----------------|--------|----------|
| HP-01 | Add new processing activity | 1. Click "Add Activity"<br>2. Fill all fields<br>3. Click "Save Activity" | Activity appears in grid | ☐ | |
| HP-02 | Edit existing activity | 1. Click "Edit" on card<br>2. Modify name<br>3. Save | Changes persist | ☐ | |
| HP-03 | Delete activity | 1. Click "Delete"<br>2. Confirm | Activity removed | ☐ | |
| HP-04 | Search functionality | 1. Type in search box<br>2. Results filter | Matching activities shown | ☐ | |
| HP-05 | Navigate to another page and back | 1. Click Dashboard<br>2. Click Processing Activities | State preserved | ☐ | |

---

## DEFECT LOG

| Defect # | Description | Severity | Page/Component | Reported By | Date |
|----------|-------------|----------|----------------|------------|------|
| | | | | | |

---

## SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Engineer | | | |
| Product Owner | | | |
| Developer | | | |

---

## SUMMARY

| Category | Total Tests | Passed | Failed | Blocked |
|----------|-------------|--------|--------|---------|
| Design Tokens | 9 | | | |
| Stat Cards | 9 | | | |
| Navigation | 8 | | | |
| Processing Activities | 27 | | | |
| Sample Data | 5 | | | |
| Edge Cases | 9 | | | |
| Accessibility | 7 | | | |
| Visual Consistency | 10 | | | |
| Consent Page | 9 | | | |
| Modal Consistency | 7 | | | |
| Happy Path | 5 | | | |
| **TOTAL** | **105** | | | |

**Pass Rate Target:** ≥ 90%

---

## Account-Admin Scoping (2026-05-09)

- [ ] As Accountadmin in Tenant A, the People page shows only Tenant A staff.
- [ ] As Accountadmin in Tenant A, attempting to insert a row with a foreign account_id (via console) returns "You don't have access to that account."
- [ ] As Accountadmin in Tenant A, calling `manage-user` against a Tenant B user returns 403.
- [ ] As Superadmin, all tenants are visible; setting `viewAsAccountId` filters to that tenant.
