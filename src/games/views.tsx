import type { ComponentType } from 'react';
import type { GameId, GameViewProps } from '@/types/game';
import { RouletteView } from './roulette/View';
import { BattleView } from './battle/View';
import { JudgeView } from './judge/View';
import { FateView } from './fate/View';

/**
 * 게임 id → 화면 컴포넌트 매핑.
 * 새 게임을 추가할 때 로직(registry.ts)과 화면(여기) 두 곳만 등록하면 된다.
 */
export const GAME_VIEWS: Record<GameId, ComponentType<GameViewProps<never>>> = {
  roulette: RouletteView as ComponentType<GameViewProps<never>>,
  battle: BattleView as ComponentType<GameViewProps<never>>,
  judge: JudgeView as ComponentType<GameViewProps<never>>,
  fate: FateView as ComponentType<GameViewProps<never>>,
};
