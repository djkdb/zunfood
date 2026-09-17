import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { APP } from '@/config/app';
import { Screen } from '@/components/ui/Screen';
import { EntryBanner } from '@/components/EntryBanner';
import { hasRemoteBackend } from '@/config/env';
import { GAMES } from '@/games/registry';

export function HomeScreen() {
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="pad-x pad-bottom flex flex-1 flex-col">
        <div className="safe-top" />

        <div className="flex items-center gap-1.5 pt-7">
          <span className="text-[17px]" aria-hidden>
            {APP.emoji}
          </span>
          <span className="text-[13px] font-extrabold tracking-[0.18em] text-ink-400">
            {APP.name}
          </span>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 text-display text-ink-900"
        >
          오늘 뭐 먹지?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 text-[17px] leading-[1.5] text-muted"
        >
          친구들이랑 고민하지 말고
          <br />
          게임으로 정하세요.
        </motion.p>

        {/* 어디서 들어왔는지에 따라 지금 필요한 한 가지만 알려준다 */}
        <EntryBanner />

        <div className="mt-7 space-y-3">
          <ModeCard
            emphasis
            delay={0.12}
            emoji="👥"
            title="친구들과 결정하기"
            description="친구를 초대하고 같이 게임하기"
            onClick={() => navigate('/create')}
          />
          <ModeCard
            delay={0.18}
            emoji="🎲"
            title="혼자 결정하기"
            description="내 조건으로 10초 만에 찾기"
            onClick={() => navigate('/solo')}
          />
        </div>

        <div className="flex-1" />

        {/* 어떤 게임이 있는지만 짧게 — 설명은 하지 않는다 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10"
        >
          <p className="text-sm font-bold text-ink-400">이런 게임으로 정해요</p>
          <div className="bleed-x mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {GAMES.map((game) => (
              <span
                key={game.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface py-2 pl-2.5 pr-3.5 text-[13.5px] font-bold text-ink-700"
              >
                <span aria-hidden>{game.emoji}</span>
                {game.title}
              </span>
            ))}
          </div>
        </motion.div>

        <button
          type="button"
          onClick={() => navigate('/join')}
          className="mt-6 h-12 w-full rounded-lg text-[14.5px] font-bold text-primary active:bg-primary-50"
        >
          초대 코드가 있어요
        </button>

        {!hasRemoteBackend && (
          <p className="mt-1 text-center text-xs text-ink-300">
            로컬 모드 · 같은 기기의 여러 탭으로 테스트할 수 있어요
          </p>
        )}
      </div>
    </Screen>
  );
}

interface ModeCardProps {
  emoji: string;
  title: string;
  description: string;
  onClick: () => void;
  emphasis?: boolean;
  delay: number;
}

function ModeCard({ emoji, title, description, onClick, emphasis, delay }: ModeCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.985 }}
      className={`flex w-full items-center gap-4 rounded-2xl p-5 text-left transition-colors ${
        emphasis
          ? 'bg-ink-900 text-white shadow-lift'
          : 'border border-line bg-surface text-ink-900 active:bg-ink-50'
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[24px] ${
          emphasis ? 'bg-white/12' : 'bg-ink-100'
        }`}
        aria-hidden
      >
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-h2">{title}</span>
        <span
          className={`mt-1 block text-sm ${emphasis ? 'text-white/55' : 'text-muted'}`}
        >
          {description}
        </span>
      </span>
      <span
        className={`shrink-0 text-[20px] ${emphasis ? 'text-white/40' : 'text-ink-300'}`}
        aria-hidden
      >
        ›
      </span>
    </motion.button>
  );
}
