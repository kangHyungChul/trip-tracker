import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoutePathCache, ROUTE_PATH_STORAGE_KEY, ROUTE_PATH_TTL } from './routePathCache';

export function fakeStorage() {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const path = [{ lat: 37, lng: 127 }, { lat: 38, lng: 128 }];
afterEach(() => vi.restoreAllMocks());

describe('경로 좌표 임시 저장', () => {
    it('좌표만 저장하고 다른 응답 필드와 참조 변경을 차단한다', () => {
        const storage = fakeStorage();
        const cache = createRoutePathCache(storage);
        cache.set('route', path.map(p => ({ ...p, durationMillis: 100, warnings: ['warning'] })));
        const raw = storage.getItem(ROUTE_PATH_STORAGE_KEY)!;
        expect(raw).not.toContain('duration');
        expect(raw).not.toContain('warning');
        cache.get('route')![0].lat = 0;
        expect(createRoutePathCache(storage).get('route')).toEqual(path);
    });
    it('조회로 수명을 연장하지 않고 24시간 뒤 삭제한다', () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
        const storage = fakeStorage();
        const cache = createRoutePathCache(storage);
        cache.set('route', path);
        clock.mockReturnValue(1000 + ROUTE_PATH_TTL - 1);
        expect(cache.get('route')).toEqual(path);
        clock.mockReturnValue(1000 + ROUTE_PATH_TTL);
        expect(cache.get('route')).toBeUndefined();
        expect(storage.getItem(ROUTE_PATH_STORAGE_KEY)).toBeNull();
    });
    it.each(['broken', '{}', '[{"key":"x","savedAt":0,"path":[]}]'])('잘못된 저장 내용을 제거한다: %s', raw => {
        const storage = fakeStorage(); storage.setItem(ROUTE_PATH_STORAGE_KEY, raw);
        expect(createRoutePathCache(storage).get('x')).toBeUndefined();
        expect(storage.getItem(ROUTE_PATH_STORAGE_KEY)).toBeNull();
    });
    it('미래 저장 시각과 범위를 벗어난 좌표를 거절한다', () => {
        const storage = fakeStorage();
        storage.setItem(ROUTE_PATH_STORAGE_KEY, JSON.stringify([{ key: 'future', savedAt: Date.now() + 10000, path }, { key: 'invalid', savedAt: Date.now(), path: [{ lat: 91, lng: 0 }, path[1]] }]));
        const cache = createRoutePathCache(storage);
        expect(cache.get('future')).toBeUndefined(); expect(cache.get('invalid')).toBeUndefined();
    });
    it('64개를 넘기면 오래된 항목을 제거하고 삭제를 지원한다', () => {
        const cache = createRoutePathCache(fakeStorage());
        for (let i = 0; i < 65; i++) cache.set(String(i), path);
        expect(cache.get('0')).toBeUndefined(); expect(cache.get('64')).toEqual(path);
        cache.delete('64'); expect(cache.get('64')).toBeUndefined();
    });
    it('저장 접근이 차단돼도 현재 화면의 재사용은 유지한다', () => {
        const fail = () => { throw Error('blocked'); };
        const cache = createRoutePathCache({ getItem: fail, setItem: fail, removeItem: fail });
        expect(() => cache.set('route', path)).not.toThrow();
        expect(cache.get('route')).toEqual(path);
    });
});
