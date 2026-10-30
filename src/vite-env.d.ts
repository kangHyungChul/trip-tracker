/// <reference types="vite/client" />

// import.meta.env 에서 읽는 환경변수 타입 선언 (VITE_ 접두사 변수만 브라우저에 노출됩니다)
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    /** 구형 anon JWT 키 (publishable 키가 없을 때만 사용) */
    readonly VITE_SUPABASE_ANON_KEY?: string;
    /** Google Maps 브라우저 키 (HTTP 리퍼러 제한 필수) */
    readonly VITE_GOOGLE_MAPS_API_KEY?: string;
    /** Google Maps Map ID (선택, 없으면 DEMO_MAP_ID) */
    readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
