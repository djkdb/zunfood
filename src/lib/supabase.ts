import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ENV, hasSupabase } from '@/config/env';

let client: SupabaseClient | null = null;

/** Supabase 설정이 없으면 null 을 반환한다 (앱은 로컬 모드로 동작). */
export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase) return null;
  if (!client) {
    client = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}
