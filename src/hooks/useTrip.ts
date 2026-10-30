// 여행 1개의 데이터 상태 + 기기 자동 저장(localStorage) 훅.
//  - 여행 화면(TripPage)이 처음 읽은 여행 데이터를 받아 시작합니다. (여행이 바뀌면 TripPage 가 key 로 새로 만들어짐)
//  - 다른 탭에서 같은 여행을 바꾸면 덮어쓰기를 막기 위해 자동 저장을 멈춥니다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { tripKey } from '../lib/storage';
import { writeTrip } from '../lib/tripStore';
import { useToast } from './useToast';
import type { Trip } from '../types';

export function useTrip(initial: Trip) {
    const toast = useToast();
    const [trip, setTrip] = useState<Trip>(initial);
    const [saveStatus, setSaveStatus] = useState('기기 자동 저장 ✓');

    // 아래 값들은 이벤트 핸들러 안에서 "최신 값"을 읽어야 하므로 ref 로 관리합니다.
    // (state 로만 두면 오래된 클로저가 이전 값을 볼 수 있음)
    const tripRef = useRef(trip);
    const externalRef = useRef(false); // 다른 탭 변경 감지로 잠김

    // 다른 탭에서 같은 키를 바꾸면 storage 이벤트가 발생합니다. (같은 탭에서의 변경은 발생하지 않음)
    useEffect(() => {
        const key = tripKey(initial.id);
        const onStorage = (event: StorageEvent) => {
            if (event.key !== key) return;
            externalRef.current = true;
            setSaveStatus('다른 탭 변경 감지');
            toast('다른 탭에서 이 여행이 바뀌었습니다. 현재 내용은 백업한 뒤 새로고침하세요.');
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [initial.id, toast]);

    /**
     * 새 여행 데이터를 화면에 반영하고 기기에 저장합니다.
     * 저장이 잠긴 상태면 화면만 바뀌고 저장은 하지 않습니다.
     * @returns 기기 저장 성공 여부
     */
    const commit = useCallback((next: Trip): boolean => {
        let saved = false;
        let value = next;
        if (externalRef.current) {
            setSaveStatus('자동 저장 중지');
            toast('다른 탭의 변경을 보호하기 위해 저장을 멈췄습니다. 현재 내용을 백업한 뒤 새로고침하세요.');
        } else {
            value = { ...next, updatedAt: new Date().toISOString() };
            saved = writeTrip(value);
            if (saved) {
                setSaveStatus('기기에 저장됨 ✓');
            } else {
                setSaveStatus('저장 공간 확인');
                toast('기기 저장에 실패했습니다. JSON 백업으로 저장해 주세요.');
            }
        }
        tripRef.current = value;
        setTrip(value);
        return saved;
    }, [toast]);

    /** 현재 데이터를 바탕으로 새 데이터를 만들어 저장합니다. (불변 업데이트용) */
    const update = useCallback((recipe: (current: Trip) => Trip) => commit(recipe(tripRef.current)), [commit]);

    /**
     * 백업 불러오기·초기화·클라우드 불러오기처럼 데이터를 통째로 교체할 때 사용합니다.
     * 사용자가 명시적으로 교체를 선택했으므로 저장 잠금을 풀고 저장합니다.
     */
    const replace = useCallback((next: Trip) => {
        externalRef.current = false;
        return commit(next);
    }, [commit]);

    /** 기기 저장이 잠겨 있는지 (클라우드 저장 전 확인용) */
    const isSaveBlocked = useCallback(() => externalRef.current, []);

    /** 이벤트 핸들러에서 최신 데이터를 읽을 때 사용 */
    const getTrip = useCallback(() => tripRef.current, []);

    return { trip, saveStatus, commit, update, replace, isSaveBlocked, getTrip };
}
