import { useMemo } from 'react';
import { getGame } from '@/games/registry';
import { GAME_VIEWS } from '@/games/views';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingDots } from '@/components/ui/ProgressBar';
import type { GameEnvelope } from '@/realtime/HostEngine';
import { useRoomStore } from '@/store/roomStore';
import type { GameContext } from '@/types/game';
import type { Player, Room } from '@/types/room';

interface PlayScreenProps {
  room: Room;
  players: Player[];
  me: Player;
  isHost: boolean;
  envelope: GameEnvelope | null;
  onExit: () => void;
}

/**
 * 게임 진행 화면.
 * 진행 중에는 앱 내비게이션을 걷어내고 화면 전체를 게임에 쓴다.
 */
export function PlayScreen({ room, players, me, isHost, envelope, onExit }: PlayScreenProps) {
  const dispatch = useRoomStore((s) => s.dispatch);

  const ctx: GameContext = useMemo(
    () => ({
      roomId: room.id,
      hostId: room.hostId,
      players,
      candidates: room.candidates,
      location: room.location,
      radius: room.radius,
      filters: room.filters,
      now: Date.now(),
      seed: envelope?.seed ?? 0,
    }),
    [room, players, envelope?.seed],
  );

  const game = room.selectedGame ? getGame(room.selectedGame) : null;

  if (!game || !envelope) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <p className="text-h2 text-white">게임을 준비하는 중</p>
        <LoadingDots surface="dark" />
      </div>
    );
  }

  const View = GAME_VIEWS[game.id];
  const progress = game.getProgress?.(envelope.state as never, ctx) ?? 0;

  return (
    <div className="flex flex-1 flex-col">
      {/* 최소한의 상단 — 나가기와 진행률만 */}
      <div className="pad-x safe-top flex items-center gap-3 pt-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="게임 나가기"
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/35 active:bg-white/10"
        >
          ✕
        </button>
        <ProgressBar value={progress} surface="dark" className="flex-1" />
        <span className="shrink-0 text-xs font-bold text-white/35">
          {players.length}명
        </span>
      </div>

      <div className="pad-x pad-bottom flex flex-1 flex-col pt-2">
        <View
          state={envelope.state as never}
          ctx={ctx}
          me={me}
          isHost={isHost}
          dispatch={dispatch}
        />
      </div>
    </div>
  );
}
