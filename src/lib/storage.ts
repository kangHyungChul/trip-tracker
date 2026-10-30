// localStorage 키와 안전한 읽기/쓰기 도우미.
// 사파리 사생활 보호 모드 등에서는 localStorage 접근 자체가 예외를 던질 수 있어 모두 try/catch 로 감쌉니다.

/** 여행 데이터 저장 키. 기존 사용자 데이터를 이어받기 위해 v1 시절 이름을 그대로 유지합니다. (내용은 version 2) */
export const TRIP_KEY = 'kagoshima-trip-v1';
/** 마지막으로 본 날짜 ID */
export const LAST_DAY_KEY = 'kagoshima-last-day';
/** 마지막으로 동기화한 클라우드 revision 정보 (충돌 방지용) */
export const CLOUD_BASE_KEY = 'kagoshima-cloud-base';
/** 화면에서 입력한 Supabase 연결 설정 (환경변수보다 우선) */
export const SUPABASE_CONFIG_KEY = 'kagoshima-supabase-config';

/** 값을 읽습니다. 접근이 막혀 있으면 null */
export function readItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/** 값을 씁니다. 성공 여부를 반환합니다. (용량 초과·접근 차단 시 false) */
export function writeItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

/** 값을 지웁니다. 실패해도 무시합니다. */
export function removeItem(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        /* 접근 불가 환경에서는 지울 것도 없으므로 무시 */
    }
}
