import type { PlaceLocation, Restaurant } from '@/types/restaurant';

export interface JudgeWish {
  playerId: string;
  nickname: string;
  /** 참가자가 입력한 먹고 싶은 음식 ("아무거나" 포함) */
  text: string;
}

export interface JudgeRequest {
  wishes: JudgeWish[];
  candidates: Restaurant[];
  location: PlaceLocation;
  budget: number;
  radius: number;
}

export interface JudgeVerdict {
  /** 반드시 candidates 안에 있는 id 여야 한다. */
  restaurantId: string;
  headline: string;
  reasons: string[];
  /** 후보별 점수 (연출용) */
  scores: { restaurantId: string; score: number }[];
}

/**
 * AI 판사 제공자.
 * 실제 LLM 연동은 이 인터페이스를 구현해서 교체한다.
 * 어떤 구현이든 "주어진 candidates 중 하나"만 고를 수 있다 — 식당을 새로 만들어내지 않는다.
 */
export interface JudgeProvider {
  readonly source: string;
  judge(request: JudgeRequest): Promise<JudgeVerdict>;
}
