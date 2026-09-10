import { useMemo } from 'react';
import { getGame } from '@/games/registry';
import { GAME_VIEWS } from '@/games/views';
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
}

export function PlayScreen({ room, players, me, isHost, envelope }: PlayScreenProps) {
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
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        <p className="text-[15px] font-bold text-white/55">게임을 준비하는 중…</p>
      </div>
    );
  }

  const View = GAME_VIEWS[game.id];

  return (
    <div className="pb-8 pt-1">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[22px]">{game.emoji}</span>
        <h1 className="text-[18px] font-black">{game.title}</h1>
        <span className="ml-auto text-[12px] font-bold text-white/35">
          {players.length}명 플레이 중
        </span>
      </div>

      <View
        state={envelope.state as never}
        ctx={ctx}
        me={me}
        isHost={isHost}
        dispatch={dispatch}
      />
    </div>
  );
}
