import { useEffect } from 'react';

/** 승리 연출 — 마운트될 때 한 번. 라이브러리는 그 순간에만 불러온다. */
export function Confetti({ fire = true }: { fire?: boolean }) {
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    const timers: number[] = [];

    void import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return;
      const base = {
        spread: 72,
        ticks: 200,
        gravity: 0.95,
        scalar: 1,
        colors: ['#2F6BFF', '#FF7A1A', '#12B76A', '#F5A524', '#FFFFFF'],
        // 시트(50)·토스트(60)보다 아래. 결과 화면 위에서만 날린다.
        zIndex: 45,
      };
      confetti({ ...base, particleCount: 80, origin: { x: 0.5, y: 0.34 } });
      timers.push(
        window.setTimeout(
          () => confetti({ ...base, particleCount: 45, angle: 60, origin: { x: 0, y: 0.7 } }),
          160,
        ),
        window.setTimeout(
          () => confetti({ ...base, particleCount: 45, angle: 120, origin: { x: 1, y: 0.7 } }),
          300,
        ),
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [fire]);

  return null;
}
