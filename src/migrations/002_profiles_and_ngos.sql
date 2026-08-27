-- =============================================================================
-- 002_profiles_and_ngos.sql — RLS: USING (true) WITH CHECK (true)
-- =============================================================================

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

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

CREATE INDEX IF NOT EXISTS idx_ngos_owner_id ON public.ngos(owner_id);

DROP TRIGGER IF EXISTS ngos_set_updated_at ON public.ngos;
CREATE TRIGGER ngos_set_updated_at BEFORE UPDATE ON public.ngos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ngo_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id uuid NOT NULL REFERENCES public.ngos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff', 'volunteer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ngo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ngo_members_user_id ON public.ngo_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ngo_members_ngo_id ON public.ngo_members(ngo_id);

CREATE OR REPLACE FUNCTION public.handle_new_ngo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ngo_members (ngo_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (ngo_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ngo_created ON public.ngos;
CREATE TRIGGER on_ngo_created AFTER INSERT ON public.ngos
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_ngo();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngo_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "allow_all_profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_ngos" ON public.ngos;
DROP POLICY IF EXISTS "ngos_select_authenticated" ON public.ngos;
DROP POLICY IF EXISTS "ngos_insert_authenticated" ON public.ngos;
DROP POLICY IF EXISTS "ngos_update_members" ON public.ngos;
DROP POLICY IF EXISTS "ngos_delete_owner" ON public.ngos;
CREATE POLICY "allow_all_ngos" ON public.ngos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_ngo_members" ON public.ngo_members;
DROP POLICY IF EXISTS "ngo_members_select" ON public.ngo_members;
DROP POLICY IF EXISTS "ngo_members_insert_admin" ON public.ngo_members;
DROP POLICY IF EXISTS "ngo_members_update_admin" ON public.ngo_members;
DROP POLICY IF EXISTS "ngo_members_delete_admin" ON public.ngo_members;
CREATE POLICY "allow_all_ngo_members" ON public.ngo_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
