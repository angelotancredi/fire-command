import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzotdlkxabblgnnznghd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b3RkbGt4YWJibGdubnpuZ2hdIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAyNTgsImV4cCI6MjA4ODI3NjI1OH0.LS6v02asmLf0gfrOxX-Jk18SUCvTeHIX1uIv66OhqSw');

async function check() {
  try {
    const { data, error } = await supabase.from('personnel').select('*').limit(1);
    if (error) {
       console.log('ERROR:', error.message);
    } else if (data && data.length > 0) {
       console.log('COLUMNS:', Object.keys(data[0]).join(', '));
    } else {
       console.log('EMPTY');
    }
  } catch (e) { console.log('CRASH:', e.message); }
}
check();
