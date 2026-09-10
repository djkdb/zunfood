export function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatRadius(meters: number): string {
  return meters >= 1000 ? `${meters / 1000}km` : `${meters}m`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/** 가격대 등급 표기 — 2 → "₩₩" (금액을 모르는 제공자용) */
export function formatPriceLevel(level: number): string {
  return '₩'.repeat(Math.min(4, Math.max(1, level)));
}

/** 좁은 자리에 넣는 금액 표기 — 12,000 → "1.2만" */
export function formatCompactWon(value: number): string {
  if (value >= 10_000) {
    const man = (value / 10_000).toFixed(1).replace(/\.0$/, '');
    return `${man}만원`;
  }
  return `${Math.round(value / 1_000)}천원`;
}
