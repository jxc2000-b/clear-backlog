import { supabase } from './supabase'

supabase.from('_does_not_exist').select('*').then(console.log);
