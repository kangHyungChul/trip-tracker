// 앱 진입점: CSS 를 불러오고, 저장소를 준비한 뒤 #root 요소에 React 앱을 그립니다.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 날짜 선택기 기본 CSS 를 먼저, 앱 CSS 를 나중에 불러와야 앱 쪽 보정 규칙이 우선 적용됩니다.
import 'react-datepicker/dist/react-datepicker.css';
import './index.css';
import App from './App';
import { isCloudEnabled } from './lib/cloudTrips';
import { initTripStore } from './lib/tripStore';
import { ConfirmProvider } from './hooks/useConfirm';
import { MapsProvider } from './hooks/useMaps';
import { ToastProvider } from './hooks/useToast';

// 처음 실행이면 예전(가고시마 전용) 데이터를 여행 목록으로 옮기거나 예시 여행을 넣습니다. (렌더링 전에 한 번)
// Supabase 를 쓰면 클라우드 목록이 기준이므로 예시 여행을 자동으로 넣지 않습니다. (첫 화면에서 직접 추가 가능)
initTripStore({ seedSample: !isCloudEnabled() });

createRoot(document.getElementById('root')!).render(
    // StrictMode: 개발 중 effect 를 두 번 실행하는 등 잠재적 문제를 미리 드러내 줍니다. (배포 빌드에는 영향 없음)
    <StrictMode>
        <ToastProvider>
            {/* 삭제·덮어쓰기 등에 쓰는 앱 자체 확인창 (useConfirm / useChoice) */}
            <ConfirmProvider>
                {/* Google 지도 스크립트 로드 + 상태 공유 (키가 없으면 지도 없이 동작) */}
                <MapsProvider>
                    <App />
                </MapsProvider>
            </ConfirmProvider>
        </ToastProvider>
    </StrictMode>,
);
