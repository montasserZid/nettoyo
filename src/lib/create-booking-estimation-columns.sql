-- Run in Supabase SQL Editor
-- Adds cleaner hourly rate and booking estimated hours.

ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(5,2)
  CHECK (hourly_rate >= 16 AND hourly_rate <= 40);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(4,2)
  CHECK (estimated_hours > 0);
