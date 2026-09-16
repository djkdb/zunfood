import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { formatDistance } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import { diversePool } from '@/solo/methods';
import type { SoloGameProps } from './types';

const DECK_SIZE = 12;

/**
 * 넘기기.
 *
 * 한 장씩만 보여준다. 고민할 정보가 한 곳뿐이라 "여긴 아니야 / 여기 좋다" 가
 * 빠르게 나온다. 끝까지 넘기면 그 사실 자체가 답이 되기도 해서,
 * 다시 돌거나 조건을 바꾸도록 안내한다.
 */
export function SwipeGame({ candidates, seed, onDecide }: SoloGameProps) {
  const deck = useMemo(
    () => diversePool(candidates, Math.min(DECK_SIZE, candidates.length), seed),
    [candidates, seed],
  );
  const [index, setIndex] = useState(0);
  const [passed, setPassed] = useState<Restaurant[]>([]);

  const current = deck[index];

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <span className="text-[52px]" aria-hidden>
          🤷
        </span>
        <div>
          <h2 className="text-h1 text-white">{deck.length}곳을 다 넘겼어요</h2>
          <p className="mt-2 text-body text-white/45">
            오늘은 딱히 끌리는 데가 없나 봐요.
          </p>
        </div>
        <div className="w-full space-y-2">
          <Button
            surface="dark"
            variant="accent"
            block
            onClick={() => {
              setIndex(0);
              setPassed([]);
            }}
          >
            처음부터 다시 보기
          </Button>
          {passed.length > 0 && (
            <Button
              surface="dark"
              variant="secondary"
              block
              onClick={() =>
                onDecide(passed[0], '넘기다 보니 결국 처음 본 곳이 제일 나았어요')
              }
            >
              그래도 첫 번째 곳으로
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.18em] text-accent">넘기기</p>
        <h2 className="mt-1.5 text-h1 text-white">여기 어때요?</h2>
        <p className="mt-1 text-sm font-semibold text-white/35">
          {index + 1} / {deck.length}
        </p>
      </div>

      <div className="relative mt-5 flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 40, rotate: 3 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -120, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="flex w-full flex-col items-center gap-5 rounded-3xl bg-white/8 px-5 py-8 text-center"
          >
            <RestaurantThumb
              category={current.category}
              name={current.name}
              className="h-[104px] w-[104px] rounded-3xl"
              emojiClassName="text-[52px]"
            />
            <div>
              <p className="text-display text-white">{current.name}</p>
              <p className="mt-2 text-body text-white/45">
                {CATEGORY_LABEL[current.category]} · 걸어서{' '}
                {walkingMinutes(current.distance)}분 · {formatDistance(current.distance)}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setPassed([...passed, current]);
            setIndex(index + 1);
          }}
          className="h-[60px] rounded-2xl bg-white/8 text-h3 text-white/60 active:bg-white/16"
        >
          <span aria-hidden>✕</span> 다음
        </button>
        <button
          type="button"
          onClick={() =>
            onDecide(current, `${index + 1}번째에서 "여기다" 싶었던 곳`)
          }
          className="h-[60px] rounded-2xl bg-accent text-h3 text-white active:brightness-95"
        >
          <span aria-hidden>❤️</span> 여기로
        </button>
      </div>
    </div>
  );
}
