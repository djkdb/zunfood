/**
 * 어디서 들어왔는지, 어떤 환경인지.
 *
 * 인스타 프로필 링크로 들어오면 인스타 **앱 안의 브라우저**가 열린다. 그 환경은
 * 보통 브라우저와 다르다 — 특히 위치 권한이 조용히 실패하는 일이 잦고, 홈 화면에
 * 추가할 수도 없다. 이 앱은 위치가 없으면 아무것도 못 하므로, 들어온 경로를 알고
 * 첫 화면에서 맞는 안내를 해줘야 한다.
 */

export type EntrySource = 'instagram' | 'threads' | 'kakao' | 'facebook' | 'naver' | 'direct';
export type Platform = 'ios' | 'android' | 'other';

export interface Entry {
  source: EntrySource;
  platform: Platform;
  /** 앱 안에 박힌 브라우저인지 (인스타·카톡 등) */
  inApp: boolean;
  /** 홈 화면에서 실행 중인지 — 이미 앱처럼 쓰고 있다는 뜻 */
  standalone: boolean;
}

/** 앱 안 브라우저를 알아보는 표식 — UA 에 이 조각이 들어간다 */
const IN_APP_MARKERS: [RegExp, EntrySource][] = [
  [/Instagram/i, 'instagram'],
  [/Barcelona/i, 'threads'],
  [/KAKAOTALK/i, 'kakao'],
  [/\bFBAN\b|\bFBAV\b|FB_IAB/i, 'facebook'],
  [/NAVER\(/i, 'naver'],
];

/** 유입 표시로 인정하는 값 — 주소에 아무 말이나 넣어도 되게 두지 않는다 */
const SOURCE_PARAMS: Record<string, EntrySource> = {
  ig: 'instagram',
  instagram: 'instagram',
  threads: 'threads',
  kakao: 'kakao',
  kakaotalk: 'kakao',
  facebook: 'facebook',
  fb: 'facebook',
  naver: 'naver',
};

const REFERRERS: [RegExp, EntrySource][] = [
  [/instagram\.com/i, 'instagram'],
  [/threads\.(net|com)/i, 'threads'],
  [/facebook\.com/i, 'facebook'],
  [/kakao\.com/i, 'kakao'],
  [/naver\.com/i, 'naver'],
];

export function detectEntry(
  location: { search: string } = window.location,
  userAgent = navigator.userAgent,
  referrer = document.referrer,
): Entry {
  const params = new URLSearchParams(location.search);
  const tagged =
    SOURCE_PARAMS[(params.get('from') ?? '').toLowerCase()] ??
    SOURCE_PARAMS[(params.get('utm_source') ?? '').toLowerCase()];

  const marker = IN_APP_MARKERS.find(([pattern]) => pattern.test(userAgent));
  const fromReferrer = REFERRERS.find(([pattern]) => pattern.test(referrer))?.[1];

  return {
    // 붙여준 표시 > 앱 안 브라우저 > 이전 페이지 순으로 믿는다
    source: tagged ?? marker?.[1] ?? fromReferrer ?? 'direct',
    platform: /iPhone|iPad|iPod/i.test(userAgent)
      ? 'ios'
      : /Android/i.test(userAgent)
        ? 'android'
        : 'other',
    inApp: Boolean(marker),
    standalone: isStandalone(),
  };
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS 는 표준 미디어 쿼리 대신 navigator 에 표시한다
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(legacy) || window.matchMedia('(display-mode: standalone)').matches;
}

/** 앱 안 브라우저를 벗어나는 방법 — 기기마다 누르는 곳이 다르다 */
export function escapeHint(entry: Entry): string {
  if (entry.source === 'kakao') {
    return entry.platform === 'ios'
      ? '오른쪽 아래 ⋯ 를 누르고 [다른 브라우저로 열기]'
      : '오른쪽 위 ⋮ 를 누르고 [다른 브라우저로 열기]';
  }
  return entry.platform === 'ios'
    ? '오른쪽 위 ⋯ 를 누르고 [외부 브라우저에서 열기]'
    : '오른쪽 위 ⋮ 를 누르고 [브라우저에서 열기]';
}

/** 홈 화면에 추가하는 방법 */
export function installHint(platform: Platform): string {
  if (platform === 'ios') return '아래 공유 버튼 → [홈 화면에 추가]';
  return '오른쪽 위 ⋮ → [홈 화면에 추가]';
}

export const SOURCE_LABEL: Record<EntrySource, string> = {
  instagram: '인스타그램',
  threads: '스레드',
  kakao: '카카오톡',
  facebook: '페이스북',
  naver: '네이버',
  direct: '',
};
