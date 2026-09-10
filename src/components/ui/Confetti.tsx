import { useEffect } from 'react';
import confetti from 'canvas-confetti';

/** 승리 연출 — 마운트 시 한 번 터진다. */
export function Confetti({ fire = true }: { fire?: boolean }) {
  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const base = {
      spread: 70,
      ticks: 220,
      gravity: 0.9,
      scalar: 1.05,
      colors: ['#4bb3ff', '#ffc21e', '#28d9a3', '#ff5d6c', '#ffffff'],
      zIndex: 60,
    };

    confetti({ ...base, particleCount: 90, origin: { x: 0.5, y: 0.35 } });
    const t1 = window.setTimeout(
      () => confetti({ ...base, particleCount: 55, angle: 60, origin: { x: 0, y: 0.7 } }),
      180,
    );
    const t2 = window.setTimeout(
      () => confetti({ ...base, particleCount: 55, angle: 120, origin: { x: 1, y: 0.7 } }),
      320,
    );

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fire]);

  return null;
}
