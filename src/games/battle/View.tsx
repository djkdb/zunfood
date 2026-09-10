import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatRating, formatWon } from '@/lib/format';
import { walkingMinutes } from '@/lib/geo';
import { cn } from '@/lib/cn';
import { CATEGORY_EMOJI, CATEGORY_LABEL, type Restaurant } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import { currentMatch, roundLabel, type BattleState } from './logic';

export function BattleView({ state, ctx, me, dispatch }: GameViewProps<BattleState>) {
  const match = currentMatch(state);
  const a = findRestaurant(ctx.candidates, match?.a ?? null);
  const b = findRestaurant(ctx.candidates, match?.b ?? null);

  const [myVote, setMyVote] = useState<string | null>(null);

  // 라운드가 바뀌면 내 선택을 초기화한다.
  useEffect(() => {
    setMyVote(null);
  }, [state.roundIndex, state.matchIndex]);

  useEffect(() => {
    if (state.phase === 'countdown') setMyVote(null);
  }, [state.phase]);

  if (!match || !a || !b) {
    return <p className="py-16 text-center text-[15px] text-white/50">대진을 준비하는 중…</p>;
  }

  const vote = (optionId: string) => {
    if (state.phase !== 'voting' || myVote) return;
    setMyVote(optionId);
    dispatch('vote', { optionId });
  };

  const votedCount = state.votedPlayerIds.length;
  const totalCount = ctx.players.length;
  const revealed = state.phase === 'reveal';
  const winnerId = revealed ? match.winnerId : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[22px] font-black text-pop-300">{roundLabel(state)}</span>
          <span className="text-[13px] font-bold text-white/45">
            {state.matchIndex + 1} / {state.rounds[state.roundIndex]?.length ?? 1} 경기
          </span>
        </div>
        <ProgressBar value={battleProgress(state)} />
      </div>

      {state.phase === 'countdown' ? (
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label={`${roundLabel(state)} ${state.matchIndex + 1}경기`}
        />
      ) : (
        <>
          <div className="relative space-y-3">
            <BattleCard
              restaurant={a}
              side="a"
              selected={myVote === a.id}
              revealed={revealed}
              votes={match.tally?.a ?? 0}
              isWinner={winnerId === a.id}
              disabled={state.phase !== 'voting' || Boolean(myVote)}
              onClick={() => vote(a.id)}
            />

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-navy-950 bg-gradient-to-br from-pop-300 to-coral text-[17px] font-black text-navy-950 shadow-pop">
                VS
              </span>
            </div>

            <BattleCard
              restaurant={b}
              side="b"
              selected={myVote === b.id}
              revealed={revealed}
              votes={match.tally?.b ?? 0}
              isWinner={winnerId === b.id}
              disabled={state.phase !== 'voting' || Boolean(myVote)}
              onClick={() => vote(b.id)}
            />
          </div>

          {state.phase === 'voting' && (
            <div className="space-y-3">
              <VoteTimer startedAt={state.phaseStartedAt} durationMs={TIMING.battleVoteMs} />
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white/60">
                  {votedCount} / {totalCount}명 투표 완료
                </span>
                <div className="flex shrink-0 -space-x-2">
                  {ctx.players.map((player) => (
                    <PlayerAvatar
                      key={player.id}
                      nickname={player.nickname}
                      avatar={player.avatar}
                      size="sm"
                      dim={!state.votedPlayerIds.includes(player.id)}
                      className="ring-2 ring-navy-900"
                    />
                  ))}
                </div>
              </div>
              <p className="text-center text-[13px] font-semibold text-white/35">
                {myVote
                  ? '다른 친구들을 기다리는 중… 결과는 모두 투표하면 공개돼요'
                  : `${me.nickname} 님, 오늘 먹고 싶은 쪽을 눌러주세요`}
              </p>
            </div>
          )}

          {revealed && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-[16px] font-black text-white/80"
            >
              {findRestaurant(ctx.candidates, winnerId)?.name} 승리! 🎉
            </motion.p>
          )}
        </>
      )}
    </div>
  );
}

