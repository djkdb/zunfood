/**
 * 참가자 신원 저장소.
 *
 * 신원은 **탭 단위(sessionStorage)** 로 저장한다.
 *  - 새로고침해도 같은 자리로 돌아온다.
 *  - 같은 기기에서 탭을 여러 개 열면 각각 다른 참가자가 된다
 *    (Supabase 없이 로컬 모드로 4인 플레이를 테스트할 때 필요).
 * 닉네임만 다음 방에서도 미리 채워주도록 localStorage 에 남긴다.
 */
export interface Identity {
  roomId: string;
  playerId: string;
  nickname: string;
  code: string;
}

const KEY = (code: string) => `mealgame:identity:${code.toUpperCase()}`;
const NICKNAME_KEY = 'mealgame:nickname';

export function saveIdentity(identity: Identity): void {
  try {
    sessionStorage.setItem(KEY(identity.code), JSON.stringify(identity));
    localStorage.setItem(NICKNAME_KEY, identity.nickname);
  } catch {
    // 시크릿 모드 등 저장 실패 — 이번 세션에서는 메모리로만 동작한다.
  }
}

export function loadIdentity(code: string): Identity | null {
  try {
    const raw = sessionStorage.getItem(KEY(code));
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function clearIdentity(code: string): void {
  try {
    sessionStorage.removeItem(KEY(code));
  } catch {
    // ignore
  }
}

export function lastNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}
