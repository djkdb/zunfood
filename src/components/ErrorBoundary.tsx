import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';
import { Screen } from './ui/Screen';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** 예기치 못한 오류로 화면이 하얗게 되는 것을 막는다. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 실제 서비스에서는 여기서 에러 리포팅 서비스로 전송한다.
    console.error('[MEALGAME] 화면 오류', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <span className="text-[56px]">🍽️</span>
          <div>
            <h1 className="text-[22px] font-black">문제가 생겼어요</h1>
            <p className="mt-2 text-[15px] text-white/55">
              잠깐 문제가 생겼어요. 처음 화면으로 돌아가서 다시 시도해 주세요.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = '/';
            }}
          >
            처음으로
          </Button>
        </div>
      </Screen>
    );
  }
}
