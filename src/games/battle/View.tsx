import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantThumb } from '@/components/RestaurantThumb';
import { formatPriceLevel, formatRating, formatWon } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { cn } from '@/lib/cn';
import { CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import { currentMatch, roundLabel, type BattleState } from './logic';

export function BattleView({ state, ctx, me, dispatch }: GameViewProps<BattleState>) {
  const match = currentMatch(state);
  const a = findRestaurant(ctx.candidates, match?.a ?? null);
  const b = findRestaurant(ctx.candidates, match?.b ?? null);
  const [myVote, setMyVote] = useState<string | null>(null);

  useEffect(() => {
    setMyVote(null);
  }, [state.roundIndex, state.matchIndex]);

  if (!match || !a || !b) {
    return <p className="py-20 text-center text-body text-white/45">대진을 준비하는 중…</p>;
  }

  const vote = (optionId: string) => {
    if (state.phase !== 'voting' || myVote) return;
    setMyVote(optionId);
    dispatch('vote', { optionId });
  };

  const revealed = state.phase === 'reveal';
  const winnerId = revealed ? match.winnerId : null;
  const matchCount = state.rounds[state.roundIndex]?.length ?? 1;

  if (state.phase === 'countdown') {
    return (
      <div className="flex flex-1 flex-col">
        <RoundHeader state={state} matchCount={matchCount} />
        <div className="flex flex-1 items-center justify-center">
          <Countdown startedAt={state.phaseStartedAt} durationMs={TIMING.countdownMs} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <RoundHeader state={state} matchCount={matchCount} />

      {/* 대결 */}
      <div className="relative mt-4 flex flex-1 flex-col justify-center gap-3">
        <Fighter
          restaurant={a}
          selected={myVote === a.id}
          revealed={revealed}
          votes={match.tally?.a ?? 0}
          isWinner={winnerId === a.id}
          disabled={state.phase !== 'voting' || Boolean(myVote)}
          onClick={() => vote(a.id)}
        />

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <AnimatePresence mode="wait">
            {revealed ? (
              <motion.span
                key="score"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-12 items-center rounded-full bg-white px-4 text-[18px] font-extrabold text-ink-900 shadow-lift"
              >
                {match.tally?.a ?? 0}
                <span className="mx-1.5 text-ink-300">:</span>
                {match.tally?.b ?? 0}
              </motion.span>
            ) : (
              <motion.span
                key="vs"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[15px] font-extrabold text-white shadow-lift"
              >
                VS
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <Fighter
          restaurant={b}
          selected={myVote === b.id}
          revealed={revealed}
          votes={match.tally?.b ?? 0}
          isWinner={winnerId === b.id}
          disabled={state.phase !== 'voting' || Boolean(myVote)}
          onClick={() => vote(b.id)}
        />
      </div>

      {/* 하단 상태 */}
      <div className="mt-5 min-h-[92px]">
        <AnimatePresence mode="wait">
          {state.phase === 'voting' ? (
            <motion.div
              key="voting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <VoteTimer startedAt={state.phaseStartedAt} durationMs={TIMING.battleVoteMs} />
              <div className="flex items-center justify-center gap-2">
                {ctx.players.map((player) => (
                  <span key={player.id} className="flex flex-col items-center gap-1">
                    <PlayerAvatar
                      avatar={player.avatar}
                      size="sm"
                      surface="dark"
                      dim={!state.votedPlayerIds.includes(player.id)}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-bold',
                        state.votedPlayerIds.includes(player.id)
                          ? 'text-success'
                          : 'text-white/25',
                      )}
                    >
                      {state.votedPlayerIds.includes(player.id) ? '완료' : '고민중'}
                    </span>
                  </span>
                ))}
              </div>
              <p className="text-center text-sm font-semibold text-white/40">
                {myVote
                  ? '모두 고르면 공개돼요'
                  : `${me.nickname}님, 먹고 싶은 쪽을 눌러주세요`}
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="pt-4 text-center text-h1 text-white"
            >
              {findRestaurant(ctx.candidates, winnerId)?.name} WIN
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RoundHeader({ state, matchCount }: { state: BattleState; matchCount: number }) {
  return (
    <div className="flex items-baseline justify-center gap-2 pt-2">
      <span className="text-[15px] font-extrabold tracking-[0.2em] text-accent">
        {roundLabel(state)}
      </span>
      <span className="text-sm font-bold text-white/35">
        {state.matchIndex + 1} / {matchCount}
      </span>
    </div>
  );
}

interface FighterProps {
  restaurant: Restaurant;
  selected: boolean;
  revealed: boolean;
  votes: number;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
}

function Fighter({
  restaurant,
  selected,
  revealed,
  votes,
  isWinner,
  disabled,
  onClick,
}: FighterProps) {
  const eliminated = revealed && !isWinner;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      animate={
        eliminated
          ? { scale: 0.95, opacity: 0.35 }
          : isWinner
            ? { scale: 1.02, opacity: 1 }
            : { scale: 1, opacity: 1 }
      }
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={cn(
        'relative flex min-h-[136px] w-full items-center gap-4 overflow-hidden rounded-2xl border-2 p-4 text-left',
        isWinner
          ? 'border-accent bg-accent/12'
          : selected
            ? 'border-primary-300 bg-primary/12'
            : 'border-white/10 bg-white/6',
      )}
    >
      <RestaurantThumb
        category={restaurant.category}
        thumbnail={restaurant.thumbnail}
        name={restaurant.name}
        className="h-[72px] w-[72px] shrink-0 rounded-xl"
        emojiClassName="text-[34px]"
      />

      <span className="min-w-0 flex-1">
        <span className="block break-keep text-h1 leading-tight text-white">
          {restaurant.name}
        </span>
        <span className="mt-1.5 block text-sm text-white/45">
          {CATEGORY_LABEL[restaurant.category]}
          {restaurant.rating > 0 && ` · ⭐ ${formatRating(restaurant.rating)}`}
          {` · 걸어서 ${walkingMinutes(restaurant.distance)}분`}
        </span>
        {(restaurant.priceRange > 0 || restaurant.priceLevel) && (
          <span className="mt-0.5 block text-sm font-bold text-accent-300">
            {restaurant.priceRange > 0
              ? formatWon(restaurant.priceRange)
              : formatPriceLevel(restaurant.priceLevel as number)}
          </span>
        )}
      </span>

      <AnimatePresence mode="popLayout">
        {revealed ? (
          <motion.span
            key="tally"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[19px] font-extrabold',
              isWinner ? 'bg-accent text-white' : 'bg-white/10 text-white/50',
            )}
          >
            {votes}
          </motion.span>
        ) : selected ? (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-[18px] font-extrabold text-white"
            aria-label="내가 고른 곳"
          >
            ✓
          </motion.span>
        ) : null}
      </AnimatePresence>

      {isWinner && (
        <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-white">
          WIN
        </span>
      )}
      {eliminated && (
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-extrabold text-white/70">
          탈락
        </span>
      )}
    </motion.button>
  );
}

function VoteTimer({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    const update = () =>
      setRatio(Math.max(0, Math.min(1, (startedAt + durationMs - Date.now()) / durationMs)));
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [startedAt, durationMs]);

  const seconds = Math.ceil((ratio * durationMs) / 1000);
  const urgent = ratio <= 0.33;

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/12">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-100 ease-linear',
            urgent ? 'bg-danger' : 'bg-accent',
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span
        className={cn(
          'w-9 shrink-0 text-right text-sm font-extrabold tabular-nums',
          urgent ? 'text-danger' : 'text-white/45',
        )}
      >
        {seconds}초
      </span>
    </div>
  );
}
