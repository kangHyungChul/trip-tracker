import { describe, expect, it, vi } from 'vitest';
import { buildRouteBatches, createRouteClient, formatRouteDuration, routeErrorDetails, routeErrorMessage, routeKey, routeProgress, type RouteData, type RouteStop } from './routes';

const stops = (count: number): RouteStop[] => Array.from({ length: count }, (_, i) => ({ lat: 31 + i / 100, lng: 130, mode: 'driving' }));
const data: RouteData = { path: [{ lat: 31, lng: 130 }, { lat: 32, lng: 130 }], legs: [{ distanceMeters: 1000, durationMillis: 120000 }], warnings: [] };

describe('무료 범위를 위한 경로 요청 구성', () => {
    it('0~1개 장소에서는 요청하지 않는다', () => {
        expect(buildRouteBatches([])).toEqual([]);
        expect(buildRouteBatches(stops(1))).toEqual([]);
    });
    it('JavaScript Routes에서 사용하는 필드를 요청한다', () => {
        expect(buildRouteBatches(stops(3))[0].request.fields).toEqual(['path', 'legs', 'warnings']);
    });
    it('도착 장소의 이동수단으로 묶고 전환 지점을 공유한다', () => {
        const input = stops(5);
        input[2].mode = input[3].mode = 'walking';
        const batches = buildRouteBatches(input);
        expect(batches.map(b => [b.start, b.end, b.mode])).toEqual([[0, 1, 'driving'], [1, 3, 'walking'], [3, 4, 'driving']]);
        expect(batches[1].request.routingPreference).toBeUndefined();
        expect(batches[0].request.routingPreference).toBe('TRAFFIC_UNAWARE');
    });
    it('중간 경유지 10곳을 넘기지 않고 모든 구간을 한 번씩 포함한다', () => {
        const batches = buildRouteBatches(stops(100));
        expect(batches.every(b => Array.from(b.request.intermediates ?? []).length <= 10)).toBe(true);
        expect(batches.reduce((n, b) => n + b.end - b.start, 0)).toBe(99);
        expect(batches[0].end).toBe(batches[1].start);
        expect(batches.every(b => b.request.optimizeWaypointOrder === false && b.request.computeAlternativeRoutes === false)).toBe(true);
    });
    it('첫 장소의 이동수단은 경로 식별값에서 제외하고 실제 구간 변경은 구별한다', () => {
        const input = stops(3);
        const key = routeKey(input);
        input[0].mode = 'walking';
        expect(routeKey(input)).toBe(key);
        input[1].mode = 'walking';
        expect(routeKey(input)).not.toBe(key);
    });
});

