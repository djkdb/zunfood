import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { LoadingDots } from '@/components/ui/ProgressBar';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { Sheet } from '@/components/ui/Sheet';
import { formatCompactWon, formatDistance, formatWon, formatRating } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { directionsUrl, mapUrl } from '@/lib/map';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';

export interface ResultAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost';
}

interface ResultViewProps {
  restaurant: Restaurant;
  /** 결과 위 한 줄 (예: "오늘의 선택") */
  kicker: string;
  /** 공개 전 티저 문구 (예: "오늘 저녁은") */
  teaser?: string;
  /** 식당 아래 한 줄 — 게임 이름·참가자 등 */
  footnote?: ReactNode;
  actions?: ResultAction[];
  onShare?: () => void;
}

const TEASER_MS = 1_100;

/**
 * 최종 결과 화면.
 * 티저 → 공개 순서로 감정을 만들고, 화면 자체가 스크린샷 한 장이 되게 구성한다.
 */
export function ResultView({
  restaurant,
  kicker,
  teaser,
  footnote,
  actions = [],
  onShare,
}: ResultViewProps) {
  const [revealed, setRevealed] = useState(!teaser);
  const [menuOpen, setMenuOpen] = useState(false);

  const stats: { value: string; label: string }[] = [
    ...(restaurant.rating > 0
      ? [{ value: formatRating(restaurant.rating), label: '평점' }]
      : []),
    { value: `${walkingMinutes(restaurant.distance)}분`, label: '걸어서' },
    ...(restaurant.priceRange > 0
      ? [{ value: formatCompactWon(restaurant.priceRange), label: '1인 평균' }]
      : [{ value: formatDistance(restaurant.distance), label: '거리' }]),
  ];

  useEffect(() => {
    if (!teaser) return;
    setRevealed(false);
    const timer = window.setTimeout(() => setRevealed(true), TEASER_MS);
    return () => window.clearTimeout(timer);
  }, [teaser, restaurant.id]);

  return (
    <div className="flex flex-1 flex-col pad-bottom">
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="teaser"
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{ duration: 0.28 }}
            className="flex flex-1 flex-col items-center justify-center gap-5"
          >
            <p className="text-h1 text-white/75">{teaser}</p>
            <LoadingDots surface="dark" />
          </motion.div>
        ) : (
          <motion.div key="result" className="flex flex-1 flex-col">
            <Confetti />

            <div className="flex flex-col items-center pt-6 text-center">
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[14px] font-bold text-accent-300"
              >
                {kicker}
              </motion.p>

              <motion.div
                initial={{ scale: 0.72, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="mt-5"
              >
                <RestaurantThumb
                  category={restaurant.category}
                  thumbnail={restaurant.thumbnail}
                  name={restaurant.name}
                  className="h-[132px] w-[132px] rounded-3xl"
                  emojiClassName="text-[62px]"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 240, damping: 20 }}
                className="mt-5 text-display text-white"
              >
                {restaurant.name}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.22 }}
                className="mt-1.5 text-body text-white/50"
              >
                {CATEGORY_LABEL[restaurant.category]}
                {restaurant.isOpen === true && ' · 지금 영업중'}
                {restaurant.isOpen === false && ' · 지금은 영업종료'}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 flex w-full items-stretch rounded-xl bg-white/8"
              >
                {/* 데이터 소스가 주지 않는 값은 '—' 로 채우지 않고 항목 자체를 뺀다 */}
                {stats.map((stat, index) => (
                  <Fragment key={stat.label}>
                    {index > 0 && <Divider />}
                    <Stat value={stat.value} label={stat.label} />
                  </Fragment>
                ))}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.38 }}
                className="mt-4 text-sm text-white/40"
              >
                {restaurant.address}
              </motion.p>

              {footnote && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.44 }}
                  className="mt-4 text-sm text-white/45"
                >
                  {footnote}
                </motion.div>
              )}
            </div>

            <div className="flex-1" />

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 space-y-2"
            >
              <Button
                surface="dark"
                variant="accent"
                block
                onClick={() => window.open(mapUrl(restaurant), '_blank', 'noopener,noreferrer')}
              >
                지도에서 보기
              </Button>

              <div className="grid grid-cols-2 gap-2">
                {actions.slice(0, 2).map((action) => (
                  <Button
                    key={action.label}
                    surface="dark"
                    variant={action.variant ?? 'secondary'}
                    size="md"
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-center gap-1 pt-1">
                {onShare && (
                  <button
                    type="button"
                    onClick={onShare}
                    className="h-11 rounded-md px-3.5 text-[14px] font-bold text-white/55 active:bg-white/10"
                  >
                    공유하기
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="h-11 rounded-md px-3.5 text-[14px] font-bold text-white/55 active:bg-white/10"
                >
                  {restaurant.menu.length > 0 ? '메뉴·길찾기' : '길찾기'}
                </button>
                {actions.slice(2).map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="h-11 rounded-md px-3.5 text-[14px] font-bold text-white/55 active:bg-white/10"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={restaurant.name}>
        {restaurant.menu.length > 0 ? (
          <ul className="group-list">
            {restaurant.menu.map((item) => (
              <li key={item.name} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-body font-bold text-ink-900">{item.name}</span>
                <span className="text-body font-bold text-ink-600">
                  {formatWon(item.price)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-body text-muted">메뉴 정보가 아직 없어요.</p>
        )}
        <Button
          variant="secondary"
          block
          className="mt-4"
          onClick={() =>
            window.open(directionsUrl(restaurant), '_blank', 'noopener,noreferrer')
          }
        >
          길찾기 열기
        </Button>
      </Sheet>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 px-2 py-3.5 text-center">
      <p className="text-h2 text-white">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-white/40">{label}</p>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="my-3 w-px bg-white/10" />;
}
