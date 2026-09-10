import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { APP } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { copyText, inviteUrl, shareOrCopy } from '@/lib/share';

interface InvitePanelProps {
  code: string;
}

/** 방 코드 · 초대 링크 · QR — 친구를 부르는 모든 수단 */
export function InvitePanel({ code }: InvitePanelProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const url = inviteUrl(code);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1_800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const copyLink = async () => {
    const ok = await copyText(url);
    setToast(ok ? '초대 링크를 복사했어요!' : '복사에 실패했어요. 링크를 길게 눌러 복사해 주세요.');
  };

  const share = async () => {
    const result = await shareOrCopy({
      title: APP.shareTitle,
      text: `${APP.name} 방에 초대합니다! 코드: ${code}`,
      url,
    });
    if (result === 'copied') setToast('초대 링크를 복사했어요!');
    if (result === 'failed') setToast('공유에 실패했어요.');
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.03] p-5">
      <p className="text-center text-[13px] font-bold tracking-widest text-white/45">방 코드</p>
      <button
        type="button"
        onClick={copyLink}
        className="mx-auto mt-2 block text-[52px] font-black leading-none tracking-[0.16em] text-pop-300 text-shadow-pop active:scale-95"
        aria-label={`방 코드 ${code.split('').join(' ')}, 눌러서 초대 링크 복사`}
      >
        {code}
      </button>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="ghost" size="md" onClick={copyLink}>
          🔗 링크 복사
        </Button>
        <Button variant="ghost" size="md" onClick={() => setQrOpen(true)}>
          📷 QR 코드
        </Button>
      </div>
      <button
        type="button"
        onClick={share}
        className="mt-2 h-11 w-full rounded-xl text-[14px] font-bold text-brand-200 active:bg-white/5"
      >
        친구에게 공유하기
      </button>

      {toast && (
        <p className="mt-3 animate-pop-in text-center text-[13px] font-bold text-mint">{toast}</p>
      )}

      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title="QR 코드로 초대">
        <QrCode value={url} />
        <p className="mt-4 break-all text-center text-[12px] text-white/40">{url}</p>
        <Button variant="ghost" size="md" block className="mt-4" onClick={() => setQrOpen(false)}>
          닫기
        </Button>
      </Sheet>
    </div>
  );
}

function QrCode({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: 480,
      margin: 1,
      color: { dark: '#0a1024', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return (
      <p className="py-10 text-center text-[14px] text-white/50">
        QR 코드를 만들지 못했어요. 링크를 복사해서 보내주세요.
      </p>
    );
  }

  return (
    <div className="mx-auto flex h-60 w-60 items-center justify-center rounded-3xl bg-white p-3">
      {dataUrl ? (
        <img src={dataUrl} alt="방 초대 QR 코드" className="h-full w-full" />
      ) : (
        <span className="text-[13px] font-bold text-navy-900">QR 생성 중…</span>
      )}
    </div>
  );
}
