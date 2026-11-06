import { buildRouteBatches, type RouteBatch, type RouteData, type RouteResult, type RouteStop } from './routeRequests';
import { routeErrorDetails, routeErrorMessage } from './routeErrors';
import type { createRoutePathCache } from './routePathCache';

type FetchRoute = (request: google.maps.routes.ComputeRoutesRequest) => Promise<RouteData | null>;
type PathCache = ReturnType<typeof createRoutePathCache>;
interface Entry { expires: number; pending: boolean; promise: Promise<RouteData | null>; value?: RouteData | null }
const MEMORY_TTL = 15 * 60_000;
const MAX_MEMORY = 150;
const keyOf = (batch: RouteBatch) => JSON.stringify(batch.request);

export function createRouteClient(fetchRoute: FetchRoute, paths: PathCache) {
    const memory = new Map<string, Entry>();
    const legs = new Map<string, { expires: number; data: RouteData }>();
    const batchAt = (stops: RouteStop[], start: number, end: number): RouteBatch => {
        const batch = buildRouteBatches(stops.slice(start, end + 1))[0];
        return { ...batch, start, end };
    };
    const trim = () => {
        for (const [key, entry] of memory) if (!entry.pending && entry.expires <= Date.now()) memory.delete(key);
        for (const [key, entry] of legs) if (entry.expires <= Date.now()) legs.delete(key);
        for (const [key, entry] of memory) {
            if (memory.size <= MAX_MEMORY) break;
            if (!entry.pending) memory.delete(key);
        }
        while (legs.size > 500) legs.delete(legs.keys().next().value!);
    };
    const remember = (batch: RouteBatch, stops: RouteStop[], data: RouteData | null) => {
        if (data?.geometryOnly) return;
        const batchKey = keyOf(batch);
        if (!data || data.warnings.length) {
            paths.delete(batchKey);
            for (let index = batch.start; index < batch.end; index++) {
                const key = keyOf(batchAt(stops, index, index + 1));
                paths.delete(key);
                legs.delete(key);
                if (key !== batchKey && !memory.get(key)?.pending) memory.delete(key);
            }
        }
        if (!data) return;
        // 저장 정책상 안전 안내를 영구 보관할 수 없으므로 안내가 있는 응답은 메모리에서만 유지합니다.
        if (!data.warnings.length) paths.set(batchKey, data.path);
        if (data.legs.length !== batch.end - batch.start) return;
        data.legs.forEach((leg, index) => {
            if (!leg.path || leg.path.length < 2) return;
            const single = batchAt(stops, batch.start + index, batch.start + index + 1);
            const key = keyOf(single);
            const segment: RouteData = { path: leg.path, legs: [leg], warnings: data.warnings };
            legs.set(key, { expires: Date.now() + MEMORY_TTL, data: segment });
            if (!data.warnings.length) paths.set(key, leg.path);
        });
    };
    const read = (batch: RouteBatch) => {
        const key = keyOf(batch);
        const entry = memory.get(key);
        if (entry && (entry.pending || entry.expires > Date.now())) return { promise: entry.promise, ready: !entry.pending, value: entry.value };
        if (entry) memory.delete(key);
        const leg = legs.get(key);
        if (leg && leg.expires > Date.now()) return { promise: Promise.resolve(leg.data), ready: true, value: leg.data };
        const path = paths.get(key);
        if (path) {
            const value: RouteData = { path, legs: [], warnings: [], geometryOnly: true };
            return { promise: Promise.resolve(value), ready: true, value };
        }
        return null;
    };
    const request = (batch: RouteBatch, stops: RouteStop[]) => {
        const key = keyOf(batch);
        const existing = memory.get(key);
        // 명시적으로 갱신해도 진행 중인 동일 요청은 공유합니다.
        if (existing?.pending) return existing.promise;
        const entry: Entry = { expires: Infinity, pending: true, promise: Promise.resolve(null) };
        entry.promise = Promise.resolve().then(() => fetchRoute(batch.request)).catch(error => {
            if (/ZERO_RESULTS/.test(routeErrorDetails(error))) return null;
            if (memory.get(key) === entry) memory.delete(key);
            throw error;
        }).then(data => {
            entry.pending = false;
            entry.expires = Date.now() + MEMORY_TTL;
            entry.value = data;
            remember(batch, stops, data);
            trim();
            return data;
        });
        memory.set(key, entry);
        trim();
        return entry.promise;
    };

    /** 재사용 가능한 구간은 분리하고, 확인하지 않은 연속 구간만 묶어 요청합니다. */
    const plan = (stops: RouteStop[], refresh: boolean) => {
        const batches: RouteBatch[] = [];
        for (const group of buildRouteBatches(stops)) {
            let cursor = group.start;
            while (cursor < group.end) {
                const remaining = batchAt(stops, cursor, group.end);
                if (refresh || read(remaining)) { batches.push(remaining); break; }
                const single = batchAt(stops, cursor, cursor + 1);
                if (read(single)) { batches.push(single); cursor++; continue; }
                let end = cursor + 1;
                while (end < group.end && !read(batchAt(stops, end, end + 1))) end++;
                batches.push(batchAt(stops, cursor, end));
                cursor = end;
            }
        }
        return batches;
    };
    return {
        /** 날짜를 바꿀 때도 추가 호출 없이 이전 경로를 복원합니다. */
        peek(stops: RouteStop[]): RouteResult[] | null {
            const result: RouteResult[] = [];
            for (const batch of plan(stops, false)) {
                const hit = read(batch);
                if (!hit?.ready) return null;
                result.push({ batch, data: hit.value ?? null });
            }
            return result.length ? result : null;
        },
        async calculate(stops: RouteStop[], isCurrent: () => boolean = () => true, options: { refresh?: boolean } = {}) {
            const results: RouteResult[] = [];
            trim();
            for (const batch of plan(stops, !!options.refresh)) {
                if (!isCurrent()) break;
                try {
                    const cached = !options.refresh ? read(batch) : null;
                    const data = await (cached?.promise ?? request(batch, stops));
                    if (!isCurrent()) break;
                    results.push({ batch, data });
                } catch (error) {
                    return { results, error: routeErrorMessage(error), diagnostic: routeErrorDetails(error) };
                }
            }
            return { results, error: '' };
        },
    };
}
