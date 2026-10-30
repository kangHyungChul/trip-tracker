// 여행 데이터의 검증·버전 변환·계산 로직.
// UI와 분리된 순수 함수만 모아 두어 Vitest로 바로 테스트할 수 있습니다.

import type { CostUnit, Day, Food, Stop, TravelMode, Trip } from '../types';

/** 날짜 개수 상한 (너무 큰 파일·실수 입력 방지) */
export const MAX_DAYS = 30;
/** 하루 장소 개수 상한 */
export const MAX_STOPS_PER_DAY = 100;
/** 장소 하나의 식당 후보 상한 */
export const MAX_FOODS_PER_STOP = 30;

/** JSON 직렬화를 이용한 깊은 복사 (데이터가 순수 JSON 이므로 충분) */
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * 고유 ID 생성.
 * crypto.randomUUID 는 https·localhost 에서만 동작하므로, 그 외(예: http 내부망 주소)에서는 대체 값을 씁니다.
 */
export function newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' && globalThis.isSecureContext !== false) {
        return crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ───────────────────────── 검증 도우미 ─────────────────────────

/** 일반 객체(배열·null 제외)인지 확인하는 타입 가드 */
const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** 문자열이고 길이 상한 이내인지 검사 후 반환. 실패 시 message 로 오류를 던집니다. */
function str(value: unknown, max: number, message: string): string {
    if (typeof value !== 'string' || value.length > max) throw new Error(message);
    return value;
}

/** 유한한 숫자이고 [min, max] 범위인지 검사 후 반환 */
function num(value: unknown, min: number, max: number, message: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(message);
    return value;
}

// ───────────────────────── 항목별 검증 ─────────────────────────

/** 식당 후보 1개 검증. 알 수 없는 키는 버리고 정해진 필드만 새 객체로 만듭니다. */
function validateFood(value: unknown): Food {
    const message = '식당 항목 형식을 확인하세요.';
    if (!isObject(value)) throw new Error(message);
    return {
        name: str(value.name, 10000, message),
        query: str(value.query, 10000, message),
        menu: str(value.menu, 10000, message),
        budget: str(value.budget, 10000, message),
        kind: str(value.kind, 10000, message),
        hours: str(value.hours, 10000, message),
        parking: str(value.parking, 10000, message),
        source: str(value.source, 10000, message),
    };
}

/** 장소 1개 검증. ids 는 여행 전체 장소 ID 중복을 막기 위한 집합입니다. */
function validateStop(value: unknown, ids: Set<string>): Stop {
    const message = '장소 데이터 형식을 확인하세요.';
    if (!isObject(value) || typeof value.id !== 'string' || !value.id || ids.has(value.id)) {
        throw new Error('중복되거나 잘못된 장소 ID입니다.');
    }
    ids.add(value.id);
    const title = str(value.title, 12000, message);
    const query = str(value.query, 12000, message);
    if (!title.trim() || !query.trim()) throw new Error('장소명과 구글지도 검색어가 필요합니다.');
    // 위도 -90~90, 경도 -180~180 범위만 허용합니다.
    const coordMessage = '지도 좌표가 올바르지 않습니다.';
    const lat = num(value.lat, -90, 90, coordMessage);
    const lng = num(value.lng, -180, 180, coordMessage);
    const amountMessage = '금액 형식을 확인하세요.';
    const amount = num(value.amount, 0, 10_000_000, amountMessage);
    const extraAmount = num(value.extraAmount, 0, 10_000_000, amountMessage);
    if (value.unit !== 'adult' && value.unit !== 'vehicle') throw new Error(amountMessage);
    if (value.mode !== 'driving' && value.mode !== 'walking') throw new Error(message);
    if (!Array.isArray(value.food) || value.food.length > MAX_FOODS_PER_STOP) throw new Error('식당 데이터 형식을 확인하세요.');
    return {
        id: value.id,
        time: str(value.time, 12000, message),
        title,
        query,
        lat,
        lng,
        duration: str(value.duration, 12000, message),
        fee: str(value.fee, 12000, message),
        amount,
        unit: value.unit as CostUnit,
        extraAmount,
        parking: str(value.parking, 12000, message),
        parkingQuery: str(value.parkingQuery, 12000, message),
        note: str(value.note, 12000, message),
        source: str(value.source, 12000, message),
        food: value.food.map(validateFood),
        kind: str(value.kind, 12000, message),
        mode: value.mode as TravelMode,
        // 체크 여부는 누락돼도 false 로 보정합니다.
        done: !!value.done,
    };
}

