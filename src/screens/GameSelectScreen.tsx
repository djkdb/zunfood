import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { GAMES, isPlayable } from '@/games/registry';
import { useRoomStore } from '@/store/roomStore';
import type { GameId, GameMode } from '@/types/game';
import type { Player, Room } from '@/types/room';

interface GameSelectScreenProps {
  room: Room;
  players: Player[];
  isHost: boolean;
}

export function GameSelectScreen({ room, players, isHost }: GameSelectScreenProps) {
  const startGame = useRoomStore((s) => s.startGame);
  const backToLobby = useRoomStore((s) => s.backToLobby);
  const [preview, setPreview] = useState<GameMode<never> | null>(null);
  const [starting, setStarting] = useState(false);

  const start = async (gameId: GameId) => {
    setStarting(true);
    try {
      await startGame(gameId);
    } finally {
      setStarting(false);
      setPreview(null);
    }
  };

  return (
    <div className="pad-x pad-bottom flex flex-1 flex-col">
      <div className="pt-3">
        <p className="text-sm font-bold text-primary">
          주변 {room.candidates.length}곳 · {room.location.name}
        </p>
        <h1 className="mt-2 text-h1 text-ink-900">오늘은 어떻게 정할까요?</h1>
      </div>

      <div className="mt-6 space-y-2.5">
        {GAMES.map((game, index) => {
          const playable = isPlayable(game, players.length);
          return (
            <motion.button
              key={game.id}
              type="button"
              disabled={!isHost || !playable}
              onClick={() => setPreview(game)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              whileTap={isHost && playable ? { scale: 0.985 } : undefined}
              className={`relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors disabled:opacity-55 ${
                game.recommended
                  ? 'border-accent/35 bg-accent-50'
                  : 'border-line bg-surface active:bg-ink-50'
              }`}
            >
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-[28px] ${game.tint}`}
                aria-hidden
              >
                {game.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-h2 text-ink-900">{game.title}</span>
                  {game.recommended && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-white">
                      추천
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-muted">{game.tagline}</span>
              </span>
              {!playable ? (
                <span className="shrink-0 text-xs font-bold text-danger">
                  {game.minPlayers}명 이상
                </span>
              ) : (
                <span className="shrink-0 text-[18px] text-ink-300" aria-hidden>
                  ›
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="flex-1" />

      {isHost ? (
        <Button variant="ghost" size="md" block className="mt-6" onClick={backToLobby}>
          대기실로 돌아가기
        </Button>
      ) : (
        <div className="mt-6 flex h-[54px] items-center justify-center gap-2 rounded-lg bg-ink-100 text-body font-bold text-ink-500">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
          방장이 게임을 고르는 중…
        </div>
      )}

      {/* 시작 전 미리보기 — 규칙을 3줄로 */}
      <Sheet open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title}>
        {preview && (
          <>
            <p className="-mt-1 text-body text-muted">{preview.tagline}</p>
            <ol className="mt-5 space-y-3">
              {preview.howTo.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-extrabold text-white">
                    {index + 1}
                  </span>
                  <span className="text-body text-ink-800">{step}</span>
                </li>
              ))}
            </ol>
            <Button
              variant="accent"
              block
              className="mt-6"
              loading={starting}
              onClick={() => start(preview.id)}
            >
              이 게임으로 시작
            </Button>
            <Button
              variant="ghost"
              size="md"
              block
              className="mt-1"
              onClick={() => setPreview(null)}
            >
              다른 게임 보기
            </Button>
          </>
        )}
      </Sheet>
    </div>
  );
}
