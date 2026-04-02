-- Run in Supabase SQL Editor to allow reservation clients to read cleaner profiles.
-- Keeps cleaner write permissions unchanged.

DROP POLICY IF EXISTS "Authenticated users can view cleaner profiles" ON public.cleaner_profiles;

CREATE POLICY "Authenticated users can view cleaner profiles"
  ON public.cleaner_profiles
  FOR SELECT
  TO authenticated
  USING (true);