/** 날짜 1개 검증 */
function validateDay(value: unknown, dayIds: Set<string>, stopIds: Set<string>): Day {
    const message = '날짜 형식이 올바르지 않습니다.';
    if (!isObject(value) || typeof value.id !== 'string' || !value.id || dayIds.has(value.id)) throw new Error(message);
    dayIds.add(value.id);
    if (!Array.isArray(value.stops) || value.stops.length > MAX_STOPS_PER_DAY) throw new Error(message);
    return {
        id: value.id,
        date: str(value.date, 100, message),
        weekday: str(value.weekday, 100, message),
        title: str(value.title, 300, message),
        subtitle: str(value.subtitle, 300, message),
        hotel: str(value.hotel, 300, message),
        pace: str(value.pace, 300, message),
        warning: str(value.warning, 3000, message),
        tight: !!value.tight,
        costNote: str(value.costNote, 1000, message),
        stops: value.stops.map(stop => validateStop(stop, stopIds)),
    };
}

/**
 * version 2 여행 데이터를 검증하고, 정해진 필드만 담은 새 객체를 반환합니다.
 * 잘못된 값이 있으면 사용자에게 보여줄 한국어 메시지로 Error 를 던집니다.
 */
export function validateTrip(value: unknown): Trip {
    if (!isObject(value) || value.version !== 2 || !Array.isArray(value.days)) {
        throw new Error('이 앱의 여행 일정 백업 파일이 아닙니다.');
    }
    if (value.days.length < 1 || value.days.length > MAX_DAYS) throw new Error(`날짜는 1~${MAX_DAYS}일이어야 합니다.`);
    if (!Number.isInteger(value.travelers) || (value.travelers as number) < 1 || (value.travelers as number) > 20) {
        throw new Error('여행 인원은 1~20명이어야 합니다.');
    }
    if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100) throw new Error('여행 제목을 확인하세요.');
    if (typeof value.notes !== 'string' || value.notes.length > 10000) throw new Error('메모를 확인하세요.');
    // 날짜 ID, 장소 ID 각각 여행 전체에서 중복되면 안 됩니다.
    const dayIds = new Set<string>();
    const stopIds = new Set<string>();
    const trip: Trip = {
        version: 2,
        title: value.title,
        travelers: value.travelers as number,
        notes: value.notes,
        days: value.days.map(day => validateDay(day, dayIds, stopIds)),
    };
    // 선택 필드는 문자열일 때만 유지합니다.
    if (typeof value.checkedAt === 'string') trip.checkedAt = value.checkedAt.slice(0, 50);
    if (typeof value.updatedAt === 'string') trip.updatedAt = value.updatedAt.slice(0, 50);
    return trip;
}

// ───────────────────────── 버전 변환 ─────────────────────────

/** version 1 앱에서 3일차(id 3)에만 하드코딩되어 있던 비용 안내 문구 */
const V1_DAY3_COST_NOTE = '페리 차3~4m 기준·차4~5m은 왕복 ¥1,300 추가';
/** version 1 앱에서 센간엔(id 'sengan')이 있는 날에 하드코딩으로 더하던 주차비 */
const V1_SENGAN_PARKING = 500;

/**
 * version 1 데이터를 version 2 형식으로 바꿉니다.
 * v1 앱의 하드코딩 동작을 그대로 데이터 필드로 옮겨서 화면 결과가 달라지지 않게 합니다.
 *  - 날짜 id 숫자 → 'day-숫자' 문자열
 *  - 3일차 → tight(빠듯함 강조) + costNote(페리 안내)
 *  - 'sengan' 장소 → extraAmount 500
 */
