-- 20260509000005_documents_storage_bucket.sql
-- Create the 'documents' storage bucket + per-user RLS on storage.objects.
-- Without this the frontend upload (js/app.js handleFileUpload) fails with
-- "Bucket not found" and silently falls back to a localStorage-only copy.
--
-- Path layout written by the frontend:
--   {auth.uid()}/{timestamp}_{rand}.{ext}
-- so policies match on the first path segment == auth.uid()::text.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE: Do NOT `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` here.
-- On hosted Supabase that table is owned by supabase_storage_admin and the
-- migration role doesn't own it (errors with SQLSTATE 42501). RLS is already
-- enabled by default on storage.objects, so we only need to define policies.

DROP POLICY IF EXISTS "documents_select_own" ON storage.objects;
CREATE POLICY "documents_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "documents_insert_own" ON storage.objects;
CREATE POLICY "documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "documents_update_own" ON storage.objects;
CREATE POLICY "documents_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "documents_delete_own" ON storage.objects;
CREATE POLICY "documents_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
