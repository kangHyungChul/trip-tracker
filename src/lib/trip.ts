// 여행 데이터의 검증·버전 변환·계산 로직.
// UI와 분리된 순수 함수만 모아 두어 Vitest로 바로 테스트할 수 있습니다.

import seed from '../data/seed.json';
import { inferStopIcon, isStopIcon, STOP_ICON_LABELS } from './stopIcons';
import { CURRENCY_PATTERN, DEFAULT_CURRENCY, LEGACY_CURRENCY } from './currency';
import { isValidISODate, isValidTime, parseISODate, splitTimeText } from './datetime';
import type { CostUnit, Day, Food, FoodCategory, Stop, TravelMode, Trip } from '../types';

/** 날짜 개수 상한 (너무 큰 파일·실수 입력 방지) */
export const MAX_DAYS = 30;
/** 하루 장소 개수 상한 */
export const MAX_STOPS_PER_DAY = 100;
/** 하루 맛집·카페 개수 상한 */
export const MAX_FOODS_PER_DAY = 100;
/** 예전 버전(v1·v2) 데이터와 기본 예시 여행이 쓰는 여행 ID. 기존 클라우드 저장 키('kagoshima-2026')와 같아야 이어집니다. */
export const LEGACY_TRIP_ID = 'kagoshima-2026';
/** 여행 ID 형식: 클라우드 trip_key 로도 쓰이므로 schema.sql 의 검사와 같은 규칙 */
export const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

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

/** 여행 안에서 ID 가 비어 있지 않고 중복되지 않는지 검사한 뒤 등록합니다. */
function uniqueId(value: unknown, ids: Set<string>, message: string): string {
    if (typeof value !== 'string' || !value || value.length > 200 || ids.has(value)) throw new Error(message);
    ids.add(value);
    return value;
}

// ───────────────────────── 항목별 검증 ─────────────────────────

/** 맛집·카페 1개 검증. 알 수 없는 키는 버리고 정해진 필드만 새 객체로 만듭니다. */
function validateFood(value: unknown, ids: Set<string>): Food {
    const message = '장소 후보 항목 형식을 확인하세요.';
    if (!isObject(value)) throw new Error(message);
    const id = uniqueId(value.id, ids, '중복되거나 잘못된 후보 ID입니다.');
    if (!isStopIcon(value.category)) throw new Error(message);
    const name = str(value.name, 10000, message);
    const query = str(value.query, 10000, message);
    if (!name.trim() || !query.trim()) throw new Error('장소 후보 이름과 구글지도 검색어가 필요합니다.');
    // 좌표는 "둘 다 숫자" 또는 "둘 다 null(위치 미정)" 만 허용합니다.
    const coordMessage = '맛집 지도 좌표가 올바르지 않습니다.';
    const hasCoords = value.lat !== null || value.lng !== null;
    return {
        id,
        category: value.category as FoodCategory,
        name,
        query,
        lat: hasCoords ? num(value.lat, -90, 90, coordMessage) : null,
        lng: hasCoords ? num(value.lng, -180, 180, coordMessage) : null,
        menu: str(value.menu, 10000, message),
        budget: str(value.budget, 10000, message),
        kind: str(value.kind, 10000, message),
        hours: str(value.hours, 10000, message),
        parking: str(value.parking, 10000, message),
        source: str(value.source, 10000, message),
    };
}

/** 장소 1개 검증. ids 는 여행 전체 장소·맛집 ID 중복을 막기 위한 집합입니다. */
function validateStop(value: unknown, ids: Set<string>): Stop {
    const message = '장소 데이터 형식을 확인하세요.';
    if (!isObject(value)) throw new Error(message);
    const id = uniqueId(value.id, ids, '중복되거나 잘못된 장소 ID입니다.');
    const title = str(value.title, 12000, message);
    const query = str(value.query, 12000, message);
    if (!title.trim() || !query.trim()) throw new Error('장소명과 구글지도 검색어가 필요합니다.');
    const start = str(value.start, 5, message);
    const end = str(value.end, 5, message);
    if (!isValidTime(start) || !isValidTime(end)) throw new Error('방문 시각은 HH:mm 형식이어야 합니다.');
    // 위도 -90~90, 경도 -180~180 범위만 허용합니다.
    const coordMessage = '지도 좌표가 올바르지 않습니다.';
    const lat = num(value.lat, -90, 90, coordMessage);
    const lng = num(value.lng, -180, 180, coordMessage);
    const amountMessage = '금액 형식을 확인하세요.';
    const amount = num(value.amount, 0, 10_000_000, amountMessage);
    const extraAmount = num(value.extraAmount, 0, 10_000_000, amountMessage);
    if (value.unit !== 'adult' && value.unit !== 'vehicle') throw new Error(amountMessage);
    if (value.mode !== 'driving' && value.mode !== 'walking') throw new Error(message);
    if (value.icon !== undefined && !isStopIcon(value.icon)) throw new Error('지도 아이콘 종류를 확인하세요.');
    let arrival: Stop['arrival'];
    if (value.arrival !== undefined) {
        const point = value.arrival;
        if (!isObject(point) || (point.type !== 'parking' && point.type !== 'entrance')) throw new Error('도착 지점 형식을 확인하세요.');
        arrival = { type: point.type, name: str(point.name, 12000, message), lat: num(point.lat, -90, 90, coordMessage), lng: num(point.lng, -180, 180, coordMessage) };
    }
    return {
        id,
        start,
        end,
        timeNote: str(value.timeNote, 200, message),
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
        kind: str(value.kind, 12000, message),
        icon: value.icon ?? inferStopIcon(str(value.kind, 12000, message)),
        ...(arrival ? { arrival } : {}),
        ...(value.sourceCandidateId !== undefined ? { sourceCandidateId: str(value.sourceCandidateId, 200, message) } : {}),
        mode: value.mode as TravelMode,
        // 체크 여부는 누락돼도 false 로 보정합니다.
        done: !!value.done,
    };
}

