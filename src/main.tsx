// 앱 진입점: CSS 를 불러오고 #root 요소에 React 앱을 그립니다.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Leaflet 기본 CSS 를 먼저, 앱 CSS 를 나중에 불러와야 앱 쪽 보정 규칙이 우선 적용됩니다.
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import { ToastProvider } from './hooks/useToast';

createRoot(document.getElementById('root')!).render(
    // StrictMode: 개발 중 effect 를 두 번 실행하는 등 잠재적 문제를 미리 드러내 줍니다. (배포 빌드에는 영향 없음)
    <StrictMode>
        <ToastProvider>
            <App />
        </ToastProvider>
    </StrictMode>,
);
