import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { TextField } from '@/components/ui/TextField';
import { RestaurantCard } from '@/components/RestaurantCard';
import type { GameViewProps } from '@/types/game';
import { findRestaurant } from '../shared';
import type { JudgeState } from './logic';

const QUICK_PICKS = ['삼겹살', '치킨', '마라탕', '국밥', '초밥', '파스타', '아무거나'];

export function JudgeView({ state, ctx, me, isHost, dispatch }: GameViewProps<JudgeState>) {
  const [text, setText] = useState('');
  const submitted = state.submittedPlayerIds.includes(me.id);

  if (state.phase === 'input') {
    return (
      <div className="flex flex-1 flex-col justify-center gap-7">
        <div className="text-center">
          <span className="text-[52px]" aria-hidden>
            ⚖️
          </span>
          <h2 className="mt-4 text-display text-white">뭐 먹고 싶어요?</h2>
        </div>

        {submitted ? (
          <div className="rounded-2xl bg-success/12 py-7 text-center">
            <p className="text-h2 text-success">제출 완료</p>
            <p className="mt-1 text-body text-white/45">다른 친구들을 기다리는 중…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <TextField
              surface="dark"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="먹고 싶은 음식"
              maxLength={24}
              autoComplete="off"
              aria-label="먹고 싶은 음식"
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_PICKS.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  onClick={() => setText(pick)}
                  className="h-10 rounded-lg bg-white/8 px-3.5 text-sm font-bold text-white/70 active:bg-white/16"
                >
                  {pick}
                </button>
              ))}
            </div>
            <Button
              surface="dark"
              variant="accent"
              block
              onClick={() => dispatch('wish', { text: text.trim() || '아무거나' })}
            >
              판사에게 제출
            </Button>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {ctx.players.map((player) => (
              <PlayerAvatar
                key={player.id}
                avatar={player.avatar}
                size="sm"
                surface="dark"
                dim={!state.submittedPlayerIds.includes(player.id)}
              />
            ))}
          </div>
          <p className="text-sm font-bold text-white/35">
            {state.submittedPlayerIds.length} / {ctx.players.length}명 제출
          </p>
          {isHost && state.submittedPlayerIds.length > 0 && (
            <Button
              surface="dark"
              variant="ghost"
              size="sm"
              onClick={() => dispatch('force')}
            >
              기다리지 않고 판결받기
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'thinking') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <motion.span
          className="text-[68px]"
          animate={{ rotate: [0, -22, 0, 22, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        >
          🔨
        </motion.span>
        <p className="text-h1 text-white">판결을 내리는 중</p>
        <div className="flex w-full flex-wrap justify-center gap-2">
          {ctx.players.map((player, index) => (
            <motion.span
              key={player.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="rounded-lg bg-white/8 px-3 py-2 text-sm font-bold text-white/75"
            >
              {player.nickname} · {state.wishes[player.id] ?? '아무거나'}
            </motion.span>
          ))}
        </div>
      </div>
    );
  }

  const verdictRestaurant = findRestaurant(ctx.candidates, state.verdict?.restaurantId ?? null);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="flex flex-1 flex-col justify-center gap-6"
    >
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.2em] text-accent">AI 판결</p>
        <h2 className="mt-3 text-display text-white">{state.verdict?.headline}</h2>
      </div>

      {verdictRestaurant && <RestaurantCard restaurant={verdictRestaurant} surface="dark" />}

      <ul className="space-y-2">
        {(state.verdict?.reasons ?? []).map((reason, index) => (
          <motion.li
            key={reason}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + index * 0.1 }}
            className="flex items-start gap-2 text-body text-white/65"
          >
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/30" />
            {reason}
          </motion.li>
        ))}
      </ul>

      {state.error && <p className="text-center text-sm font-bold text-danger">{state.error}</p>}
    </motion.div>
  );
}
