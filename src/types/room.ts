import type { PlaceLocation, Restaurant, RestaurantFilters } from './restaurant';
import type { GameId } from './game';

export type RoomStatus =
  /** 참가자 모집 중 */
  | 'lobby'
  /** 게임 선택 화면 */
  | 'selecting'
  /** 게임 진행 중 */
  | 'playing'
  /** 결과 확정 */
  | 'finished';

export interface Player {
  id: string;
  roomId: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  /** 아바타 색상 인덱스 */
  avatar: number;
  joinedAt: number;
  lastSeenAt: number;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  location: PlaceLocation;
  radius: number;
  filters: RestaurantFilters;
  selectedGame: GameId | null;
  /** 게임에 사용될 후보 식당 목록 (호스트가 확정 후 공유) */
  candidates: Restaurant[];
  /** 최종 결정된 식당 id */
  winnerId: string | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

/** 방 + 참가자 + 게임 상태를 합친, 화면이 구독하는 단일 스냅샷 */
export interface RoomSnapshot {
  room: Room;
  players: Player[];
  /** 공개된 게임 상태(비밀 정보 제거됨) */
  gameState: unknown | null;
}

export interface CreateRoomInput {
  nickname: string;
  maxPlayers: number;
  location: PlaceLocation;
  radius: number;
  filters: RestaurantFilters;
}
