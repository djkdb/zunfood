import { forwardRef, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { formatDistance } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import { diversePool } from '@/solo/methods';
import type { SoloGameProps } from './types';

/** 8강 → 4강 → 결승. 후보가 모자라면 4강이나 결승만 한다 */
const BRACKET_SIZES = [8, 4, 2];

const ROUND_LABEL: Record<number, string> = { 8: '8강', 4: '4강', 2: '결승' };

/**
 * 음식 월드컵.
 *
 * 무작위가 아니라 내가 고른 결과가 나온다. 한 번에 둘만 보여주면
 * "둘 중엔 이게 낫지" 라는 판단은 쉽게 되고, 그게 쌓여 결론이 된다.
 */
export function WorldCupGame({ candidates, seed, onDecide }: SoloGameProps) {
  const initial = useMemo(() => {
    const size = BRACKET_SIZES.find((n) => n <= candidates.length) ?? 2;
    return diversePool(candidates, size, seed);
  }, [candidates, seed]);

  /** 이번 라운드에 남은 곳 */
  const [pool, setPool] = useState<Restaurant[]>(initial);
  /** 다음 라운드로 올라간 곳 */
  const [survivors, setSurvivors] = useState<Restaurant[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);

  const a = pool[matchIndex * 2];
  const b = pool[matchIndex * 2 + 1];
  const matchCount = Math.floor(pool.length / 2);

  const choose = (winner: Restaurant) => {
    const nextSurvivors = [...survivors, winner];

    if ((matchIndex + 1) * 2 < pool.length) {
      setSurvivors(nextSurvivors);
      setMatchIndex(matchIndex + 1);
      return;
    }

    if (nextSurvivors.length === 1) {
      onDecide(nextSurvivors[0], `${ROUND_LABEL[initial.length] ?? '토너먼트'}부터 직접 골라 올라온 곳`);
      return;
    }

    setPool(nextSurvivors);
    setSurvivors([]);
    setMatchIndex(0);
  };

  if (!a || !b) return null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.18em] text-accent">
          {ROUND_LABEL[pool.length] ?? `${pool.length}강`}
        </p>
        <h2 className="mt-1.5 text-h1 text-white">어디가 더 끌려요?</h2>
        <p className="mt-1 text-sm font-semibold text-white/35">
          {matchIndex + 1} / {matchCount}
        </p>
      </div>

      <div className="relative mt-5 flex flex-1 flex-col justify-center gap-3">
        <AnimatePresence mode="popLayout">
          <Choice key={a.id} restaurant={a} from={-24} onClick={() => choose(a)} />
          <Choice key={b.id} restaurant={b} from={24} onClick={() => choose(b)} />
        </AnimatePresence>

        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-arena px-3.5 py-1.5 text-sm font-extrabold tracking-wider text-white/55 ring-1 ring-white/10"
        >
          VS
        </span>
      </div>
    </div>
  );
}

/**
 * AnimatePresence 의 popLayout 은 자식에 ref 를 걸어 자리를 재는다.
 * 일반 함수 컴포넌트로 두면 ref 가 전달되지 않아 경고가 난다.
 */
const Choice = forwardRef<
  HTMLButtonElement,
  { restaurant: Restaurant; from: number; onClick: () => void }
>(function Choice({ restaurant, from, onClick }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      layout
      initial={{ opacity: 0, x: from }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex flex-1 items-center gap-4 rounded-2xl bg-white/10 p-5 text-left ring-1 ring-white/10 active:bg-white/16"
    >
      <RestaurantThumb
        category={restaurant.category}
        name={restaurant.name}
        className="h-20 w-20 shrink-0 rounded-2xl"
        emojiClassName="text-[42px]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-h1 leading-tight text-white line-clamp-2">{restaurant.name}</p>
        <p className="mt-1 text-sm font-semibold text-white/45">
          {CATEGORY_LABEL[restaurant.category]} · 걸어서 {walkingMinutes(restaurant.distance)}분 ·{' '}
          {formatDistance(restaurant.distance)}
        </p>
      </div>
    </motion.button>
  );
});
