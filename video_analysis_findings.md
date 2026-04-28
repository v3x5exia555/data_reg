# Video Analysis Findings - DataRex UI/UX

## Page Flow
1. **Landing Page**: 
   - Hero section with title "PDPA compliance, done for you. Not another checklist."
   - "Start free" and "See how it works" buttons.
   - Diagram showing data flow from various sources (CRM, HR, etc.) to a "DataRex compliance engine" and then to "Your safe data".
   - Feature cards below the hero.
2. **Onboarding (Step 1 of 3)**:
   - Form title: "Tell us about your company".
   - Fields: Company name, SSM / Company registration number, Industry (dropdown), Number of employees (dropdown).
   - Toggles: "Do you process sensitive data?", "Do you transfer data outside Malaysia?".
   - "Continue" button.
3. **App Dashboard / Companies**:
   - Sidebar navigation with sections: Overview (Dashboard, Companies), Foundation (DPO, Checklist, Data Sources, etc.), Operations (Data Requests, Breach Log, etc.), Records (Documents, Audit Report), Monitoring (System Integration, Activity Monitoring, Alerts).
   - Main content: "Your companies" list with "Add company" button.
   - Each company card shows status tags (Active, Sensitive data, Cross-border) and actions (Switch to, Delete).
4. **Checklist Section**:
   - Categorized tasks (Security, Retention, Data Integrity).
   - Each task has a checkbox, a question (e.g., "Is collected data stored securely?"), and a brief description.
   - Progress indicators (e.g., Security 0/5).

## Design Details
- **Colors**: Primary blue (#2563EB), light gray backgrounds, white cards, dark gray text.
- **Typography**: Clean sans-serif (likely Inter or similar).
- **Layout**: 
  - Landing page: Centered hero, grid for features.
  - App: Left sidebar (fixed width), main content area (fluid).
- **Interactive Elements**:
  - Buttons with rounded corners.
  - Form inputs with subtle borders.
  - Toggle switches for binary options.
  - Sidebar with active state highlighting.
