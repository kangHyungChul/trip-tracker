// 주소의 # 뒷부분으로 화면을 나누는 아주 작은 라우터.
//  #/            → 여행 목록(첫 화면)
//  #/trip/<id>   → 여행 화면
// 해시 방식은 서버 설정(새로고침 시 index.html 로 돌려보내기) 없이도 정적 배포에서 동작하고, 뒤로가기도 자연스럽습니다.

import { useSyncExternalStore } from 'react';

export type Route = { page: 'home' } | { page: 'trip'; id: string };

/** 해시 문자열 → 화면 정보. 알 수 없는 해시(예: Supabase 로그인 토큰 #access_token=…)는 첫 화면으로 봅니다. */
export function parseHash(hash: string): Route {
    const match = /^#\/trip\/([A-Za-z0-9_-]{1,100})$/.exec(hash);
    return match ? { page: 'trip', id: match[1] } : { page: 'home' };
}

/** hashchange 이벤트 구독 (useSyncExternalStore 규약: 구독 해제 함수를 반환) */
function subscribe(onChange: () => void) {
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
}

/** 현재 화면 정보. 해시가 바뀌면 자동으로 다시 렌더링됩니다. */
export function useHashRoute(): Route {
    // useSyncExternalStore: 브라우저 주소처럼 React 밖에 있는 값을 안전하게 구독하는 표준 훅
    const hash = useSyncExternalStore(subscribe, () => location.hash);
    return parseHash(hash);
}

/** 첫 화면으로 이동 */
export const goHome = () => {
    location.hash = '#/';
};

/** 여행 화면으로 이동 */
export const goTrip = (id: string) => {
    location.hash = `#/trip/${id}`;
};