describe('호출·중복·오류 처리', () => {
    it('SDK가 요청을 거절하면 사용자에게 오류 코드를 보존한다', async () => {
        const fetch = vi.fn(async () => { throw Object.assign(new Error('Invalid field: legs.durationMillis'), { code: 'INVALID_ARGUMENT', endpoint: 'DIRECTIONS_ROUTE' }); });
        const response = await createRouteClient(fetch).calculate(stops(3));
        expect(response.error).toContain('경로를 확인하지 못했습니다');
        expect(response.diagnostic).toContain('INVALID_ARGUMENT');
        expect(response.diagnostic).toContain('legs.durationMillis');
    });
    it('동시 요청과 재조회에서 같은 경로 계산을 공유한다', async () => {
        const fetch = vi.fn(async () => data);
        const client = createRouteClient(fetch);
        await Promise.all([client.calculate(stops(3)), client.calculate(stops(3))]);
        await client.calculate(stops(3));
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('권한·한도 오류 이후 남은 구간은 호출하지 않고 자동 재시도하지 않는다', async () => {
        const fetch = vi.fn(async () => { throw Object.assign(new Error('quota'), { code: 'RESOURCE_EXHAUSTED' }); });
        const result = await createRouteClient(fetch).calculate(stops(25));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result.error).toContain('한도');
        expect(result.results).toEqual([]);
    });
    it('일정이 바뀌면 진행 중 응답을 버리고 남은 호출을 중단한다', async () => {
        let current = true;
        const fetch = vi.fn(async () => { current = false; return data; });
        const result = await createRouteClient(fetch).calculate(stops(25), () => current);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result.results).toEqual([]);
    });
    it('경로 없음은 직선을 생성하지 않고 이후 경로는 계산한다', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(data);
        const result = await createRouteClient(fetch).calculate(stops(13));
        expect(result.results.map(r => r.data)).toEqual([null, data]);
        expect(result.error).toBe('');
    });
    it('빈 경로 응답을 표시 중으로 안내하지 않는다', async () => {
        const result = await createRouteClient(vi.fn(async () => null)).calculate(stops(2));
        expect(routeProgress(result.results, 1)).toEqual({ confirmedLegs: 0, label: '경로 없음', hasMissingRoutes: true });
    });
    it('일부 구간만 반환됐을 때 전체 경로 완료와 구분한다', async () => {
        const fetch = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(data);
        const result = await createRouteClient(fetch).calculate(stops(13));
        expect(routeProgress(result.results, 12)).toEqual({ confirmedLegs: 1, label: '일부 경로 표시 중', hasMissingRoutes: true });
        const complete = await createRouteClient(vi.fn(async () => data)).calculate(stops(2));
        expect(routeProgress(complete.results, 1)).toEqual({ confirmedLegs: 1, label: '경로 표시 중', hasMissingRoutes: false });
    });
    it('실패한 요청은 수동 재시도할 수 있다', async () => {
        const fetch = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(data);
        const client = createRouteClient(fetch);
        expect((await client.calculate(stops(2))).error).not.toBe('');
        expect((await client.calculate(stops(2))).results[0].data).toBe(data);
    });
    it('유효 시간이 지난 결과는 다시 계산한다', async () => {
        const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
        try {
            const fetch = vi.fn(async () => data);
            const client = createRouteClient(fetch);
            await client.calculate(stops(2));
            clock.mockReturnValue(16 * 60_000);
            await client.calculate(stops(2));
            expect(fetch).toHaveBeenCalledTimes(2);
        } finally { clock.mockRestore(); }
    });
    it('시간이 없을 때 임의로 0분이라고 표시하지 않는다', () => {
        expect(formatRouteDuration(null)).toBe('시간 정보 없음');
        expect(formatRouteDuration(Infinity)).toBe('시간 정보 없음');
        expect(formatRouteDuration(3660000)).toBe('1시간 1분');
    });
});

describe('오류 진단', () => {
    it.each([
        [{ code: 'PERMISSION_DENIED', message: 'Request denied' }, '권한'],
        [{ error: { code: 403, message: 'Billing must be enabled' } }, '결제'],
        [{ status: 'PERMISSION_DENIED', message: 'Routes API has not been enabled' }, '지도 연결'],
        [{ code: 8 }, '한도'],
        [{ code: 3 }, '경로를 확인하지 못했습니다'],
        [new TypeError('Cannot read properties of undefined (reading computeRoutes)'), '새로고침'],
        [{ code: 'UNAVAILABLE' }, '서비스'],
    ])('오류에 맞는 안내를 표시한다: %j', (error, expected) => {
        expect(routeErrorMessage(error)).toContain(expected);
    });
    it('일반 객체·중첩 오류와 문자열의 상세도 읽되 요청 전체는 표시하지 않는다', () => {
        expect(routeErrorDetails({ cause: { message: 'nested failure' }, request: { secret: 'do-not-show' } })).toContain('nested failure');
        expect(routeErrorDetails({ request: { secret: 'do-not-show' } })).not.toContain('do-not-show');
        expect(routeErrorDetails('Failed to fetch')).toBe('Failed to fetch');
    });
    it('오류 메시지에 담긴 API 키를 가린다', () => {
        const secret = 'AIza' + 'a'.repeat(35);
        const details = routeErrorDetails(new Error(`key ${secret} https://example.test/?key=secret-value&token=token-value`));
        expect(details).not.toContain(secret);
        expect(details).not.toContain('secret-value');
        expect(details).not.toContain('token-value');
    });
    it('순환 cause도 안전하게 처리한다', () => {
        const error: { message: string; cause?: unknown } = { message: 'failure' };
        error.cause = error;
        expect(routeErrorDetails(error)).toBe('message: failure');
    });
});
