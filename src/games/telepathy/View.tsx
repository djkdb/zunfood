import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { formatDistance } from '@/lib/format';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import type { TelepathyState } from './logic';

export function TelepathyView({ state, ctx, me, dispatch }: GameViewProps<TelepathyState>) {
  const picked = state.pickedPlayerIds.includes(me.id);

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="전원이 같은 곳을 고르면 끝"
        />
      </div>
    );
  }

  if (state.phase === 'result' || state.phase === 'done') {
    const winner = findRestaurant(ctx.candidates, state.winnerId);
    if (!winner) return null;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="flex flex-1 flex-col items-center justify-center gap-6 text-center"
      >
        <p className="text-sm font-extrabold tracking-[0.2em] text-accent">
          {state.matched ? '마음이 통했어요' : '표가 갈렸어요'}
        </p>
        <RestaurantThumb
          category={winner.category}
          name={winner.name}
          className="h-[120px] w-[120px] rounded-3xl"
          emojiClassName="text-[58px]"
        />
        <div>
          <p className="text-display text-white">{winner.name}</p>
          <p className="mt-2 text-body text-white/45">
            {state.matched
              ? `${state.round}번 만에 전원이 같은 곳을 골랐어요`
              : '두 곳까지 좁혀서 많이 고른 쪽으로 정했어요'}
          </p>
        </div>
      </motion.div>
    );
  }

  const revealing = state.phase === 'reveal';

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.18em] text-accent">
          {state.round}번째 시도
        </p>
        <h2 className="mt-1.5 text-h1 text-white">
          {revealing ? '아쉽게 갈렸어요' : picked ? '다 고를 때까지 기다려요' : '어디로 갈까요?'}
        </h2>
        <p className="mt-1 text-sm font-semibold text-white/35">
          {revealing ? '제일 적게 고른 곳이 사라져요' : '말하지 말고 마음으로 맞춰보세요'}
        </p>
      </div>

      <div className="mt-4 flex-1 space-y-2">
        <AnimatePresence mode="popLayout">
          {state.optionIds.map((optionId) => {
            const restaurant = findRestaurant(ctx.candidates, optionId);
            if (!restaurant) return null;
            const tally = state.lastTally?.find((t) => t.optionId === optionId);
            return (
              <Option
                key={optionId}
                restaurant={restaurant}
                voters={revealing ? tally?.players ?? [] : []}
                dying={state.eliminated.includes(optionId)}
                disabled={picked || revealing}
                onPick={() => dispatch('pick', { optionId })}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {ctx.players.map((player) => (
            <PlayerAvatar
              key={player.id}
              avatar={player.avatar}
              size="sm"
              surface="dark"
              dim={!state.pickedPlayerIds.includes(player.id)}
            />
          ))}
        </div>
        <p className="text-sm font-bold text-white/35">
          {state.pickedPlayerIds.length} / {ctx.players.length}명 선택
        </p>
      </div>
    </div>
  );
}

/** popLayout 은 자식에 ref 를 걸어 자리를 잰다 — 함수 컴포넌트면 전달되지 않는다 */
const Option = forwardRef<
  HTMLButtonElement,
  {
    restaurant: Restaurant;
    voters: string[];
    dying: boolean;
    disabled: boolean;
    onPick: () => void;
  }
>(function Option({ restaurant, voters, dying, disabled, onPick }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dying ? 0.35 : 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      disabled={disabled}
      onClick={onPick}
      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
        dying ? 'bg-danger/12' : 'bg-white/8 active:bg-white/16'
      }`}
    >
      <RestaurantThumb
        category={restaurant.category}
        name={restaurant.name}
        className="h-12 w-12 shrink-0 rounded-xl"
        emojiClassName="text-[26px]"
      />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-h3 ${dying ? 'text-white/50 line-through' : 'text-white'}`}>
          {restaurant.name}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-white/40">
          {voters.length > 0
            ? voters.join(' · ')
            : `${CATEGORY_LABEL[restaurant.category]} · ${formatDistance(restaurant.distance)}`}
        </span>
      </span>
      {voters.length > 0 && (
        <span className="shrink-0 text-h3 tabular-nums text-accent-300">{voters.length}</span>
      )}
    </motion.button>
  );
});
