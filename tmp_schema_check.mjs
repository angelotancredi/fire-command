import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzotdlkxabblgnnznghd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b3RkbGt4YWJibGdubnpuZ2hdIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAyNTgsImV4cCI6MjA4ODI3NjI1OH0.LS6v02asmLf0gfrOxX-Jk18SUCvTeHIX1uIv66OhqSw');

async function check() {
  const { data, error } = await supabase.from('vehicles').select('*').limit(5);
  if (error) console.error(error);
  else {
    console.log('COLUMNS:', Object.keys(data[0]));
    console.log('SAMPLE:', JSON.stringify(data, null, 2));
  }
}
check();
