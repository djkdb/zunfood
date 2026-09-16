import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IconButton, AppBar, Screen } from '@/components/ui/Screen';
import { LoadingDots } from '@/components/ui/ProgressBar';
import { StatusView } from '@/components/ui/StatusView';
import { ResultView } from '@/components/ResultView';
import { formatRadius } from '@/lib/format';
import { APP, SEARCH } from '@/config/app';
import { shareOrCopy } from '@/lib/share';
import { isPlayable, reelOrder, soloMethod, SOLO_METHODS } from '@/solo/methods';
import { SOLO_GAME_VIEWS } from '@/solo/games/views';
import { useSoloStore } from '@/store/soloStore';
import { toast } from '@/store/toastStore';

const REEL_MS = 1_700;

type Phase = 'busy' | 'reeling' | 'done';

export function SoloResultScreen() {
  const navigate = useNavigate();
  const store = useSoloStore();
  const [phase, setPhase] = useState<Phase>('busy');
  const started = useRef(false);

  // 화면에 들어오면 한 번 결정한다
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!store.location) {
      navigate('/solo', { replace: true });
      return;
    }
    void store.decide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 후보를 받으면 릴을 돌린 뒤 결과를 연다.
  // 직접 플레이하는 방식은 이미 내가 골랐으니 릴 없이 바로 결과를 보여준다.
  useEffect(() => {
    if (store.status !== 'ready' || !store.result) return;
    if (isPlayable(store.method)) {
      setPhase('done');
      return;
    }
    setPhase('reeling');
    const timer = window.setTimeout(() => setPhase('done'), REEL_MS);
    return () => window.clearTimeout(timer);
  }, [store.status, store.result?.id, store.method]);

  useEffect(() => {
    if (store.status === 'loading') setPhase('busy');
  }, [store.status]);

  const method = SOLO_METHODS.find((m) => m.id === store.method);

  if (store.status === 'empty') {
    const next = SEARCH.radiusOptions.find((r) => r > store.radius);
    return (
      <Screen variant="arena">
        <SoloBar onBack={() => navigate('/solo')} />
        <div className="pad-x flex flex-1 flex-col">
          <StatusView
            surface="dark"
            emoji="🥲"
            title="조건에 맞는 곳이 없어요"
            description="조건을 조금만 넓혀볼까요?"
            action={
              next
                ? {
                    label: `반경 ${formatRadius(next)}로 늘리기`,
                    onClick: () => void store.widenRadius(),
                  }
                : undefined
            }
            secondaryAction={{ label: '조건 바꾸기', onClick: () => navigate('/solo') }}
          />
        </div>
      </Screen>
    );
  }

  if (store.status === 'error') {
    return (
      <Screen variant="arena">
        <SoloBar onBack={() => navigate('/solo')} />
        <div className="pad-x flex flex-1 flex-col">
          <StatusView
            surface="dark"
            emoji="📡"
            title="잠시 연결이 끊겼어요"
            description={store.error ?? undefined}
            action={{ label: '다시 시도', onClick: () => void store.decide() }}
            secondaryAction={{ label: '조건 바꾸기', onClick: () => navigate('/solo') }}
          />
        </div>
      </Screen>
    );
  }

  // 직접 플레이하는 방식 — 후보는 왔고 결정은 아직
  const GameView = SOLO_GAME_VIEWS[store.method];
  const needed = soloMethod(store.method).minCandidates;

  if (store.status === 'ready' && !store.result && GameView && store.candidates.length < needed) {
    const next = SEARCH.radiusOptions.find((r) => r > store.radius);
    return (
      <Screen variant="arena">
        <SoloBar onBack={() => navigate('/solo')} />
        <div className="pad-x flex flex-1 flex-col">
          <StatusView
            surface="dark"
            emoji="🔍"
            title={`주변에 ${store.candidates.length}곳뿐이에요`}
            description={`${soloMethod(store.method).title}은(는) ${needed}곳부터 할 수 있어요.`}
            action={
              next
                ? {
                    label: `반경 ${formatRadius(next)}로 늘리기`,
                    onClick: () => void store.widenRadius(),
                  }
                : undefined
            }
            secondaryAction={{ label: '다른 방식 고르기', onClick: () => navigate('/solo') }}
          />
        </div>
      </Screen>
    );
  }

  if (store.status === 'ready' && !store.result && GameView) {
    return (
      <Screen variant="arena">
        <SoloBar onBack={() => navigate('/solo')} />
        <div className="pad-x pad-bottom flex flex-1 flex-col pt-1">
          <GameView
            key={store.playSeed}
            candidates={store.candidates}
            seed={store.playSeed}
            onDecide={store.commit}
          />
        </div>
      </Screen>
    );
  }

  if (phase !== 'done' || !store.result) {
    return (
      <Screen variant="arena">
        <SoloBar onBack={() => navigate('/solo')} />
        <div className="pad-x flex flex-1 flex-col items-center justify-center gap-8">
          {phase === 'busy' ? (
            <>
              <span className="text-[52px]" aria-hidden>
                {method?.emoji ?? '🍽️'}
              </span>
              <div className="text-center">
                <p className="text-h1 text-white">주변 맛집 찾는 중</p>
                <p className="mt-2 text-body text-white/45">
                  {store.location?.name} · {formatRadius(store.radius)}
                </p>
              </div>
              <LoadingDots surface="dark" />
            </>
          ) : (
            <Reel names={reelOrder(store.candidates, Date.now()).map((r) => r.name)} />
          )}
        </div>
      </Screen>
    );
  }

  const share = async () => {
    const result = await shareOrCopy({
      title: APP.shareTitle,
      text: `오늘은 "${store.result?.name}" 어때요? ${APP.name}에서 골랐어요 🍽️`,
      url: window.location.origin,
    });
    if (result === 'copied') toast('링크를 복사했어요', { icon: '🔗' });
    if (result === 'failed') toast('공유하지 못했어요', { tone: 'error' });
  };

  return (
    <Screen variant="arena">
      <SoloBar onBack={() => navigate('/solo')} />
      <div className="pad-x flex flex-1 flex-col">
        <ResultView
          restaurant={store.result}
          kicker="오늘의 선택"
          // 직접 고른 결과를 "오늘은…" 하고 다시 뜸들이면 김이 샌다
          teaser={isPlayable(store.method) ? undefined : '오늘은…'}
          footnote={store.reason}
          candidates={store.candidates}
          onShare={share}
          actions={[
            {
              label: isPlayable(store.method) ? '다시 하기' : '다시 뽑기',
              onClick: () => store.reroll(),
            },
            { label: '친구들과 게임하기', onClick: () => navigate('/create') },
            { label: '조건 바꾸기', onClick: () => navigate('/solo') },
          ]}
        />
      </div>
    </Screen>
  );
}

function SoloBar({ onBack }: { onBack: () => void }) {
  return (
    <AppBar
      surface="arena"
      left={
        <IconButton surface="dark" label="뒤로" onClick={onBack}>
          ‹
        </IconButton>
      }
    />
  );
}

/** 결과 공개 직전, 후보 이름이 빠르게 지나가는 릴 */
function Reel({ names }: { names: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (names.length === 0) return;
    const start = Date.now();
    const id = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / REEL_MS);
      const eased = 1 - (1 - p) ** 3;
      setIndex(Math.floor(eased * names.length * 4) % names.length);
    }, 55);
    return () => window.clearInterval(id);
  }, [names.length]);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="text-sm font-bold text-white/40">고르는 중</p>
      <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-2xl bg-white/8 px-5">
        <motion.span
          key={index}
          initial={{ y: 18, opacity: 0.3 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.06 }}
          className="text-center text-h1 text-white"
        >
          {names[index] ?? '…'}
        </motion.span>
      </div>
    </div>
  );
}
