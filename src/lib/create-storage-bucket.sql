-- Run this in Supabase SQL Editor
-- Dashboard -> SQL Editor -> New Query -> Run

-- Create the space-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('space-photos', 'space-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload their own photos
CREATE POLICY "Users can upload own space photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'space-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to view space photos (public bucket)
CREATE POLICY "Anyone can view space photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'space-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own space photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'space-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
