-- Add reason_code column to cached_line_items (nullable text, no data loss)
ALTER TABLE public.cached_line_items 
ADD COLUMN reason_code text DEFAULT NULL;