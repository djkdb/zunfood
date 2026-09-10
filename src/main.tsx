import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// 서체는 CDN 이 아니라 번들에서 제공한다.
// 외부 CDN 이 막히거나 느리면 서비스 전체가 다른 폰트로 보이기 때문.
// dynamic subset 이라 화면에 실제로 쓰인 글자가 든 조각만 내려받는다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root 를 찾을 수 없습니다.');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
