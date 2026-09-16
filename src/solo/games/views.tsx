import type { ComponentType } from 'react';
import type { SoloMethod } from '@/solo/methods';
import { WorldCupGame } from './WorldCupGame';
import { SwipeGame } from './SwipeGame';
import { LadderGame } from './LadderGame';
import type { SoloGameProps } from './types';

/** 직접 플레이하는 방식만 화면을 가진다 */
export const SOLO_GAME_VIEWS: Partial<Record<SoloMethod, ComponentType<SoloGameProps>>> = {
  worldcup: WorldCupGame,
  swipe: SwipeGame,
  ladder: LadderGame,
};
