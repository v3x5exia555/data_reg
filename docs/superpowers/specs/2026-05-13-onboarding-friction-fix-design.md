# Onboarding Friction Fix Design

## Context

New users currently hit avoidable friction before reaching the dashboard. The landing page has adjacent login and "Get started free" buttons, but both route to login. The create account form asks for profile, company, industry, size, and registration details before the user has entered the product. The onboarding flow also shows a business selection step that may not accept selections, then summarizes business type and data sources even though those details are not reliably captured. The final dashboard button can leave the user stuck on the summary screen.

## Goals

- Make "Get Started" clearly mean account creation.
- Reduce initial signup to email and password only.
- Remove free-trial wording from a free product path.
- Avoid asking company size, industry, business type, and data sources during first-run onboarding.
- Route new users directly to the dashboard after account creation.
- Verify the new path with Playwright.

## Non-Goals

- No database or Supabase schema changes.
- No dashboard redesign.
- No new business type or data source setup UI inside the dashboard in this change.
- No replacement of the existing localStorage registration fallback.

## User Flow

1. User lands on the marketing screen.
2. User clicks "Get Started".
3. App opens the Create Account screen.
4. User enters email and password.
5. App creates the local account record with safe defaults for deferred fields.
6. App launches the authenticated shell and opens the dashboard.

The login button continues to open the login screen.

## UI Changes

### Landing

- Rename the nav CTA from "Get started free" to "Get Started".
- Route the nav CTA to `screen-register`.
- Route the hero primary CTA to `screen-register`.

### Create Account

- Keep only:
  - Work Email
  - Password
- Remove:
  - Full Name
  - Company Name
  - Industry
  - Company Size
  - Business Registration No
  - Confirm Password
  - "Start your 14-day free trial"
- Keep the existing create-account button and login footer.
- Keep password strength feedback if it remains compatible with the simplified password field.

## Data Defaults

Registration still writes a local user object because the current app uses it for local login/session fallback. Missing deferred fields use defaults:

- `name`: email local part
- `company`: empty string
- `industry`: empty string
- `companySize`: `1-10`
- `regNo`: empty string

These defaults prevent downstream code from crashing while keeping the initial form short.

## Onboarding Behavior

After successful registration:

- Set `state.user`.
- Set `state.isLoggedIn = true`.
- Save state.
- Create a session for the new email if the existing session helper is available.
- Launch the app shell if the existing launch helper is available.
- Navigate to `dashboard`.

The old onboarding summary screen is no longer part of the signup success path. Existing onboarding functions can remain for now if unused, but they must not block new-user signup.

## Error Handling

- Invalid email shows the existing inline email error and error toast.
- Missing or short password shows the existing inline password error and error toast.
- Duplicate email shows the existing inline email error and error toast.
- Dashboard navigation falls back through existing `launchApp`, `goTo('screen-app')`, and `showPage('dashboard')` paths so it works whether a session helper is present or not.

## Testing

Use Playwright against the local app to verify:

- Landing "Get Started" opens Create Account.
- Landing hero primary CTA opens Create Account.
- Login button still opens Login.
- Create Account displays only email and password as user-entered signup fields.
- "Start your 14-day free trial" is absent.
- Creating a unique local account reaches the dashboard.

## Files

- `pages/auth__landing.html`: CTA text and routing.
- `pages/auth__register.html`: simplified signup markup.
- `js/app.js`: simplified `doRegister()` validation and successful registration routing.
- Optional Playwright script or ad hoc Playwright command: browser verification.
