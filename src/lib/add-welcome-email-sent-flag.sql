-- Run in Supabase SQL Editor
-- Adds idempotency flag for post-signup welcome email

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

