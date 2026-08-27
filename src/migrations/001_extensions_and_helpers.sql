-- =============================================================================
-- 001_extensions_and_helpers.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Kept for compatibility; RLS is open (allow all)
CREATE OR REPLACE FUNCTION public.user_ngo_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ngo_id FROM public.ngo_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_ngo_member(p_ngo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT true;
$$;

CREATE OR REPLACE FUNCTION public.is_ngo_admin(p_ngo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT true;
$$;
