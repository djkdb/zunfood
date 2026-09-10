export type ShareResult = 'shared' | 'copied' | 'failed';

/** 시스템 공유 시트 → 실패하면 클립보드 복사로 폴백 */
export async function shareOrCopy(data: {
  title?: string;
  text?: string;
  url: string;
}): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      // 사용자가 취소한 경우는 실패로 취급하지 않는다.
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(data.url)) ? 'copied' : 'failed';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // https 가 아닌 환경 등 — 아래 폴백을 사용한다.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** 방 초대 링크 */
export function inviteUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}
