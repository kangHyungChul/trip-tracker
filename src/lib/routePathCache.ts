export type RoutePoint = google.maps.LatLngLiteral;
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface StoredPath { key: string; savedAt: number; path: RoutePoint[] }
export const ROUTE_PATH_TTL = 24 * 60 * 60_000;
export const ROUTE_PATH_STORAGE_KEY = 'trip-tracker:route-paths:v1';
const MAX_ENTRIES = 64;
const MAX_SIZE = 750_000;

function browserStorage(): StorageAccess | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
function validPoint(point: unknown): point is RoutePoint {
    if (!point || typeof point !== 'object') return false;
    const p = point as Record<string, unknown>;
    return typeof p.lat === 'number' && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && typeof p.lng === 'number' && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
}

/** Google 서비스 약관 19.3의 좌표 임시 저장만 사용. 거리·시간·안내는 저장하지 않습니다. */
export function createRoutePathCache(storage: StorageAccess | null = browserStorage()) {
    let entries: StoredPath[] | null = null;
    const flush = () => {
        if (!storage || !entries) return;
        try {
            let serialized = JSON.stringify(entries);
            while (serialized.length > MAX_SIZE && entries.length) { entries.shift(); serialized = JSON.stringify(entries); }
            if (entries.length) storage.setItem(ROUTE_PATH_STORAGE_KEY, serialized);
            else storage.removeItem(ROUTE_PATH_STORAGE_KEY);
        } catch { /* 저장 공간이 없어도 현재 화면의 경로 계산은 계속합니다. */ }
    };
    const load = () => {
        if (entries) return;
        entries = [];
        try {
            const raw = storage?.getItem(ROUTE_PATH_STORAGE_KEY);
            if (!raw) return;
            if (raw.length > MAX_SIZE) { flush(); return; }
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) { flush(); return; }
            for (const item of parsed.slice(-MAX_ENTRIES)) {
                if (!item || typeof item !== 'object') continue;
                const row = item as Record<string, unknown>;
                if (typeof row.key !== 'string' || row.key.length > 10000 || typeof row.savedAt !== 'number' || !Number.isFinite(row.savedAt) || row.savedAt > Date.now() || Date.now() - row.savedAt >= ROUTE_PATH_TTL) continue;
                if (!Array.isArray(row.path) || row.path.length < 2 || row.path.length > 50000 || !row.path.every(validPoint)) continue;
                // 예상하지 못한 반환 필드는 읽을 때도 버립니다.
                entries.push({ key: row.key, savedAt: row.savedAt, path: row.path.map(p => ({ lat: p.lat, lng: p.lng })) });
            }
            flush();
        } catch { flush(); }
    };
    const prune = () => {
        load();
        const before = entries!.length;
        entries = entries!.filter(item => Date.now() - item.savedAt < ROUTE_PATH_TTL && item.savedAt <= Date.now());
        if (entries.length !== before) flush();
    };
    return {
        delete(key: string) {
            prune();
            entries = entries!.filter(item => item.key !== key);
            flush();
        },
        get(key: string): RoutePoint[] | undefined {
            prune();
            const index = entries!.findIndex(item => item.key === key);
            if (index < 0) return;
            const [entry] = entries!.splice(index, 1);
            entries!.push(entry); // 최근 사용 순서만 변경하고 저장 시각은 연장하지 않습니다.
            return entry.path.map(p => ({ ...p }));
        },
        set(key: string, path: RoutePoint[]) {
            prune();
            if (path.length < 2 || path.length > 50000 || !path.every(validPoint)) return;
            entries = entries!.filter(item => item.key !== key);
            entries.push({ key, savedAt: Date.now(), path: path.map(p => ({ lat: p.lat, lng: p.lng })) });
            if (entries.length > MAX_ENTRIES) entries.shift();
            flush();
        },
    };
}
