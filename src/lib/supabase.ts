// Supabase 연결 설정과 클라이언트 생성.
// 클라우드에는 여행마다 한 행씩 저장하며, 여행 ID 를 trip_key 로 사용합니다. (supabase/schema.sql 참고)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readItem, SUPABASE_CONFIG_KEY } from './storage';

export interface SupabaseConfig {
    url: string;
    key: string;
}

/**
 * 사용할 연결 설정을 결정합니다.
 * 1순위: 사용자가 앱 화면에서 저장한 설정(localStorage)
 * 2순위: 빌드 시 환경변수 (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, 구형 VITE_SUPABASE_ANON_KEY)
 */
export function loadSupabaseConfig(): SupabaseConfig {
    const env: SupabaseConfig = {
        url: import.meta.env.VITE_SUPABASE_URL ?? '',
        key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    };
    try {
        const saved = JSON.parse(readItem(SUPABASE_CONFIG_KEY) ?? 'null') as Partial<SupabaseConfig> | null;
        if (saved && typeof saved.url === 'string' && typeof saved.key === 'string') return { url: saved.url, key: saved.key };
    } catch {
        /* 저장값이 깨져 있으면 환경변수 설정을 사용합니다. */
    }
    return env;
}

// 같은 설정으로 클라이언트를 여러 번 만들면 Supabase 가 "Multiple GoTrueClient instances" 경고를 냅니다.
// (React StrictMode 는 개발 중 effect 를 두 번 실행하므로) 설정별로 하나만 만들어 재사용합니다.
const clients = new Map<string, SupabaseClient>();

/** 설정에 해당하는 Supabase 클라이언트를 반환합니다. url·key 가 없으면 null (기기 저장 모드) */
export function getSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
    if (!config.url || !config.key) return null;
    const cacheKey = `${config.url}\n${config.key}`;
    let client = clients.get(cacheKey);
    if (!client) {
        client = createClient(config.url, config.key, {
            // persistSession: 로그인 유지, autoRefreshToken: 토큰 자동 갱신,
            // detectSessionInUrl: 이메일 매직 링크로 돌아왔을 때 URL 의 토큰을 읽어 로그인 처리
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        clients.set(cacheKey, client);
    }
    return client;
}
