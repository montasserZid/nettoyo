-- Run in Supabase SQL Editor

-- 1) Ensure new users get identity fields at profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, first_name, last_name, city)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) Backfill existing profiles from auth metadata when identity columns are empty
UPDATE public.profiles p
SET
  first_name = COALESCE(p.first_name, NULLIF(u.raw_user_meta_data->>'first_name', '')),
  last_name = COALESCE(p.last_name, NULLIF(u.raw_user_meta_data->>'last_name', '')),
  city = COALESCE(p.city, NULLIF(u.raw_user_meta_data->>'city', ''))
FROM auth.users u
WHERE p.id = u.id
  AND (
    p.first_name IS NULL
    OR p.last_name IS NULL
    OR p.city IS NULL
  );
