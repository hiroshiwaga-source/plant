# Threat Model — Plant Care App (Expo + Supabase)

**Document status:** Pre-implementation (design-only).  
**Scope:** Mobile client (Expo), Supabase (Auth, Postgres, Storage), server-side AI (Supabase Edge Functions or equivalent).

## System context

| Component | Trust boundary |
|-----------|----------------|
| User device | Untrusted (rooted/jailbroken possible, debugger attached) |
| Expo app binary | Untrusted for secret storage; `EXPO_PUBLIC_*` is world-readable |
| Supabase Auth | Trusted issuer of JWTs; client holds session only |
| Supabase Postgres + RLS | Trusted enforcement for row access |
| Supabase Storage + policies | Trusted enforcement for object access |
| Edge Functions (server) | Trusted to hold provider API keys; must not leak via logs/responses |

## Assets to protect

1. **User identity** — `auth.users`, session tokens, linkage to plant data  
2. **Plant metadata** — names, species, care schedules, notes  
3. **Care logs** — watering, fertilizer, pruning, repotting history  
4. **Photos** — binary image data in Storage  
5. **AI outputs** — diagnoses, recommendations (may infer health, environment)  
6. **Secrets** — `service_role`, OpenAI/Anthropic/Plant.id/Kindwise keys, webhook secrets  

## Threat actors

- **Remote anonymous attacker** — API abuse, credential stuffing, mass enumeration  
- **Malicious other user** — attempt cross-tenant reads/writes via forged IDs or policy gaps  
- **Compromised device** — extraction of app bundle, `EXPO_PUBLIC_*`, cached data  
- **Insider / operator mistake** — logging secrets, deploying wrong env, disabling RLS  
- **Third-party AI provider** — data retention, training use, subpoena (mitigate via minimization + DPAs)  

## STRIDE summary

| Category | Example threat | Mitigation (design) |
|----------|----------------|---------------------|
| **Spoofing** | Attacker presents another user’s JWT | Short-lived tokens; Supabase Auth; no custom “user id” from client without RLS check |
| **Tampering** | Modify `user_id` on insert | DB defaults + RLS `WITH CHECK`; server paths validate ownership |
| **Repudiation** | User denies creating a log | Audit optional; timestamps + `user_id` on rows |
| **Information disclosure** | Cross-tenant SELECT; public bucket; logs with PII | RLS on all user tables; private bucket; logging policy |
| **Denial of service** | Storage/AI quota exhaustion | Rate limits, quotas, server-side AI invocation only |
| **Elevation of privilege** | Use `service_role` on client | Never ship `service_role`; Edge Functions only |

## Specific threat scenarios

### T1: API keys in client bundle

**Risk:** OpenAI/Anthropic/Plant.id keys extracted; financial abuse; data exfiltration via model.  
**Mitigation:** Keys only in Edge Function (or other server) secrets; client calls signed-in user endpoint only.

### T2: `service_role` in mobile app

**Risk:** Full database/storage bypass.  
**Mitigation:** Anon + user JWT only on client; automation uses `service_role` only in CI/deploy secrets.

### T3: RLS missing or overly permissive

**Risk:** User A reads user B’s plants, photos, logs, diagnoses.  
**Mitigation:** RLS on every user-owned table; policies use `auth.uid() = user_id`; tests required before release.

### T4: Storage path leaks or guessable paths

**Risk:** Enumeration of objects if paths predictable and policies wrong.  
**Mitigation:** Private bucket; path `{user_id}/{plant_id}/{photo_id}`; RLS-aligned Storage policies; no names in paths.

### T5: Over-logging

**Risk:** Secrets, JWTs, signed URLs, prompts, or image bytes in logs.  
**Mitigation:** Logging policy; structured logs with allowlist fields; redaction in Edge Functions.

### T6: AI over-claiming or unsafe advice

**Risk:** Harm if user treats output as medical/plant “diagnosis” certainty.  
**Mitigation:** Copy and schema: possibilities only; disclaimers; no definitive pathology claims.

### T7: Excessive PII/care data sent to models

**Risk:** Provider retention, breach blast radius.  
**Mitigation:** Minimize fields; avoid raw EXIF location if not needed; optional image downscaling/strip metadata server-side.

## Assumptions and non-goals (initial)

- **Assumption:** Supabase project configuration (RLS enabled, no public `service_role` in repos) is enforced in CI.  
- **Non-goal:** Protection against a user screenshotting their own data.  
- **Non-goal:** Hiding Supabase `anon` key (it is public by design; security relies on RLS + Auth).

## Review triggers (update this document when…)

- New third-party AI or identification API is added  
- New tables, buckets, or Edge Function entrypoints  
- Change from private to signed-URL access patterns  
- Export/sharing features that cross tenant boundaries  
