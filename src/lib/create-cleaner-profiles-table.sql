-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.cleaner_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT,
  services TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  photo_url TEXT,
  home_address JSONB,
  home_area JSONB,
  service_areas JSONB NOT NULL DEFAULT '[]'::JSONB,
  weekly_availability JSONB NOT NULL DEFAULT '{}'::JSONB,
  availability_exceptions JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cleaner_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cleaners can read own profile" ON public.cleaner_profiles;
DROP POLICY IF EXISTS "Cleaners can insert own profile" ON public.cleaner_profiles;
DROP POLICY IF EXISTS "Cleaners can update own profile" ON public.cleaner_profiles;
DROP POLICY IF EXISTS "Cleaners can delete own profile" ON public.cleaner_profiles;
DROP POLICY IF EXISTS "Authenticated users can view cleaner profiles" ON public.cleaner_profiles;

CREATE POLICY "Cleaners can read own profile"
  ON public.cleaner_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view cleaner profiles"
  ON public.cleaner_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Cleaners can insert own profile"
  ON public.cleaner_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Cleaners can update own profile"
  ON public.cleaner_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Cleaners can delete own profile"
  ON public.cleaner_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_cleaner_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cleaner_profiles_updated_at ON public.cleaner_profiles;

CREATE TRIGGER update_cleaner_profiles_updated_at
  BEFORE UPDATE ON public.cleaner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_cleaner_profiles_updated_at();
