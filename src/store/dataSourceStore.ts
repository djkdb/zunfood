import { create } from 'zustand';

/**
 * 왜 예시 데이터로 내려갔는가.
 * - no-backend: 서버(/api)가 없는 환경 (로컬 개발)
 * - no-key:     서버는 있지만 식당 API 키가 없거나 거부당함
 */
export type DemoReason = 'no-backend' | 'no-key';

interface DataSourceState {
  demo: boolean;
  reason: DemoReason | null;
  markDemo: (reason: DemoReason) => void;
}

/**
 * 지금 보고 있는 식당이 실제 데이터인지 예시 데이터인지.
 *
 * 예시 데이터로 조용히 내려가면 사용자는 존재하지 않는 가게를 찾아 나서게 된다.
 * 게임을 멈추지는 않되, 화면에서 사실대로 밝힌다.
 */
export const useDataSourceStore = create<DataSourceState>((set, get) => ({
  demo: false,
  reason: null,
  markDemo(reason) {
    // 처음 내려간 이유가 더 정확하다 (이후 호출은 그 결과일 뿐)
    if (get().demo) return;
    set({ demo: true, reason });
  },
}));

export const markDemoData = (reason: DemoReason) =>
  useDataSourceStore.getState().markDemo(reason);

export const DEMO_NOTICE: Record<DemoReason, string> = {
  'no-backend': '둘러보기용 예시 데이터예요. 실제 가게가 아닙니다.',
  'no-key': '식당 정보를 불러오지 못해 예시 데이터로 진행했어요. 실제 가게가 아닙니다.',
};
