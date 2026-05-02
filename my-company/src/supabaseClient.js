import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kcgpyiepyhvhgsfkmmit.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjZ3B5aWVweWh2aGdzZmttbWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NjQxNzksImV4cCI6MjA5MzI0MDE3OX0.q_XYk09f_vqu0ggj7ibHX-yUnZaXsEeLYRhkxeASruM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