/** 날짜 1개 검증 */
function validateDay(value: unknown, dayIds: Set<string>, itemIds: Set<string>): Day {
    const message = '날짜 형식이 올바르지 않습니다.';
    if (!isObject(value)) throw new Error(message);
    const id = uniqueId(value.id, dayIds, message);
    if (!Array.isArray(value.stops) || value.stops.length > MAX_STOPS_PER_DAY) throw new Error(message);
    if (!Array.isArray(value.foods) || value.foods.length > MAX_FOODS_PER_DAY) throw new Error('맛집·카페 데이터 형식을 확인하세요.');
    const date = str(value.date, 10, message);
    if (!isValidISODate(date)) throw new Error('날짜는 YYYY-MM-DD 형식이어야 합니다.');
    return {
        id,
        date,
        dateNote: str(value.dateNote, 100, message),
        title: str(value.title, 300, message),
        subtitle: str(value.subtitle, 300, message),
        hotel: str(value.hotel, 300, message),
        pace: str(value.pace, 300, message),
        warning: str(value.warning, 3000, message),
        tight: !!value.tight,
        costNote: str(value.costNote, 1000, message),
        stops: value.stops.map(stop => validateStop(stop, itemIds)),
        foods: value.foods.map(food => validateFood(food, itemIds)),
    };
}

/**
 * version 3 여행 데이터를 검증하고, 정해진 필드만 담은 새 객체를 반환합니다.
 * 잘못된 값이 있으면 사용자에게 보여줄 한국어 메시지로 Error 를 던집니다.
 */
export function validateTrip(value: unknown): Trip {
    if (!isObject(value) || value.version !== 3 || !Array.isArray(value.days)) {
        throw new Error('이 앱의 여행 일정 백업 파일이 아닙니다.');
    }
    if (typeof value.id !== 'string' || !TRIP_ID_PATTERN.test(value.id)) throw new Error('여행 ID 형식이 올바르지 않습니다.');
    if (value.days.length > MAX_DAYS) throw new Error(`날짜는 최대 ${MAX_DAYS}일까지입니다.`);
    if (!Number.isInteger(value.travelers) || (value.travelers as number) < 1 || (value.travelers as number) > 20) {
        throw new Error('여행 인원은 1~20명이어야 합니다.');
    }
    if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100) throw new Error('여행 제목을 확인하세요.');
    if (typeof value.notes !== 'string' || value.notes.length > 10000) throw new Error('메모를 확인하세요.');
    const message = '여행 소개 문구를 확인하세요.';
    // 통화: 없으면(통화 기능 이전 데이터) 엔화로 보정, 있으면 세 글자 코드여야 합니다.
    const currency = value.currency === undefined ? LEGACY_CURRENCY : value.currency;
    if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency)) throw new Error('통화 코드는 KRW·JPY 같은 영문 대문자 세 글자여야 합니다.');
    // 날짜 ID 는 날짜끼리, 장소·맛집 ID 는 서로 섞여도(지도 선택에 같은 ID 공간을 씀) 중복되면 안 됩니다.
    const dayIds = new Set<string>();
    const itemIds = new Set<string>();
    const trip: Trip = {
        version: 3,
        id: value.id,
        title: value.title,
        companion: str(value.companion, 300, message),
        tagline: str(value.tagline, 300, message),
        highlight: str(value.highlight, 300, message),
        highlightSub: str(value.highlightSub, 300, message),
        travelers: value.travelers as number,
        currency,
        notes: value.notes,
        days: value.days.map(day => validateDay(day, dayIds, itemIds)),
    };
    if (value.candidates !== undefined && (!Array.isArray(value.candidates) || value.candidates.length > 3000)) throw new Error('장소 후보 목록을 확인하세요.');
    // 예전 날짜별 목록도 ID·정보를 보존해 여행 공통 후보함으로 한 번만 이동합니다.
    trip.candidates = [...trip.days.flatMap(day => day.foods), ...((value.candidates ?? []) as unknown[]).map(item => validateFood(item, itemIds))];
    if (trip.candidates.length > 3000) throw new Error('장소 후보는 여행당 최대 3000개입니다.');
    trip.days = trip.days.map(day => ({ ...day, foods: [] }));
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