export function migrateV1(value: Record<string, unknown>): Record<string, unknown> {
    if (!Array.isArray(value.days)) throw new Error('이 앱의 여행 일정 백업 파일이 아닙니다.');
    const days = value.days.map((day: unknown, index: number) => {
        if (!isObject(day)) throw new Error('날짜 형식이 올바르지 않습니다.');
        // v1 은 id 가 1,2,3,4 순번이었습니다. 숫자가 아니면 위치로 대신합니다.
        const n = typeof day.id === 'number' ? day.id : index + 1;
        const stops = Array.isArray(day.stops)
            ? day.stops.map((stop: unknown) => (isObject(stop) ? { ...stop, extraAmount: stop.id === 'sengan' ? V1_SENGAN_PARKING : 0 } : stop))
            : day.stops;
        return { ...day, id: `day-${n}`, tight: n === 3, costNote: n === 3 ? V1_DAY3_COST_NOTE : '', stops };
    });
    // restaurantGroups 등 v1 시드에만 있던 부가 키는 validateTrip 단계에서 자연히 제거됩니다.
    return { ...value, version: 2, days };
}

/**
 * 저장소·백업·클라우드에서 읽은 임의의 값을 현재 형식의 Trip 으로 만듭니다.
 * version 1 이면 먼저 변환하고, 최종적으로 version 2 검증을 통과해야 합니다.
 */
export function parseTrip(value: unknown): Trip {
    if (isObject(value) && value.version === 1) return validateTrip(migrateV1(value));
    return validateTrip(value);
}

// ───────────────────────── 계산·검색 ─────────────────────────

/**
 * 하루 비용 합계(엔).
 * 1인당 금액은 인원수를 곱하고, 차량·전체 금액과 추가 고정비는 1회만 더합니다.
 */
export function dayCost(day: Day, travelers: number): number {
    return day.stops.reduce(
        (sum, stop) => sum + stop.amount * (stop.unit === 'adult' ? travelers : 1) + stop.extraAmount,
        0,
    );
}

/** 대소문자 무시 부분 일치. 검색어가 비어 있으면 항상 일치로 봅니다. */
const includesTerm = (fields: string[], term: string): boolean => {
    const t = term.trim().toLowerCase();
    if (!t) return true;
    return fields.some(field => field.toLowerCase().includes(t));
};

/**
 * 식당 검색: 사람이 읽는 텍스트 필드만 대상으로 합니다.
 * (기존 버전은 JSON 전체를 검색해 URL·좌표 문자열까지 걸리는 문제가 있었음)
 */
export function foodMatches(food: Food, term: string): boolean {
    return includesTerm([food.name, food.query, food.menu, food.budget, food.kind, food.hours, food.parking], term);
}

/** 장소 검색: 장소 텍스트 필드 + 딸린 식당 이름·메뉴까지 검색합니다. ("장소·음식 검색") */
export function stopMatches(stop: Stop, term: string): boolean {
    const own = [stop.time, stop.title, stop.query, stop.kind, stop.duration, stop.fee, stop.parking, stop.note];
    const foods = stop.food.flatMap(food => [food.name, food.menu, food.kind]);
    return includesTerm([...own, ...foods], term);
}

// ───────────────────────── 새 항목 기본값 ─────────────────────────

/** 장소 추가 시 편집 화면의 기본값 (id 는 저장할 때 부여) */
export function blankStop(): Omit<Stop, 'id'> {
    return {
        time: '시간 미정', title: '', query: '', lat: 31.59, lng: 130.56, duration: '30분',
        fee: '무료 또는 현장 확인', amount: 0, unit: 'adult', extraAmount: 0,
        parking: '주차 여부·요금 확인', parkingQuery: '', note: '', source: '', food: [],
        kind: '관광', mode: 'driving', done: false,
    };
}

/** 식당 후보 추가 시 빈 값 */
export function blankFood(): Food {
    return { name: '', query: '', menu: '', budget: '', kind: '', hours: '', parking: '', source: '' };
}

/** 날짜 추가 시 기본값 (id 는 저장할 때 부여) */
export function blankDay(): Omit<Day, 'id'> {
    return { date: '', weekday: '', title: '새로운 하루', subtitle: '', hotel: '', pace: '', warning: '', tight: false, costNote: '', stops: [] };
}
