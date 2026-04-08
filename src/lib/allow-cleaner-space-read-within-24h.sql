-- Run in Supabase SQL Editor.
-- Allows cleaners to read space address fields only for their accepted/confirmed
-- bookings that are within the next 24 hours.

DROP POLICY IF EXISTS "Cleaners can read assigned spaces within 24h" ON public.spaces;

CREATE POLICY "Cleaners can read assigned spaces within 24h"
  ON public.spaces
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.space_id = spaces.id
        AND b.cleaner_id = auth.uid()
        AND b.status IN ('confirmed', 'accepted')
        AND b.scheduled_at IS NOT NULL
        AND b.scheduled_at >= NOW()
        AND b.scheduled_at <= NOW() + INTERVAL '24 hours'
    )
  );
