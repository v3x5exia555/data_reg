# Findings & Decisions

## Requirements
- PDPA Compliance Portal (DataRex)
- User authentication with Supabase
- Data register with CRUD operations
- Compliance checklist tracking
- Role-based navigation permissions
- Document storage/upload
- Consent and retention management

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Supabase for backend | Free tier, RLS security, easy auth |
| env.js for credentials | Load from env.json at runtime, not hardcoded |
| gen_random_uuid() | uuid_generate_v4() not available on remote DB |
| CREATE TABLE IF NOT EXISTS | Handle existing tables gracefully |
| localStorage fallback | Demo mode when Supabase not configured |

---

## Key Code Patterns

### Supabase Client Setup
```javascript
// env.js loads window.ENV from /env.json
// app.js uses getSupabaseClient() to access client
```

### Navigation Items (js/app.js)
```javascript
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', section: 'Overview' },
  { id: 'checklist', label: 'Checklist', section: 'Overview' },
  // ... etc
];
```

### State Management
```javascript
const state = {
  isLoggedIn, user, bizType, currentUserLevel, navPermissions,
  checks, records, team, documents, customRoles
};
```

---

## Project Structure
```
data-reg/
├── index.html          # Main app HTML
├── js/
│   ├── app.js        # All application logic
│   └── env.js        # Env config loader
├── css/
│   └── style.css    # All styles
├── env.json         # Supabase credentials (gitignored)
├── .gitignore       # Excludes .env, venv, etc
└── supabase/
    └── migrations/  # Database schema
```

---

## Supabase Tables

| Table | Purpose | Key Column |
|-------|---------|------------|
| profiles | User data | id (FK to auth.users) |
| data_records | Data register | user_id |
| checklist_items | Compliance | user_id, item_id |
| team_members | Access control | org_id |
| consent_items | Consent tracking | user_id |
| retention_rules | Retention schedule | user_id |
| nav_permissions | Nav visibility | org_id, access_level, nav_item |

---

## Resources
- Supabase Docs: https://supabase.com/docs
- Supabase JS: https://supabase.com/docs/reference/javascript
- DM Sans Font: Google Fonts

---

## Server Commands
```bash
# Start server
python3 -m http.server 8060

# Push migration
npx supabase db push --linked --yes

# Kill port
lsof -ti:8060 | xargs kill -9
```