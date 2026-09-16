import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { formatDistance } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import { INSTINCT_TICKETS, ticketsLeft, type InstinctState } from './logic';

export function InstinctView({ state, ctx, me, dispatch }: GameViewProps<InstinctState>) {
  const left = ticketsLeft(state, me.id);

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label={`찜은 ${INSTINCT_TICKETS}번뿐이에요`}
        />
      </div>
    );
  }

  if (state.phase === 'result' || state.phase === 'done') {
    return <Reveal state={state} ctx={ctx} />;
  }

  const current = findRestaurant(ctx.candidates, state.optionIds[state.roundIndex] ?? null);
  if (!current) return null;

  return (
    <div className="flex flex-1 flex-col">
      <Header
        index={state.roundIndex}
        total={state.optionIds.length}
        left={left}
        roundStartedAt={state.roundStartedAt}
      />

      <div className="relative mt-4 flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -24 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
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
                {CATEGORY_LABEL[current.category]} · 걸어서 {walkingMinutes(current.distance)}분 ·{' '}
                {formatDistance(current.distance)}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        disabled={left <= 0}
        onClick={() => dispatch('claim', { optionId: current.id })}
        className="mt-5 h-[68px] rounded-2xl bg-accent text-h1 text-white transition-transform active:scale-[0.98] disabled:bg-white/8 disabled:text-white/30"
      >
        {left > 0 ? '⚡ 찜하기' : '찜을 다 썼어요'}
      </button>

      {/* 남들이 얼마나 썼는지 — 무엇을 골랐는지는 끝까지 모른다 */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {ctx.players.map((player) => (
          <span key={player.id} className="flex items-center gap-1.5">
            <PlayerAvatar
              avatar={player.avatar}
              size="sm"
              surface="dark"
              dim={ticketsLeft(state, player.id) === 0}
            />
            <span className="text-xs font-bold text-white/35">
              {ticketsLeft(state, player.id)}장
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Header({
  index,
  total,
  left,
  roundStartedAt,
}: {
  index: number;
  total: number;
  left: number;
  roundStartedAt: number;
}) {
  const ratio = useRoundRatio(roundStartedAt, TIMING.instinctRoundMs);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-bold text-white/40">남은 찜</p>
          <div className="mt-1 flex gap-1.5">
            {Array.from({ length: INSTINCT_TICKETS }, (_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${i < left ? 'bg-accent' : 'bg-white/12'}`}
              />
            ))}
          </div>
        </div>
        <p className="text-sm font-bold text-white/35">
          {index + 1} / {total}
        </p>
      </div>

      {/* 남은 시간 — 숫자보다 줄어드는 막대가 급한 느낌을 준다 */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${ratio * 100}%`, transition: 'width 120ms linear' }}
        />
      </div>
    </div>
  );
}

function Reveal({
  state,
  ctx,
}: {
  state: InstinctState;
  ctx: GameViewProps<InstinctState>['ctx'];
}) {
  const results = (state.results ?? []).filter((r) => r.count > 0).slice(0, 6);
  const max = Math.max(1, ...results.map((r) => r.count));
  const winner = findRestaurant(ctx.candidates, state.winnerId);

  return (
    <div className="flex flex-1 flex-col justify-center gap-5">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.2em] text-accent">찜 결과</p>
        <h2 className="mt-2 text-h1 text-white">
          {results.length > 0 ? '이렇게 갈렸어요' : '아무도 못 골랐네요'}
        </h2>
      </div>

      {results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((result, index) => {
            const restaurant = findRestaurant(ctx.candidates, result.optionId);
            if (!restaurant) return null;
            const isWinner = result.optionId === state.winnerId;
            return (
              <motion.li
                key={result.optionId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.12 }}
                className={`rounded-xl px-3 py-2.5 ${isWinner ? 'bg-accent/18' : 'bg-white/6'}`}
              >
                <div className="flex items-baseline gap-2">
                  <p className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-white">
                    {isWinner && <span aria-hidden>👑 </span>}
                    {restaurant.name}
                  </p>
                  <p
                    className={`shrink-0 text-h3 tabular-nums ${
                      isWinner ? 'text-accent-300' : 'text-white/50'
                    }`}
                  >
                    {result.count}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className={`h-full rounded-full ${isWinner ? 'bg-accent' : 'bg-white/30'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(result.count / max) * 100}%` }}
                    transition={{ delay: 0.2 + index * 0.12, duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                {result.players.length > 0 && (
                  <p className="mt-1.5 truncate text-xs font-semibold text-white/35">
                    {result.players.join(' · ')}
                  </p>
                )}
              </motion.li>
            );
          })}
        </ul>
      ) : (
        winner && <FallbackCard restaurant={winner} />
      )}
    </div>
  );
}

function FallbackCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/8 p-6 text-center">
      <RestaurantThumb
        category={restaurant.category}
        name={restaurant.name}
        className="h-20 w-20 rounded-2xl"
        emojiClassName="text-[40px]"
      />
      <div>
        <p className="text-h1 text-white">{restaurant.name}</p>
        <p className="mt-1.5 text-body text-white/45">그래서 이곳으로 정했어요</p>
      </div>
    </div>
  );
}

/** 이번 장이 얼마나 남았는지 0~1 */
function useRoundRatio(startedAt: number, durationMs: number): number {
  const compute = () => Math.max(0, Math.min(1, 1 - (Date.now() - startedAt) / durationMs));
  const [ratio, setRatio] = useState(compute);

  useEffect(() => {
    setRatio(compute());
    const id = window.setInterval(() => setRatio(compute()), 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMs]);

  return ratio;
}
