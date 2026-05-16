# Access Control — Role Capability Matrix

**Single source of truth:** `js/role_capability.js` (`ROLE_CAPABILITY`).
This document is asserted equal to that constant by
`test_access_control_matrix.js` — if you change one, change the other or the
test fails. The server-side boundary is Postgres RLS
(`20260509000007` + `20260516000002` + `20260516000003`); this matrix mirrors
it and the client guard derives from it. The client guard is cosmetic — RLS
is the real enforcement.

Legend: `yes` = allowed · `no` = denied · `own` = own account/row only · `all` = all tenants

| Capability | Superadmin | Accountadmin | useradmin | security_user | user |
|---|---|---|---|---|---|
| page.dashboard | yes | yes | yes | yes | yes |
| page.accounts | yes | no | no | no | no |
| page.companies | yes | no | no | no | no |
| page.people | yes | no | no | no | no |
| page.access | yes | yes | no | no | no |
| account.create | yes | no | no | no | no |
| account.suspend | yes | no | no | no | no |
| account.delete | yes | no | no | no | no |
| account.seat_edit | yes | no | no | no | no |
| viewas.impersonate | yes | no | no | no | no |
| user.invite | yes | own | no | no | no |
| user.change_other_role | yes | own | no | no | no |
| user.change_own_role | no | no | no | no | no |
| profiles.read | all | own | own | own | own |
| accountdata.rw | all | own | own | own | own |
| nav_permissions.configure | all | own | no | no | no |

## Enforcement layers

1. **Client page guard** (`showPage()` + `ROLE_HARD_BLOCKS`, derived from
   `ROLE_CAPABILITY.computeRoleHardBlocks()`). Cosmetic — bypassable via
   console. UX only.
2. **`nav_permissions` table** (account-scoped, `20260513000001`). Gates
   menu-item visibility per role; admin-configurable.
3. **Postgres RLS** (`20260509000007` row policies + `20260516000002`
   column REVOKE + guard trigger + `20260516000003` audit log). The real
   security boundary. Role/account_id columns are not client-writable;
   role changes flow only through the `create-user` Edge function
   (service-role, server-side authz).

## Audit trail

Destructive Superadmin actions and impersonation are recorded in
`access_audit_log` (append-only): `account.suspend`, `account.reactivate`,
`account.delete`, `account.seat_change`, `viewas.enter`, `viewas.exit`,
`user.role_change`. Role-change rows are written server-side in the Edge
function so a tampering client cannot skip them.
