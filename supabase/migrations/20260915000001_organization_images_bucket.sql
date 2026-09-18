-- ============================================================================
-- ORGANIZATION IMAGES STORAGE BUCKET
-- ============================================================================
-- Adds a storage bucket for organization images (logo, hero image).
-- Private bucket with RLS policies enforcing org-level access.
--
-- Path structure: {organization_id}/{type}.{ext}
-- where type is 'logo' or 'hero'
-- ============================================================================

-- ============================================================================
-- 1. CREATE BUCKET
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-images',
  'organization-images',
  FALSE,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Owner and above can manage their org's images.
-- All org members can view them (needed for displaying logo in app).

CREATE POLICY "organization_images_select_same_org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'organization-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
);

CREATE POLICY "organization_images_insert_owner_or_above"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'organization-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('owner')
);

CREATE POLICY "organization_images_update_owner_or_above"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'organization-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('owner')
)
WITH CHECK (
  bucket_id = 'organization-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('owner')
);

CREATE POLICY "organization_images_delete_owner_or_above"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'organization-images'
  AND (storage.foldername(name))[1] = public.current_organization_id()::TEXT
  AND public.has_role_or_above('owner')
);
