import { getSupabase } from '@/lib/supabase';
import { LocalRoomBackend } from './LocalRoomBackend';
import { SupabaseRoomBackend } from './SupabaseRoomBackend';
import type { RoomBackend } from './types';

let instance: RoomBackend | null = null;

/** Supabase 설정이 있으면 Supabase, 없으면 로컬 백엔드를 사용한다. */
export function getRoomBackend(): RoomBackend {
  if (instance) return instance;
  const supabase = getSupabase();
  instance = supabase ? new SupabaseRoomBackend(supabase) : new LocalRoomBackend();
  return instance;
}

export * from './types';
