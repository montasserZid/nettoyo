-- Run in Supabase SQL Editor.
-- Adds:
-- 1) booking status `expired`
-- 2) client profile phone (+1XXXXXXXXXX)
-- 3) RLS policies to allow pending -> expired updates by booking owner/assignee

-- ================================
-- Profiles: required phone support
-- ================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_phone_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_phone_check
      CHECK (phone IS NULL OR phone ~ '^\+1[0-9]{10}$');
  END IF;
END$$;

-- ================================
-- Bookings: add `expired` status
-- ================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_status_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
  END IF;

  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'expired'));
END$$;

-- ============================================
-- RLS: allow clients to mark own pending expired
-- ============================================
DROP POLICY IF EXISTS "Clients can expire own pending bookings" ON public.bookings;
CREATE POLICY "Clients can expire own pending bookings"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id AND status = 'pending')
  WITH CHECK (auth.uid() = client_id AND status = 'expired');

-- =====================================================
-- RLS: allow cleaners to mark own pending bookings expired
-- (policy creation only if cleaner_id exists on bookings)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'cleaner_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Cleaners can expire own pending bookings" ON public.bookings';
    EXECUTE '
      CREATE POLICY "Cleaners can expire own pending bookings"
      ON public.bookings
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = cleaner_id AND status = ''pending'')
      WITH CHECK (auth.uid() = cleaner_id AND status = ''expired'')
    ';
  END IF;
END$$;
