// 여행 1개의 Supabase 저장 상태를 구독하는 훅 + 상태별 표시 문구.

import { useCallback, useSyncExternalStore } from 'react';
import { getSyncStatus, subscribeSyncStatus, type SyncState, type SyncStatus } from '../lib/sync';

/** 여행의 저장 상태. 상태가 바뀌면 자동으로 다시 렌더링됩니다. */
export function useSyncStatus(id: string): SyncStatus {
    // getSnapshot 은 id 가 바뀔 때만 새로 만듭니다. (매 렌더마다 새 함수면 구독이 계속 다시 걸림)
    const getSnapshot = useCallback(() => getSyncStatus(id), [id]);
    return useSyncExternalStore(subscribeSyncStatus, getSnapshot);
}

/** 헤더에 보여줄 짧은 문구 */
export const SYNC_LABEL: Record<SyncState, string> = {
    local: '기기에만 저장 (Supabase 미설정)',
    pending: '저장 대기…',
    saving: '저장 중…',
    saved: '클라우드에 저장됨 ✓',
    offline: '오프라인 · 연결되면 자동 저장',
    error: '저장 실패 · 자동 재시도',
    conflict: '충돌 · 눌러서 해결',
};
