-- plant: core schema, RLS, storage bucket policies, triggers
-- Requires: pgcrypto (gen_random_uuid) — enabled by default on Supabase

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
CREATE TYPE public.care_log_type AS ENUM (
  'water',
  'fertilizer',
  'pruning',
  'repotting'
);

CREATE TYPE public.recommendation_source AS ENUM (
  'rules',
  'ai'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  species_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX plants_user_id_idx ON public.plants (user_id);

CREATE TABLE public.care_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plant_id uuid NOT NULL,
  log_type public.care_log_type NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plant_id, user_id) REFERENCES public.plants (id, user_id) ON DELETE CASCADE
);

CREATE INDEX care_logs_user_plant_occurred_idx
  ON public.care_logs (user_id, plant_id, occurred_at DESC);

CREATE TABLE public.plant_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plant_id uuid NOT NULL,
  storage_path text NOT NULL,
  content_type text NOT NULL,
  byte_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plant_id, user_id) REFERENCES public.plants (id, user_id) ON DELETE CASCADE,
  UNIQUE (id, user_id),
  UNIQUE (storage_path)
);

CREATE INDEX plant_photos_user_plant_idx ON public.plant_photos (user_id, plant_id);

CREATE TABLE public.plant_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plant_id uuid NOT NULL,
  source_photo_id uuid,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  summary text NOT NULL,
  structured jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plant_id, user_id) REFERENCES public.plants (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (source_photo_id, user_id) REFERENCES public.plant_photos (id, user_id) ON DELETE SET NULL
);

CREATE INDEX plant_diagnoses_user_plant_created_idx
  ON public.plant_diagnoses (user_id, plant_id, created_at DESC);

CREATE TABLE public.care_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  plant_id uuid NOT NULL,
  for_date date NOT NULL,
  actions jsonb NOT NULL,
  source public.recommendation_source NOT NULL DEFAULT 'rules',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (plant_id, user_id) REFERENCES public.plants (id, user_id) ON DELETE CASCADE,
  UNIQUE (user_id, plant_id, for_date)
);

CREATE INDEX care_recommendations_user_plant_date_idx
  ON public.care_recommendations (user_id, plant_id, for_date DESC);

-- ---------------------------------------------------------------------------
-- Triggers: user_id, updated_at, storage path shape
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_user_id_from_jwt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NEW.user_id IS NOT NULL AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'user_id must match authenticated user';
  END IF;
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_prevent_user_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_plant_photo_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected text;
BEGIN
  expected :=
    auth.uid()::text || '/' || NEW.plant_id::text || '/' || NEW.id::text;
  IF NEW.storage_path IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'storage_path must equal user_id/plant_id/photo_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER plants_set_user_id
  BEFORE INSERT ON public.plants
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_user_id_from_jwt();

CREATE TRIGGER plants_prevent_user_id_change
  BEFORE UPDATE ON public.plants
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_prevent_user_id_change();

CREATE TRIGGER plants_set_updated_at
  BEFORE UPDATE ON public.plants
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER care_logs_set_user_id
  BEFORE INSERT ON public.care_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_user_id_from_jwt();

CREATE TRIGGER care_logs_prevent_user_id_change
  BEFORE UPDATE ON public.care_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_prevent_user_id_change();

CREATE TRIGGER plant_photos_set_user_id
  BEFORE INSERT ON public.plant_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_user_id_from_jwt();

CREATE TRIGGER plant_photos_enforce_path
  BEFORE INSERT ON public.plant_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_plant_photo_path();

CREATE TRIGGER plant_photos_prevent_user_id_change
  BEFORE UPDATE ON public.plant_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_prevent_user_id_change();

CREATE TRIGGER plant_diagnoses_set_user_id
  BEFORE INSERT ON public.plant_diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_user_id_from_jwt();

CREATE TRIGGER plant_diagnoses_prevent_user_id_change
  BEFORE UPDATE ON public.plant_diagnoses
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_prevent_user_id_change();

CREATE TRIGGER care_recommendations_set_user_id
  BEFORE INSERT ON public.care_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_set_user_id_from_jwt();

CREATE TRIGGER care_recommendations_prevent_user_id_change
  BEFORE UPDATE ON public.care_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_prevent_user_id_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_recommendations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.care_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plant_photos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plant_diagnoses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.care_recommendations FORCE ROW LEVEL SECURITY;

CREATE POLICY plants_select_own ON public.plants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY plants_insert_own ON public.plants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plants_update_own ON public.plants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plants_delete_own ON public.plants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY care_logs_select_own ON public.care_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY care_logs_insert_own ON public.care_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_logs_update_own ON public.care_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_logs_delete_own ON public.care_logs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY plant_photos_select_own ON public.plant_photos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY plant_photos_insert_own ON public.plant_photos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plant_photos_update_own ON public.plant_photos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plant_photos_delete_own ON public.plant_photos
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY plant_diagnoses_select_own ON public.plant_diagnoses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY plant_diagnoses_insert_own ON public.plant_diagnoses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plant_diagnoses_update_own ON public.plant_diagnoses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY plant_diagnoses_delete_own ON public.plant_diagnoses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY care_recommendations_select_own ON public.care_recommendations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY care_recommendations_insert_own ON public.care_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_recommendations_update_own ON public.care_recommendations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY care_recommendations_delete_own ON public.care_recommendations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (Supabase roles)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket + policies (metadata row must exist first)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'plant-photos',
  'plant-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY plant_photos_storage_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'plant-photos'
    AND (storage.foldername (name))[1] = auth.uid()::text
  );

CREATE POLICY plant_photos_storage_insert_with_metadata ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plant-photos'
    AND EXISTS (
      SELECT 1
      FROM public.plant_photos pp
      WHERE pp.user_id = auth.uid()
        AND pp.storage_path = name
    )
  );

CREATE POLICY plant_photos_storage_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'plant-photos'
    AND (storage.foldername (name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'plant-photos'
    AND (storage.foldername (name))[1] = auth.uid()::text
  );

CREATE POLICY plant_photos_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'plant-photos'
    AND (storage.foldername (name))[1] = auth.uid()::text
  );
