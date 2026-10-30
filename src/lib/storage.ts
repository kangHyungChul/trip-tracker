// localStorage 키와 안전한 읽기/쓰기 도우미.
// 사파리 사생활 보호 모드 등에서는 localStorage 접근 자체가 예외를 던질 수 있어 모두 try/catch 로 감쌉니다.
// 저장에 실패한 값은 메모리에 임시 보관해, 적어도 현재 페이지에서는 앱이 계속 동작하게 합니다.

/** 키 앞에 붙는 공통 이름 */
const PREFIX = 'trip-tracker:';

/** 여행 ID 목록(첫 화면 표시 순서). 이 키가 없으면 "처음 실행"으로 보고 예전 데이터를 옮깁니다. */
export const TRIP_INDEX_KEY = `${PREFIX}trips`;
/** 여행 1개의 데이터 */
export const tripKey = (id: string) => `${PREFIX}trip:${id}`;
/** 여행별 마지막으로 본 날짜 ID */
export const lastDayKey = (id: string) => `${PREFIX}last-day:${id}`;
/** 여행별 마지막으로 동기화한 클라우드 revision 정보 (충돌 방지용) */
export const cloudBaseKey = (id: string) => `${PREFIX}cloud-base:${id}`;
/** 화면에서 입력한 Supabase 연결 설정 (환경변수보다 우선) */
export const SUPABASE_CONFIG_KEY = `${PREFIX}supabase-config`;
/** 화면에서 입력한 Google Maps API 키·Map ID (환경변수보다 우선) */
export const GOOGLE_MAPS_CONFIG_KEY = `${PREFIX}google-maps`;

/** 예전(가고시마 전용) 버전의 키들. 처음 실행 때 새 키로 옮기고, 원본은 백업 삼아 지우지 않습니다. */
export const LEGACY_KEYS = {
    trip: 'kagoshima-trip-v1',
    lastDay: 'kagoshima-last-day',
    cloudBase: 'kagoshima-cloud-base',
    supabaseConfig: 'kagoshima-supabase-config',
} as const;

/** localStorage 에 쓰지 못한 값의 임시 보관소 (페이지를 닫으면 사라짐) */
const memory = new Map<string, string>();

/** 값을 읽습니다. 메모리 임시값이 있으면 그것을 우선합니다. 없거나 접근이 막혀 있으면 null */
export function readItem(key: string): string | null {
    if (memory.has(key)) return memory.get(key)!;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/** 값을 씁니다. localStorage 저장 성공 여부를 반환합니다. (실패해도 메모리에는 보관) */
export function writeItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        memory.delete(key);
        return true;
    } catch {
        // 용량 초과·접근 차단: 현재 페이지에서는 이어서 쓸 수 있게 메모리에 둡니다.
        memory.set(key, value);
        return false;
    }
}

/** 값을 지웁니다. 실패해도 무시합니다. */
export function removeItem(key: string): void {
    memory.delete(key);
    try {
        localStorage.removeItem(key);
    } catch {
        /* 접근 불가 환경에서는 지울 것도 없으므로 무시 */
    }
}
