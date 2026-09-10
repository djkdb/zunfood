import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { APP } from '@/config/app';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Screen } from '@/components/ui/Screen';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRoomStore } from '@/store/roomStore';

const FLOATING = ['🍕', '🍜', '🍗', '🍣', '🥓', '🍚'];

export function HomeScreen() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const backendKind = useRoomStore((s) => s.backendKind);

  const startWithCurrentLocation = async () => {
    const location = await geo.request();
    navigate('/create', { state: location ? { location } : undefined });
  };

  return (
    <Screen>
      <div className="flex flex-1 flex-col">
        <div className="pt-6" />
        <Banner message={geo.error} onClose={geo.clearError} />

        {/* 로고 */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-6 flex items-center gap-2"
        >
          <span className="text-[26px]">{APP.emoji}</span>
          <span className="text-[15px] font-black tracking-[0.32em] text-brand-200">
            {APP.name}
          </span>
        </motion.div>

        {/* 메인 카피 */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, type: 'spring', stiffness: 130, damping: 16 }}
          className="mt-4 text-[46px] font-black leading-[1.08] tracking-tight text-shadow-pop"
        >
          오늘
          <br />
          <span className="text-pop-300">뭐 먹지?</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24 }}
          className="mt-4 text-[17px] font-semibold leading-relaxed text-white/60"
        >
          {APP.subTagline}
        </motion.p>

        {/* 떠다니는 음식 이모지 — 남는 세로 공간을 채운다 */}
        <div className="relative my-6 min-h-[168px] flex-1">
          {FLOATING.map((emoji, index) => (
            <motion.span
              key={emoji}
              className="absolute text-[40px] drop-shadow-lg"
              style={{
                left: `${8 + (index % 3) * 33}%`,
                top: `${index < 3 ? 4 : 52}%`,
              }}
              animate={{ y: [0, -12, 0], rotate: [-6, 6, -6] }}
              transition={{
                duration: 3 + index * 0.35,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: index * 0.18,
              }}
            >
              {emoji}
            </motion.span>
          ))}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-brand-500/10 blur-3xl" />
        </div>

        {/* 액션 */}
        <div className="space-y-3">
          <Button variant="pop" block onClick={() => navigate('/create')}>
            🎮 방 만들기
          </Button>
          <Button variant="ghost" block onClick={() => navigate('/join')}>
            초대받은 방 참가
          </Button>
          <button
            type="button"
            onClick={startWithCurrentLocation}
            disabled={geo.loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-brand-200 active:bg-white/5 disabled:opacity-50"
          >
            {geo.loading ? '위치 확인 중…' : '📍 현재 위치로 바로 시작'}
          </button>
        </div>

        <p className="mt-5 text-center text-[12px] font-semibold text-white/25">
          {backendKind === 'supabase'
            ? '실시간 서버 연결됨 · 회원가입 없이 바로 플레이'
            : '로컬 모드 · 같은 기기의 여러 탭으로 테스트할 수 있어요'}
        </p>
      </div>
    </Screen>
  );
}
