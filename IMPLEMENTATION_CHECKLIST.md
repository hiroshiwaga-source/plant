# Implementation Checklist (Security-First)

**Use this list after design review and before shipping features.** Do not treat as complete until all items are checked.

## Phase 0 — Repository & secrets

- [ ] `.env.example` present; **no** committed `.env` with real secrets  
- [ ] `.gitignore` includes `.env`, `.env.local`, `*.pem`, service role files  
- [ ] CI job fails on suspicious patterns (e.g. `service_role`, long `sk-` keys in diff) — optional but recommended  
- [ ] Document in README: never put AI keys in Expo public env  

## Phase 1 — Supabase project

- [ ] Create project in intended region  
- [ ] Enable leaked password protection / MFA for dashboard admins (org policy)  
- [ ] **RLS enabled** on all user tables before any production data  

## Phase 2 — Database

- [ ] Migrations match [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)  
- [ ] Every user table has `user_id` + FK to `auth.users`  
- [ ] Triggers: default `user_id` from `auth.uid()`; validate `plant_id` ownership on child tables  
- [ ] No policy allows `USING (true)` for authenticated users on user data tables  

## Phase 3 — Storage

- [ ] Bucket `plant-photos` (or chosen name) is **private**  
- [ ] Upload paths strictly `{user_id}/{plant_id}/{photo_id}`  
- [ ] Storage policies deny cross-user prefix access  
- [ ] Confirm list/search APIs do not leak other users’ object names  

## Phase 4 — Edge Functions (AI)

- [ ] All AI provider keys only in `supabase secrets` (or equivalent)  
- [ ] Functions verify JWT and derive `user_id` before reads/writes  
- [ ] Functions never log keys, JWTs, signed URLs, raw images, full prompts/responses  
- [ ] Responses persisted with possibility-framed copy; schema validation on output  
- [ ] Rate limiting per user on AI endpoints  

## Phase 5 — Expo client

- [ ] Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (and non-secrets) in client  
- [ ] No `service_role`, no OpenAI/Anthropic/Plant.id keys in repo or EAS public config  
- [ ] Supabase client uses user session; no “impersonation” helpers in production builds  

## Phase 6 — Tests / checks (cross-tenant isolation)

**Requirement:** Prove user A cannot read user B’s plants, photos, logs, or diagnoses.

### 6.1 Automated (recommended)

- [ ] **Supabase pgTAP or SQL tests:** As user A JWT (or `set local role` + `request.jwt.claims`), `SELECT`/`UPDATE` on user B’s `plant_id` returns 0 rows or fails policy  
- [ ] Repeat for `care_logs`, `plant_photos`, `plant_diagnoses`, `care_recommendations`  
- [ ] **Storage:** Attempt `getPublicUrl` or download as user A for user B’s path — must fail  
- [ ] **Edge Function:** Call with user A JWT requesting analysis for user B’s `plant_id` — must return 403 or empty  

### 6.2 Manual verification script

- [ ] Document steps: create two users in staging, create data as B, log in as A, confirm app and raw API show no B data  

### 6.3 CI

- [ ] Run SQL isolation tests on each migration PR (`supabase db test` or custom runner)  

## Phase 7 — Privacy & legal

- [ ] In-app privacy policy link  
- [ ] AI disclosure / opt-in if required by product  
- [ ] Vendor list matches actual APIs used  

## Phase 8 — Release

- [ ] Security review of new Edge Function routes  
- [ ] Confirm logging/redaction in staging with sample traffic  
- [ ] Incident contacts documented in [SECURITY.md](./SECURITY.md)  

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering | | |
| Security/Privacy (if any) | | |
