# Multi-tenant smoke checklist

Run this against staging **after** Phase F (full Superadmin UI deployed). Expected: all 12 steps pass.

| # | Step | Expected |
|---|---|---|
| 1 | Run migrations 1–6 | All succeed |
| 2 | Run promotion SQL: `UPDATE user_profiles SET role='Superadmin', account_id=NULL WHERE id='<tyson uid>'` | One row updated |
| 3 | Tyson logs in | Lands on /accounts; sees Default Account 1 |
| 4 | Click "+ New account" → fill in `Acme Pte Ltd / test1@acme.com / Test1234! / 2` | Toast shows credentials; new row in `accounts`; new auth user; `companies` row created |
| 5 | Log out → log in as `test1@acme.com` | Lands on /dashboard; legacy nav unchanged; no Accounts link in sidebar |
| 6 | Open Access page | Seat chip "1 / 2"; "+ Add user" enabled |
| 7 | Click "+ Add user" → `john@acme.com / password123` | Toast: Added. Chip flips to 2/2. |
| 8 | Try "+ Add user" again | Toast: "Seat limit reached" (or button disabled) |
| 9 | Log out → log in as `john@acme.com` | Lands on /dashboard; nav respects `permissions` JSON; no Access page |
| 10 | Log out → log in as Tyson → click "View as Default Account 1" | Banner appears; Dashboard shows legacy data; "Exit view-as" returns to /accounts |
| 11 | Tyson: suspend Acme Pte Ltd | `accounts.status='suspended'`. Log in as `test1@acme.com` → toast "Your account is suspended"; redirect to login |
| 12 | Tyson: delete Acme Pte Ltd (typed-confirm modal) | All `account_id`-tagged rows for Acme are gone; auth users deleted |
