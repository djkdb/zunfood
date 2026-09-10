import type { CreateRoomInput, Player, Room, RoomSnapshot } from '@/types/room';
import type { GameAction } from '@/types/game';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export type RoomErrorCode =
  | 'room_not_found'
  | 'room_full'
  | 'room_expired'
  | 'nickname_taken'
  | 'already_started'
  | 'network'
  | 'unknown';

export class RoomError extends Error {
  code: RoomErrorCode;
  constructor(code: RoomErrorCode, message: string) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

export const ROOM_ERROR_MESSAGE: Record<RoomErrorCode, string> = {
  room_not_found: '그런 방 코드가 없어요. 코드를 다시 확인해 주세요.',
  room_full: '방이 가득 찼어요. 방장에게 인원을 늘려달라고 해보세요.',
  room_expired: '이 방은 만료됐어요. 새로 방을 만들어 주세요.',
  nickname_taken: '이미 같은 닉네임이 있어요. 다른 이름으로 들어와 주세요.',
  already_started: '이미 게임이 시작된 방이에요.',
  network: '연결이 불안정해요. 잠시 후 다시 시도해 주세요.',
  unknown: '알 수 없는 오류가 발생했어요. 다시 시도해 주세요.',
};

export interface RoomHandlers {
  onSnapshot: (snapshot: RoomSnapshot) => void;
  /** 호스트만 수신 — 참가자 액션 */
  onAction?: (action: GameAction) => void;
  onStatus?: (status: ConnectionStatus) => void;
  onError?: (error: RoomError) => void;
}

export interface SubscribeOptions {
  playerId: string;
  isHost: boolean;
}

export type Unsubscribe = () => void;

/** 방 상태 저장 + 실시간 동기화 백엔드 */
export interface RoomBackend {
  readonly kind: 'local' | 'neon';
  createRoom(input: CreateRoomInput): Promise<{ room: Room; player: Player }>;
  joinRoom(code: string, nickname: string): Promise<{ room: Room; player: Player }>;
  getSnapshot(roomId: string): Promise<RoomSnapshot | null>;
  subscribe(
    roomId: string,
    options: SubscribeOptions,
    handlers: RoomHandlers,
  ): Promise<Unsubscribe>;
  /** 호스트 전용 — 방 설정/상태 갱신 */
  patchRoom(roomId: string, patch: Partial<Room>): Promise<void>;
  /** 호스트 전용 — 공개 게임 상태 갱신 */
  setGameState(roomId: string, state: unknown | null): Promise<void>;
  sendAction(action: GameAction): Promise<void>;
  heartbeat(roomId: string, playerId: string): Promise<void>;
  leaveRoom(roomId: string, playerId: string): Promise<void>;
}
