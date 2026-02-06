-- Create cached payments table
CREATE TABLE public.cached_payments (
  id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  payment_reference TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_date DATE,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'unreconciled',
  reconciled_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  zoho_record_id TEXT,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cached payment line items table
CREATE TABLE public.cached_line_items (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES public.cached_payments(id) ON DELETE CASCADE,
  client_name TEXT,
  plan_reference TEXT,
  adviser_name TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  fee_category TEXT,
  status TEXT NOT NULL DEFAULT 'unmatched',
  matched_expectation_id TEXT,
  match_notes TEXT,
  zoho_record_id TEXT,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cached expectations table
CREATE TABLE public.cached_expectations (
  id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  client_name TEXT,
  plan_reference TEXT,
  adviser_name TEXT,
  expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  calculation_date DATE,
  fee_category TEXT,
  status TEXT NOT NULL DEFAULT 'unmatched',
  allocated_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  zoho_record_id TEXT,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create local matches table (pending sync to Zoho)
CREATE TABLE public.pending_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL REFERENCES public.cached_payments(id) ON DELETE CASCADE,
  line_item_id TEXT NOT NULL REFERENCES public.cached_line_items(id) ON DELETE CASCADE,
  expectation_id TEXT NOT NULL REFERENCES public.cached_expectations(id) ON DELETE CASCADE,
  matched_amount DECIMAL(12,2) NOT NULL,
  variance DECIMAL(12,2) NOT NULL DEFAULT 0,
  variance_percentage DECIMAL(8,4) NOT NULL DEFAULT 0,
  match_quality TEXT,
  notes TEXT,
  matched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_to_zoho BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Create sync status table
CREATE TABLE public.sync_status (
  id TEXT PRIMARY KEY DEFAULT 'current',
  last_download_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  pending_match_count INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  lock_reason TEXT
);

-- Insert initial sync status record
INSERT INTO public.sync_status (id, pending_match_count, is_locked) 
VALUES ('current', 0, false);

-- Create indexes for performance
CREATE INDEX idx_cached_line_items_payment_id ON public.cached_line_items(payment_id);
CREATE INDEX idx_cached_line_items_status ON public.cached_line_items(status);
CREATE INDEX idx_cached_expectations_provider ON public.cached_expectations(provider_name);
CREATE INDEX idx_cached_expectations_status ON public.cached_expectations(status);
CREATE INDEX idx_pending_matches_synced ON public.pending_matches(synced_to_zoho);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_cached_payments_updated_at
  BEFORE UPDATE ON public.cached_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cached_line_items_updated_at
  BEFORE UPDATE ON public.cached_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cached_expectations_updated_at
  BEFORE UPDATE ON public.cached_expectations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update pending match count trigger
CREATE OR REPLACE FUNCTION public.update_pending_match_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.sync_status 
  SET pending_match_count = (
    SELECT COUNT(*) FROM public.pending_matches WHERE synced_to_zoho = false
  )
  WHERE id = 'current';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_match_count_on_insert
  AFTER INSERT OR UPDATE OR DELETE ON public.pending_matches
  FOR EACH STATEMENT EXECUTE FUNCTION public.update_pending_match_count();