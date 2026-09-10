import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/Toaster';
import { Screen } from './components/ui/Screen';
import { LoadingDots } from './components/ui/ProgressBar';
import { HomeScreen } from './screens/HomeScreen';

// 첫 화면 밖의 흐름은 필요할 때 불러온다 (첫 로딩을 가볍게)
const SoloSetupScreen = lazy(() =>
  import('./screens/SoloSetupScreen').then((m) => ({ default: m.SoloSetupScreen })),
);
const SoloResultScreen = lazy(() =>
  import('./screens/SoloResultScreen').then((m) => ({ default: m.SoloResultScreen })),
);
const CreateRoomScreen = lazy(() =>
  import('./screens/CreateRoomScreen').then((m) => ({ default: m.CreateRoomScreen })),
);
const JoinRoomScreen = lazy(() =>
  import('./screens/JoinRoomScreen').then((m) => ({ default: m.JoinRoomScreen })),
);
const RoomScreen = lazy(() =>
  import('./screens/RoomScreen').then((m) => ({ default: m.RoomScreen })),
);

function ScreenFallback() {
  return (
    <Screen>
      <div className="flex flex-1 items-center justify-center">
        <LoadingDots />
      </div>
    </Screen>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <ErrorBoundary>
      {/* 사용자가 모션 최소화를 켰다면 애니메이션을 끈다 */}
      <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {/* 화면 전환은 짧게 — 기다리게 만들지 않는다 */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="flex min-h-full flex-1 flex-col"
        >
          <Suspense fallback={<ScreenFallback />}>
          <Routes location={location}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/solo" element={<SoloSetupScreen />} />
            <Route path="/solo/result" element={<SoloResultScreen />} />
            <Route path="/create" element={<CreateRoomScreen />} />
            <Route path="/join" element={<JoinRoomScreen />} />
            <Route path="/join/:code" element={<JoinRoomScreen />} />
            <Route path="/room/:code" element={<RoomScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      </MotionConfig>
      <Toaster />
    </ErrorBoundary>
  );
}
