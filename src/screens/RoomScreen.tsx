import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROOM } from '@/config/app';
import { Button, IconButton } from '@/components/ui/Button';
import { AppBar, Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { StatusView } from '@/components/ui/StatusView';
import { LoadingDots } from '@/components/ui/ProgressBar';
import { normalizeRoomCode } from '@/lib/id';
import { selectEnvelope, selectIsHost, selectMe, useRoomStore } from '@/store/roomStore';
import { toast } from '@/store/toastStore';
import { LobbyScreen } from './LobbyScreen';
import { GameSelectScreen } from './GameSelectScreen';
import { PlayScreen } from './PlayScreen';
import { RoomResultScreen } from './RoomResultScreen';

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

  // 오류는 배너 대신 토스트로 — 화면 레이아웃을 밀지 않는다
  useEffect(() => {
    if (!error) return;
    toast(error, { tone: 'error' });
    setError(null);
  }, [error, setError]);

  const players = useMemo(() => {
    if (!snapshot) return [];
    const now = Date.now();
    const online = snapshot.players.filter(
      (p) => now - p.lastSeenAt < ROOM.offlineAfterMs || p.id === me?.id,
    );
    return online.length > 0 ? online : snapshot.players;
  }, [snapshot, me?.id]);

  const exitRoom = async () => {
    setLeaveOpen(false);
    await leave();
    navigate('/', { replace: true });
  };

  if (phase === 'loading') {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          <p className="text-h2 text-ink-900">방에 들어가는 중</p>
          <LoadingDots />
        </div>
      </Screen>
    );
  }

  if (phase === 'missing' || !snapshot || !me) {
    return (
      <Screen>
        <div className="pad-x flex flex-1 flex-col">
          <StatusView
            emoji="🚪"
            title="방에 들어갈 수 없어요"
            description="방이 사라졌거나, 아직 참가하지 않은 방이에요."
            action={{ label: '코드로 참가하기', onClick: () => navigate(`/join/${code}`) }}
            secondaryAction={{ label: '처음으로', onClick: () => navigate('/') }}
          />
        </div>
      </Screen>
    );
  }

  const { room } = snapshot;
  const playing = room.status === 'playing';
  const finished = room.status === 'finished';
  const immersive = playing || finished;

  return (
    <Screen variant={immersive ? 'arena' : 'app'}>
      {!immersive && (
        <AppBar
          left={
            <IconButton label="방 나가기" onClick={() => setLeaveOpen(true)}>
              ‹
            </IconButton>
          }
          title={
            <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[13px] font-extrabold tracking-[0.14em] text-ink-700">
              {room.code}
            </span>
          }
          right={
            <span className="flex items-center gap-1.5 pr-1 text-xs font-bold text-ink-400">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === 'online'
                    ? 'bg-success'
                    : status === 'connecting'
                      ? 'bg-warning'
                      : 'bg-danger'
                }`}
              />
              {status === 'online' ? '실시간' : status === 'connecting' ? '연결 중' : '연결 끊김'}
            </span>
          }
        />
      )}

      {room.status === 'lobby' && (
        <LobbyScreen room={room} players={players} isHost={isHost} />
      )}
      {room.status === 'selecting' && (
        <GameSelectScreen room={room} players={players} isHost={isHost} />
      )}
      {playing && (
        <PlayScreen
          room={room}
          players={players}
          me={me}
          isHost={isHost}
          envelope={envelope}
          onExit={() => setLeaveOpen(true)}
        />
      )}
      {finished && <RoomResultScreen room={room} players={players} isHost={isHost} />}

      {finished && (
        <div className="pad-x pb-6">
          <Button
            variant="ghost"
            size="sm"
            surface="dark"
            block
            onClick={() => setLeaveOpen(true)}
          >
            방 나가기
          </Button>
        </div>
      )}

      <Sheet
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="방에서 나갈까요?"
        description={
          isHost ? '방장이 나가면 다음 사람이 방장이 돼요.' : '진행 중인 게임에서 빠지게 돼요.'
        }
      >
        <div className="space-y-2">
          <Button variant="danger" block onClick={exitRoom}>
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
