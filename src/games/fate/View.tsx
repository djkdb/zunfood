import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TIMING } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CATEGORY_EMOJI } from '@/types/restaurant';
import type { GameViewProps } from '@/types/game';
import { findRestaurant, resolveAll } from '../shared';
import type { FateState } from './logic';

export function FateView({ state, ctx, me, isHost, dispatch }: GameViewProps<FateState>) {
  const options = resolveAll(ctx.candidates, state.optionIds);
  const winner = findRestaurant(ctx.candidates, state.optionIds[state.winnerIndex] ?? null);
  const committed = state.committedPlayerIds.includes(me.id);

  if (state.phase === 'ready') {
    return (
      <div className="flex flex-col items-center gap-7 py-6 text-center">
        <motion.span
          className="text-[76px]"
          animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          🎲
        </motion.span>
        <div>
          <h2 className="text-[28px] font-black leading-tight">
            오늘은
            <br />
            운명에 맡긴다.
          </h2>
          <p className="mt-3 text-[14px] font-semibold text-white/50">
            모두가 운명을 맡기면 한 곳이 정해집니다.
          </p>
        </div>

        <div className="w-full space-y-3">
          {/* 주 버튼은 움직이지 않는다 — 모바일에서 터치 목표가 흔들리면 안 된다. */}
          <Button variant="pop" block disabled={committed} onClick={() => dispatch('commit')}>
            {committed ? '운명을 맡겼어요' : '🔮 운명 맡기기'}
          </Button>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-white/60">
              {state.committedPlayerIds.length} / {ctx.players.length}명 준비
            </span>
            <div className="flex shrink-0 -space-x-2">
              {ctx.players.map((player) => (
                <PlayerAvatar
                  key={player.id}
                  nickname={player.nickname}
                  avatar={player.avatar}
                  size="sm"
                  dim={!state.committedPlayerIds.includes(player.id)}
                  className="ring-2 ring-navy-900"
                />
              ))}
            </div>
          </div>

          {isHost && (
            <Button variant="ghost" size="md" block onClick={() => dispatch('force')}>
              기다리지 않고 바로 뽑기
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'countdown') {
    return (
      <motion.div
        animate={{ x: [0, -5, 5, -4, 4, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        <Countdown
          startedAt={state.phaseStartedAt}
          durationMs={TIMING.countdownMs}
          label="운명이 결정됩니다"
        />
      </motion.div>
    );
  }

  if (state.phase === 'reeling') {
    return <FateReel state={state} names={options.map((r) => `${CATEGORY_EMOJI[r.category]} ${r.name}`)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 16 }}
      className="space-y-5 py-4 text-center"
    >
      <span className="text-[56px]">🏆</span>
      <p className="text-[13px] font-black tracking-[0.3em] text-pop-300">운명의 선택</p>
      {winner && <RestaurantCard restaurant={winner} />}
    </motion.div>
  );
}

function FateReel({ state, names }: { state: FateState; names: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (names.length === 0) return;
    const totalSteps = names.length * 5 + state.winnerIndex;

    const update = () => {
      const elapsed = Date.now() - state.phaseStartedAt;
      const p = Math.min(1, elapsed / TIMING.fateReelMs);
      const eased = 1 - (1 - p) ** 3; // 점점 느려지는 슬롯머신
      setIndex(Math.floor(eased * totalSteps) % names.length);
    };

    update();
    const id = window.setInterval(update, 45);
    return () => window.clearInterval(id);
  }, [state.phaseStartedAt, state.winnerIndex, names.length]);

  return (
    <motion.div
      animate={{ x: [0, -6, 6, -5, 5, 0], rotate: [0, -0.6, 0.6, 0] }}
      transition={{ duration: 0.45, repeat: Infinity }}
      className="flex flex-col items-center gap-6 py-12"
    >
      <p className="text-[15px] font-black tracking-widest text-white/45">운명을 고르는 중…</p>
      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-pop-400/50 bg-navy-950/70 px-4 shadow-glow">
        <motion.span
          key={index}
          initial={{ y: 26, opacity: 0.2 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.05 }}
          className="text-center text-[24px] font-black leading-tight"
        >
          {names[index] ?? '…'}
        </motion.span>
      </div>
    </motion.div>
  );
}
