/*
 * IMPORTANT - Before the spaces feature works:
 * 1. Go to Supabase Dashboard -> SQL Editor
 * 2. Run: src/lib/create-spaces-table.sql
 * 3. Run: src/lib/create-bookings-table.sql
 * These tables must exist before saving spaces.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'in your Vercel environment variables.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase
