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
