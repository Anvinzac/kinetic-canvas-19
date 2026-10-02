-- Ambient music tracks for the vocabulary feed background player.
-- Public read (anon can stream track list), admin-only writes via service_role.

CREATE TABLE IF NOT EXISTS public.ambient_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  bpm SMALLINT NOT NULL DEFAULT 120,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambient_tracks ENABLE ROW LEVEL SECURITY;

-- Anyone can read the track list (needed by the public feed player).
CREATE POLICY ambient_tracks_public_read ON public.ambient_tracks
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only service_role can write (admin server functions use supabaseAdmin).
GRANT SELECT ON public.ambient_tracks TO anon;
GRANT SELECT ON public.ambient_tracks TO authenticated;
GRANT ALL ON public.ambient_tracks TO service_role;
