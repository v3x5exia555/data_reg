# DataRex Application - Page Flow Summary

## Overview

DataRex is a PDPA (Personal Data Protection Act) compliance management platform designed to guide organizations through data protection requirements step-by-step. The application features a landing page, multi-step onboarding flow, and a comprehensive dashboard with sidebar navigation.

## Page Flow Architecture

### 1. Landing Page

The landing page serves as the entry point to the application and is designed to convert visitors into users. It contains the following key sections:

**Hero Section**: The hero section presents the core value proposition with the headline "PDPA compliance, done for you. Not another checklist." This is supported by a subheading that emphasizes the step-by-step guidance approach. The section includes two primary call-to-action buttons: "Start free" (primary blue button) and "See how it works" (secondary outline button). A supporting tagline states "No legal jargon. No spreadsheets. No guesswork."

**Data Flow Diagram**: Below the hero text, a visual diagram illustrates how DataRex processes data from multiple sources (CRM, HR systems, Apps & web, E-commerce, IoT & sensors, Partners, Financial systems) through a centralized "DataRex compliance engine" to produce "Your safe data" that is compliant and audit-ready. This diagram helps users understand the platform's value proposition visually.

**Feature Cards**: Three feature cards are displayed in a grid layout at the bottom of the landing page. These cards highlight key benefits: "Know What Data You Have" (complete inventory), "Stay Compliant Without Guesswork" (step-by-step guidance), and "Always Be Audit-Ready" (detailed records and documentation).

### 2. Onboarding Flow (Step 1 of 3)

When users click "Start free" or "Get started," they are directed to the onboarding page. This is a multi-step form designed to collect essential company information to tailor the compliance setup.

**Step 1: Company Information**

The onboarding form collects the following information:

- **Company Name** (text input): A simple text field where users enter their organization's name.
- **SSM / Company Registration Number** (text input): Users provide their business registration number for identification.
- **Industry** (dropdown select): Users select their industry from predefined options including Legal Firm, Financial Services, Healthcare, Retail, Technology, and Other. This selection helps tailor compliance recommendations.
- **Number of Employees** (dropdown select): Users select their company size from ranges: 1-10, 11-50, 51-100, 101-500, or 500+. This affects compliance complexity and recommendations.
- **Do you process sensitive data?** (toggle switch): A binary toggle that indicates whether the company handles sensitive data categories such as health information, financial data, biometric data, or religious information.
- **Do you transfer data outside Malaysia?** (toggle switch): Another binary toggle indicating whether personal data is transferred to servers outside Malaysia (e.g., Singapore, US, EU).

Both toggle switches are displayed in an active (blue) state by default, indicating that the company processes sensitive data and transfers data internationally. This is typical for many organizations and helps establish baseline compliance requirements.

The form includes a "Continue" button to proceed to the next step and a "Back" button to return to the landing page.

### 3. Dashboard - Companies View

After completing the onboarding form, users are directed to the main dashboard. The dashboard uses a two-column layout with a persistent sidebar on the left and the main content area on the right.

**Sidebar Navigation**: The sidebar is organized into six main sections:

1. **Active Company**: Displays the currently selected company (e.g., "dsdsa") with an option to "Manage companies" to switch between multiple company accounts.

2. **Overview**: Contains links to the Dashboard and Companies pages. The Companies page is the default view upon first login.

3. **Foundation**: Includes compliance setup sections such as DPO (Data Protection Officer), Checklist, Data Sources, Data Register, Consent, Access Control, and Retention. These sections help establish the foundational compliance framework.

4. **Operations**: Contains operational compliance tasks including Data Requests, Breach Log, DPIA (Data Protection Impact Assessment), Cross-border transfers, Vendors, and Training.

5. **Records**: Includes Documents and Audit Report sections for maintaining compliance documentation.

6. **Monitoring**: Features System Integration, Activity Monitoring, Alerts (with a red badge showing "1" unread alert), Cases, and Monitoring Report.

**Companies List View**: The main content area displays a list of all companies managed under the user's account. Each company card includes:

- **Company Icon**: A visual icon representing the company.
- **Company Details**: The company name, industry/type, employee count, and SSM registration number.
- **Status Tags**: Color-coded tags indicating the company's status:
  - Green "Active" tag for the currently active company
  - Orange "Sensitive data" tag for companies processing sensitive personal data
  - Blue "Cross-border" tag for companies transferring data internationally
