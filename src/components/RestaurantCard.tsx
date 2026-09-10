import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import { formatDistance, formatRating, formatWon } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { cn } from '@/lib/cn';
import { RestaurantThumb } from './RestaurantThumb';

interface RestaurantCardProps {
  restaurant: Restaurant;
  surface?: 'light' | 'dark';
  onClick?: () => void;
  className?: string;
}

/**
 * 식당 한 줄 카드.
 * 이름 · 카테고리 · 평점 · 거리 · 가격만 — 정보를 더 넣지 않는다.
 */
export function RestaurantCard({
  restaurant,
  surface = 'light',
  onClick,
  className,
}: RestaurantCardProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl p-3 text-left',
        surface === 'light' ? 'bg-surface' : 'bg-white/8',
        onClick && 'transition-transform active:scale-[0.99]',
        className,
      )}
    >
      <RestaurantThumb
        category={restaurant.category}
        thumbnail={restaurant.thumbnail}
        name={restaurant.name}
        className="h-14 w-14 shrink-0 rounded-md"
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-h3',
            surface === 'light' ? 'text-ink-900' : 'text-white',
          )}
        >
          {restaurant.name}
        </p>
        <p
          className={cn(
            'mt-0.5 flex items-center gap-1.5 text-sm',
            surface === 'light' ? 'text-muted' : 'text-white/50',
          )}
        >
          <span>{CATEGORY_LABEL[restaurant.category]}</span>
          {restaurant.rating > 0 && (
            <>
              <Dot surface={surface} />
              <span>⭐ {formatRating(restaurant.rating)}</span>
            </>
          )}
          <Dot surface={surface} />
          <span>{formatDistance(restaurant.distance)}</span>
        </p>
      </div>

      <div className="shrink-0 text-right">
        {restaurant.priceRange > 0 && (
          <p
            className={cn(
              'text-[14px] font-bold',
              surface === 'light' ? 'text-ink-800' : 'text-white',
            )}
          >
            {formatWon(restaurant.priceRange)}
          </p>
        )}
        <p
          className={cn(
            'mt-0.5 text-xs font-bold',
            restaurant.isOpen
              ? 'text-success'
              : surface === 'light'
                ? 'text-ink-400'
                : 'text-white/35',
          )}
        >
          {restaurant.isOpen ? '영업중' : '영업종료'} · 걸어서 {walkingMinutes(restaurant.distance)}분
        </p>
      </div>
    </Wrapper>
  );
}

function Dot({ surface }: { surface: 'light' | 'dark' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-[3px] w-[3px] rounded-full',
        surface === 'light' ? 'bg-ink-300' : 'bg-white/25',
      )}
    />
  );
}
