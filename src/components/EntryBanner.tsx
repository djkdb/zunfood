import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  detectEntry,
  escapeHint,
  installHint,
  SOURCE_LABEL,
  type Entry,
} from '@/lib/entry';
import { copyText } from '@/lib/share';
import { useInstallStore } from '@/store/installStore';
import { toast } from '@/store/toastStore';

type BannerKind = 'in-app' | 'onboarding' | 'install';

const SEEN_KEY: Record<BannerKind, string> = {
  'in-app': 'mealgame:banner:in-app',
  onboarding: 'mealgame:banner:onboarding',
  install: 'mealgame:banner:install',
};
const VISITS_KEY = 'mealgame:visits';

/**
 * 첫 화면 안내 배너.
 *
 * 인스타 프로필 링크로 들어오면 인스타 앱 안의 브라우저가 열린다. 거기서는
 * 위치 권한이 조용히 실패하는 일이 잦아서, 이 앱은 아무것도 못 한다.
 * 그래서 들어온 경로를 보고 **지금 이 사람에게 필요한 한 가지**만 말한다:
 *
 *   앱 안 브라우저   → 밖으로 나가는 방법 (제일 급하다)
 *   처음 온 사람     → 30초 사용법 세 줄
 *   다시 온 사람     → 홈 화면에 추가하면 앱처럼 쓸 수 있다
 *   이미 설치함      → 아무것도 띄우지 않는다
 */
export function EntryBanner() {
  const entry = useMemo(() => detectEntry(), []);
  const visits = useMemo(countVisit, []);
  const installable = useInstallStore((s) => s.available);
  const install = useInstallStore((s) => s.install);
  const [dismissed, setDismissed] = useState<BannerKind[]>([]);

  const kind = pickBanner(entry, visits, installable, dismissed);
  if (!kind) return null;

  const close = () => {
    setDismissed((prev) => [...prev, kind]);
    // 앱 안 브라우저 안내는 이번 방문에서만 접는다 — 다음에 또 들어오면 또 필요하다
    if (kind !== 'in-app') remember(kind);
  };

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className={`relative mt-5 rounded-2xl p-4 ${
          kind === 'in-app' ? 'bg-warning/12 ring-1 ring-warning/30' : 'bg-primary-50'
        }`}
      >
        <button
          type="button"
          onClick={close}
          aria-label="안내 닫기"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-400 active:bg-ink-100"
        >
          ✕
        </button>

        {kind === 'in-app' && <InAppNotice entry={entry} />}
        {kind === 'onboarding' && <Onboarding entry={entry} />}
        {kind === 'install' && (
          <Install entry={entry} installable={installable} onInstall={install} />
        )}
      </motion.aside>
    </AnimatePresence>
  );
}

/** 지금 이 사람에게 가장 급한 안내 하나 */
function pickBanner(
  entry: Entry,
  visits: number,
  installable: boolean,
  dismissed: BannerKind[],
): BannerKind | null {
  const open = (kind: BannerKind) => !dismissed.includes(kind) && !wasSeen(kind);

  // 이미 홈 화면에서 쓰고 있으면 더 알려줄 게 없다
  if (entry.standalone) return null;
  if (entry.inApp && open('in-app')) return 'in-app';
  if (visits <= 1 && open('onboarding')) return 'onboarding';
  if (visits >= 2 && (installable || entry.platform === 'ios') && open('install')) {
    return 'install';
  }
  return null;
}

function InAppNotice({ entry }: { entry: Entry }) {
  const where = SOURCE_LABEL[entry.source] || '이 앱';

  const copy = async () => {
    const ok = await copyText(window.location.origin);
    if (ok) toast('주소를 복사했어요. 브라우저에 붙여넣으세요', { icon: '🔗' });
    else toast('주소를 복사하지 못했어요', { tone: 'error' });
  };

  return (
    <div className="pr-7">
      <p className="text-h3 text-ink-900">
        <span aria-hidden>🧭 </span>
        브라우저로 열면 더 잘 돼요
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
        {where} 안에서는 <b>내 위치 찾기가 막힐 수 있어요.</b>
        <br />
        {escapeHint(entry)}
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 h-10 rounded-lg bg-ink-900 px-4 text-sm font-bold text-white active:bg-ink-800"
      >
        주소 복사하기
      </button>
    </div>
  );
}

function Onboarding({ entry }: { entry: Entry }) {
  const where = SOURCE_LABEL[entry.source];
  const steps = ['위치를 정하고', '게임을 고르면', '한 곳이 정해져요'];

  return (
    <div className="pr-7">
      <p className="text-h3 text-primary-700">
        {where ? `${where}에서 오셨네요 — ` : ''}30초면 정해져요
      </p>
      <ol className="mt-2.5 space-y-1.5">
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-2 text-sm text-ink-700">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-2.5 text-sm text-muted">
        친구들과 하려면 링크만 보내면 돼요. 설치도 가입도 없어요.
      </p>
    </div>
  );
}

function Install({
  entry,
  installable,
  onInstall,
}: {
  entry: Entry;
  installable: boolean;
  onInstall: () => Promise<boolean>;
}) {
  return (
    <div className="pr-7">
      <p className="text-h3 text-primary-700">
        <span aria-hidden>📲 </span>
        홈 화면에 추가하면 앱처럼 써요
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
        아이콘을 눌러 바로 열 수 있어요. 설치 용량도 없고요.
      </p>
      {installable ? (
        <button
          type="button"
          onClick={() => void onInstall()}
          className="mt-3 h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white active:bg-primary-700"
        >
          홈 화면에 추가
        </button>
      ) : (
        <p className="mt-2 text-sm font-semibold text-ink-700">{installHint(entry.platform)}</p>
      )}
    </div>
  );
}

/**
 * 방문 횟수 — 처음인지 다시 왔는지로 안내가 달라진다.
 *
 * 한 번 열 때 딱 한 번만 센다. 렌더가 두 번 돌아도(개발 모드의 StrictMode,
 * 화면 복귀로 인한 재마운트) 같은 값을 돌려줘야 첫 방문이 두 번째로 둔갑하지 않는다.
 */
let counted: number | null = null;

function countVisit(): number {
  if (counted !== null) return counted;
  try {
    const next = Number(localStorage.getItem(VISITS_KEY) ?? 0) + 1;
    localStorage.setItem(VISITS_KEY, String(next));
    counted = next;
  } catch {
    // 저장이 막힌 브라우저에서는 늘 첫 방문으로 본다
    counted = 1;
  }
  return counted;
}

function wasSeen(kind: BannerKind): boolean {
  try {
    return localStorage.getItem(SEEN_KEY[kind]) === '1';
  } catch {
    return false;
  }
}

function remember(kind: BannerKind): void {
  try {
    localStorage.setItem(SEEN_KEY[kind], '1');
  } catch {
    // 저장 못 해도 이번 화면에서는 닫힌다
  }
}
