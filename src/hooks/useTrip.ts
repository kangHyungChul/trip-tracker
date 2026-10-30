// 여행 데이터 상태 + 기기 자동 저장(localStorage) 훅.
//  - 처음 실행 시 저장된 데이터를 읽고(v1 이면 자동 변환), 실패하면 기존 데이터를 덮어쓰지 않도록 저장을 잠급니다.
//  - 다른 탭에서 같은 데이터를 바꾸면 덮어쓰기를 막기 위해 자동 저장을 멈춥니다.

import { useCallback, useEffect, useRef, useState } from 'react';
import seed from '../data/seed.json';
import { clone, parseTrip } from '../lib/trip';
import { readItem, TRIP_KEY, writeItem } from '../lib/storage';
import { useToast } from './useToast';
import type { Trip } from '../types';

/** 원래 추천 일정. JSON 을 한 번 검증해 타입이 보장된 Trip 으로 만듭니다. */
export const SEED_TRIP: Trip = parseTrip(seed);

interface InitialState {
    trip: Trip;
    /** 저장 데이터를 읽지 못해 자동 저장을 잠갔는지 여부 */
    blocked: boolean;
}

/** 앱 시작 시 한 번만 실행되는 초기 로드 */
function loadInitial(): InitialState {
    const stored = readItem(TRIP_KEY);
    if (!stored) return { trip: clone(SEED_TRIP), blocked: false };
    try {
        // parseTrip: version 1 이면 version 2 로 변환한 뒤 검증합니다.
        return { trip: parseTrip(JSON.parse(stored)), blocked: false };
    } catch {
        // 손상된 데이터를 추천 일정으로 덮어쓰면 복구 기회가 사라지므로 저장을 막아 둡니다.
        return { trip: clone(SEED_TRIP), blocked: true };
    }
}

export function useTrip() {
    const toast = useToast();
    // useState 에 함수를 넘기면 첫 렌더에서만 실행됩니다. (매 렌더마다 localStorage 를 읽지 않음)
    const [initial] = useState(loadInitial);
    const [trip, setTrip] = useState<Trip>(initial.trip);
    const [saveStatus, setSaveStatus] = useState(initial.blocked ? '저장 복구 필요' : '기기 자동 저장 ✓');

    // 아래 값들은 이벤트 핸들러 안에서 "최신 값"을 읽어야 하므로 ref 로 관리합니다.
    // (state 로만 두면 오래된 클로저가 이전 값을 볼 수 있음)
    const tripRef = useRef(trip);
    const blockedRef = useRef(initial.blocked); // 저장 데이터 손상으로 잠김
    const externalRef = useRef(false);          // 다른 탭 변경 감지로 잠김

    // 초기 로드 실패 안내 (StrictMode 개발 모드에서는 두 번 표시될 수 있음)
    useEffect(() => {
        if (initial.blocked) toast('저장된 데이터를 읽지 못했습니다. 기존 데이터는 보존했습니다. 백업 불러오기 또는 초기화로 복구하세요.');
    }, [initial.blocked, toast]);

    // 다른 탭에서 같은 키를 바꾸면 storage 이벤트가 발생합니다. (같은 탭에서의 변경은 발생하지 않음)
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== TRIP_KEY) return;
            externalRef.current = true;
            setSaveStatus('다른 탭 변경 감지');
            toast('다른 탭에서 일정이 바뀌었습니다. 현재 내용은 백업한 뒤 새로고침하세요.');
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [toast]);

    /**
     * 새 여행 데이터를 화면에 반영하고 기기에 저장합니다.
     * 저장이 잠긴 상태면 화면만 바뀌고 저장은 하지 않습니다.
     * @returns 기기 저장 성공 여부
     */
    const commit = useCallback((next: Trip): boolean => {
        let saved = false;
        let value = next;
        if (blockedRef.current || externalRef.current) {
            setSaveStatus('자동 저장 중지');
            toast('기존 저장을 보호하기 위해 저장을 멈췄습니다. 현재 내용을 백업한 뒤 새로고침하거나 백업을 다시 불러오세요.');
        } else {
            value = { ...next, updatedAt: new Date().toISOString() };
            saved = writeItem(TRIP_KEY, JSON.stringify(value));
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
        blockedRef.current = false;
        externalRef.current = false;
        return commit(next);
    }, [commit]);

    /** 기기 저장이 잠겨 있는지 (클라우드 저장 전 확인용) */
    const isSaveBlocked = useCallback(() => blockedRef.current || externalRef.current, []);

    /** 이벤트 핸들러에서 최신 데이터를 읽을 때 사용 */
    const getTrip = useCallback(() => tripRef.current, []);

    return { trip, saveStatus, commit, update, replace, isSaveBlocked, getTrip };
}
