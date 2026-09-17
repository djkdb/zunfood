import { create } from 'zustand';

/** 안드로이드 크롬이 "설치할 수 있다" 고 알려줄 때 주는 이벤트 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** 브라우저가 설치를 제안할 수 있는 상태인지 */
  available: boolean;
  /** 설치 창을 띄운다. 성공하면 true */
  install: () => Promise<boolean>;
}

let deferred: InstallPromptEvent | null = null;

/**
 * 홈 화면에 추가 — 안드로이드 크롬만 프로그램으로 띄울 수 있다.
 *
 * 이 이벤트는 앱이 뜨자마자 한 번 날아오고 다시 오지 않는다. 그래서 배너가
 * 그려지기 전에 잡아두었다가, 사용자가 누를 때 꺼내 쓴다.
 * iOS 는 이런 창이 없어서 손으로 하는 방법을 글로 알려주는 수밖에 없다.
 */
export const useInstallStore = create<InstallState>((set) => ({
  available: false,
  async install() {
    if (!deferred) return false;
    const event = deferred;
    // 한 번 쓰면 다시 못 쓴다
    deferred = null;
    set({ available: false });
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome === 'accepted';
    } catch {
      return false;
    }
  },
}));

export function watchInstallPrompt(): () => void {
  const onPrompt = (event: Event) => {
    // 기본 배너를 막고 우리가 원하는 자리에서 띄운다
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    useInstallStore.setState({ available: true });
  };
  const onInstalled = () => {
    deferred = null;
    useInstallStore.setState({ available: false });
  };

  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  };
}
