# Alert Feature Requirements Request

This document is to gather requirements for the "Alert" feature inside Data Rex. Please provide details for the following areas so we can implement the feature accurately.

## 1. Types of Alerts
* What kinds of alerts should the system support? (e.g., Warning, Error, Info, Success)
* Examples: "Privacy Policy missing", "Overdue compliance tasks", "Consent review due". Are there any new ones?

## 2. Trigger Conditions
* What specific actions or conditions should trigger an alert?
* Are these alerts generated automatically by the system based on dates (e.g., retention deadlines) or triggered manually?

## 3. UI/UX Display
* How should these alerts be displayed to the user?
  * Should there be a dedicated "Alerts" page?
  * Should there be a notification bell with a dropdown in the navigation bar?
  * Should they appear as banner notifications or toast messages?
* Can users dismiss or mark alerts as "Read"?

## 4. Data Storage & Supabase
* Are alerts going to be stored in a Supabase table? 
* If yes, what is the expected schema? (e.g., `id`, `user_id`, `company_id`, `title`, `message`, `type`, `link`, `is_read`, `created_at`)

## 5. Role-Based Access
* Who should see these alerts? 
* Do different roles (e.g., Accountadmin, security_user, user) receive different types of alerts?

---

**Please fill out or answer these questions so we can proceed with the development of the Alert feature.**
