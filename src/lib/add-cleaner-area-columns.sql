-- Run in Supabase SQL Editor if cleaner_profiles already exists

ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS home_address JSONB,
  ADD COLUMN IF NOT EXISTS home_area JSONB,
  ADD COLUMN IF NOT EXISTS service_areas JSONB NOT NULL DEFAULT '[]'::JSONB;
