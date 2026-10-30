// Supabase 공개 키 검사 함수.
// 브라우저(연결 설정 화면)와 Node(vite.config.ts 빌드 검사) 양쪽에서 쓰므로
// DOM이나 Node 전용 API에 의존하지 않고 전역 atob만 사용합니다. (Node 16+ 에도 atob 존재)

/**
 * 공개해도 되는 Supabase 키인지 검사합니다.
 * @returns 문제가 없으면 null, 문제가 있으면 사용자에게 보여줄 오류 문구
 */
export function checkPublicKey(key: string): string | null {
    // 서버 전용 비밀 키는 정적 앱에 절대 넣으면 안 되므로 가장 먼저 거부합니다.
    if (key.startsWith('sb_secret_')) return '서버 비밀 키(sb_secret_)는 사용할 수 없습니다. 공개 publishable 키를 사용하세요.';
    // 구형 키는 JWT(eyJ로 시작) 형식입니다. payload의 role이 anon인지 확인합니다.
    if (key.startsWith('eyJ')) {
        try {
            // JWT는 header.payload.signature 구조이고 payload는 base64url 인코딩입니다.
            // base64url → base64 로 바꾼 뒤 atob로 디코딩합니다.
            const payload = key.split('.')[1] ?? '';
            const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
            // service_role 같은 관리자 키는 RLS를 우회하므로 거부합니다.
            if (claims.role !== 'anon') return 'anon 역할의 공개 키만 사용할 수 있습니다.';
            return null;
        } catch {
            return '공개 키 형식을 확인하세요.';
        }
    }
    // 신형 공개 키 형식
    if (key.startsWith('sb_publishable_')) return null;
    return 'publishable 또는 anon 키를 입력하세요.';
}

/**
 * Supabase 프로젝트 URL 형식을 검사합니다. (https://xxxx.supabase.co)
 * @returns 끝의 슬래시를 제거한 URL, 형식이 틀리면 null
 */
export function normalizeSupabaseURL(value: string): string | null {
    const trimmed = value.trim().replace(/\/$/, '');
    try {
        const url = new URL(trimmed);
        // 반드시 https 이고 supabase.co 하위 도메인이어야 합니다.
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return null;
        return trimmed;
    } catch {
        return null;
    }
}
