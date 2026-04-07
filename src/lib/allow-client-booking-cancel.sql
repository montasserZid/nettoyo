-- Run in Supabase SQL Editor
-- Allows clients to cancel their own pending/confirmed bookings.

DROP POLICY IF EXISTS "Clients can cancel own bookings" ON public.bookings;

CREATE POLICY "Clients can cancel own bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = client_id
    AND status IN ('pending', 'confirmed')
  )
  WITH CHECK (
    auth.uid() = client_id
    AND status = 'cancelled'
  );
