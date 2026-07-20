import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("VITE_SUPABASE_URL이 .env.local에 없습니다.");
}

if (!supabasePublishableKey) {
  throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY가 .env.local에 없습니다.");
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
