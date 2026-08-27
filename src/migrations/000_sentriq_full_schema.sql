-- =============================================================================
-- SentriQ full schema (run once in SQL Editor)
-- All RLS policies: USING (true) WITH CHECK (true) — open access for authenticated
-- Project: pwomrtwoihtulautvjwv
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_ngo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ngo_members (ngo_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (ngo_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ngo_dogs_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ngos SET dogs_count = dogs_count + 1 WHERE id = NEW.ngo_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ngos SET dogs_count = GREATEST(dogs_count - 1, 0) WHERE id = OLD.ngo_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.ngo_id IS DISTINCT FROM OLD.ngo_id THEN
    UPDATE public.ngos SET dogs_count = GREATEST(dogs_count - 1, 0) WHERE id = OLD.ngo_id;
    UPDATE public.ngos SET dogs_count = dogs_count + 1 WHERE id = NEW.ngo_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_dog_alert_flag()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dog_id uuid;
  v_active boolean;
  v_message text;
  v_severity text;
BEGIN
  v_dog_id := COALESCE(NEW.dog_id, OLD.dog_id);
  SELECT EXISTS (SELECT 1 FROM public.dog_alerts WHERE dog_id = v_dog_id AND is_active = true) INTO v_active;
  SELECT message, severity INTO v_message, v_severity
  FROM public.dog_alerts WHERE dog_id = v_dog_id AND is_active = true
  ORDER BY created_at DESC LIMIT 1;
  UPDATE public.dogs SET
    has_alert = v_active,
    alert_message = CASE WHEN v_active THEN v_message ELSE NULL END,
    status = CASE
      WHEN v_active AND v_severity = 'critical' THEN 'critical'
      WHEN v_active THEN 'warning'
      WHEN status IN ('critical', 'warning') THEN 'online'
      ELSE status
    END
  WHERE id = v_dog_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff', 'volunteer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ngos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  location text DEFAULT '',
  email text,
  phone text,
  logo_url text,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dogs_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ngo_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff', 'volunteer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ngo_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.dogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  name text NOT NULL,
  breed text DEFAULT '',
  species text DEFAULT '',
  age text DEFAULT '',
  weight text DEFAULT '',
  device_id text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'warning', 'critical')),
  has_alert boolean NOT NULL DEFAULT false,
  alert_message text,
  last_seen timestamptz,
  notes text DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dog_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  message text NOT NULL,
  vital_type text,
  vital_value numeric,
  is_active boolean NOT NULL DEFAULT true,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vital_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  temperature numeric,
  heart_rate integer,
  spo2 numeric,
  activity text,
  speed_kmph numeric,
  latitude numeric,
  longitude numeric,
  sats integer,
  battery_level integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('vaccination', 'prescription', 'report', 'other')),
  title text NOT NULL,
  notes text DEFAULT '',
  file_url text,
  file_path text,
  file_name text,
  file_size integer,
  mime_type text,
  record_date date DEFAULT CURRENT_DATE,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('diagnosis', 'treatment', 'surgery', 'allergy', 'chronic', 'general')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  diagnosis text,
  treatment text,
  veterinarian text,
  occurred_on date,
  is_chronic boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ngo_id uuid REFERENCES public.ngos(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  tags text[] DEFAULT '{}',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dog_id uuid REFERENCES public.dogs(id) ON DELETE SET NULL,
  title text DEFAULT 'Dog Health Chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  period_type text NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  file_url text,
  file_path text,
  summary jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ngos_owner_id ON public.ngos(owner_id);
CREATE INDEX IF NOT EXISTS idx_ngo_members_user_id ON public.ngo_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ngo_members_ngo_id ON public.ngo_members(ngo_id);
CREATE INDEX IF NOT EXISTS idx_dogs_ngo_id ON public.dogs(ngo_id);
CREATE INDEX IF NOT EXISTS idx_dogs_device_id ON public.dogs(device_id);
CREATE INDEX IF NOT EXISTS idx_dog_alerts_dog_id ON public.dog_alerts(dog_id);
CREATE INDEX IF NOT EXISTS idx_vital_readings_dog_time ON public.vital_readings(dog_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_dog_id ON public.medical_records(dog_id);
CREATE INDEX IF NOT EXISTS idx_medical_history_dog_id ON public.medical_history(dog_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON public.chat_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_reports_dog ON public.health_reports(dog_id, created_at DESC);

-- Triggers
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS ngos_set_updated_at ON public.ngos;
CREATE TRIGGER ngos_set_updated_at BEFORE UPDATE ON public.ngos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_ngo_created ON public.ngos;
CREATE TRIGGER on_ngo_created AFTER INSERT ON public.ngos
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_ngo();

DROP TRIGGER IF EXISTS dogs_set_updated_at ON public.dogs;
CREATE TRIGGER dogs_set_updated_at BEFORE UPDATE ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS dogs_sync_count ON public.dogs;
CREATE TRIGGER dogs_sync_count AFTER INSERT OR DELETE OR UPDATE OF ngo_id ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.sync_ngo_dogs_count();

DROP TRIGGER IF EXISTS dog_alerts_sync_flag ON public.dog_alerts;
CREATE TRIGGER dog_alerts_sync_flag AFTER INSERT OR UPDATE OR DELETE ON public.dog_alerts
  FOR EACH ROW EXECUTE FUNCTION public.sync_dog_alert_flag();

DROP TRIGGER IF EXISTS medical_records_set_updated_at ON public.medical_records;
CREATE TRIGGER medical_records_set_updated_at BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS medical_history_set_updated_at ON public.medical_history;
CREATE TRIGGER medical_history_set_updated_at BEFORE UPDATE ON public.medical_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS community_posts_set_updated_at ON public.community_posts;
CREATE TRIGGER community_posts_set_updated_at BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS community_likes_sync ON public.community_likes;
CREATE TRIGGER community_likes_sync AFTER INSERT OR DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

DROP TRIGGER IF EXISTS community_comments_sync ON public.community_comments;
CREATE TRIGGER community_comments_sync AFTER INSERT OR DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comments_count();

DROP TRIGGER IF EXISTS chat_conversations_set_updated_at ON public.chat_conversations;
CREATE TRIGGER chat_conversations_set_updated_at BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngo_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vital_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_reports ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','ngos','ngo_members','dogs','dog_alerts','vital_readings',
        'medical_records','medical_history','community_posts','community_comments',
        'community_likes','chat_conversations','chat_messages','health_reports'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Allow-all policies (USING true / WITH CHECK true)
CREATE POLICY "allow_all_profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ngos" ON public.ngos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_ngo_members" ON public.ngo_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_dogs" ON public.dogs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_dog_alerts" ON public.dog_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vital_readings" ON public.vital_readings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_medical_records" ON public.medical_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_medical_history" ON public.medical_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_community_posts" ON public.community_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_community_comments" ON public.community_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_community_likes" ON public.community_likes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_chat_conversations" ON public.chat_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_chat_messages" ON public.chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_health_reports" ON public.health_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow anon read on community for public landing (optional)
CREATE POLICY "anon_read_community_posts" ON public.community_posts FOR SELECT TO anon USING (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('medical-records', 'medical-records', true, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('dog-images', 'dog-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('health-reports', 'health-reports', true, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage allow-all for authenticated
DO $$
BEGIN
  DROP POLICY IF EXISTS "medical_records_storage_select" ON storage.objects;
  DROP POLICY IF EXISTS "medical_records_storage_insert" ON storage.objects;
  DROP POLICY IF EXISTS "medical_records_storage_delete" ON storage.objects;
  DROP POLICY IF EXISTS "dog_images_storage_select" ON storage.objects;
  DROP POLICY IF EXISTS "dog_images_storage_insert" ON storage.objects;
  DROP POLICY IF EXISTS "dog_images_storage_delete" ON storage.objects;
  DROP POLICY IF EXISTS "health_reports_storage_select" ON storage.objects;
  DROP POLICY IF EXISTS "health_reports_storage_insert" ON storage.objects;
  DROP POLICY IF EXISTS "health_reports_storage_delete" ON storage.objects;
  DROP POLICY IF EXISTS "allow_all_storage_select" ON storage.objects;
  DROP POLICY IF EXISTS "allow_all_storage_insert" ON storage.objects;
  DROP POLICY IF EXISTS "allow_all_storage_update" ON storage.objects;
  DROP POLICY IF EXISTS "allow_all_storage_delete" ON storage.objects;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "allow_all_storage_select" ON storage.objects FOR SELECT TO public USING (true);
CREATE POLICY "allow_all_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_all_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (true);
