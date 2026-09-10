import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Screen } from './ui/Screen';
import { StatusView } from './ui/StatusView';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** 예기치 못한 오류로 화면이 비는 것을 막는다 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 실서비스에서는 여기서 에러 리포팅으로 보낸다
    console.error('[MEALGAME]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Screen>
        <div className="pad-x flex flex-1 flex-col">
          <StatusView
            emoji="🍽️"
            title="문제가 생겼어요"
            description="잠깐 문제가 생겼어요. 처음 화면에서 다시 시도해 주세요."
            action={{
              label: '처음으로',
              onClick: () => {
                window.location.href = '/';
              },
            }}
          />
        </div>
      </Screen>
    );
  }
}
