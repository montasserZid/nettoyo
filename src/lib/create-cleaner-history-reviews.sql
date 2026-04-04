-- Run in Supabase SQL Editor
-- Enables cleaner history reviews + safe client first-name lookup for assigned bookings.

BEGIN;

-- 1) Create reviews table for cleaner -> client feedback (one review per booking)
CREATE TABLE IF NOT EXISTS public.cleaner_client_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cleaner_client_reviews_booking_unique UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS cleaner_client_reviews_cleaner_id_idx
  ON public.cleaner_client_reviews(cleaner_id);

CREATE INDEX IF NOT EXISTS cleaner_client_reviews_client_id_idx
  ON public.cleaner_client_reviews(client_id);

ALTER TABLE public.cleaner_client_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cleaners can read own history reviews" ON public.cleaner_client_reviews;
CREATE POLICY "Cleaners can read own history reviews"
  ON public.cleaner_client_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = cleaner_id);

DROP POLICY IF EXISTS "Cleaners can insert one review for own bookings" ON public.cleaner_client_reviews;
CREATE POLICY "Cleaners can insert one review for own bookings"
  ON public.cleaner_client_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = cleaner_id
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND b.cleaner_id = auth.uid()
        AND b.client_id = cleaner_client_reviews.client_id
    )
  );

DROP POLICY IF EXISTS "No review updates after submission" ON public.cleaner_client_reviews;
CREATE POLICY "No review updates after submission"
  ON public.cleaner_client_reviews
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No review deletes" ON public.cleaner_client_reviews;
CREATE POLICY "No review deletes"
  ON public.cleaner_client_reviews
  FOR DELETE
  TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.update_cleaner_client_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cleaner_client_reviews_updated_at ON public.cleaner_client_reviews;
CREATE TRIGGER update_cleaner_client_reviews_updated_at
BEFORE UPDATE ON public.cleaner_client_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_cleaner_client_reviews_updated_at();

-- 2) Allow cleaners to read client rows only when there is a booking relation.
DROP POLICY IF EXISTS "Cleaners can read assigned clients" ON public.profiles;
CREATE POLICY "Cleaners can read assigned clients"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.client_id = profiles.id
        AND b.cleaner_id = auth.uid()
    )
  );

COMMIT;
