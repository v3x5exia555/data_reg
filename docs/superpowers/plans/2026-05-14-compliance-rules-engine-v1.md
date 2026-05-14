# Compliance Rules Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static Malaysia PDPA checklist into a generated, evidence-aware compliance flow driven by company profile answers.

**Architecture:** Keep the existing static HTML and vanilla JavaScript app. Add profile applicability fields, a small in-app rules engine that derives applicable obligations from the profile, generated checklist state, critical evidence enforcement, and weighted dashboard scoring. This is v1: no backend schema migration, but data is persisted in existing `dataRexState` local state.

**Tech Stack:** Static HTML fragments, vanilla JavaScript, localStorage, Playwright regression tests.

---

## Implementation Tasks

- [x] Add failing Playwright regression in `test_compliance_rules_engine.js`.
- [x] Add Malaysia PDPA applicability fields to `pages/23__profile.html`.
- [x] Persist applicability answers in `js/app.js`.
- [x] Add rules engine helpers and generated checklist state in `js/app.js`.
- [x] Add Generate Checklist summary UI in `pages/01__checklist.html`.
- [x] Add critical/evidence badges and evidence-required enforcement in checklist rendering.
- [x] Replace equal checklist score with weighted score.
- [x] Run focused and protected Playwright verification.
