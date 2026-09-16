import type { GameId, GameMode } from '@/types/game';
import { rouletteGame } from './roulette/logic';
import { battleGame } from './battle/logic';
import { judgeGame } from './judge/logic';
import { fateGame } from './fate/logic';
import { auctionGame } from './auction/logic';
import { eliminationGame } from './elimination/logic';
import { instinctGame } from './instinct/logic';
import { telepathyGame } from './telepathy/logic';
import { dartGame } from './dart/logic';
import { clawGame } from './claw/logic';
import { raceGame } from './race/logic';
import { fishingGame } from './fishing/logic';

/**
 * 게임 레지스트리.
 * 새 게임을 추가하려면 GameMode 를 구현해서 이 배열에 넣기만 하면 된다.
 * 방/실시간 시스템은 수정할 필요가 없다.
 */
/**
 * 목록 순서가 곧 추천 순서다.
 * 직접 개입하는 게임을 앞에 둔다 — 눌러놓고 구경만 하는 게임이 먼저 보이면
 * 앱 전체가 "그냥 랜덤 뽑기" 로 읽힌다.
 */
export const GAMES: GameMode<never>[] = [
  dartGame as GameMode<never>,
  clawGame as GameMode<never>,
  raceGame as GameMode<never>,
  fishingGame as GameMode<never>,
  battleGame as GameMode<never>,
  eliminationGame as GameMode<never>,
  auctionGame as GameMode<never>,
  instinctGame as GameMode<never>,
  telepathyGame as GameMode<never>,
  judgeGame as GameMode<never>,
  rouletteGame as GameMode<never>,
  fateGame as GameMode<never>,
];

const BY_ID = new Map<GameId, GameMode<never>>(GAMES.map((g) => [g.id, g]));

export function getGame(id: GameId): GameMode<never> | null {
  return BY_ID.get(id) ?? null;
}

/** 참가자 수에 맞는 게임인지 */
export function isPlayable(game: GameMode<never>, playerCount: number): boolean {
  return playerCount >= game.minPlayers && playerCount <= game.maxPlayers;
}

/** 게임 하나가 실제로 쓰는 최대 후보 수 */
export const MAX_CANDIDATES = Math.max(...GAMES.map((g) => g.candidateCount));

/**
 * 방이 미리 받아두는 후보 수.
 *
 * 게임은 이 중 일부만 쓰지만, 후보 목록에서 주변 식당을 둘러보거나 다시
 * 결정할 때 매번 같은 열 곳만 나오면 금방 질린다. 넉넉히 받아둔다.
 */
export const ROOM_CANDIDATES = 40;
