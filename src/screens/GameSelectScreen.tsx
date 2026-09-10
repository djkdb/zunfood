import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { GAMES, isPlayable } from '@/games/registry';
import { useRoomStore } from '@/store/roomStore';
import type { GameId } from '@/types/game';
import type { Player, Room } from '@/types/room';

interface GameSelectScreenProps {
  room: Room;
  players: Player[];
  isHost: boolean;
}

export function GameSelectScreen({ room, players, isHost }: GameSelectScreenProps) {
  const startGame = useRoomStore((s) => s.startGame);
  const backToLobby = useRoomStore((s) => s.backToLobby);
  const [starting, setStarting] = useState<GameId | null>(null);

  const pick = async (gameId: GameId) => {
    if (!isHost || starting) return;
    setStarting(gameId);
    try {
      await startGame(gameId);
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <div className="pt-2">
        <p className="text-[13px] font-bold tracking-widest text-brand-200">
          후보 {room.candidates.length}곳 준비 완료 · {room.location.name}
        </p>
        <h1 className="mt-2 text-[28px] font-black leading-tight">
          오늘은 어떤 게임으로
          <br />
          정할까요?
        </h1>
      </div>

      <div className="space-y-3">
        {GAMES.map((game, index) => {
          const playable = isPlayable(game, players.length);
          const disabled = !isHost || !playable || Boolean(starting);

          return (
            <motion.button
              key={game.id}
              type="button"
              disabled={disabled}
              onClick={() => pick(game.id)}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07, type: 'spring', stiffness: 220, damping: 22 }}
              whileTap={disabled ? undefined : { scale: 0.97 }}
              className={`relative w-full overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br ${game.accent} p-[1.5px] text-left disabled:opacity-55`}
            >
              <div className="stripe-bg relative flex items-center gap-4 rounded-[22px] bg-navy-900/85 p-5">
                <span className="text-[40px] drop-shadow">{game.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[20px] font-black">{game.title}</span>
                  <span className="mt-0.5 block text-[14px] font-semibold text-white/55">
                    {game.tagline}
                  </span>
                  <span className="mt-1 block text-[12px] text-white/35">{game.description}</span>
                </span>
                {starting === game.id ? (
                  <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                ) : (
                  <span className="shrink-0 text-[20px] text-white/35">›</span>
                )}
              </div>
              {!playable && (
                <span className="absolute right-4 top-4 rounded-full bg-navy-950/85 px-2 py-1 text-[11px] font-bold text-coral">
                  {game.minPlayers}명 이상
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {isHost ? (
        <Button variant="ghost" size="md" block onClick={backToLobby}>
          대기실로 돌아가기
        </Button>
      ) : (
        <div className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-[15px] font-bold text-white/55">
          <span className="mr-2 h-2 w-2 animate-ping rounded-full bg-pop-400" />
          방장이 게임을 고르는 중…
        </div>
      )}
    </div>
  );
}