interface BattleCardProps {
  restaurant: Restaurant;
  side: 'a' | 'b';
  selected: boolean;
  revealed: boolean;
  votes: number;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
}

function BattleCard({
  restaurant,
  side,
  selected,
  revealed,
  votes,
  isWinner,
  disabled,
  onClick,
}: BattleCardProps) {
  const eliminated = revealed && !isWinner;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      animate={
        eliminated
          ? { scale: 0.94, opacity: 0.4, rotate: side === 'a' ? -1.5 : 1.5 }
          : isWinner
            ? { scale: 1.03, opacity: 1 }
            : { scale: 1, opacity: 1 }
      }
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={cn(
        'relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border-2 p-4 text-left',
        'min-h-[112px]',
        isWinner
          ? 'border-pop-400 bg-pop-400/15'
          : selected
            ? 'border-brand-400 bg-brand-500/15'
            : 'border-white/12 bg-white/[0.06]',
      )}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[30px]">
        {CATEGORY_EMOJI[restaurant.category]}
      </span>
      <span className="min-w-0 flex-1">
        {/* 좁은 화면에서는 두 줄로 흘려서 이름이 잘리지 않게 한다 */}
        <span className="block break-keep text-[19px] font-black leading-tight">
          {restaurant.name}
        </span>
        <span className="mt-1 block text-[13px] font-semibold text-white/50">
          {CATEGORY_LABEL[restaurant.category]}
          {restaurant.rating > 0 && ` · ⭐ ${formatRating(restaurant.rating)}`}
          {` · 🚶 ${walkingMinutes(restaurant.distance)}분`}
        </span>
        {restaurant.priceRange > 0 && (
          <span className="mt-0.5 block text-[13px] font-bold text-pop-300">
            {formatWon(restaurant.priceRange)}
          </span>
        )}
      </span>

      {/* 오른쪽 슬롯: 투표 중에는 내 선택 표시, 공개 후에는 득표 수 */}
      <AnimatePresence mode="popLayout">
        {revealed ? (
          <motion.span
            key="tally"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 16 }}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[19px] font-black',
              isWinner ? 'bg-pop-400 text-navy-950' : 'bg-white/10 text-white/60',
            )}
          >
            {votes}
          </motion.span>
        ) : selected ? (
          <motion.span
            key="picked"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 16 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-[19px] font-black text-white"
            aria-label="내 선택"
          >
            ✓
          </motion.span>
        ) : null}
      </AnimatePresence>

      {/* 왼쪽 위 코너 배지 — 승리/탈락은 동시에 나오지 않으므로 자리를 공유한다 */}
      {isWinner && (
        <span className="absolute left-2 top-2 rounded-full bg-pop-400 px-2 py-0.5 text-[11px] font-black text-navy-950">
          WIN
        </span>
      )}
      {eliminated && (
        <span className="absolute left-2 top-2 rounded-full bg-navy-950/85 px-2 py-0.5 text-[11px] font-black text-coral">
          탈락
        </span>
      )}
    </motion.button>
  );
}

function VoteTimer({ startedAt, durationMs }: { startedAt: number; durationMs: number }) {
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    const update = () => {
      const left = startedAt + durationMs - Date.now();
      setRatio(Math.max(0, Math.min(1, left / durationMs)));
    };
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [startedAt, durationMs]);

  const seconds = Math.ceil((ratio * durationMs) / 1000);

  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-100 ease-linear',
            ratio > 0.33 ? 'bg-gradient-to-r from-brand-300 to-pop-400' : 'bg-coral',
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p
        className={cn(
          'text-center text-[13px] font-black',
          ratio > 0.33 ? 'text-white/50' : 'animate-pulse text-coral',
        )}
      >
        {seconds}초 남음
      </p>
    </div>
  );
}

function battleProgress(state: BattleState): number {
  const total = state.rounds[0] ? state.rounds[0].length * 2 - 1 : 1;
  const done = state.rounds.flat().filter((m) => m.winnerId !== null).length;
  return Math.min(1, done / total);
}
