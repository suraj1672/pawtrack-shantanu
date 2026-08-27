-- =============================================================================
-- 003_dogs_and_alerts.sql — RLS: USING (true) WITH CHECK (true)
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_dogs_ngo_id ON public.dogs(ngo_id);
CREATE INDEX IF NOT EXISTS idx_dogs_device_id ON public.dogs(device_id);

DROP TRIGGER IF EXISTS dogs_set_updated_at ON public.dogs;
CREATE TRIGGER dogs_set_updated_at BEFORE UPDATE ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

DROP TRIGGER IF EXISTS dogs_sync_count ON public.dogs;
CREATE TRIGGER dogs_sync_count AFTER INSERT OR DELETE OR UPDATE OF ngo_id ON public.dogs
  FOR EACH ROW EXECUTE FUNCTION public.sync_ngo_dogs_count();

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

CREATE INDEX IF NOT EXISTS idx_dog_alerts_dog_id ON public.dog_alerts(dog_id);

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

DROP TRIGGER IF EXISTS dog_alerts_sync_flag ON public.dog_alerts;
CREATE TRIGGER dog_alerts_sync_flag AFTER INSERT OR UPDATE OR DELETE ON public.dog_alerts
  FOR EACH ROW EXECUTE FUNCTION public.sync_dog_alert_flag();

ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_dogs" ON public.dogs;
DROP POLICY IF EXISTS "dogs_select_members" ON public.dogs;
DROP POLICY IF EXISTS "dogs_insert_members" ON public.dogs;
DROP POLICY IF EXISTS "dogs_update_members" ON public.dogs;
DROP POLICY IF EXISTS "dogs_delete_admin" ON public.dogs;
CREATE POLICY "allow_all_dogs" ON public.dogs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_dog_alerts" ON public.dog_alerts;
DROP POLICY IF EXISTS "dog_alerts_select_members" ON public.dog_alerts;
DROP POLICY IF EXISTS "dog_alerts_insert_members" ON public.dog_alerts;
DROP POLICY IF EXISTS "dog_alerts_update_members" ON public.dog_alerts;
DROP POLICY IF EXISTS "dog_alerts_delete_admin" ON public.dog_alerts;
CREATE POLICY "allow_all_dog_alerts" ON public.dog_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
