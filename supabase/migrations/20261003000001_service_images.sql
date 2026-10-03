-- ============================================================================
-- SERVICE IMAGES
-- ============================================================================
-- Adds image support to services following the same pattern as product images.
-- Private bucket with RLS policies enforcing org-level access.
--
-- Path structure: {organization_id}/{service_id}.{ext}
-- ============================================================================

-- ============================================================================
-- 1. ADD IMAGE COLUMN TO SERVICES
-- ============================================================================
ALTER TABLE services
  ADD COLUMN image_url TEXT;

COMMENT ON COLUMN services.image_url IS
  'Path to the object in the service-images Storage bucket, shaped
   <organization_id>/<service_id>.<ext> — not a URL. The bucket is private, so
   display goes through a signed URL and a stored absolute URL would expire.';

-- ============================================================================
-- 2. STORAGE BUCKET FOR SERVICE IMAGES
-- ============================================================================
-- Private bucket, same pattern as product-images. Members of an org can view
-- their org's service images (needed for booking flow), but only managers and
-- above can upload/update/delete them.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-images',
  'service-images',
  FALSE,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- SELECT is org-wide: employees need to see service images in the booking flow.
-- Write operations (INSERT/UPDATE/DELETE) are manager-and-above only.

CREATE POLICY "service_images_select_same_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'service-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
);

CREATE POLICY "service_images_insert_manager_or_above"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'service-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

CREATE POLICY "service_images_update_manager_or_above"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'service-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
)
WITH CHECK (
  bucket_id = 'service-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);

CREATE POLICY "service_images_delete_manager_or_above"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'service-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('manager')
);
