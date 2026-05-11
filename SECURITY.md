# Security — Plant Care App

**Principles:** Defense in depth, least privilege, assume the mobile client and `EXPO_PUBLIC_*` are public.

## 1. Client vs server responsibilities

| Responsibility | Mobile (Expo) | Server (Edge Functions / backend) |
|----------------|---------------|-------------------------------------|
| Hold user session | Yes (Supabase session) | Validate JWT on each request |
| Hold `anon` key | Yes (`EXPO_PUBLIC_`) | N/A |
| Hold `service_role` | **Never** | Yes, only in hosted secret store |
| Call OpenAI / Anthropic / Plant.id / Kindwise | **Never** | Yes |
| Enforce row ownership | Rely on RLS (not UI alone) | Double-check on privileged paths |

## 2. What is “public” in Expo

- Any `EXPO_PUBLIC_*` variable is bundled and recoverable from the app.  
- Treat as **world-readable**: only Supabase URL + anon key, and non-sensitive feature flags.  
- **Never** prefix secrets with `EXPO_PUBLIC_`.

## 3. Secret management plan

### 3.1 Classification

| Secret | Where it lives | Client exposure |
|--------|----------------|-----------------|
| Supabase `anon` key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Allowed (public) |
| Supabase `service_role` | Supabase dashboard / CI deploy secrets / Edge Function secrets | **Forbidden** on client |
| OpenAI / Anthropic / Plant.id / Kindwise keys | Edge Function secrets (or vault) | **Forbidden** on client |
| JWT signing secrets (Supabase) | Managed by Supabase | N/A for app code |
| Webhook signing secrets (if any) | Server only | **Forbidden** on client |

### 3.2 Provisioning workflow

1. **Local dev:** Developer copies `.env.example` → local `.env` (gitignored). Real `.env` is never committed.  
2. **Expo EAS:** Use EAS Secrets for any build-time non-public values; still **do not** put AI keys in Expo for client-side use — only for CI if a step must call a server.  
3. **Supabase Edge Functions:** `supabase secrets set KEY=value` (or dashboard). Keys referenced via `Deno.env.get` only inside functions.  
4. **Rotation:** Document owner; rotate on leak suspicion; revoke old keys in provider dashboards.

### 3.3 Repository rules

- `.env.example` only — placeholders, no real values.  
- Pre-commit or CI grep for patterns: `sk-`, `service_role`, `OPENAI_API_KEY=` with long tokens, etc. (implementation checklist).

## 4. Logging policy

### 4.1 Forbidden in logs (production)

- API keys, `service_role`, webhook secrets  
- Full JWTs, refresh tokens, session cookies  
- Raw email addresses (unless legally required and redacted elsewhere)  
- Signed URLs or long-lived storage URLs  
- Raw image bytes, base64 images  
- Full raw prompts or full model responses containing user PII (truncate + redact)  

### 4.2 Allowed (examples)

- Request id, Edge Function name, duration, error **codes**  
- `user_id` as opaque UUID **only when necessary** for debugging incidents (prefer hash in high-volume logs)  
- AI call: provider name, model id, token counts **aggregated**, outcome (success/fail)  

### 4.3 Practices

- Structured logging (JSON); default log level `info` in prod; verbose debug only in non-prod.  
- Crash reporting SDKs: verify they do not attach screenshots by default if they could show sensitive screens.  

## 5. AI safety (security + safety)

- All model outputs stored or shown as **possibilities**, not definitive diagnoses.  
- Server validates output shape before persisting; reject chain-of-thought or disallowed content if providers return it.  
- Rate limit AI endpoints per `user_id` to reduce abuse.

## 6. Incident response (lightweight)

1. Revoke leaked keys at provider + Supabase.  
2. Rotate Edge Function secrets; redeploy.  
3. Review Storage access logs if available; invalidate sessions if JWT leak suspected.  
4. Post-mortem: update THREAT_MODEL.md and this file.

## 7. Related documents

- [THREAT_MODEL.md](./THREAT_MODEL.md)  
- [DATA_FLOW.md](./DATA_FLOW.md)  
- [PRIVACY.md](./PRIVACY.md)  
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — schema + RLS plan  
- [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)  
