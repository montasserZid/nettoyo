-- Run this in Supabase SQL Editor
-- Dashboard -> SQL Editor -> New Query -> Run

DROP TABLE IF EXISTS public.bookings CASCADE;

CREATE TABLE public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id)
    ON DELETE CASCADE NOT NULL,
  space_id UUID REFERENCES public.spaces(id)
    ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'expired')),
  service_type TEXT,
  cleaner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can create own bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can cancel own bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id AND status IN ('pending', 'confirmed'))
  WITH CHECK (auth.uid() = client_id AND status = 'cancelled');

CREATE POLICY "Clients can expire own pending bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id AND status = 'pending')
  WITH CHECK (auth.uid() = client_id AND status = 'expired');

CREATE POLICY "Cleaners can view assigned bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = cleaner_id);

CREATE POLICY "Cleaners can update own pending bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = cleaner_id AND status = 'pending')
  WITH CHECK (auth.uid() = cleaner_id AND status IN ('confirmed', 'cancelled'));

CREATE POLICY "Cleaners can expire own pending bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = cleaner_id AND status = 'pending')
  WITH CHECK (auth.uid() = cleaner_id AND status = 'expired');

CREATE INDEX bookings_client_id_idx
  ON public.bookings(client_id);

CREATE INDEX bookings_cleaner_id_idx
  ON public.bookings(cleaner_id);
