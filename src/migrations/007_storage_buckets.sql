-- =============================================================================
-- 007_storage_buckets.sql — allow all storage access
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('medical-records', 'medical-records', true, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('dog-images', 'dog-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('health-reports', 'health-reports', true, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

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
