import { useEffect, useState } from 'react';
import { APP } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { copyText, inviteUrl, shareOrCopy } from '@/lib/share';
import { toast } from '@/store/toastStore';

interface InviteSheetProps {
  open: boolean;
  onClose: () => void;
  code: string;
}

/** 친구 초대 — 시스템 공유(카카오톡 등) · 링크 복사 · QR */
export function InviteSheet({ open, onClose, code }: InviteSheetProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const url = inviteUrl(code);

  const share = async () => {
    const result = await shareOrCopy({
      title: APP.shareTitle,
      text: `오늘 뭐 먹을지 게임으로 정하자! 방 코드 ${code}`,
      url,
    });
    if (result === 'copied') toast('초대 링크를 복사했어요', { icon: '🔗' });
    if (result === 'failed') toast('공유하지 못했어요', { tone: 'error' });
    if (result === 'shared') onClose();
  };

  const copy = async () => {
    const ok = await copyText(url);
    toast(ok ? '초대 링크를 복사했어요' : '복사하지 못했어요', {
      icon: ok ? '🔗' : undefined,
      tone: ok ? 'neutral' : 'error',
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="친구 초대하기">
      <div className="rounded-2xl bg-ink-50 py-6 text-center">
        <p className="text-sm font-bold text-ink-400">방 코드</p>
        <p className="mt-1.5 text-[44px] font-extrabold tracking-[0.16em] text-ink-900">
          {code}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <Button block onClick={share}>
          공유하기
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="md" onClick={copy}>
            링크 복사
          </Button>
          <Button variant="secondary" size="md" onClick={() => setQrOpen((v) => !v)}>
            {qrOpen ? 'QR 접기' : 'QR 코드'}
          </Button>
        </div>
      </div>

      {qrOpen && <QrBlock value={url} />}
    </Sheet>
  );
}

function QrBlock({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // QR 라이브러리는 시트를 열었을 때만 불러온다
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(value, {
          width: 420,
          margin: 1,
          color: { dark: '#101828', light: '#ffffff' },
        }),
      )
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return (
      <p className="mt-4 text-center text-sm text-muted">
        QR을 만들지 못했어요. 링크를 복사해서 보내주세요.
      </p>
    );
  }

  return (
    <div className="mt-4 animate-pop-in">
      <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl border border-line bg-white p-3">
        {dataUrl ? (
          <img src={dataUrl} alt="방 초대 QR 코드" className="h-full w-full" />
        ) : (
          <span className="text-sm text-muted">QR 만드는 중…</span>
        )}
      </div>
      <p className="mt-3 break-all text-center text-xs text-ink-300">{value}</p>
    </div>
  );
}
