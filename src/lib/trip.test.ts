// 여행 데이터 검증·변환·계산 테스트.
// 실행: npm test

import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import { allowsDecimals, currencySymbol, formatMoney, isCurrencyCode, normalizeCurrency } from './currency';
import { gmaps, safeURL } from './links';
import { checkPublicKey, normalizeSupabaseURL } from './supabaseKey';
import { clone, createTrip, dayCost, foodMatches, guessCategory, LEGACY_TRIP_ID, migrateV1, parseTrip, stopMatches, validateTrip } from './trip';
import type { Trip } from '../types';
import { STOP_ICON_LABELS } from './stopIcons';

/** 테스트마다 원본을 건드리지 않도록 검증된 복사본을 만듭니다. */
const freshSeed = (): Trip => validateTrip(clone(seed));

/** 예전 버전(v1·v2)의 장소 1개 (시간은 자유 문구, 식당은 장소 안에) */
const legacyStop = (id: string, extra: Record<string, unknown> = {}) => ({
    id, time: '17:45 예상', title: `장소 ${id}`, query: `검색 ${id}`, lat: 31.5, lng: 130.5, duration: '1시간', fee: '무료',
    amount: 100, unit: 'adult', parking: '주차', parkingQuery: '', note: '', source: '', food: [], kind: '관광', mode: 'driving', done: false,
    ...extra,
});

/** 예전 버전의 식당 1개 */
const legacyFood = (name: string, query: string) => ({ name, query, menu: '메뉴', budget: '¥1,000', kind: '설명', hours: '', parking: '', source: '' });

