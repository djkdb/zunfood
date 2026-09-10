import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROOM } from '@/config/app';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Screen, TopBar } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { normalizeRoomCode } from '@/lib/id';
import {
  selectEnvelope,
  selectIsHost,
  selectMe,
  useRoomStore,
} from '@/store/roomStore';
import { LobbyScreen } from './LobbyScreen';
import { GameSelectScreen } from './GameSelectScreen';
import { PlayScreen } from './PlayScreen';
import { ResultScreen } from './ResultScreen';

type Phase = 'loading' | 'ready' | 'missing';

export function RoomScreen() {
  const navigate = useNavigate();
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? '');

  const snapshot = useRoomStore((s) => s.snapshot);
  const attach = useRoomStore((s) => s.attach);
  const detach = useRoomStore((s) => s.detach);
  const leave = useRoomStore((s) => s.leave);
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);
  const setError = useRoomStore((s) => s.setError);
  const me = useRoomStore(selectMe);
  const isHost = useRoomStore(selectIsHost);
  const envelope = useRoomStore(selectEnvelope);

  const [phase, setPhase] = useState<Phase>(() =>
    useRoomStore.getState().snapshot?.room.code === code ? 'ready' : 'loading',
  );
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;

    if (useRoomStore.getState().snapshot?.room.code === code) {
      setPhase('ready');
    } else {
      void attach(code).then((ok) => {
        if (!cancelled) setPhase(ok ? 'ready' : 'missing');
      });
    }

    return () => {
      cancelled = true;
      detach();
    };
  }, [code, attach, detach, navigate]);

  /** 접속 중인 참가자만 게임에 참여한 것으로 본다. */
  const players = useMemo(() => {
    if (!snapshot) return [];
    const now = Date.now();
    const online = snapshot.players.filter(
      (p) => now - p.lastSeenAt < ROOM.offlineAfterMs || p.id === me?.id,
    );
    return online.length > 0 ? online : snapshot.players;
  }, [snapshot, me?.id]);

  if (phase === 'loading') {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
          <p className="text-[15px] font-bold text-white/55">방에 들어가는 중…</p>
        </div>
      </Screen>
    );
  }

  if (phase === 'missing' || !snapshot || !me) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="text-[52px]">🚪</span>
          <div>
            <h1 className="text-[22px] font-black">방에 들어갈 수 없어요</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-white/55">
              방이 사라졌거나, 아직 참가하지 않은 방이에요.
              <br />
              방 코드로 다시 입장해 주세요.
            </p>
          </div>
          <div className="w-full space-y-2">
            <Button variant="pop" block onClick={() => navigate(`/join/${code}`)}>
              방 코드로 참가하기
            </Button>
            <Button variant="ghost" size="md" block onClick={() => navigate('/')}>
              처음으로
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  const { room } = snapshot;
  const expired = room.expiresAt < Date.now();
  const tone = room.status === 'finished' ? 'result' : room.status === 'playing' ? 'game' : 'default';

  return (
    <Screen tone={tone}>
      <TopBar
        left={
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[13px] font-bold active:bg-white/20"
          >
            나가기
          </button>
        }
        center={
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-black tracking-[0.2em]">
            {room.code}
          </span>
        }
        right={
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-white/45">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'online' ? 'bg-mint' : status === 'connecting' ? 'bg-pop-400' : 'bg-coral'
              }`}
            />
            {status === 'online' ? '실시간' : status === 'connecting' ? '연결 중' : '연결 끊김'}
          </span>
        }
      />

      <Banner message={error} onClose={() => setError(null)} />
      {expired && (
        <Banner message="이 방은 만료됐어요. 새 방을 만들어 주세요." tone="error" />
      )}

      {room.status === 'lobby' && (
        <LobbyScreen room={room} players={players} isHost={isHost} />
      )}
      {room.status === 'selecting' && (
        <GameSelectScreen room={room} players={players} isHost={isHost} />
      )}
      {room.status === 'playing' && (
        <PlayScreen room={room} players={players} me={me} isHost={isHost} envelope={envelope} />
      )}
      {room.status === 'finished' && (
        <ResultScreen room={room} players={players} isHost={isHost} />
      )}

      <Sheet open={leaveOpen} onClose={() => setLeaveOpen(false)} title="방에서 나갈까요?">
        <p className="mb-5 text-center text-[14px] leading-relaxed text-white/55">
          {isHost
            ? '방장이 나가면 다음 사람에게 방장이 넘어가요.'
            : '나가면 진행 중인 게임에서 빠지게 돼요.'}
        </p>
        <div className="space-y-2">
          <Button
            variant="danger"
            block
            onClick={async () => {
              setLeaveOpen(false);
              await leave();
              navigate('/', { replace: true });
            }}
          >
            나가기
          </Button>
          <Button variant="ghost" size="md" block onClick={() => setLeaveOpen(false)}>
            계속 있기
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
