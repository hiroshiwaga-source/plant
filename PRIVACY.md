# Privacy — Plant Care App

**Document status:** Pre-implementation. This is a design statement; legal review may be required before production.

## 1. Data categories collected

| Category | Examples | Purpose |
|----------|----------|---------|
| Account | Email (Supabase Auth), auth metadata | Authentication |
| Plant profile | Species, notes, care preferences | App functionality |
| Care logs | Watering, fertilizer, pruning, repotting events | History and recommendations |
| Photos | User-uploaded plant images | Display and optional AI analysis |
| AI outputs | Textual “possible conditions” and care suggestions | User guidance |
| Technical | Device/app version, coarse error logs | Reliability (minimized) |

## 2. Data locations

- **Supabase (user’s region project):** Postgres + private Storage.  
- **AI providers (OpenAI, Anthropic, Plant.id, Kindwise, etc.):** Only data sent from **server-side** functions, following minimization rules in [DATA_FLOW.md](./DATA_FLOW.md).

## 3. Principles

1. **Minimization:** Send the smallest subset needed for a task; avoid raw EXIF location; avoid sending user email to models.  
2. **No secret leakage:** Privacy aligns with [SECURITY.md](./SECURITY.md) — no logging of secrets, JWTs, signed URLs, or image payloads.  
3. **User control:** Users can delete plants, logs, photos (implementation must cascade or soft-delete per product decision — document in schema migrations).  
4. **Third parties:** List each AI/provider in the eventual privacy policy; link to their privacy terms; prefer DPAs where available.

## 4. Photos

- Stored in a **private** bucket; paths use `{user_id}/{plant_id}/{photo_id}` — no personal or plant **names** in paths (reduces accidental exposure in support tools and logs).  
- Access only via authenticated Supabase rules or short-lived server-mediated access.

## 5. AI-specific privacy

- Outputs framed as **uncertain possibilities** (not medical/agronomic certainty).  
- Retention of prompts/responses at providers: governed by vendor settings and contracts; design assumes **sensitive content should not appear in prompts** beyond what is necessary.

## 6. User-facing transparency (to add before launch)

- Privacy policy URL in app settings.  
- Clear disclosure when an image or summary is sent for AI analysis; optional opt-out if product allows degraded features.

## 7. Data subject requests (design hook)

- Export: define whether v1 supports full JSON export via authenticated Edge Function.  
- Erasure: account deletion flow should remove or orphan user-owned rows per legal requirements (implementation detail in migrations).

## 8. Children and sensitive data

- If not targeting minors, state minimum age in terms of service.  
- Do not collect health data about **people**; plant health only.