- **Action Buttons**: 
  - "Switch to" button to change the active company
  - Delete button (trash icon) to remove the company from the account

The page header includes an "Add company" button to add additional companies to the account.

### 4. Dashboard - Checklist View

Users can navigate to the Checklist section from the sidebar to view and complete compliance tasks. The checklist is organized into three main categories:

**Security Section (0/5 completed)**:
- Is collected data stored securely? (Use password protection, encryption, or secure cloud storage)
- Do you control who can access the data? (Only authorised staff should see personal data)
- Do you use encryption for sensitive data? (Encrypt data at rest and in transit)
- Do you have a password policy? (Set rules for password length, change frequency, and 2FA where possible)
- Have you uploaded a written Security Policy? (A short policy document everyone can refer to)

**Retention Section (0/2 completed)**:
- Do you delete data when no longer needed? (Don't keep data forever — set retention periods)
- Do you have a disposal method? (Shredding, secure delete, vendor certificate, etc.)

**Data Integrity Section (0/3 completed)**:
- Is your data accurate and up-to-date? (Regularly verify and update personal data records)
- Do you have a process to correct errors? (Allow individuals to request corrections)
- Do you log data subject requests? (Keep a record of every request and how you responded)

Each checklist item includes a checkbox, a question, and a helpful description. Users can check off items as they complete them. Progress is tracked with a counter (e.g., "0/5") for each section.

## User Interaction Flow

1. **Entry Point**: User visits the landing page and reviews the value proposition and features.
2. **Call-to-Action**: User clicks "Start free" or "Get started" button.
3. **Onboarding**: User completes Step 1 of the onboarding form with company information.
4. **Dashboard Access**: User is directed to the dashboard and sees their companies list.
5. **Navigation**: User can navigate between different sections using the sidebar (Companies, Checklist, DPO, etc.).
6. **Compliance Tasks**: User completes compliance tasks by checking off items in the Checklist or managing other compliance aspects.
7. **Multi-Company Management**: User can add additional companies and switch between them using the sidebar.

## Design System

**Color Palette**:
- Primary Blue: #2563eb (buttons, links, active states)
- Dark Blue: #1d4ed8 (button hover states)
- Light Blue: #dbeafe (backgrounds, icons)
- Gray: #6b7280 (secondary text)
- Light Gray: #f9fafb (page background)
- White: #ffffff (cards, containers)
- Red: #ef4444 (alerts, delete actions)
- Green: #065f46 (success/active states)
- Orange: #92400e (warning/sensitive data)

**Typography**:
- Font Family: System fonts (San Francisco, Segoe UI, Roboto) for optimal readability
- Headings: 700 weight for emphasis
- Body Text: 400-500 weight for readability
- Small Text: 0.875rem for hints and descriptions

**Layout**:
- Landing Page: Centered hero section with full-width background, followed by feature grid
- Dashboard: Fixed left sidebar (240px width) with fluid main content area
- Forms: Maximum width container (700px) for optimal readability
- Cards: Subtle shadows and rounded corners (0.5-1rem radius) for depth

**Interactive Elements**:
- Buttons: Rounded corners with hover effects and smooth transitions
- Form Inputs: Subtle borders with blue focus states and shadow effects
- Toggle Switches: Animated switches with active/inactive states
- Checkboxes: Simple bordered squares that fill with blue when checked
- Sidebar Items: Highlight on hover and active state with left blue border

## Technical Implementation

The application is built as a single-page application (SPA) using vanilla HTML, CSS, and JavaScript. Key features include:

- **Page Switching**: JavaScript functions manage page visibility using CSS classes
- **Form Handling**: Form validation and submission logic
- **Interactive Elements**: Toggle switches, checkboxes, and sidebar navigation respond to user interactions
- **Responsive Design**: CSS media queries ensure the layout adapts to mobile devices
- **State Management**: Simple JavaScript state management for tracking active pages and form inputs

## File Structure

The complete application is contained in a single HTML file (`datarex.html`) with embedded CSS and JavaScript. This approach provides easy deployment and sharing while maintaining clean code organization through CSS sections and JavaScript functions.
