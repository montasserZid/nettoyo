-- Run this in Supabase SQL Editor
-- Dashboard -> SQL Editor -> New Query -> Run

DROP TABLE IF EXISTS public.spaces CASCADE;

CREATE TABLE public.spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id)
    ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('apartment', 'house', 'office', 'other')),
  format_system TEXT NOT NULL DEFAULT 'quebec'
    CHECK (format_system IN ('quebec', 'international')),
  quebec_format TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  floor TEXT,
  access_code TEXT,
  photo_url TEXT,
  notes TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  rooms JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can manage own spaces"
  ON public.spaces FOR ALL
  USING (auth.uid() = client_id);

CREATE INDEX spaces_client_id_idx
  ON public.spaces(client_id);