describe('예시 여행 시드 (version 3)', () => {
    it('검증을 통과한다', () => {
        expect(() => freshSeed()).not.toThrow();
        expect(freshSeed().id).toBe(LEGACY_TRIP_ID);
    });

    it('모든 장소·맛집의 길찾기 링크가 검색어를 정확히 인코딩한다', () => {
        for (const day of freshSeed().days) {
            for (const stop of day.stops) {
                const url = new URL(gmaps(stop.query, true, stop.mode));
                expect(url.hostname).toBe('www.google.com');
                expect(url.searchParams.get('destination')).toBe(stop.query);
                expect(stop.parking.trim()).not.toBe('');
                expect(stop.fee.trim()).not.toBe('');
            }
            for (const food of day.foods) {
                expect(new URL(gmaps(food.query, true)).searchParams.get('destination')).toBe(food.query);
                expect(safeURL(food.source)).not.toBe('');
            }
        }
    });

    it('맛집은 날짜별 목록으로 분리돼 있고 모두 지도 좌표가 있다', () => {
        const trip = freshSeed();
        const foods = trip.days.flatMap(day => day.foods);
        expect(foods.length).toBeGreaterThan(20);
        expect(foods.every(food => food.lat !== null && food.lng !== null)).toBe(true);
        expect(foods.some(food => food.category === 'cafe')).toBe(true);
        // 같은 날 같은 검색어는 한 번만
        for (const day of trip.days) expect(new Set(day.foods.map(food => food.query)).size).toBe(day.foods.length);
    });

    it('요청한 핵심 장소와 시간 분해가 들어 있다', () => {
        const trip = freshSeed();
        const day3 = trip.days[2].stops.map(stop => stop.id);
        for (const id of ['yuno', 'kuro', 'arimura', 'akamizu', 'aqua', 'sengan', 'night']) expect(day3).toContain(id);
        expect(trip.days[3].stops.some(stop => stop.id === 'budgetback')).toBe(true);
        const night = trip.days[2].stops.find(stop => stop.id === 'night')!;
        expect([night.start, night.end]).toEqual(['18:50', '20:20']);
        expect(trip.days.map(day => day.date)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
    });
});

describe('validateTrip: 잘못된 데이터 거부', () => {
    it('모든 지도 아이콘을 저장·백업 왕복 시 보존한다', () => {
        for (const icon of Object.keys(STOP_ICON_LABELS)) {
            const trip = freshSeed();
            Object.assign(trip.days[0].stops[0], { icon });
            expect(parseTrip(JSON.parse(JSON.stringify(trip))).days[0].stops[0].icon).toBe(icon);
        }
    });
    it('아이콘 없는 기존 백업은 종류를 참고하고 명시한 아이콘은 유지한다', () => {
        const trip = freshSeed();
        delete trip.days[0].stops[0].icon;
        trip.days[0].stops[0].kind = '숙소';
        expect(validateTrip(trip).days[0].stops[0].icon).toBe('hotel');
        trip.days[0].stops[0].icon = 'cafe';
        expect(validateTrip(trip).days[0].stops[0].icon).toBe('cafe');
    });
    it('알 수 없는 아이콘은 거부한다', () => {
        const trip = freshSeed();
        Object.assign(trip.days[0].stops[0], { icon: 'invalid' });
        expect(() => validateTrip(trip)).toThrow('아이콘');
    });
    // 각 함수가 시드를 한 군데씩 망가뜨립니다.
    const breakers: [string, (trip: Trip) => void][] = [
        ['위도 범위 초과', trip => { trip.days[0].stops[0].lat = 999; }],
        ['음수 금액', trip => { trip.days[0].stops[0].amount = -1; }],
        ['음수 추가 고정비', trip => { trip.days[0].stops[0].extraAmount = -1; }],
        ['장소 ID 중복', trip => { trip.days[0].stops.push(trip.days[0].stops[0]); }],
        ['장소·맛집 ID 중복', trip => { trip.days[0].foods[0].id = trip.days[0].stops[0].id; }],
        ['맛집 좌표 한쪽만', trip => { trip.days[0].foods[0].lng = null; }],
        ['맛집 종류 오류', trip => { (trip.days[0].foods[0] as unknown as { category: string }).category = 'bar'; }],
        ['시각 형식 오류', trip => { trip.days[0].stops[0].start = '25:00'; }],
        ['날짜 형식 오류', trip => { trip.days[0].date = '10.31'; }],
        ['없는 날짜', trip => { trip.days[0].date = '2026-02-30'; }],
        ['인원 0명', trip => { trip.travelers = 0; }],
        ['날짜 ID 중복', trip => { trip.days[1].id = trip.days[0].id; }],
        ['여행 ID 형식', trip => { trip.id = '한글 아이디'; }],
        ['알 수 없는 이동수단', trip => { (trip.days[0].stops[0] as unknown as { mode: string }).mode = 'flying'; }],
        ['통화 코드 소문자', trip => { trip.currency = 'krw'; }],
        ['통화 코드 길이', trip => { trip.currency = 'KR'; }],
    ];
    it.each(breakers)('%s', (_name, breakTrip) => {
        const trip = freshSeed();
        breakTrip(trip);
        expect(() => validateTrip(trip)).toThrow();
    });

    it('날짜 0개(새 여행)부터 여러 날까지 허용한다', () => {
        expect(createTrip('새 여행').days).toHaveLength(0);
        const longer = freshSeed();
        longer.days.push({ ...clone(longer.days[0]), id: 'day-extra', stops: [], foods: [] });
        expect(validateTrip(longer).days).toHaveLength(5);
    });

    it('맛집 위치 미정(null)을 허용한다', () => {
        const trip = freshSeed();
        trip.days[0].foods[0].lat = null;
        trip.days[0].foods[0].lng = null;
        expect(validateTrip(trip).days[0].foods[0].lat).toBeNull();
    });

    it('알 수 없는 키는 제거한다', () => {
        const trip = { ...freshSeed(), restaurantGroups: {} };
        expect(validateTrip(trip)).not.toHaveProperty('restaurantGroups');
    });
});

describe('통화', () => {
    it('통화가 없는 예전 데이터는 엔화(JPY)로 본다', () => {
        // currency 필드를 빼고 검증 → 기존 데이터는 모두 엔화로 작성되었으므로 JPY
        const { currency: _omit, ...withoutCurrency } = freshSeed();
        expect(validateTrip(withoutCurrency).currency).toBe('JPY');
    });

    it('새 여행은 원화(KRW)로 시작한다', () => {
        expect(createTrip('새 여행').currency).toBe('KRW');
    });

    it('통화 코드 정규화·검사', () => {
        expect(normalizeCurrency(' usd ')).toBe('USD');
        expect(isCurrencyCode('USD')).toBe(true);
        expect(isCurrencyCode('usd')).toBe(false); // 저장 형식은 대문자만
        expect(isCurrencyCode('US')).toBe(false);
    });

    it('통화별 기호·소수 자릿수로 금액을 표시한다', () => {
        expect(formatMoney(19500, 'KRW')).toBe('₩19,500');
        expect(formatMoney(1950, 'JPY')).toBe('¥1,950');
        expect(formatMoney(19.5, 'USD')).toBe('$19.5');
        expect(currencySymbol('KRW')).toBe('₩');
        expect(allowsDecimals('KRW')).toBe(false);
        expect(allowsDecimals('USD')).toBe(true);
    });
});

describe('예전 버전 → version 3 변환', () => {
    it('v1: 하드코딩 동작(3일차 강조·센간엔 주차)을 데이터로 옮긴다', () => {
        const v1 = {
            version: 1, title: '가고시마', travelers: 2, checkedAt: '2026-10-30', notes: '',
            days: [1, 2, 3].map(n => ({
                id: n, date: `11.0${n}`, weekday: '월', title: `${n}일차`, subtitle: '', hotel: '', pace: '', warning: '',
                stops: n === 3 ? [legacyStop('sengan'), legacyStop('x3')] : [legacyStop(`s${n}`)],
            })),
        };
        const trip = parseTrip(v1);
        expect(trip.version).toBe(3);
        expect(trip.id).toBe(LEGACY_TRIP_ID);
        expect(trip.days.map(day => day.id)).toEqual(['day-1', 'day-2', 'day-3']);
        expect(trip.days.map(day => day.tight)).toEqual([false, false, true]);
        expect(trip.days[2].costNote).toContain('페리');
        expect(trip.days[2].stops.find(stop => stop.id === 'sengan')?.extraAmount).toBe(500);
        expect(trip.days[0].stops[0].extraAmount).toBe(0);
    });

    it('v2: 날짜·시간·맛집을 새 구조로 바꾸고 예시 데이터의 맛집 좌표를 채운다', () => {
        const knownQuery = '仙巌園茶寮'; // 예시 여행에 있는 카페 (좌표·종류를 알고 있음)
        const v2 = {
            version: 2, title: '가고시마', travelers: 2, checkedAt: '2026-10-30', notes: '',
            days: [
                {
                    id: 'day-1', date: '11.03', weekday: '화 · 공휴일', title: 'd1', subtitle: '', hotel: '', pace: '', warning: '', tight: false, costNote: '',
                    stops: [
                        legacyStop('a', { time: '18:50~20:20', extraAmount: 0, food: [legacyFood('센간엔 차료', knownQuery), legacyFood('새 식당', '新しい店')] }),
                        // 같은 식당이 다른 장소에도 있으면 한 번만 옮깁니다.
                        legacyStop('b', { time: '시간 미정', extraAmount: 0, food: [legacyFood('센간엔 차료', knownQuery)] }),
                    ],
                },
            ],
        };
        const trip = parseTrip(v2);
        const day = trip.days[0];
        expect(day.date).toBe('2026-11-03');
        expect(day.dateNote).toBe('공휴일');
        expect([day.stops[0].start, day.stops[0].end, day.stops[0].timeNote]).toEqual(['18:50', '20:20', '']);
        expect([day.stops[1].start, day.stops[1].timeNote]).toEqual(['', '시간 미정']);
        expect(day.foods.map(food => food.name)).toEqual(['센간엔 차료', '새 식당']);
        expect(day.foods[0].category).toBe('cafe');
        expect(day.foods[0].lat).not.toBeNull(); // 예시 데이터에서 찾은 좌표
        expect(day.foods[1].lat).toBeNull();     // 모르는 가게는 위치 미정 → 앱에서 자동 조회
        expect(trip.companion).toBe('부모님과 둘이'); // 예전 화면 고정 문구 보존
    });

    it('v2: 12월 → 1월로 넘어가면 다음 해로 계산한다', () => {
        const day = (id: string, date: string) => ({ id, date, weekday: '', title: id, subtitle: '', hotel: '', pace: '', warning: '', tight: false, costNote: '', stops: [] });
        const trip = parseTrip({ version: 2, title: '연말', travelers: 1, checkedAt: '2026-12-01', notes: '', days: [day('a', '12.31'), day('b', '01.01')] });
        expect(trip.days.map(item => item.date)).toEqual(['2026-12-31', '2027-01-01']);
    });

    it('ID 를 지정하면 그 값으로 고정한다 (클라우드 trip_key)', () => {
        expect(parseTrip(freshSeed(), { id: 'other-trip' }).id).toBe('other-trip');
    });

    it('알 수 없는 버전은 거부한다', () => {
        expect(() => parseTrip({ ...freshSeed(), version: 4 })).toThrow();
        expect(() => parseTrip(null)).toThrow();
        expect(() => migrateV1({ version: 1 })).toThrow();
    });

    it('카페 여부 추측', () => {
        expect(guessCategory({ name: 'danken COFFEE' })).toBe('cafe');
        expect(guessCategory({ name: '라멘집', menu: '돈코츠 라멘' })).toBe('restaurant');
    });
});

describe('비용 계산', () => {
    it('1인당은 인원수를 곱하고 차량·추가 고정비는 1회만 더한다', () => {
        const day = freshSeed().days[2];
        const expected = day.stops.reduce((sum, stop) => sum + (stop.unit === 'adult' ? stop.amount * 3 : stop.amount) + stop.extraAmount, 0);
        expect(dayCost(day, 3)).toBe(expected);
        // 센간엔 주차 500 이 포함되어야 함
        const withoutExtra = day.stops.reduce((sum, stop) => sum + (stop.unit === 'adult' ? stop.amount * 2 : stop.amount), 0);
        expect(dayCost(day, 2)).toBe(withoutExtra + 500);
    });
});

describe('검색', () => {
    const trip = freshSeed();
    const stop = trip.days[2].stops.find(item => item.id === 'sengan')!;
    const food = trip.days[2].foods.find(item => item.name === '센간엔 차료')!;

    it('장소는 이름·메모로, 맛집은 이름·메뉴로 찾는다', () => {
        expect(stopMatches(stop, '센간엔')).toBe(true);
        expect(stopMatches(stop, '')).toBe(true);
        expect(foodMatches(food, '시로쿠마')).toBe(true);
    });

    it('URL·좌표 문자열에는 걸리지 않는다', () => {
        expect(stopMatches(stop, 'https')).toBe(false);
        expect(stopMatches(stop, 'senganen.jp')).toBe(false);
        expect(stopMatches(stop, String(stop.lat))).toBe(false);
        expect(foodMatches(food, 'https')).toBe(false);
    });
});

describe('링크·키 안전 처리', () => {
    it('http(s) 외의 URL 은 막는다', () => {
        expect(safeURL('javascript:alert(1)')).toBe('');
        expect(safeURL('data:text/html,test')).toBe('');
        expect(safeURL('')).toBe('');
        expect(safeURL('https://example.com/a')).toBe('https://example.com/a');
    });

    it('도보 길찾기 모드', () => {
        expect(new URL(gmaps('鹿児島中央駅', true, 'walking')).searchParams.get('travelmode')).toBe('walking');
    });

    it('Supabase 공개 키만 허용한다', () => {
        // JWT 형식 테스트용: payload 만 의미 있고 서명은 임의 값
        const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.sig`;
        expect(checkPublicKey('sb_publishable_abc')).toBeNull();
        expect(checkPublicKey(jwt('anon'))).toBeNull();
        expect(checkPublicKey('sb_secret_abc')).not.toBeNull();
        expect(checkPublicKey(jwt('service_role'))).not.toBeNull();
        expect(checkPublicKey('random')).not.toBeNull();
    });

    it('Supabase URL 형식', () => {
        expect(normalizeSupabaseURL('https://abc.supabase.co/')).toBe('https://abc.supabase.co');
        expect(normalizeSupabaseURL('http://abc.supabase.co')).toBeNull();
        expect(normalizeSupabaseURL('https://evil.com')).toBeNull();
    });
});
