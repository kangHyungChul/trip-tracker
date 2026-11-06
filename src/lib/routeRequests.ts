import type { Stop, TravelMode } from '../types';
import { stopPosition } from './itinerary';

export type RouteStop = Pick<Stop, 'lat' | 'lng' | 'mode' | 'arrival'>;
export interface RouteBatch {
    start: number;
    end: number;
    mode: TravelMode;
    request: google.maps.routes.ComputeRoutesRequest;
}
export interface RouteData {
    path: google.maps.LatLngLiteral[];
    legs: { distanceMeters: number; durationMillis: number | null; path?: google.maps.LatLngLiteral[] }[];
    warnings: string[];
    geometryOnly?: boolean;
}
export interface RouteResult { batch: RouteBatch; data: RouteData | null }

export function routeProgress(results: RouteResult[], totalLegs: number) {
    const confirmedLegs = results.reduce((sum, result) => sum + (result.data ? result.batch.end - result.batch.start : 0), 0);
    return {
        confirmedLegs,
        label: confirmedLegs === 0 ? '경로 없음' : confirmedLegs < totalLegs ? '일부 경로 표시 중' : '경로 표시 중',
        hasMissingRoutes: confirmedLegs < totalLegs,
    };
}

/** 이동수단은 도착 장소 기준. 시간·완료 체크·아이콘은 경로 식별값에서 제외합니다. */
export const routeKey = (stops: RouteStop[]) => JSON.stringify(stops.map((s, i) => { const p = stopPosition(s); return [p.lat, p.lng, i ? s.mode : null]; }));

/** 같은 이동수단을 묶고 Essentials 범위(중간 경유지 10곳)를 넘기 전에 분할합니다. */
export function buildRouteBatches(stops: RouteStop[]): RouteBatch[] {
    const batches: RouteBatch[] = [];
    const point = stopPosition;
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
            // Maps JavaScript 라이브러리의 Route 속성명을 사용합니다 (REST 필드 마스크와 구분).
            fields: ['path', 'legs', 'warnings'], language: 'ko',
        } });
        start = end;
    }
    return batches;
}

