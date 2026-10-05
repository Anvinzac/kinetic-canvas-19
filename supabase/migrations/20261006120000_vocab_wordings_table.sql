-- Vocabulary wording presets for reveal button and guess leads.
-- Allows admin to customize the Vietnamese phrasing without code changes.

CREATE TABLE IF NOT EXISTS public.vocab_wordings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  -- The reveal button label (e.g., "Ê, từ này biết nè")
  reveal_button TEXT NOT NULL DEFAULT 'Ê, từ này biết nè',
  -- Optional guess lead text shown before the word is revealed
  guess_lead TEXT,
  -- When true, this is the active preset used by the feed
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure only one preset is active at a time
  CONSTRAINT vocab_wordings_single_active CHECK (
    NOT is_active OR id IN (
      SELECT id FROM public.vocab_wordings WHERE is_active
      LIMIT 1
    )
  )
);

-- Seed with the default wording
INSERT INTO public.vocab_wordings (reveal_button, is_active)
VALUES ('Ê, từ này biết nè', true)
ON CONFLICT DO NOTHING;

-- Index for fast active-lookup
CREATE INDEX IF NOT EXISTS idx_vocab_wordings_active ON public.vocab_wordings (is_active) WHERE is_active;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_vocab_wordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vocab_wordings_updated_at ON public.vocab_wordings;
CREATE TRIGGER vocab_wordings_updated_at
  BEFORE UPDATE ON public.vocab_wordings
  FOR EACH ROW
  EXECUTE FUNCTION update_vocab_wordings_updated_at();

-- RLS: admins can manage, everyone can read the active preset
ALTER TABLE public.vocab_wordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read wordings" ON public.vocab_wordings;
CREATE POLICY "Anyone can read wordings" ON public.vocab_wordings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage wordings" ON public.vocab_wordings;
CREATE POLICY "Admins can manage wordings" ON public.vocab_wordings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.auth_user_id = auth.uid()
        AND profiles.is_admin = true
    )
  );
