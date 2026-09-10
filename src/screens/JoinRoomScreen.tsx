import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROOM } from '@/config/app';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { BackButton, Screen, TopBar } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { normalizeRoomCode } from '@/lib/id';
import { RoomError } from '@/realtime/types';
import { lastNickname, loadIdentity } from '@/store/identity';
import { useRoomStore } from '@/store/roomStore';

export function JoinRoomScreen() {
  const navigate = useNavigate();
  const params = useParams<{ code?: string }>();
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const attach = useRoomStore((s) => s.attach);

  const [code, setCode] = useState(normalizeRoomCode(params.code ?? ''));
  const [nickname, setNickname] = useState(lastNickname());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 이미 이 방에 들어와 있던 기기라면 곧장 복귀시킨다.
  useEffect(() => {
    const invited = normalizeRoomCode(params.code ?? '');
    if (!invited || !loadIdentity(invited)) return;
    let cancelled = false;
    void attach(invited).then((ok) => {
      if (ok && !cancelled) navigate(`/room/${invited}`, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [params.code, attach, navigate]);

  const submit = async () => {
    const trimmedCode = normalizeRoomCode(code);
    if (trimmedCode.length < ROOM.codeLength) {
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
      const joined = await joinRoom(trimmedCode, nickname.trim().slice(0, 10));
      navigate(`/room/${joined}`, { replace: true });
    } catch (err) {
      setError(
        err instanceof RoomError ? err.message : '방에 들어가지 못했어요. 다시 시도해 주세요.',
      );
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <TopBar
        left={<BackButton onClick={() => navigate('/')} />}
        center={<span className="text-[16px] font-black">방 참가</span>}
        right={<span className="w-11" />}
      />

      <div className="flex flex-1 flex-col pt-4">
        <Banner message={error} onClose={() => setError(null)} />

        <h1 className="mt-4 text-[30px] font-black leading-tight">
          친구가 알려준
          <br />
          <span className="text-pop-300">방 코드</span>를 넣어주세요
        </h1>

        <div className="mt-8 space-y-5">
          <TextField
            value={code}
            onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
            placeholder="A7K3"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            aria-label="방 코드"
            className="!h-20 text-center !text-[38px] font-black tracking-[0.4em]"
          />
          <TextField
            label="내 닉네임"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="예: 민수"
            maxLength={10}
            autoComplete="off"
          />
        </div>

        <div className="flex-1" />

        <Button variant="pop" block onClick={submit} loading={submitting} className="mt-8">
          입장하기
        </Button>
      </div>
    </Screen>
  );
}
