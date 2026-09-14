import { DEMO_NOTICE, useDataSourceStore } from '@/store/dataSourceStore';

/**
 * 예시 데이터로 동작 중일 때만 나타나는 한 줄.
 *
 * 결과 화면은 "여기 가자"고 말하는 자리다. 그 자리에서 가짜 가게를 진짜처럼
 * 보여주지 않기 위해, 출처가 예시일 때는 반드시 밝힌다.
 */
export function DemoDataNotice({ surface = 'dark' }: { surface?: 'dark' | 'light' }) {
  const demo = useDataSourceStore((s) => s.demo);
  const reason = useDataSourceStore((s) => s.reason);
  if (!demo || !reason) return null;

  const tone =
    surface === 'dark'
      ? 'bg-white/8 text-white/55'
      : 'bg-ink-50 text-ink-600';

  return (
    <p
      role="status"
      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${tone}`}
    >
      <span aria-hidden>🧪</span>
      {DEMO_NOTICE[reason]}
    </p>
  );
}
