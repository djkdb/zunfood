import { forwardRef, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar, faceFor } from '@/components/ui/PlayerAvatar';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { formatDistance } from '@/lib/format';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import { currentPlayerId, remaining, type EliminationState } from './logic';

export function EliminationView({
  state,
  ctx,
  me,
  dispatch,
}: GameViewProps<EliminationState>) {
  const turnPlayerId = currentPlayerId(state, ctx);
  const turnPlayer = ctx.players.find((p) => p.id === turnPlayerId) ?? null;
  const myTurn = turnPlayerId === me.id;

  const alive = useMemo(
    () =>
      remaining(state)
        .map((id) => findRestaurant(ctx.candidates, id))
        .filter((r): r is Restaurant => Boolean(r)),
    [state, ctx.candidates],
  );

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="싫은 곳부터 지워요"
        />
      </div>
    );
  }

  const winner = state.winnerId ? findRestaurant(ctx.candidates, state.winnerId) : null;
  if (winner && state.phase !== 'playing') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
      >
        <p className="text-sm font-extrabold tracking-[0.2em] text-accent">마지막 한 곳</p>
        <RestaurantThumb
          category={winner.category}
          name={winner.name}
          className="h-[120px] w-[120px] rounded-3xl"
          emojiClassName="text-[58px]"
        />
        <div>
          <p className="text-display text-white">{winner.name}</p>
          <p className="mt-2 text-body text-white/45">
            {state.removed.length}곳이 지워지고 살아남았어요
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TurnBar
        nickname={turnPlayer?.nickname ?? '…'}
        avatar={turnPlayer?.avatar ?? 0}
        myTurn={myTurn}
        left={alive.length}
        turnStartedAt={state.turnStartedAt}
      />

      <div className="mt-4 grid flex-1 auto-rows-min grid-cols-2 gap-2">
        <AnimatePresence mode="popLayout">
          {alive.map((restaurant) => (
            <Card
              key={restaurant.id}
              restaurant={restaurant}
              enabled={myTurn}
              onStrike={() => dispatch('strike', { optionId: restaurant.id })}
            />
          ))}
        </AnimatePresence>
      </div>

      {state.removed.length > 0 && <Graveyard state={state} ctx={ctx} />}
    </div>
  );
}

function TurnBar({
  nickname,
  avatar,
  myTurn,
  left,
  turnStartedAt,
}: {
  nickname: string;
  avatar: number;
  myTurn: boolean;
  left: number;
  turnStartedAt: number;
}) {
  const seconds = useSecondsLeft(turnStartedAt, TIMING.eliminationTurnMs);

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3">
      <PlayerAvatar avatar={avatar} size="sm" surface="dark" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-h3 text-white">
          {myTurn ? '내 차례예요' : `${nickname}님 차례`}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-white/40">
          {myTurn ? '싫은 곳을 하나 누르세요' : `${left}곳 남음`}
        </p>
      </div>
      <span
        className={`shrink-0 text-h2 tabular-nums ${
          seconds <= 5 ? 'text-danger' : 'text-white/50'
        }`}
      >
        {seconds}
      </span>
    </div>
  );
}

/** popLayout 은 자식에 ref 를 걸어 자리를 잰다 — 함수 컴포넌트면 전달되지 않는다 */
const Card = forwardRef<
  HTMLButtonElement,
  { restaurant: Restaurant; enabled: boolean; onStrike: () => void }
>(function Card({ restaurant, enabled, onStrike }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7, rotate: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      whileTap={enabled ? { scale: 0.95 } : undefined}
      disabled={!enabled}
      onClick={onStrike}
      aria-label={`${restaurant.name} 지우기`}
      className={`flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-colors ${
        enabled ? 'bg-white/10 ring-1 ring-white/12 active:bg-danger/25' : 'bg-white/6'
      }`}
    >
      <RestaurantThumb
        category={restaurant.category}
        name={restaurant.name}
        className="h-12 w-12 rounded-xl"
        emojiClassName="text-[26px]"
      />
      <span className="w-full truncate text-[14px] font-extrabold text-white">
        {restaurant.name}
      </span>
      <span className="w-full truncate text-xs font-semibold text-white/40">
        {CATEGORY_LABEL[restaurant.category]} · {formatDistance(restaurant.distance)}
      </span>
    </motion.button>
  );
});

/** 지워진 곳들 — 누가 지웠는지가 이 게임의 이야기다 */
function Graveyard({
  state,
  ctx,
}: {
  state: EliminationState;
  ctx: GameViewProps<EliminationState>['ctx'];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {state.removed.map((strike) => {
        const restaurant = findRestaurant(ctx.candidates, strike.optionId);
        const player = ctx.players.find((p) => p.id === strike.playerId);
        if (!restaurant) return null;
        return (
          <motion.span
            key={strike.optionId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex max-w-full items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-white/30"
          >
            <span aria-hidden>{player ? faceFor(player.avatar) : '⏱'}</span>
            <span className="truncate line-through">{restaurant.name}</span>
          </motion.span>
        );
      })}
    </div>
  );
}

/** 남은 시간(초) — 호스트가 정한 시작 시각 기준이라 모두 같은 숫자를 본다 */
function useSecondsLeft(startedAt: number, durationMs: number): number {
  const compute = () => Math.max(0, Math.ceil((startedAt + durationMs - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(compute);

  useEffect(() => {
    setSeconds(compute());
    const id = window.setInterval(() => setSeconds(compute()), 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMs]);

  return seconds;
}
