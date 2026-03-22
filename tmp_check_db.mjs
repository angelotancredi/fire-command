import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzotdlkxabblgnnznghd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b3RkbGt4YWJibGdubnpuZ2hdIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAyNTgsImV4cCI6MjA4ODI3NjI1OH0.LS6v02asmLf0gfrOxX-Jk18SUCvTeHIX1uIv66OhqSw');

async function check() {
  try {
    const { data: c, error: ec } = await supabase.from('centers').select('*');
    if (ec) console.error('CENTERS ERROR:', ec.message);
    else console.log('CENTERS COUNT:', c?.length);

    const { data: v, error: ev } = await supabase.from('vehicles').select('*');
    if (ev) console.error('VEHICLES ERROR:', ev.message);
    else {
      console.log('VEHICLES COUNT:', v?.length);
      if (v) {
        // 최근 추가된 차량만 출력
        const recent = v.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        console.log('RECENT VEHICLES:', JSON.stringify(recent, null, 2));
      }
    }
  } catch (err) {
    console.error('CRASH:', err.message);
  }
}
check();