/** 예시 여행(seed)에 들어 있는 맛집 정보: 검색어 → 좌표·종류. 예전 데이터 변환 때 좌표를 채우는 데 씁니다. */
type KnownFood = { lat: number | null; lng: number | null; category: FoodCategory };
let knownFoods: Map<string, KnownFood> | null = null;
function knownFood(query: string): KnownFood | undefined {
    // 처음 필요할 때 한 번만 seed.json 을 훑어 표를 만듭니다. (seed 는 version 3 형식)
    if (!knownFoods) {
        knownFoods = new Map();
        for (const day of (seed as { days: { foods: (KnownFood & { query: string })[] }[] }).days) {
            for (const food of day.foods) knownFoods.set(food.query, { lat: food.lat, lng: food.lng, category: food.category });
        }
    }
    return knownFoods.get(query);
}

/** 예시 데이터에 없는 맛집은 이름·메뉴·설명으로 카페 여부를 추측합니다. */
export function guessCategory(food: { name?: unknown; kind?: unknown; menu?: unknown }): FoodCategory {
    const text = [food.name, food.kind, food.menu].filter(item => typeof item === 'string').join(' ');
    return /카페|커피|coffee|cafe|디저트|빙수|茶寮|喫茶|珈琲/i.test(text) ? 'cafe' : 'restaurant';
}

/** 날짜·시각 문자열에서 연도(4자리)를 찾습니다. */
const yearOf = (value: unknown) => (typeof value === 'string' && /^(\d{4})-/.test(value) ? Number(value.slice(0, 4)) : null);

/**
 * version 2 데이터를 version 3 형식으로 바꿉니다.
 *  - 여행 ID: 예전 클라우드 키와 같은 LEGACY_TRIP_ID
 *  - 소개 문구: 예전 화면에 고정돼 있던 문구를 그대로 데이터로 옮김
 *  - 날짜 "10.31" + 요일 "화 · 공휴일" → ISO 날짜 + dateNote("공휴일").
 *    연도는 정보 확인일(checkedAt) → 저장 시각(updatedAt) → 올해 순으로 정하고, 월이 줄어들면 다음 해로 넘깁니다.
 *  - 장소의 time 문구 → start/end/timeNote
 *  - 장소마다 들어 있던 food → 그날의 foods 목록 (같은 검색어는 한 번만), 좌표·종류는 예시 데이터에서 찾아 채움
 */
