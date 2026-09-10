import type { GameId, GameMode } from '@/types/game';
import { rouletteGame } from './roulette/logic';
import { battleGame } from './battle/logic';
import { judgeGame } from './judge/logic';
import { fateGame } from './fate/logic';

/**
 * 게임 레지스트리.
 * 새 게임을 추가하려면 GameMode 를 구현해서 이 배열에 넣기만 하면 된다.
 * 방/실시간 시스템은 수정할 필요가 없다.
 */
export const GAMES: GameMode<never>[] = [
  rouletteGame as GameMode<never>,
  battleGame as GameMode<never>,
  judgeGame as GameMode<never>,
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

/** 선택된 게임들이 필요로 하는 최대 후보 수 */
export const MAX_CANDIDATES = Math.max(...GAMES.map((g) => g.candidateCount));
