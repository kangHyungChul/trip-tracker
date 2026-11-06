import type { RouteData } from './routeRequests';
import { createRoutePathCache } from './routePathCache';
import { createRouteClient as createClient } from './routeClient';
export * from './routeRequests';
export * from './routeErrors';
async function compute(request: google.maps.routes.ComputeRoutesRequest): Promise<RouteData | null> {
    const { Route } = await google.maps.importLibrary('routes') as google.maps.RoutesLibrary;
    if (!Route || typeof Route.computeRoutes !== 'function') {
        throw Object.assign(new Error('Google Maps routes library does not provide Route.computeRoutes.'), { code: 'ROUTES_LIBRARY_UNAVAILABLE' });
    }
    const { routes } = await Route.computeRoutes(request);
    const route = routes?.[0];
    if (!route?.path?.length) return null;
    return {
        path: route.path.map(p => ({ lat: p.lat, lng: p.lng })),
        legs: (route.legs ?? []).map(leg => ({ distanceMeters: leg.distanceMeters, durationMillis: leg.durationMillis, path: leg.path?.map(p => ({ lat: p.lat, lng: p.lng })) })),
        warnings: route.warnings ?? [],
    };
}

export function createRouteClient(fetchRoute = compute, pathCache = createRoutePathCache()) {
    return createClient(fetchRoute, pathCache);
}
export const routeClient = createRouteClient();
export const formatRouteDistance = (meters: number) => meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
export function formatRouteDuration(millis: number | null) {
    if (millis === null || !Number.isFinite(millis)) return '시간 정보 없음';
    const minutes = Math.max(1, Math.ceil(millis / 60_000));
    return minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`;
}
