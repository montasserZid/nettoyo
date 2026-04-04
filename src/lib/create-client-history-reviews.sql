-- Run in Supabase SQL Editor
-- Enables client history reviews (client -> cleaner), one review per booking.

BEGIN;

CREATE TABLE IF NOT EXISTS public.client_cleaner_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_cleaner_reviews_booking_unique UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS client_cleaner_reviews_client_id_idx
  ON public.client_cleaner_reviews(client_id);

CREATE INDEX IF NOT EXISTS client_cleaner_reviews_cleaner_id_idx
  ON public.client_cleaner_reviews(cleaner_id);

ALTER TABLE public.client_cleaner_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can read own cleaner reviews" ON public.client_cleaner_reviews;
CREATE POLICY "Clients can read own cleaner reviews"
  ON public.client_cleaner_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients can insert one review for own bookings" ON public.client_cleaner_reviews;
CREATE POLICY "Clients can insert one review for own bookings"
  ON public.client_cleaner_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND b.client_id = auth.uid()
        AND b.cleaner_id = client_cleaner_reviews.cleaner_id
    )
  );

DROP POLICY IF EXISTS "No client review updates after submission" ON public.client_cleaner_reviews;
CREATE POLICY "No client review updates after submission"
  ON public.client_cleaner_reviews
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No client review deletes" ON public.client_cleaner_reviews;
CREATE POLICY "No client review deletes"
  ON public.client_cleaner_reviews
  FOR DELETE
  TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.update_client_cleaner_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_client_cleaner_reviews_updated_at ON public.client_cleaner_reviews;
CREATE TRIGGER update_client_cleaner_reviews_updated_at
BEFORE UPDATE ON public.client_cleaner_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_client_cleaner_reviews_updated_at();

COMMIT;
