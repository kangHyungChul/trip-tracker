// 외부 링크 관련 유틸리티.
// React는 텍스트를 자동으로 이스케이프하지만 href 속성의 javascript: 같은 위험한 URL은 막지 못하므로
// 사용자가 입력한 URL은 반드시 safeURL을 거쳐서 사용합니다.

import type { TravelMode } from '../types';

/**
 * http/https URL만 허용하고 그 외(javascript:, data: 등)는 빈 문자열을 반환합니다.
 */
export function safeURL(value: string): string {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch {
        // URL 형식이 아니면(빈 문자열 포함) 링크를 만들지 않습니다.
        return '';
    }
}

/**
 * 구글지도 Maps URLs 규격 링크를 만듭니다. (유료 API 키 불필요)
 * @param query 검색어 또는 목적지
 * @param nav true 면 길찾기(dir), false 면 장소 검색(search)
 * @param mode 길찾기 이동수단. walking 외에는 모두 driving 으로 처리합니다.
 */
export function gmaps(query: string, nav = false, mode: TravelMode = 'driving'): string {
    const q = encodeURIComponent(query);
    if (!nav) return `https://www.google.com/maps/search/?api=1&query=${q}`;
    const travelmode = mode === 'walking' ? 'walking' : 'driving';
    return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=${travelmode}`;
}
