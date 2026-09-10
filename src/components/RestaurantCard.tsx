import { CATEGORY_EMOJI, CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import { formatDistance, formatRating, formatWon } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { cn } from '@/lib/cn';

interface RestaurantCardProps {
  restaurant: Restaurant;
  compact?: boolean;
  className?: string;
}

/** 식당 요약 카드 — 후보 목록/결과 화면에서 공통으로 쓴다. */
export function RestaurantCard({ restaurant, compact, className }: RestaurantCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3',
        className,
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-white/10',
          compact ? 'h-11 w-11 text-[20px]' : 'h-14 w-14 text-[26px]',
        )}
      >
        {CATEGORY_EMOJI[restaurant.category]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-white">{restaurant.name}</p>
        <p className="mt-0.5 truncate text-[13px] text-white/50">
          {CATEGORY_LABEL[restaurant.category]}
          {restaurant.rating > 0 && ` · ⭐ ${formatRating(restaurant.rating)}`}
          {` · 🚶 ${walkingMinutes(restaurant.distance)}분`}
        </p>
        {restaurant.priceRange > 0 && (
          <p className="mt-0.5 truncate text-[13px] font-bold text-pop-300">
            1인 약 {formatWon(restaurant.priceRange)}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13px] font-bold text-white/70">
          {formatDistance(restaurant.distance)}
        </p>
        <p
          className={cn(
            'mt-0.5 text-[12px] font-bold',
            restaurant.isOpen ? 'text-mint' : 'text-white/35',
          )}
        >
          {restaurant.isOpen ? '영업중' : '영업종료'}
        </p>
      </div>
    </div>
  );
}
