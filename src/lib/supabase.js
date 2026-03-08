import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mzotdlkxabblgnnznghd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16b3RkbGt4YWJibGdubnpuZ2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDAyNTgsImV4cCI6MjA4ODI3NjI1OH0.LS6v02asmLf0gfrOxX-Jk18SUCvTeHIX1uIv66OhqSw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
