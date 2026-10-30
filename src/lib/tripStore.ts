// 여러 여행의 기기 저장소 관리.
//  - 여행 ID 목록은 TRIP_INDEX_KEY 에, 각 여행은 tripKey(id) 에 따로 저장합니다.
//    (한 여행 데이터가 깨져도 다른 여행에 영향이 없고, 탭 간 변경 감지도 여행 단위로 할 수 있음)
//  - 처음 실행(목록 키 없음) 때 예전 가고시마 전용 데이터를 첫 여행으로 옮기거나, 없으면 예시 여행을 넣습니다.

import seed from '../data/seed.json';
import { clone, LEGACY_TRIP_ID, parseTrip, validateTrip } from './trip';
import {
    cloudBaseKey, LEGACY_KEYS, lastDayKey, readItem, removeItem, SUPABASE_CONFIG_KEY, TRIP_INDEX_KEY, tripKey, writeItem,
} from './storage';
import type { Trip } from '../types';

/** 기본 예시 여행(가고시마). 시드 JSON 을 한 번 검증해 타입이 보장된 Trip 으로 만듭니다. */
export const SAMPLE_TRIP: Trip = validateTrip(seed);

/** 기기에 둘 수 있는 여행 개수 상한 (localStorage 용량 약 5MB 고려) */
export const MAX_TRIPS = 50;

/** 여행 1개 읽기 결과: 정상 / 저장값 없음 / 손상(원문 보존) */
export type StoredTrip =
    | { status: 'ok'; id: string; trip: Trip }
    | { status: 'missing'; id: string }
    | { status: 'broken'; id: string; raw: string; error: string };

/** 여행 ID 목록 읽기. 형식이 깨졌으면 빈 목록 */
export function listTripIds(): string[] {
    try {
        const value = JSON.parse(readItem(TRIP_INDEX_KEY) ?? '[]') as unknown;
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

/** 여행 ID 목록 저장 */
const writeIds = (ids: string[]) => writeItem(TRIP_INDEX_KEY, JSON.stringify(ids));

/** 여행 1개 읽기 (예전 형식이면 자동 변환. 저장 키의 ID 를 여행 ID 로 고정) */
export function readTrip(id: string): StoredTrip {
    const raw = readItem(tripKey(id));
    if (raw === null) return { status: 'missing', id };
    try {
        return { status: 'ok', id, trip: parseTrip(JSON.parse(raw), { id }) };
    } catch (error) {
        return { status: 'broken', id, raw, error: error instanceof Error ? error.message : String(error) };
    }
}

/** 모든 여행 읽기 (첫 화면 목록용, 목록 순서대로) */
export const readAllTrips = (): StoredTrip[] => listTripIds().map(readTrip);

/**
 * 여행 저장. 목록에 없던 여행이면 목록 맨 앞에 추가합니다.
 * @returns localStorage 저장 성공 여부
 */
export function writeTrip(trip: Trip): boolean {
    const saved = writeItem(tripKey(trip.id), JSON.stringify(trip));
    const ids = listTripIds();
    if (!ids.includes(trip.id)) writeIds([trip.id, ...ids]);
    return saved;
}

/** 여행 삭제 (기기에서만. 클라우드 사본은 그대로 남음) */
export function deleteTrip(id: string): void {
    writeIds(listTripIds().filter(item => item !== id));
    removeItem(tripKey(id));
    removeItem(lastDayKey(id));
    removeItem(cloudBaseKey(id));
}

/** 새 여행을 더 만들 수 있는지 */
export const canAddTrip = () => listTripIds().length < MAX_TRIPS;

/**
 * 앱 시작 시 한 번 실행: 처음 실행이면 예전 데이터 이전 또는 예시 여행 추가.
 * 이미 목록 키가 있으면 아무것도 하지 않습니다.
 */
export function initTripStore(): void {
    if (readItem(TRIP_INDEX_KEY) !== null) return;

    const legacyRaw = readItem(LEGACY_KEYS.trip);
    if (legacyRaw) {
        try {
            // 예전 데이터(v1·v2)는 LEGACY_TRIP_ID 로 변환되어 기존 클라우드 저장과 계속 이어집니다.
            writeItem(tripKey(LEGACY_TRIP_ID), JSON.stringify(parseTrip(JSON.parse(legacyRaw), { id: LEGACY_TRIP_ID })));
        } catch {
            // 읽을 수 없는 데이터도 원문 그대로 옮겨 두면, 여행 화면에서 "손상" 안내와 원문 내려받기를 제공할 수 있습니다.
            writeItem(tripKey(LEGACY_TRIP_ID), legacyRaw);
        }
        // 마지막으로 본 날짜: v1 은 숫자("3")로 저장했으므로 날짜 ID("day-3")로 바꿉니다.
        const lastDay = readItem(LEGACY_KEYS.lastDay);
        if (lastDay) writeItem(lastDayKey(LEGACY_TRIP_ID), /^\d+$/.test(lastDay) ? `day-${lastDay}` : lastDay);
        // 클라우드 동기화 기준 revision 도 같은 여행으로 이어 붙입니다.
        const cloudBase = readItem(LEGACY_KEYS.cloudBase);
        if (cloudBase) writeItem(cloudBaseKey(LEGACY_TRIP_ID), cloudBase);
    } else {
        // 처음 쓰는 사람에게는 예시 여행을 보여줍니다.
        writeItem(tripKey(SAMPLE_TRIP.id), JSON.stringify(clone(SAMPLE_TRIP)));
    }
    // 화면에서 입력했던 Supabase 연결 설정도 새 키로 옮깁니다.
    const supabaseConfig = readItem(LEGACY_KEYS.supabaseConfig);
    if (supabaseConfig && readItem(SUPABASE_CONFIG_KEY) === null) writeItem(SUPABASE_CONFIG_KEY, supabaseConfig);

    writeIds([LEGACY_TRIP_ID]);
}
