// 화면에 보이지 않는 동기화 관리 컴포넌트 (App 에 하나만 둠).
//  - 앱을 열 때·온라인으로 돌아올 때·창에 다시 들어올 때 클라우드와 기기 캐시를 맞춥니다. (syncAll)
//  - 동기화 엔진이 충돌을 알리면 "클라우드 내용 불러오기 / 내 내용으로 덮어쓰기"를 하나씩 묻습니다.

import { useEffect } from 'react';
import { isCloudEnabled } from '../lib/cloudTrips';
import { onSyncEvent, pendingConflicts, resolveConflict, syncAll } from '../lib/sync';
import { readTrip } from '../lib/tripStore';
import { useChoice } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';

/** 창 포커스로 다시 동기화할 때 최소 간격 (탭을 자주 오가도 요청이 몰리지 않게) */
const FOCUS_SYNC_GAP_MS = 10000;

export function SyncCoordinator() {
    const choose = useChoice();
    const toast = useToast();

    useEffect(() => {
        if (!isCloudEnabled()) return;
        let disposed = false;
        const queue: string[] = []; // 물어볼 충돌 여행 ID (한 번에 하나씩)
        let asking = false;

        /** 대기 중인 충돌을 순서대로 묻고 해결합니다. */
        const askNext = async () => {
            if (asking) return;
            asking = true;
            try {
                while (queue.length && !disposed) {
                    const id = queue.shift()!;
                    const stored = readTrip(id);
                    const title = stored.status === 'ok' ? stored.trip.title : id;
                    const picked = await choose({
                        title: `'${title}' 여행이 다른 기기에서 먼저 수정(또는 삭제)되었습니다`,
                        message:
                            '이 기기에서 수정한 내용은 아직 다른 기기에 반영되지 않았습니다.\n' +
                            '‘다른 기기의 내용 불러오기’를 고르면 지금 수정한 내용이 사라지고, ‘내 내용으로 덮어쓰기’를 고르면 다른 기기의 변경이 사라집니다.\n' +
                            '두 내용을 모두 보관하려면 ‘나중에’를 누르고 현재 여행을 백업해 주세요.',
                        cancelLabel: '나중에',
                        choices: [
                            { value: 'cloud', label: '다른 기기의 내용 불러오기', tone: 'outline' },
                            { value: 'mine', label: '내 내용으로 덮어쓰기', tone: 'danger' },
                        ],
                    });
                    if (picked === null) continue; // 나중에: 충돌 상태 유지 (헤더 상태를 눌러 다시 열 수 있음)
                    try {
                        await resolveConflict(id, picked as 'cloud' | 'mine');
                        toast(picked === 'mine' ? '지금 수정한 내용으로 저장했습니다.' : '다른 기기의 여행 내용을 불러왔습니다.');
                    } catch (error) {
                        toast('충돌 해결 실패: ' + (error instanceof Error ? error.message : String(error)));
                    }
                }
            } finally {
                asking = false;
            }
        };

        const enqueue = (id: string) => {
            if (!queue.includes(id)) queue.push(id);
            void askNext();
        };
        const off = onSyncEvent(event => {
            if (event.type === 'conflict') enqueue(event.id);
        });
        // 구독 전에 이미 생긴 충돌도 처리
        pendingConflicts().forEach(enqueue);

        /** 전체 동기화. 실패(오프라인 등)는 조용히 넘기고 다음 기회에 다시 시도합니다. */
        const sync = () => void syncAll().catch(() => {});
        sync();

        let lastFocusSync = Date.now();
        const onFocus = () => {
            if (Date.now() - lastFocusSync < FOCUS_SYNC_GAP_MS) return;
            lastFocusSync = Date.now();
            sync();
        };
        window.addEventListener('online', sync);
        window.addEventListener('focus', onFocus);
        return () => {
            disposed = true;
            off();
            window.removeEventListener('online', sync);
            window.removeEventListener('focus', onFocus);
        };
    }, [choose, toast]);

    return null;
}
