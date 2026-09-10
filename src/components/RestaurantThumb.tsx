import { CATEGORY_EMOJI, type FoodCategory } from '@/types/restaurant';
import { cn } from '@/lib/cn';

/** 카테고리별 배경 톤 — 사진이 없을 때도 식당마다 다르게 보이게 */
const TINTS: Record<FoodCategory, string> = {
  korean: 'bg-[#FFF0DC]',
  chinese: 'bg-[#FFE6E2]',
  japanese: 'bg-[#E6F0FF]',
  western: 'bg-[#FDECEF]',
  chicken: 'bg-[#FFF4D6]',
  snack: 'bg-[#FFE8ED]',
  meat: 'bg-[#FFE3DA]',
  cafe: 'bg-[#EFE9E2]',
  etc: 'bg-[#E9F3EC]',
};

interface RestaurantThumbProps {
  category: FoodCategory;
  /** 실제 사진 URL. 없으면 카테고리 이모지로 대체한다 */
  thumbnail?: string;
  name: string;
  className?: string;
  emojiClassName?: string;
}

/** 식당 대표 이미지. 이미지가 없으면 카테고리 이모지로 대체한다. */
export function RestaurantThumb({
  category,
  thumbnail,
  name,
  className,
  emojiClassName,
}: RestaurantThumbProps) {
  if (thumbnail) {
    return (
      <img
        src={thumbnail}
        alt={name}
        loading="lazy"
        // 사진을 못 불러오면 이모지 배경이 비치도록 숨긴다
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
        className={cn('bg-ink-100 object-cover', className)}
      />
    );
  }
  return (
    <div
      className={cn('flex items-center justify-center', TINTS[category], className)}
      aria-hidden
    >
      <span className={cn('text-[26px]', emojiClassName)}>{CATEGORY_EMOJI[category]}</span>
    </div>
  );
}
