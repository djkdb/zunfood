import type { Restaurant } from '@/types/restaurant';

export interface SoloGameProps {
  /** 이번 판에 쓸 후보 (이미 종류가 섞여 들어온다) */
  candidates: Restaurant[];
  /** 같은 판을 다시 열면 같은 배치가 나오도록 하는 시드 */
  seed: number;
  /** 결정됐을 때 호출한다 */
  onDecide: (winner: Restaurant, reason: string) => void;
}
