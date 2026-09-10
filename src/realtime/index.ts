import { ENV, hasRemoteBackend } from '@/config/env';
import { LocalRoomBackend } from './LocalRoomBackend';
import { NeonRoomBackend } from './NeonRoomBackend';
import type { RoomBackend } from './types';

let instance: RoomBackend | null = null;

/**
 * API 주소가 설정돼 있으면 Neon 백엔드(서버 경유), 없으면 로컬 백엔드를 쓴다.
 * 로컬 백엔드는 같은 기기의 탭끼리만 동기화되는 개발/데모용이다.
 */
export function getRoomBackend(): RoomBackend {
  if (instance) return instance;
  instance = hasRemoteBackend ? new NeonRoomBackend(ENV.apiBase) : new LocalRoomBackend();
  return instance;
}

export * from './types';
