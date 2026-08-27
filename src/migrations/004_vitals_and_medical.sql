-- =============================================================================
-- 004_vitals_and_medical.sql — RLS: USING (true) WITH CHECK (true)
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_vital_readings_dog_time ON public.vital_readings(dog_id, recorded_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_medical_records_dog_id ON public.medical_records(dog_id);

DROP TRIGGER IF EXISTS medical_records_set_updated_at ON public.medical_records;
CREATE TRIGGER medical_records_set_updated_at BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

CREATE INDEX IF NOT EXISTS idx_medical_history_dog_id ON public.medical_history(dog_id);

DROP TRIGGER IF EXISTS medical_history_set_updated_at ON public.medical_history;
CREATE TRIGGER medical_history_set_updated_at BEFORE UPDATE ON public.medical_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vital_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_vital_readings" ON public.vital_readings;
DROP POLICY IF EXISTS "vital_readings_select" ON public.vital_readings;
DROP POLICY IF EXISTS "vital_readings_insert" ON public.vital_readings;
DROP POLICY IF EXISTS "vital_readings_delete" ON public.vital_readings;
CREATE POLICY "allow_all_vital_readings" ON public.vital_readings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_medical_records" ON public.medical_records;
DROP POLICY IF EXISTS "medical_records_select" ON public.medical_records;
DROP POLICY IF EXISTS "medical_records_insert" ON public.medical_records;
DROP POLICY IF EXISTS "medical_records_update" ON public.medical_records;
DROP POLICY IF EXISTS "medical_records_delete" ON public.medical_records;
CREATE POLICY "allow_all_medical_records" ON public.medical_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_medical_history" ON public.medical_history;
DROP POLICY IF EXISTS "medical_history_select" ON public.medical_history;
DROP POLICY IF EXISTS "medical_history_insert" ON public.medical_history;
DROP POLICY IF EXISTS "medical_history_update" ON public.medical_history;
DROP POLICY IF EXISTS "medical_history_delete" ON public.medical_history;
CREATE POLICY "allow_all_medical_history" ON public.medical_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
