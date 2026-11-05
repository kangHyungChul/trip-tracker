import type { Stop, TravelMode } from '../types';

export type RouteStop = Pick<Stop, 'lat' | 'lng' | 'mode'>;
export interface RouteBatch {
    start: number;
    end: number;
    mode: TravelMode;
    request: google.maps.routes.ComputeRoutesRequest;
}
export interface RouteData {
    path: google.maps.LatLngLiteral[];
    legs: { distanceMeters: number; durationMillis: number | null }[];
    warnings: string[];
}
export interface RouteResult { batch: RouteBatch; data: RouteData | null }

/** 이동수단은 도착 장소 기준. 시간·완료 체크·아이콘은 경로 식별값에서 제외합니다. */
export const routeKey = (stops: RouteStop[]) => JSON.stringify(stops.map((s, i) => [s.lat, s.lng, i ? s.mode : null]));

/** 같은 이동수단을 묶고 Essentials 범위(중간 경유지 10곳)를 넘기 전에 분할합니다. */
export function buildRouteBatches(stops: RouteStop[]): RouteBatch[] {
    const batches: RouteBatch[] = [];
    const point = (s: RouteStop) => ({ lat: s.lat, lng: s.lng });
    for (let start = 0; start < stops.length - 1;) {
        const mode = stops[start + 1].mode;
        let end = start + 1;
        while (end < stops.length - 1 && end - start < 11 && stops[end + 1].mode === mode) end++;
        batches.push({ start, end, mode, request: {
            origin: point(stops[start]), destination: point(stops[end]),
            intermediates: stops.slice(start + 1, end).map(s => ({ location: point(s) })),
            travelMode: mode === 'walking' ? 'WALKING' : 'DRIVING',
            ...(mode === 'driving' ? { routingPreference: 'TRAFFIC_UNAWARE' as const } : {}),
            optimizeWaypointOrder: false, computeAlternativeRoutes: false,
            fields: ['path', 'legs.distanceMeters', 'legs.durationMillis', 'warnings'], language: 'ko',
        } });
        start = end;
    }
    return batches;
}

export function routeErrorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const text = `${code} ${raw}`;
    if (/RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|QUOTA|429/i.test(text)) return '경로 계산 한도에 도달했습니다. 잠시 후 또는 다음 날 다시 시도하거나 구글지도 길찾기를 이용하세요.';
    if (/PERMISSION_DENIED|REQUEST_DENIED|403|API_KEY|BILLING/i.test(text)) return '경로 계산 권한이 없습니다. Routes API 사용 설정, API 키 제한과 결제 연결을 확인하세요.';
    return '경로를 불러오지 못했습니다. 네트워크와 Routes API 설정을 확인하고 다시 시도하세요.';
}

async function compute(request: google.maps.routes.ComputeRoutesRequest): Promise<RouteData | null> {
    const { Route } = await google.maps.importLibrary('routes') as google.maps.RoutesLibrary;
    const { routes } = await Route.computeRoutes(request);
    const route = routes?.[0];
    if (!route?.path?.length) return null;
    return {
        path: route.path.map(p => ({ lat: p.lat, lng: p.lng })),
        legs: (route.legs ?? []).map(leg => ({ distanceMeters: leg.distanceMeters, durationMillis: leg.durationMillis })),
        warnings: route.warnings ?? [],
    };
}

/** 페이지 메모리에서 결과와 진행 중인 요청을 공유합니다. DB·백업·기기 저장소에 저장하지 않습니다. */
export function createRouteClient(fetchRoute = compute) {
    const cache = new Map<string, { expires: number; promise: Promise<RouteData | null> }>();
    return {
        async calculate(stops: RouteStop[], isCurrent: () => boolean = () => true) {
            const results: RouteResult[] = [];
            for (const batch of buildRouteBatches(stops)) {
                if (!isCurrent()) break;
                const key = JSON.stringify(batch.request);
                let entry = cache.get(key);
                if (!entry || entry.expires <= Date.now()) {
                    const promise = fetchRoute(batch.request).catch(error => {
                        cache.delete(key);
                        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
                        if (/ZERO_RESULTS/.test(`${code} ${error}`)) return null;
                        throw error;
                    });
                    entry = { expires: Date.now() + 15 * 60_000, promise };
                    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
                    cache.set(key, entry);
                }
                try {
                    const data = await entry.promise;
                    if (!isCurrent()) break;
                    results.push({ batch, data });
                } catch (error) {
                    // 권한·한도·통신 오류 시 나머지 요청을 중단하고 사용자의 재시도를 기다립니다.
                    return { results, error: routeErrorMessage(error) };
                }
            }
            return { results, error: '' };
        },
    };
}

export const routeClient = createRouteClient();
export const formatRouteDistance = (meters: number) => meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
export function formatRouteDuration(millis: number | null) {
    if (millis === null || !Number.isFinite(millis)) return '시간 정보 없음';
    const minutes = Math.max(1, Math.ceil(millis / 60_000));
    return minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`;
}
