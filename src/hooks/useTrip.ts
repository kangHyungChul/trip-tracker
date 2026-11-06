// 여행 1개의 데이터 상태 + 자동 저장 훅.
//  - 편집하면 기기 캐시(localStorage)에 바로 쓰고, Supabase 업로드는 동기화 엔진(lib/sync.ts)이 잠시 모아서 처리합니다.
//  - 다른 기기 변경을 불러오거나 충돌을 "클라우드 내용"으로 해결하면 sync 의 remote 이벤트로 화면 데이터를 교체합니다.
//  - 같은 기기의 다른 탭에서 같은 여행을 바꾸면 덮어쓰기를 막기 위해 저장을 멈춥니다.
//  - 여행 화면(TripPage)이 처음 읽은 여행 데이터로 시작합니다. (여행이 바뀌면 TripPage 가 key 로 새로 만들어짐)

import { useCallback, useEffect, useRef, useState } from 'react';
import { tripKey } from '../lib/storage';
import { markDirty, onSyncEvent } from '../lib/sync';
import { writeTrip } from '../lib/tripStore';
import { goHome } from './useHashRoute';
import { SYNC_LABEL, useSyncStatus } from './useSyncStatus';
import { useToast } from './useToast';
import type { Trip } from '../types';

export function useTrip(initial: Trip) {
    const toast = useToast();
    const [trip, setTrip] = useState<Trip>(initial);
    const sync = useSyncStatus(initial.id);
    // 다른 탭 변경으로 저장을 멈췄는지 (헤더 문구용 state + 핸들러에서 최신값을 읽기 위한 ref)
    const [blocked, setBlocked] = useState(false);

    // 아래 값들은 이벤트 핸들러 안에서 "최신 값"을 읽어야 하므로 ref 로 관리합니다.
    // (state 로만 두면 오래된 클로저가 이전 값을 볼 수 있음)
    const tripRef = useRef(trip);
    const externalRef = useRef(false);

    // 다른 탭에서 같은 키를 바꾸면 storage 이벤트가 발생합니다. (같은 탭에서의 변경은 발생하지 않음)
    useEffect(() => {
        const key = tripKey(initial.id);
        const onStorage = (event: StorageEvent) => {
            if (event.key !== key) return;
            externalRef.current = true;
            setBlocked(true);
            toast('다른 탭에서 이 여행이 바뀌었습니다. 현재 내용은 백업한 뒤 새로고침하세요.');
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [initial.id, toast]);

    // 클라우드 내용으로 기기 캐시가 바뀌면 화면도 교체합니다.
    useEffect(
        () =>
            onSyncEvent(event => {
                if (event.type !== 'remote' || event.id !== initial.id) return;
                if (event.trip === null) {
                    toast('이 여행이 다른 기기에서 삭제되었습니다. 첫 화면 ‘저장·백업 → 휴지통’에서 복구할 수 있습니다.');
                    goHome();
                    return;
                }
                tripRef.current = event.trip;
                setTrip(event.trip);
                toast('최신 여행 내용을 불러왔습니다.');
            }),
        [initial.id, toast],
    );

    /**
     * 새 여행 데이터를 화면에 반영하고 기기 캐시에 쓴 뒤 업로드를 예약합니다.
     * 다른 탭 변경으로 저장이 잠긴 상태면 화면만 바뀌고 저장은 하지 않습니다.
     */
    const commit = useCallback((next: Trip) => {
        let value = next;
        if (externalRef.current) {
            toast('다른 탭의 변경을 보호하기 위해 저장을 멈췄습니다. 현재 내용을 백업한 뒤 새로고침하세요.');
        } else {
            value = { ...next, updatedAt: new Date().toISOString() };
            // localStorage 가 가득 차도 메모리에는 보관되므로, 이 페이지에서는 업로드가 계속 가능합니다.
            if (!writeTrip(value)) toast('이 기기의 저장 공간이 부족합니다. 현재 여행을 백업 파일로 내려받아 보관해 주세요.');
            markDirty(value.id);
        }
        tripRef.current = value;
        setTrip(value);
    }, [toast]);

    /** 현재 데이터를 바탕으로 새 데이터를 만들어 저장합니다. (불변 업데이트용) */
    const update = useCallback((recipe: (current: Trip) => Trip) => commit(recipe(tripRef.current)), [commit]);

    /**
     * 백업 불러오기·초기화처럼 데이터를 통째로 교체할 때 사용합니다.
     * 사용자가 명시적으로 교체를 선택했으므로 저장 잠금을 풀고 저장합니다.
     */
    const replace = useCallback((next: Trip) => {
        externalRef.current = false;
        setBlocked(false);
        commit(next);
    }, [commit]);

    /** 이벤트 핸들러에서 최신 데이터를 읽을 때 사용 */
    const getTrip = useCallback(() => tripRef.current, []);

    // 헤더 상태 문구: 다른 탭 잠금이 가장 우선
    const saveStatus = blocked ? '다른 탭 변경 감지 · 저장 중지' : SYNC_LABEL[sync.state];

    return { trip, saveStatus, syncState: sync.state, syncMessage: sync.message, commit, update, replace, getTrip };
}
