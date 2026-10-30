// 여행 데이터 검증·변환·계산 테스트. (기존 scripts/check.mjs 의 검사 항목 + 새 기능)
// 실행: npm test

import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import { gmaps, safeURL } from './links';
import { checkPublicKey, normalizeSupabaseURL } from './supabaseKey';
import { clone, dayCost, foodMatches, migrateV1, parseTrip, stopMatches, validateTrip } from './trip';
import type { Trip } from '../types';

/** 테스트마다 원본을 건드리지 않도록 검증된 복사본을 만듭니다. */
const freshSeed = (): Trip => validateTrip(clone(seed));

/** version 2 시드를 version 1 형식으로 되돌린 데이터 (마이그레이션 테스트용) */
function toV1(trip: Trip): Record<string, unknown> {
    return {
        ...trip,
        version: 1,
        days: trip.days.map((day, index) => ({
            id: index + 1,
            date: day.date, weekday: day.weekday, title: day.title, subtitle: day.subtitle,
            hotel: day.hotel, pace: day.pace, warning: day.warning,
            // v1 에는 extraAmount 가 없었습니다.
            stops: day.stops.map(({ extraAmount: _extra, ...stop }) => stop),
        })),
    };
}

describe('추천 일정 시드', () => {
    it('검증을 통과한다', () => {
        expect(() => freshSeed()).not.toThrow();
    });

    it('모든 장소·식당의 길찾기 링크가 검색어를 정확히 인코딩한다', () => {
        for (const day of freshSeed().days) {
            for (const stop of day.stops) {
                const url = new URL(gmaps(stop.query, true, stop.mode));
                expect(url.hostname).toBe('www.google.com');
                expect(url.searchParams.get('destination')).toBe(stop.query);
                // 비용·주차 안내가 비어 있지 않아야 합니다.
                expect(stop.parking.trim()).not.toBe('');
                expect(stop.fee.trim()).not.toBe('');
                for (const food of stop.food) {
                    expect(new URL(gmaps(food.query, true)).searchParams.get('destination')).toBe(food.query);
                    expect(safeURL(food.source)).not.toBe('');
                }
            }
        }
    });

    it('요청한 핵심 장소가 포함되어 있다', () => {
        const trip = freshSeed();
        const day3 = trip.days[2].stops.map(stop => stop.id);
        for (const id of ['yuno', 'kuro', 'arimura', 'akamizu', 'aqua', 'sengan', 'night']) expect(day3).toContain(id);
        expect(trip.days[3].stops.some(stop => stop.id === 'budgetback')).toBe(true);
    });
});

describe('validateTrip: 잘못된 데이터 거부', () => {
    // 각 함수가 시드를 한 군데씩 망가뜨립니다.
    const breakers: [string, (trip: Trip) => void][] = [
        ['위도 범위 초과', trip => { trip.days[0].stops[0].lat = 999; }],
        ['음수 금액', trip => { trip.days[0].stops[0].amount = -1; }],
        ['음수 추가 고정비', trip => { trip.days[0].stops[0].extraAmount = -1; }],
        ['장소 ID 중복', trip => { trip.days[0].stops.push(trip.days[0].stops[0]); }],
        ['식당 형식 오류', trip => { (trip.days[0].stops[0] as unknown as { food: string }).food = 'invalid'; }],
        ['인원 0명', trip => { trip.travelers = 0; }],
        ['날짜 0개', trip => { trip.days = []; }],
        ['날짜 ID 중복', trip => { trip.days[1].id = trip.days[0].id; }],
        ['알 수 없는 이동수단', trip => { (trip.days[0].stops[0] as unknown as { mode: string }).mode = 'flying'; }],
    ];
    it.each(breakers)('%s', (_name, breakTrip) => {
        const trip = freshSeed();
        breakTrip(trip);
        expect(() => validateTrip(trip)).toThrow();
    });

    it('날짜를 4일이 아닌 개수로 바꿔도 허용한다 (4일 고정 해제)', () => {
        const trip = freshSeed();
        trip.days = trip.days.slice(0, 2);
        expect(validateTrip(trip).days).toHaveLength(2);
        const longer = freshSeed();
        longer.days.push({ ...clone(longer.days[0]), id: 'day-extra', stops: [] });
        expect(validateTrip(longer).days).toHaveLength(5);
    });

    it('알 수 없는 키는 제거한다', () => {
        const trip = { ...freshSeed(), restaurantGroups: {} };
        expect(validateTrip(trip)).not.toHaveProperty('restaurantGroups');
    });
});

describe('version 1 → 2 변환', () => {
    it('기존 하드코딩 동작을 데이터 필드로 옮긴다', () => {
        const migrated = parseTrip(toV1(freshSeed()));
        expect(migrated.version).toBe(2);
        expect(migrated.days.map(day => day.id)).toEqual(['day-1', 'day-2', 'day-3', 'day-4']);
        // 3일차만 빠듯함 강조 + 페리 안내
        expect(migrated.days.map(day => day.tight)).toEqual([false, false, true, false]);
        expect(migrated.days[2].costNote).toContain('페리');
        // 센간엔에만 주차비 500
        const sengan = migrated.days[2].stops.find(stop => stop.id === 'sengan');
        expect(sengan?.extraAmount).toBe(500);
        expect(migrated.days[0].stops.every(stop => stop.extraAmount === 0)).toBe(true);
    });

    it('변환 결과가 새 시드와 같다', () => {
        const original = freshSeed();
        expect(parseTrip(toV1(original))).toEqual(original);
    });

    it('version 이 1·2 가 아니면 거부한다', () => {
        expect(() => parseTrip({ ...freshSeed(), version: 3 })).toThrow();
        expect(() => parseTrip(null)).toThrow();
        expect(() => migrateV1({ version: 1 })).toThrow();
    });
});

describe('비용 계산', () => {
    it('1인당은 인원수를 곱하고 차량·추가 고정비는 1회만 더한다', () => {
        const day = freshSeed().days[2];
        const expected = day.stops.reduce((sum, stop) => sum + (stop.unit === 'adult' ? stop.amount * 3 : stop.amount) + stop.extraAmount, 0);
        expect(dayCost(day, 3)).toBe(expected);
        // 기존 앱과 같은 결과인지: 센간엔 주차 500 이 포함되어야 함
        const withoutExtra = day.stops.reduce((sum, stop) => sum + (stop.unit === 'adult' ? stop.amount * 2 : stop.amount), 0);
        expect(dayCost(day, 2)).toBe(withoutExtra + 500);
    });
});

describe('검색', () => {
    const stop = freshSeed().days[2].stops.find(item => item.id === 'sengan')!;

    it('이름·메모·식당 이름으로 찾는다', () => {
        expect(stopMatches(stop, '센간엔')).toBe(true);
        expect(stopMatches(stop, '차료')).toBe(true); // 딸린 식당 이름
        expect(stopMatches(stop, '')).toBe(true);
    });

    it('URL·좌표 문자열에는 걸리지 않는다', () => {
        expect(stopMatches(stop, 'https')).toBe(false);
        expect(stopMatches(stop, 'senganen.jp')).toBe(false);
        expect(stopMatches(stop, String(stop.lat))).toBe(false);
        expect(foodMatches(stop.food[0], 'https')).toBe(false);
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
