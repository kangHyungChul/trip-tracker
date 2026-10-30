// CSS 미디어 쿼리가 지금 맞는지(true/false)를 React 상태처럼 쓰는 훅.
// 화면 크기가 바뀌어 결과가 달라지면 자동으로 다시 렌더링됩니다.

import { useSyncExternalStore } from 'react';

/**
 * 휴대폰 화면 기준: Tailwind `max-phone:`(폭 481px 미만)과 같은 조건.
 * `not all and (min-width: …)` = “폭이 30.0625rem(481px) 이상이 아닐 때”
 */
export const PHONE_QUERY = 'not all and (min-width: 30.0625rem)';

export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        // subscribe: 조건 결과가 바뀔 때(change) React 에 알려 줍니다. 반환 함수는 구독 해제
        notify => {
            const list = window.matchMedia(query);
            list.addEventListener('change', notify);
            return () => list.removeEventListener('change', notify);
        },
        // getSnapshot: 현재 결과
        () => window.matchMedia(query).matches,
    );
}
