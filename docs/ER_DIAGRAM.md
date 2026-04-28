# DataRex Database Schema

## Tables (Linked by org_id)

```
┌────────────────────────────────────┐
│          COMPANIES                 │
├────────────────────────────────────┤
│ id (PK)                          │
│ name                            │
│ industry                       │
│ country                       │
│ dpo_name                      │
│ address                       │
│ contact_email                 │
└────────────────────────────────────┘
              │
              │ org_id
              ▼
 All these tables have: org_id FK
──────────────────────────────
  ┌──────────────┐  ┌──────────────┐
  │team_members │  │data_records │
  └──────────────┘  └──────────────┘
  ┌──────────────┐  ┌──────────────┐
  │ documents   │  │checklist_items
  └──────────────┘  └──────────────┘
  ┌──────────────┐  ┌──────────────┐
  │retention_rules│  │consent_settings
  └──────────────┘  └──────────────┘
  ┌──────────────┐  ┌──────────────┐
  │data_requests│  │ breach_log │
  └──────────────┘  └──────────────┘
  ┌──────────────┐  ┌──────────────┐
  │dpia_assessments│  │cross_border_transfers
  └──────────────┘  └──────────────┘
  ┌──────────────┐  ┌──────────────┐
  │  vendors    │  │training_records
  └──────────────┘  └──────────────┘
  ┌──────────────┐  ┌──────────────┐
  │   alerts    │  │   cases    │
  └──────────────┘  └──────────────┘
```

## Table Details

| Table | Key Column |
|-------|-----------|
| companies | id (PK) |
| team_members | org_id → companies.id |
| data_records | org_id → companies.id |
| documents | org_id → companies.id |
| checklist_items | org_id → companies.id |
| retention_rules | org_id → companies.id |
| consent_settings | org_id → companies.id |
| data_requests | org_id → companies.id |
| breach_log | org_id → companies.id |
| dpia_assessments | org_id → companies.id |
| cross_border_transfers | org_id → companies.id |
| vendors | org_id → companies.id |
| training_records | org_id → companies.id |
| alerts | org_id → companies.id |
| cases | org_id → companies.id |