-- Enable RLS on all tables
ALTER TABLE public.cached_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_expectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all operations (single-user tool, no auth)
-- Cached Payments policies
CREATE POLICY "Allow all operations on cached_payments" 
ON public.cached_payments FOR ALL USING (true) WITH CHECK (true);

-- Cached Line Items policies
CREATE POLICY "Allow all operations on cached_line_items" 
ON public.cached_line_items FOR ALL USING (true) WITH CHECK (true);

-- Cached Expectations policies
CREATE POLICY "Allow all operations on cached_expectations" 
ON public.cached_expectations FOR ALL USING (true) WITH CHECK (true);

-- Pending Matches policies
CREATE POLICY "Allow all operations on pending_matches" 
ON public.pending_matches FOR ALL USING (true) WITH CHECK (true);

-- Sync Status policies
CREATE POLICY "Allow all operations on sync_status" 
ON public.sync_status FOR ALL USING (true) WITH CHECK (true);