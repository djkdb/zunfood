import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROOM } from '@/config/app';
import { Button, IconButton } from '@/components/ui/Button';
import { AppBar, Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { normalizeRoomCode } from '@/lib/id';
import { RoomError } from '@/realtime/types';
import { lastNickname, loadIdentity } from '@/store/identity';
import { useRoomStore } from '@/store/roomStore';
import { toast } from '@/store/toastStore';

export function JoinRoomScreen() {
  const navigate = useNavigate();
  const params = useParams<{ code?: string }>();
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const attach = useRoomStore((s) => s.attach);

  const invited = normalizeRoomCode(params.code ?? '');
  const [code, setCode] = useState(invited);
  const [nickname, setNickname] = useState(lastNickname());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 이 탭에서 이미 들어와 있던 방이면 바로 복귀시킨다
  useEffect(() => {
    if (!invited || !loadIdentity(invited)) return;
    let cancelled = false;
    void attach(invited).then((ok) => {
      if (ok && !cancelled) navigate(`/room/${invited}`, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [invited, attach, navigate]);

  const submit = async () => {
    const trimmed = normalizeRoomCode(code);
    if (trimmed.length < ROOM.codeLength) {
      setError('방 코드를 정확히 입력해 주세요.');
      return;
    }
    if (!nickname.trim()) {
      setError('닉네임을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const joined = await joinRoom(trimmed, nickname.trim().slice(0, 10));
      navigate(`/room/${joined}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof RoomError ? err.message : '방에 들어가지 못했어요. 다시 시도해 주세요.';
      setError(message);
      toast(message, { tone: 'error' });
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppBar
        left={
          <IconButton label="뒤로" onClick={() => navigate('/')}>
            ‹
          </IconButton>
        }
      />

      <div className="pad-x flex flex-1 flex-col pt-4">
        <h1 className="text-h1 text-ink-900">
          친구가 보낸
          <br />
          방 코드를 넣어주세요
        </h1>

        <div className="mt-8 space-y-4">
          <TextField
            value={code}
            onChange={(event) => {
              setCode(normalizeRoomCode(event.target.value));
              setError(null);
            }}
            placeholder="ABCD"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            aria-label="방 코드"
            className="!h-[76px] text-center !text-[34px] font-extrabold tracking-[0.32em]"
            error={error}
          />
          <TextField
            label="내 닉네임"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="닉네임"
            maxLength={10}
            autoComplete="off"
          />
        </div>

        <div className="flex-1" />

        <div className="pad-bottom pt-8">
          <Button block onClick={submit} loading={submitting}>
            들어가기
          </Button>
        </div>
      </div>
    </Screen>
  );
}