export function migrateV2(value: Record<string, unknown>): Record<string, unknown> {
    if (!Array.isArray(value.days)) throw new Error('이 앱의 여행 일정 백업 파일이 아닙니다.');
    let year = yearOf(value.checkedAt) ?? yearOf(value.updatedAt) ?? new Date().getFullYear();
    let previousMonth = 0;
    const text = (item: unknown) => (typeof item === 'string' ? item : '');

    const days = value.days.map((day: unknown) => {
        if (!isObject(day)) throw new Error('날짜 형식이 올바르지 않습니다.');
        const { weekday, stops: rawStops, ...rest } = day;

        // ── 날짜 ──
        let date = '';
        // "화 · 공휴일" 에서 요일 뒤의 부가 설명만 메모로 남깁니다. (요일은 날짜로 자동 계산)
        let dateNote = text(weekday).split('·').slice(1).join('·').trim();
        const match = /^(\d{1,2})[./-](\d{1,2})$/.exec(text(day.date).trim());
        if (match) {
            const month = Number(match[1]);
            if (previousMonth && month < previousMonth) year += 1; // 12월 → 1월처럼 해가 바뀌는 여행
            previousMonth = month;
            const iso = `${year}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
            if (parseISODate(iso)) date = iso;
        }
        // 날짜로 읽지 못한 경우 원래 문구를 메모에 그대로 보존합니다.
        if (!date) dateNote = [text(day.date), text(weekday)].filter(Boolean).join(' ').trim().slice(0, 100);

        // ── 장소·맛집 ──
        const foods: Record<string, unknown>[] = [];
        const seen = new Set<string>();
        const stops = Array.isArray(rawStops)
            ? rawStops.map((stop: unknown) => {
                  if (!isObject(stop)) return stop; // 형식 오류는 validateTrip 에서 걸러집니다.
                  const { time, food, ...stopRest } = stop;
                  for (const item of Array.isArray(food) ? food : []) {
                      if (!isObject(item) || typeof item.query !== 'string' || seen.has(item.query)) continue;
                      seen.add(item.query);
                      const known = knownFood(item.query);
                      foods.push({
                          ...item,
                          id: `${text(day.id)}-food-${foods.length + 1}`,
                          category: known?.category ?? guessCategory(item),
                          lat: known?.lat ?? null,
                          lng: known?.lng ?? null,
                      });
                  }
                  const { start, end, note } = splitTimeText(text(time));
                  return { ...stopRest, start, end, timeNote: note };
              })
            : rawStops;
        return { ...rest, date, dateNote, stops, foods };
    });

    return {
        ...value,
        version: 3,
        id: LEGACY_TRIP_ID,
        // 예전 화면에 하드코딩돼 있던 소개 문구 (이제 여행 정보 편집에서 바꿀 수 있음)
        companion: '부모님과 둘이',
        tagline: '따뜻한 온천, 바다 너머 화산, 그리고 가을 축제.',
        highlight: '전 일정 렌터카',
        highlightSub: '실크인 2박 → 시로야마 1박',
        currency: LEGACY_CURRENCY, // 예전 앱의 금액은 모두 엔화
        days,
    };
}

/**
 * 저장소·백업·클라우드에서 읽은 임의의 값을 현재 형식의 Trip 으로 만듭니다.
 * version 1 → 2 → 3 순서로 변환한 뒤 최종적으로 version 3 검증을 통과해야 합니다.
 * @param options.id 지정하면 여행 ID 를 이 값으로 고정합니다. (클라우드 trip_key·현재 여행에 불러오기)
 */
export function parseTrip(value: unknown, options: { id?: string } = {}): Trip {
    let data = value;
    if (isObject(data) && data.version === 1) data = migrateV1(data);
    if (isObject(data) && data.version === 2) data = migrateV2(data);
    if (options.id && isObject(data)) data = { ...data, id: options.id };
    return validateTrip(data);
}

// ───────────────────────── 계산·검색 ─────────────────────────

/**
 * 하루 비용 합계 (여행 통화 기준).
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
 * 맛집 검색: 사람이 읽는 텍스트 필드만 대상으로 합니다.
 * (URL·좌표 문자열까지 걸리지 않도록 JSON 전체 검색은 하지 않음)
 */
export function foodMatches(food: Food, term: string): boolean {
    return includesTerm([food.name, food.query, food.menu, food.budget, food.kind, food.hours, food.parking, STOP_ICON_LABELS[food.category]], term);
}

/** 장소 검색: 장소의 텍스트 필드만 검색합니다. (맛집은 별도 탭에서 검색) */
export function stopMatches(stop: Stop, term: string): boolean {
    return includesTerm([stop.start, stop.end, stop.timeNote, stop.title, stop.query, stop.kind, stop.duration, stop.fee, stop.parking, stop.note], term);
}

// ───────────────────────── 새 항목 기본값 ─────────────────────────

/** 장소 추가 시 편집 화면의 기본값 (id 는 저장할 때, 좌표는 구글지도에서 가져올 때 정해짐) */
export function blankStop(): Omit<Stop, 'id' | 'lat' | 'lng'> {
    return {
        start: '', end: '', timeNote: '', title: '', query: '', duration: '30분',
        fee: '무료 또는 현장 확인', amount: 0, unit: 'adult', extraAmount: 0,
        parking: '주차 여부·요금 확인', parkingQuery: '', note: '', source: '',
        kind: '관광', icon: 'sightseeing', mode: 'driving', done: false,
    };
}

/** 맛집 추가 시 빈 값 (좌표는 위치를 가져오기 전까지 null) */
export function blankFood(): Omit<Food, 'id'> {
    return { category: 'sightseeing', name: '', query: '', lat: null, lng: null, menu: '', budget: '', kind: '', hours: '', parking: '', source: '' };
}

/** 날짜 추가 시 기본값 (id 는 저장할 때 부여) */
export function blankDay(date = ''): Omit<Day, 'id'> {
    return { date, dateNote: '', title: '새로운 하루', subtitle: '', hotel: '', pace: '', warning: '', tight: false, costNote: '', stops: [], foods: [] };
}

/** 이름만으로 새 여행 만들기 (날짜는 나중에 하나씩 추가) */
export function createTrip(title: string): Trip {
    return validateTrip({
        version: 3, id: newId(), title: title.trim(), companion: '', tagline: '', highlight: '', highlightSub: '',
        travelers: 2, currency: DEFAULT_CURRENCY, notes: '', days: [],
    });
}
