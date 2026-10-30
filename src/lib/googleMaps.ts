// Google Maps API 키 관리.
//
// 키를 넣는 방법은 두 가지이며, 화면에서 입력한 값이 우선합니다.
//  1) 빌드 환경변수: .env.local / Vercel 의 VITE_GOOGLE_MAPS_API_KEY (+ 선택 VITE_GOOGLE_MAPS_MAP_ID)
//  2) 앱 설정 화면에서 입력 → 이 기기 localStorage 에 저장
//
// 주의: 브라우저에서 쓰는 지도 키는 어떤 방식이든 사용자에게 노출됩니다.
//       Google Cloud 콘솔에서 반드시 "웹사이트(HTTP 리퍼러)" 제한과 사용할 API 제한을 걸어 두세요.

import { GOOGLE_MAPS_CONFIG_KEY, readItem, removeItem, writeItem } from './storage';

/**
 * 고급 마커(AdvancedMarker)를 쓰려면 Map ID 가 필요합니다.
 * 따로 만든 Map ID 가 없으면 Google 이 제공하는 개발·시연용 ID 를 사용합니다.
 */
export const DEMO_MAP_ID = 'DEMO_MAP_ID';

export interface GoogleMapsConfig {
    apiKey: string;
    mapId: string;
    /** 키를 어디서 읽었는지 (설정 화면 안내용) */
    source: 'device' | 'env' | 'none';
}

/** 환경변수에 들어 있는 값 */
const envConfig = () => ({
    apiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim(),
    mapId: (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim(),
});

/** 현재 사용할 설정: 기기 저장값 → 환경변수 순서 */
export function loadGoogleMapsConfig(): GoogleMapsConfig {
    try {
        const saved = JSON.parse(readItem(GOOGLE_MAPS_CONFIG_KEY) ?? 'null') as Partial<GoogleMapsConfig> | null;
        if (saved && typeof saved.apiKey === 'string' && saved.apiKey.trim()) {
            return { apiKey: saved.apiKey.trim(), mapId: (saved.mapId ?? '').trim() || DEMO_MAP_ID, source: 'device' };
        }
    } catch {
        /* 저장값이 깨졌으면 환경변수를 사용합니다. */
    }
    const env = envConfig();
    if (env.apiKey) return { apiKey: env.apiKey, mapId: env.mapId || DEMO_MAP_ID, source: 'env' };
    return { apiKey: '', mapId: DEMO_MAP_ID, source: 'none' };
}

/** 환경변수 키가 설정돼 있는지 (설정 화면에서 "기기 키 삭제 시 되돌아갈 값" 안내용) */
export const hasEnvGoogleKey = () => envConfig().apiKey !== '';

/**
 * 이 기기에 키 저장. Google 지도 스크립트는 한 페이지에서 한 번만 불러올 수 있어
 * 바뀐 키는 새로고침 후 적용됩니다.
 */
export function saveGoogleMapsConfig(apiKey: string, mapId: string): void {
    const key = apiKey.trim();
    // 구글 API 키는 보통 "AIza" 로 시작하는 39자입니다. 형식이 크게 다르면 오타일 가능성이 높아 막습니다.
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(key)) throw new Error('Google API 키 형식을 확인하세요. (보통 AIza로 시작)');
    if (!writeItem(GOOGLE_MAPS_CONFIG_KEY, JSON.stringify({ apiKey: key, mapId: mapId.trim() }))) {
        throw new Error('키를 기기에 저장하지 못했습니다.');
    }
}

/** 기기에 저장한 키 삭제 (환경변수 키가 있으면 그것으로 돌아감) */
export const clearGoogleMapsConfig = () => removeItem(GOOGLE_MAPS_CONFIG_KEY);
