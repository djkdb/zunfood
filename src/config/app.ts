/**
 * 서비스 전역 설정.
 * 서비스명/카피는 여기서만 바꾸면 앱 전체에 반영된다.
 */
export const APP = {
  name: 'MEALGAME',
  tagline: '오늘 뭐 먹지?',
  subTagline: '친구들이랑 게임으로 결정하세요.',
  emoji: '🍜',
  /** 결과 공유 시 사용하는 문구 */
  shareTitle: 'MEALGAME — 오늘 뭐 먹지?',
} as const;

export const ROOM = {
  /** 방 코드 길이 (예: A7K3) */
  codeLength: 4,
  minPlayers: 2,
  maxPlayers: 8,
  defaultMaxPlayers: 4,
  /** 방 만료 시간 (분) */
  expiresInMinutes: 180,
  /** 참가자 하트비트 주기 (ms) */
  heartbeatMs: 10_000,
  /** 이 시간동안 하트비트가 없으면 이탈로 간주 (ms) */
  offlineAfterMs: 35_000,
} as const;

export const SEARCH = {
  radiusOptions: [300, 500, 1000, 2000] as const,
  defaultRadius: 500,
  budgetOptions: [10_000, 15_000, 20_000, 30_000] as const,
  defaultBudget: 15_000,
} as const;

export type RadiusOption = (typeof SEARCH.radiusOptions)[number];
export type BudgetOption = (typeof SEARCH.budgetOptions)[number];

/** 게임 연출 타이밍(ms). 한 곳에서 조율한다. */
export const TIMING = {
  countdownMs: 3_000,
  revealDelayMs: 1_200,
  rouletteSpinMs: 5_200,
  fateReelMs: 3_600,
  battleVoteMs: 15_000,
  battleRevealMs: 3_400,
  judgeThinkingMs: 2_600,
  /** 경매는 나눠 걸어야 해서 투표보다 시간이 더 필요하다 */
  auctionBidMs: 40_000,
  auctionRevealMs: 4_600,
  /** 지우기 한 차례 제한 시간 */
  eliminationTurnMs: 15_000,
  /** 눈치 게임에서 후보 한 장이 떠 있는 시간 */
  instinctRoundMs: 3_200,
  /** 이심전심 한 라운드 제한 시간 */
  telepathyPickMs: 15_000,
  telepathyRevealMs: 3_400,
} as const;
