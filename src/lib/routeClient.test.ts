import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouteClient, type RouteData, type RouteStop } from './routes';
import { createRoutePathCache } from './routePathCache';

const stops: RouteStop[] = Array.from({ length: 4 }, (_, i) => ({ lat: 37 + i / 100, lng: 127, mode: 'driving' }));
const point = (stop: RouteStop) => ({ lat: stop.lat, lng: stop.lng });
const result = (input = stops): RouteData => ({
    path: input.map(point), warnings: [],
    legs: input.slice(1).map((s, i) => ({ distanceMeters: 1000, durationMillis: 120000, path: [point(input[i]), point(s)] })),
});
const storage = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};
afterEach(() => vi.restoreAllMocks());

describe('구간 재사용과 요청 공유', () => {
    it('새 클라이언트에서도 저장된 경로를 호출 없이 복원하고 갱신에서만 거리·시간을 요청한다', async () => {
        const disk = storage();
        await createRouteClient(async () => result(), createRoutePathCache(disk)).calculate(stops);
        const fetch = vi.fn(async (_request: google.maps.routes.ComputeRoutesRequest) => result());
        const client = createRouteClient(fetch, createRoutePathCache(disk));
        expect(client.peek(stops)?.[0].data?.geometryOnly).toBe(true);
        expect((await client.calculate(stops)).results[0].data?.legs).toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
        expect((await client.calculate(stops, undefined, { refresh: true })).results[0].data?.geometryOnly).toBeUndefined();
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('중간 장소를 삽입하면 변경되지 않은 앞뒤 구간을 재사용한다', async () => {
        const fetch = vi.fn(async (_request: google.maps.routes.ComputeRoutesRequest) => result());
        const client = createRouteClient(fetch, createRoutePathCache(null));
        await client.calculate(stops);
        const changed = [stops[0], stops[1], { ...stops[1], lng: 128 }, stops[2], stops[3]];
        const response = await client.calculate(changed);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch.mock.calls[1][0]).toMatchObject({ origin: point(stops[1]), destination: point(stops[2]), intermediates: [{ location: { lat: stops[1].lat, lng: 128 } }] });
        expect(response.results.map(r => [r.batch.start, r.batch.end])).toEqual([[0, 1], [1, 3], [3, 4]]);
    });
    it('이동수단·방향·실제 도착지 변경은 기존 구간과 혼동하지 않는다', async () => {
        const fetch = vi.fn(async () => result(stops.slice(0, 2)));
        const client = createRouteClient(fetch, createRoutePathCache(null));
        await client.calculate(stops.slice(0, 2));
        await client.calculate([stops[1], stops[0]]);
        await client.calculate([stops[0], { ...stops[1], mode: 'walking' }]);
        await client.calculate([stops[0], { ...stops[1], arrival: { type: 'parking', name: '', lat: 38, lng: 128 } }]);
        expect(fetch).toHaveBeenCalledTimes(4);
    });
    it('15분 이상 진행 중인 요청과 강제 갱신도 중복 호출하지 않는다', async () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
        let resolve!: (data: RouteData) => void;
        const fetch = vi.fn(() => new Promise<RouteData>(done => { resolve = done; }));
        const client = createRouteClient(fetch, createRoutePathCache(null));
        const first = client.calculate(stops);
        await Promise.resolve();
        clock.mockReturnValue(16 * 60_000);
        const second = client.calculate(stops, undefined, { refresh: true });
        resolve(result());
        await Promise.all([first, second]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it.each([null, { ...result(), warnings: ['보행 주의'] }])('새로 확인한 경로 없음·안전 안내가 있으면 이전 영속 경로를 제거한다', async fresh => {
        const disk = storage();
        const fetch = vi.fn().mockResolvedValueOnce(result()).mockResolvedValueOnce(fresh);
        const client = createRouteClient(fetch, createRoutePathCache(disk));
        await client.calculate(stops);
        await client.calculate(stops, undefined, { refresh: true });
        const reopened = createRouteClient(async () => null, createRoutePathCache(disk));
        expect(reopened.peek(stops)).toBeNull();
        expect(reopened.peek(stops.slice(0, 2))).toBeNull();
    });
    it('갱신의 네트워크 오류로 기존 좌표를 지우지 않고 수동 재시도할 수 있다', async () => {
        const disk = storage();
        const fetch = vi.fn().mockResolvedValueOnce(result()).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(result());
        const client = createRouteClient(fetch, createRoutePathCache(disk));
        await client.calculate(stops);
        expect((await client.calculate(stops, undefined, { refresh: true })).error).not.toBe('');
        expect(createRouteClient(fetch, createRoutePathCache(disk)).peek(stops)?.[0].data?.geometryOnly).toBe(true);
        expect((await client.calculate(stops, undefined, { refresh: true })).error).toBe('');
    });
});
