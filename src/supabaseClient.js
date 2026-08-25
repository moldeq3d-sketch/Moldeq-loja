import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://sixpidujmrzubiadyrmk.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpeHBpZHVqbXJ6dWJpYWR5cm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODM3ODMsImV4cCI6MjEwMzI1OTc4M30.q451kD2tf23sVdLQkDPlBNCKTm67K7PpTIYYY_GB2Qs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
