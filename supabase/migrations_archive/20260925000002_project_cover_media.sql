-- ============================================================
-- Project cover media.
-- ============================================================
--
-- The Discover spec listed project imagery as an explicit non-goal ("No
-- project image upload - generated visual identity covers it"), because no
-- cover field existed and nobody was going to upload one. generateIdentity()
-- stays as the fallback for every project without a cover; this adds somewhere
-- to put one when it does exist.
--
-- cover_url holds a full public URL, matching profiles.avatar_url rather than
-- storing a bare object path, so the client needs no extra resolution step.
--
-- Images only. There is no video player in the app - expo-av, expo-video and
-- react-native-video are all absent - so a video URL here would have nothing
-- to render it.
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Public bucket for project artwork. Public so the archive renders without
-- signed URLs; writes stay restricted to authenticated users.
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-media', 'project-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "project-media: public read"       ON storage.objects;
DROP POLICY IF EXISTS "project-media: authenticated write" ON storage.objects;
DROP POLICY IF EXISTS "project-media: authenticated update" ON storage.objects;

CREATE POLICY "project-media: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-media');

CREATE POLICY "project-media: authenticated write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-media');

CREATE POLICY "project-media: authenticated update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'project-media');

-- Seed covers for the completed projects. Safe to clear:
--   UPDATE public.projects SET cover_url = NULL;
UPDATE public.projects SET cover_url = 'https://nrtleybrvlmrnyfyhhps.supabase.co/storage/v1/object/public/project-media/tidewater.jpg'   WHERE id = 'a5e1d000-0000-4000-8000-000000000001';
UPDATE public.projects SET cover_url = 'https://nrtleybrvlmrnyfyhhps.supabase.co/storage/v1/object/public/project-media/beacon.jpg'      WHERE id = 'a5e1d000-0000-4000-8000-000000000002';
UPDATE public.projects SET cover_url = 'https://nrtleybrvlmrnyfyhhps.supabase.co/storage/v1/object/public/project-media/aurora.jpg'      WHERE id = 'a5e1d000-0000-4000-8000-000000000003';
UPDATE public.projects SET cover_url = 'https://nrtleybrvlmrnyfyhhps.supabase.co/storage/v1/object/public/project-media/kestrel.jpg'     WHERE id = 'a5e1d000-0000-4000-8000-000000000004';
UPDATE public.projects SET cover_url = 'https://nrtleybrvlmrnyfyhhps.supabase.co/storage/v1/object/public/project-media/harbour.jpg'     WHERE id = 'a5e1d000-0000-4000-8000-000000000005';
UPDATE public.projects SET cover_url = 'https://nrtleybrvlmrnyfyhhps.supabase.co/storage/v1/object/public/project-media/foghorn.jpg'     WHERE id = 'a5e1d000-0000-4000-8000-000000000006';
UPDATE public.projects SET cover_url = 'https://nrtleybrvlmrnyfyhhps.supabase.co/storage/v1/object/public/project-media/nightingale.jpg' WHERE id = 'dec0de00-0000-4000-8000-000000000003';
