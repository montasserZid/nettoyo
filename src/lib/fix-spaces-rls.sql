-- Run in Supabase SQL Editor

-- Remove any existing policies on spaces
DROP POLICY IF EXISTS "Clients can manage own spaces"
  ON public.spaces;
DROP POLICY IF EXISTS "Clients can select own spaces"
  ON public.spaces;
DROP POLICY IF EXISTS "Clients can insert own spaces"
  ON public.spaces;
DROP POLICY IF EXISTS "Clients can update own spaces"
  ON public.spaces;
DROP POLICY IF EXISTS "Clients can delete own spaces"
  ON public.spaces;

-- Recreate all policies explicitly
CREATE POLICY "Clients can select own spaces"
  ON public.spaces FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can insert own spaces"
  ON public.spaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own spaces"
  ON public.spaces FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can delete own spaces"
  ON public.spaces FOR DELETE
  TO authenticated
  USING (auth.uid() = client_id);
