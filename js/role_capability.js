/* role_capability.js — single source of truth for role -> capability access.
 *
 * Everything that decides "can this role do X" derives from ROLE_CAPABILITY:
 *   - the client page guard (ROLE_HARD_BLOCKS, computed below)
 *   - docs/ACCESS_CONTROL.md (asserted equal by test_access_control_matrix.js)
 *   - the Playwright enforcement matrix
 *
 * Values: true = allowed, false = denied, 'own' = own account/row only.
 * Server-side RLS (20260509000007 + 20260516000002/3) is the real boundary;
 * this client matrix must MIRROR it, never contradict it.
 *
 *  ROLE        ─┐
 *               ├─> ROLE_CAPABILITY[role][capability]
 *  CAPABILITY ──┘            │
 *                            ├─> roleCanAccessPage()  ── showPage() guard
 *                            └─> computeRoleHardBlocks() ── ROLE_HARD_BLOCKS
 */
(function (root) {
  'use strict';

  var GATED_PAGES = ['accounts', 'companies', 'people', 'access'];

  var ROLE_CAPABILITY = {
    Superadmin: {
      'page.dashboard': true,
      'page.accounts': true,
      'page.companies': true,
      'page.people': true,
      'page.access': true,
      'account.create': true,
      'account.suspend': true,
      'account.delete': true,
      'account.seat_edit': true,
      'viewas.impersonate': true,
      'user.invite': true,
      'user.change_other_role': true,
      'user.change_own_role': false,
      'profiles.read': 'all',
      'accountdata.rw': 'all',
      'nav_permissions.configure': 'all'
    },
    Accountadmin: {
      'page.dashboard': true,
      'page.accounts': false,
      'page.companies': false,
      'page.people': false,
      'page.access': true,
      'account.create': false,
      'account.suspend': false,
      'account.delete': false,
      'account.seat_edit': false,
      'viewas.impersonate': false,
      'user.invite': 'own',
      'user.change_other_role': 'own',
      'user.change_own_role': false,
      'profiles.read': 'own',
      'accountdata.rw': 'own',
      'nav_permissions.configure': 'own'
    },
    useradmin: {
      'page.dashboard': true,
      'page.accounts': false,
      'page.companies': false,
      'page.people': false,
      'page.access': false,
      'account.create': false,
      'account.suspend': false,
      'account.delete': false,
      'account.seat_edit': false,
      'viewas.impersonate': false,
      'user.invite': false,
      'user.change_other_role': false,
      'user.change_own_role': false,
      'profiles.read': 'own',
      'accountdata.rw': 'own',
      'nav_permissions.configure': false
    },
    security_user: {
      'page.dashboard': true,
      'page.accounts': false,
      'page.companies': false,
      'page.people': false,
      'page.access': false,
      'account.create': false,
      'account.suspend': false,
      'account.delete': false,
      'account.seat_edit': false,
      'viewas.impersonate': false,
      'user.invite': false,
      'user.change_other_role': false,
      'user.change_own_role': false,
      'profiles.read': 'own',
      'accountdata.rw': 'own',
      'nav_permissions.configure': false
    },
    user: {
      'page.dashboard': true,
      'page.accounts': false,
      'page.companies': false,
      'page.people': false,
      'page.access': false,
      'account.create': false,
      'account.suspend': false,
      'account.delete': false,
      'account.seat_edit': false,
      'viewas.impersonate': false,
      'user.invite': false,
      'user.change_other_role': false,
      'user.change_own_role': false,
      'profiles.read': 'own',
      'accountdata.rw': 'own',
      'nav_permissions.configure': false
    }
  };

  // page id (as used by showPage) -> capability key
  function pageCapKey(pageId) { return 'page.' + pageId; }

  function roleCanAccessPage(role, pageId) {
    var caps = ROLE_CAPABILITY[role];
    if (!caps) return false;
    var v = caps[pageCapKey(pageId)];
    // Pages not in the matrix are not gated by this layer (nav_permissions
    // + RLS still apply); only an explicit `false` hard-blocks.
    return v !== false;
  }

  // Derive the legacy ROLE_HARD_BLOCKS shape: { role: Set(blockedGatedPages) }.
  // Reproduces the prior hand-maintained map exactly, now from one source.
  function computeRoleHardBlocks() {
    var blocks = {};
    Object.keys(ROLE_CAPABILITY).forEach(function (role) {
      if (role === 'Superadmin') return; // Superadmin blocks nothing
      var blocked = GATED_PAGES.filter(function (p) {
        return ROLE_CAPABILITY[role][pageCapKey(p)] === false;
      });
      blocks[role] = new Set(blocked);
    });
    return blocks;
  }

  var api = {
    ROLE_CAPABILITY: ROLE_CAPABILITY,
    GATED_PAGES: GATED_PAGES,
    roleCanAccessPage: roleCanAccessPage,
    computeRoleHardBlocks: computeRoleHardBlocks
  };

  // Browser global + CommonMS (Playwright/node) compatibility.
  root.RoleCapability = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
