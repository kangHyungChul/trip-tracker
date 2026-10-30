// 좌표가 없는 맛집·카페의 위치를 Google 장소 검색으로 자동으로 찾아 채우는 훅.
// 예전 버전에서 옮겨 온 데이터 중 예시 여행에 없던 가게(직접 추가했던 가게)가 대상입니다.
// 한 번 시도한 가게는 페이지를 새로고침하기 전까지 다시 시도하지 않습니다. (요금·반복 오류 방지)

import { useEffect, useRef } from 'react';
import { searchPlace } from '../lib/placeLookup';
import type { Trip } from '../types';

/** 이미 시도한 가게 (여행ID:맛집ID:검색어). 모듈 변수라 화면을 오가도 유지됩니다. */
const attempted = new Set<string>();

export function useAutoLocateFoods(
    trip: Trip,
    update: (recipe: (current: Trip) => Trip) => void,
    ready: boolean,
    toast: (message: string) => void,
) {
    // 화면이 사라진 뒤에는 결과를 반영하지 않기 위한 표시
    // (사라진 화면의 오래된 데이터로 저장하면 새 화면의 수정 내용을 덮어쓸 수 있음)
    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!ready) return;
        // 좌표 없는 가게 목록 + 그날 첫 장소 좌표(근처 결과 우선 검색용)
        const pending = trip.days.flatMap(day => {
            const firstStop = day.stops[0];
            const bias = firstStop ? { lat: firstStop.lat, lng: firstStop.lng } : null;
            return day.foods
                .filter(food => food.lat === null)
                .map(food => ({ food, bias, key: `${trip.id}:${food.id}:${food.query}` }))
                .filter(item => !attempted.has(item.key));
        });
        if (!pending.length) return;
        pending.forEach(item => attempted.add(item.key));

        // 비동기 함수를 바로 실행 (effect 자체는 async 일 수 없음)
        void (async () => {
            let found = 0;
            let missing = 0;
            for (const { food, bias, key } of pending) {
                if (!mounted.current) {
                    attempted.delete(key); // 다음에 화면이 열리면 다시 시도
                    continue;
                }
                try {
                    const place = await searchPlace(food.query, bias);
                    if (!mounted.current) {
                        attempted.delete(key);
                        continue;
                    }
                    if (!place) {
                        missing += 1;
                        continue;
                    }
                    found += 1;
                    // 그사이 사용자가 직접 위치를 지정했을 수 있으므로 여전히 null 인 경우에만 채웁니다.
                    update(current => ({
                        ...current,
                        days: current.days.map(day => ({
                            ...day,
                            foods: day.foods.map(item => (item.id === food.id && item.lat === null ? { ...item, lat: place.lat, lng: place.lng } : item)),
                        })),
                    }));
                } catch (error) {
                    // API 미사용 설정·키 제한 같은 공통 오류는 반복해도 실패하므로 중단합니다.
                    toast('맛집 위치 자동 조회 실패: ' + (error instanceof Error ? error.message : String(error)));
                    return;
                }
            }
            if (mounted.current && (found || missing)) {
                toast(`맛집 위치 ${found}곳을 지도에 표시했습니다.${missing ? ` ${missing}곳은 찾지 못했습니다. 편집에서 구글지도 URL로 지정하세요.` : ''}`);
            }
        })();
    }, [ready, trip, update, toast]);
}
