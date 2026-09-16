import type { Player } from './room';
import type { PlaceLocation, Restaurant, RestaurantFilters } from './restaurant';

export type GameId =
  | 'roulette'
  | 'battle'
  | 'judge'
  | 'fate'
  | 'auction'
  | 'elimination'
  | 'instinct'
  | 'telepathy'
  | 'dart';

/** 참가자가 호스트에게 보내는 액션 (실시간 채널을 통해 전달) */
export interface GameAction<P = Record<string, unknown>> {
  id: string;
  roomId: string;
  playerId: string;
  type: string;
  payload: P;
  createdAt: number;
}

/** 게임 로직이 참조할 수 있는 방 컨텍스트 */
export interface GameContext {
  roomId: string;
  hostId: string;
  players: Player[];
  candidates: Restaurant[];
  location: PlaceLocation;
  radius: number;
  filters: RestaurantFilters;
  /** 현재 시각(ms). 테스트/재현성을 위해 주입한다. */
  now: number;
  /** 게임 시작 시 고정되는 시드 — 모든 참가자가 같은 결과를 본다. */
  seed: number;
}

/**
 * 게임 모드 인터페이스.
 *
 * 규칙:
 *  - 순수 함수로만 구성한다 (호스트에서 실행 → 결과 상태를 브로드캐스트).
 *  - UI 는 상태를 렌더링만 하고, 액션을 dispatch 한다.
 *  - 새 게임을 추가할 때 방/실시간 시스템을 수정할 필요가 없어야 한다.
 */
export interface GameMode<S = unknown> {
  id: GameId;
  title: string;
  tagline: string;
  description: string;
  emoji: string;
  /** 게임 카드 아이콘 배경 (tailwind class) */
  tint: string;
  /** 시작 전 미리보기에 쓰는 3줄 요약 */
  howTo: string[];
  /** 목록에서 하나만 "추천"으로 강조한다 */
  recommended?: boolean;
  minPlayers: number;
  maxPlayers: number;
  /** 이 게임이 필요로 하는 후보 식당 수 */
  candidateCount: number;

  /** 게임 시작 시 초기 상태 */
  createInitialState(ctx: GameContext): S;

  /** 참가자 액션 처리 (호스트에서만 실행). 변화가 없으면 같은 객체를 반환. */
  handleAction(state: S, action: GameAction, ctx: GameContext): S;

  /** 타이머 기반 진행 (호스트에서 주기적으로 호출). 변화 없으면 null. */
  tick(state: S, ctx: GameContext): S | null;

  /** 참가자에게 공개해도 되는 상태로 변환 (예: 투표 내용 숨김) */
  toPublicState(state: S, ctx: GameContext): S;

  /** 최종 우승 식당 id (아직이면 null) */
  getWinner(state: S): string | null;

  /** 게임 종료 여부 */
  isFinished(state: S): boolean;

  /** 진행률 0~1 (상단 프로그레스 바에 사용) */
  getProgress?(state: S, ctx: GameContext): number;

  /**
   * 외부 호출이 필요한 시점을 식별하는 키. null 이면 호출하지 않는다.
   * 호스트는 키가 바뀔 때 딱 한 번 runEffect 를 실행한다.
   */
  getEffectKey?(state: S): string | null;

  /** 호스트에서만 실행되는 비동기 부수효과. 결과는 액션으로 되돌려준다. */
  runEffect?(state: S, ctx: GameContext): Promise<ActionDraft | null>;
}

/** dispatch 에 사용하는 액션 초안 */
export interface ActionDraft {
  type: string;
  payload?: Record<string, unknown>;
}

/** 게임 화면 컴포넌트가 받는 props */
export interface GameViewProps<S = unknown> {
  state: S;
  ctx: GameContext;
  me: Player;
  isHost: boolean;
  dispatch: (type: string, payload?: Record<string, unknown>) => void;
}
