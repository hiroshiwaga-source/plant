# Database Schema, RLS Plan, and Storage Plan

**Document status:** Implemented in `supabase/migrations/` (this file remains the human-readable spec; driftしたらマイグレーションを正とする).

## 1. Conventions

- All user-owned tables include `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.  
- RLS **enabled** on every table listed below.  
- Default deny: no policy → no access.  
- Prefer `gen_random_uuid()` for primary keys.  
- Timestamps: `created_at`, `updated_at` with `updated_at` maintained by trigger.

## 2. Schema (tables)

### 2.1 `plants`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| user_id | uuid | Owner |
| display_name | text | Optional; not used in Storage paths |
| species_name | text | Nullable |
| notes | text | Nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Indexes: `(user_id)`, `(user_id, id)`.

### 2.2 `care_logs`

Single table with a **type** enum to avoid four nearly identical tables.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| user_id | uuid | Owner |
| plant_id | uuid | FK → plants(id) |
| log_type | text or enum | `water` \| `fertilizer` \| `pruning` \| `repotting` |
| occurred_at | timestamptz | When the event happened |
| notes | text | Nullable |
| meta | jsonb | Nullable; optional structured fields (dilution, amount) — avoid PII |
| created_at | timestamptz | |

Indexes: `(user_id, plant_id, occurred_at DESC)`.

FK: `(plant_id, user_id)` must reference a plant owned by the same user — enforce with composite FK or trigger:

```sql
-- Illustrative: composite unique on plants(id, user_id) then FK care_logs(plant_id, user_id) REFERENCES plants(id, user_id)
```

### 2.3 `plant_photos`

Metadata for Storage objects. **No** image bytes in Postgres.

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK; used as `photo_id` in Storage path |
| user_id | uuid | Owner |
| plant_id | uuid | FK → plants |
| storage_path | text | `{user_id}/{plant_id}/{photo_id}` — canonical |
| content_type | text | e.g. image/jpeg |
| byte_size | int | Nullable |
| created_at | timestamptz | |

Unique: `(storage_path)`.

### 2.4 `plant_diagnoses` (AI outputs)

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| user_id | uuid | Owner |
| plant_id | uuid | FK → plants |
| source_photo_id | uuid | Nullable FK → plant_photos |
| model_provider | text | e.g. openai, anthropic, plantid |
| model_name | text | Non-secret model id |
| summary | text | User-facing; possibility-framed |
| structured | jsonb | Nullable; e.g. `{ "possible_issues": [...] }` |
| created_at | timestamptz | |

Indexes: `(user_id, plant_id, created_at DESC)`.

### 2.5 `care_recommendations` (optional, for “today’s actions”)

If recommendations are persisted per day:

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK |
| user_id | uuid | Owner |
| plant_id | uuid | FK → plants |
| for_date | date | Calendar date in user’s TZ (store TZ separately or UTC date + rule) |
| actions | jsonb | Structured list |
| source | text | `rules` \| `ai` |
| created_at | timestamptz | |

Unique: `(user_id, plant_id, for_date)` if one row per plant per day.

---

## 3. RLS policy plan

**Principle:** For each table, users may only access rows where `user_id = auth.uid()`.

### 3.1 Enable RLS

```sql
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_recommendations ENABLE ROW LEVEL SECURITY;
```

### 3.2 Standard CRUD policies (per table)

For **SELECT, INSERT, UPDATE, DELETE**:

- **SELECT:** `USING (user_id = auth.uid())`  
- **INSERT:** `WITH CHECK (user_id = auth.uid())`  
- **UPDATE:** `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`  
- **DELETE:** `USING (user_id = auth.uid())`

**Optional hardening:** Revoke broad `PUBLIC`/`anon` grants on tables and expose only via PostgREST with above policies (follow Supabase defaults carefully).

### 3.3 `service_role` / Edge Functions

- Mobile uses **authenticated** JWT only.  
- Edge Functions that must bypass RLS for batch jobs should use `service_role` **only inside the function** and **manually** filter by `user_id` derived from verified JWT — prefer `auth.get_user(jwt)` pattern or Supabase helper.  
- Avoid exposing a generic “admin” API without additional checks.

### 3.4 Triggers (recommended)

- **Set `user_id` on insert:** `BEFORE INSERT` trigger sets `NEW.user_id := auth.uid()` and rejects if `NEW.user_id` is null or mismatched — reduces client tampering risk.  
- **Validate plant ownership** on `care_logs`, `plant_photos`, `plant_diagnoses`: `BEFORE INSERT/UPDATE` ensure `plant_id` belongs to same `user_id`.

---

## 4. Storage access policy plan

### 4.1 Bucket

- Name: e.g. `plant-photos`  
- **Private** (no public bucket listing).  
- File size and MIME limits at bucket or application level.

### 4.2 Object path convention

`{user_id}/{plant_id}/{photo_id}`

- UUIDs only — **no** slugified person names or plant nicknames.  
- `photo_id` matches `plant_photos.id`.

### 4.3 Storage RLS (Supabase Storage policies)

Policies on `storage.objects` for bucket `plant-photos`:

| Operation | Rule |
|-----------|------|
| INSERT (upload) | `bucket_id = 'plant-photos' AND (storage.foldername(name))[1] = auth.uid()::text` AND path matches plant ownership (see below) |
| SELECT (download) | Same folder prefix = `auth.uid()` |
| UPDATE/DELETE | Same as SELECT |

**Path validation:** Enforce that `(storage.foldername(name))[2]` = `plant_id` and that `plant_id` exists in `plants` for `auth.uid()`. Supabase Storage policies can use `EXISTS` subqueries against `plants` and `plant_photos` where supported.

If policy expressions become too complex, **narrow** client upload to signed upload URLs minted by an Edge Function that validates ownership (still keep bucket private).

### 4.4 Server-side reads for AI

- Edge Function uses **service_role** to read object bytes by `storage_path` after verifying the requesting user owns the row in `plant_photos`.  
- Never return short-lived signed URLs to the client for logging; if the client needs a thumbnail, prefer a separate processed object under the same path policy or a signed URL generated in-memory without logging the URL.

---

## 5. Migration order (implementation)

1. Create tables + FKs + indexes.  
2. Enable RLS + policies.  
3. Create Storage bucket + Storage policies.  
4. Add triggers for `user_id` and ownership.  
5. Run isolation tests (see [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)).
