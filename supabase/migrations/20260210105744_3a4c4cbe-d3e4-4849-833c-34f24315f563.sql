
-- Table to cache Zoho OAuth access tokens across edge function instances
CREATE TABLE IF NOT EXISTS public.zoho_token_cache (
  id TEXT PRIMARY KEY DEFAULT 'default',
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed - only accessed by edge functions via service role
ALTER TABLE public.zoho_token_cache ENABLE ROW LEVEL SECURITY;

-- No public policies - edge functions use service role key which bypasses RLS
