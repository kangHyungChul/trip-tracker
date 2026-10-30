// 버튼으로 실행하는 비동기 작업 도우미.
// 진행 중인 작업 이름을 기억해 버튼을 비활성화(중복 클릭 방지)하고, 오류는 토스트로 보여줍니다.

import { useCallback, useState } from 'react';
import { useToast } from './useToast';

const errorMessage = (error: unknown) => (error instanceof Error && error.message) || '요청에 실패했습니다.';

export function useRunner() {
    const toast = useToast();
    // 진행 중인 작업 이름 (없으면 null)
    const [pending, setPending] = useState<string | null>(null);

    /** 작업 실행: 이미 진행 중이면 무시 → 실행 → 오류 토스트 → 끝나면 해제 */
    const run = useCallback(
        async (name: string, action: () => Promise<void>) => {
            if (pending) return;
            setPending(name);
            try {
                await action();
            } catch (error) {
                toast(errorMessage(error));
            } finally {
                setPending(null);
            }
        },
        [pending, toast],
    );

    return { pending, run };
}
