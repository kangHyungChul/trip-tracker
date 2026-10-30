// 구글지도 URL 또는 장소 이름 → 좌표 찾기.
//
// 처리 순서
//  1) 짧은 공유 링크(maps.app.goo.gl)면 서버 함수(/api/resolve-maps-url)로 원래 주소를 얻음
//  2) 긴 URL 에 좌표가 있으면 그대로 사용 (API 호출 없음)
//  3) 좌표가 없고 이름만 있거나, URL 이 아닌 글자를 입력했으면 Google Places 텍스트 검색으로 좌표를 찾음
//     (Google 지도 스크립트가 로드된 상태여야 함)

import { isShortMapsLink, parseMapsUrl } from './mapsUrl';

/** 찾은 위치 */
export interface FoundPlace {
    lat: number;
    lng: number;
    /** 장소 이름 (URL·검색 결과에서 얻은 경우) */
    name: string;
    /** 주소 (검색 결과에서만) */
    address: string;
}

/** 위·경도 객체 */
export interface LatLng {
    lat: number;
    lng: number;
}

/** 짧은 링크 → 긴 주소 (서버 함수 호출) */
async function expandShortLink(url: string): Promise<string> {
    const response = await fetch(`/api/resolve-maps-url?url=${encodeURIComponent(url)}`);
    // 서버 함수가 없는 환경(예: vite preview)에서는 JSON 이 아닌 응답이 올 수 있어 안전하게 읽습니다.
    const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !body.url) throw new Error(body.error || '짧은 링크를 풀지 못했습니다. 브라우저 주소창의 긴 구글지도 주소를 붙여넣어 보세요.');
    return body.url;
}

/** Google 지도 스크립트가 로드됐는지 (google 전역 객체 존재 여부) */
export const isGoogleReady = () => typeof google !== 'undefined' && typeof google.maps?.importLibrary === 'function';

/**
 * Google Places(신규) 텍스트 검색으로 장소 1곳을 찾습니다. 결과가 없으면 null.
 * @param bias 이 근처 결과를 우선 (예: 그날 첫 장소). 반경 50km
 */
export async function searchPlace(text: string, bias?: LatLng | null): Promise<FoundPlace | null> {
    if (!isGoogleReady()) throw new Error('Google 지도가 아직 로드되지 않아 이름으로 검색할 수 없습니다. 좌표가 들어 있는 구글지도 URL을 붙여넣거나 API 키 설정을 확인하세요.');
    // importLibrary: 필요한 기능(places)만 그때 불러옵니다. 반환 타입을 PlacesLibrary 로 지정해 Place 클래스를 꺼냅니다.
    const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
    const { places } = await Place.searchByText({
        textQuery: text,
        // fields: 요청한 필드만 과금되므로 꼭 필요한 것만 받습니다.
        fields: ['displayName', 'location', 'formattedAddress'],
        maxResultCount: 1,
        language: 'ko',
        ...(bias ? { locationBias: { center: bias, radius: 50_000 } } : {}),
    });
    const place = places[0];
    if (!place?.location) return null;
    return {
        lat: Number(place.location.lat().toFixed(6)),
        lng: Number(place.location.lng().toFixed(6)),
        name: place.displayName ?? '',
        address: place.formattedAddress ?? '',
    };
}

/**
 * 사용자가 입력한 구글지도 URL 또는 장소 이름으로 위치를 찾습니다.
 * 실패하면 사용자에게 보여줄 한국어 메시지로 Error 를 던집니다.
 */
export async function resolveLocation(input: string, bias?: LatLng | null): Promise<FoundPlace> {
    let text = input.trim();
    if (!text) throw new Error('구글지도 URL 또는 장소 이름을 입력하세요.');

    if (/^https?:\/\//i.test(text)) {
        // 1) 짧은 링크면 원래 주소로 풀기
        if (isShortMapsLink(text)) text = await expandShortLink(text);
        // 2) URL 분석
        const parsed = parseMapsUrl(text);
        if (!parsed) throw new Error('구글지도 링크가 아닙니다. 구글지도에서 장소를 연 뒤 공유 링크나 주소창 URL을 붙여넣으세요.');
        if (parsed.lat !== null && parsed.lng !== null) return { lat: parsed.lat, lng: parsed.lng, name: parsed.name, address: '' };
        // 3) 좌표 없이 이름만 있는 링크 → 이름으로 검색
        if (!parsed.name) throw new Error('링크에서 위치를 찾지 못했습니다. 구글지도에서 장소를 선택한 상태의 URL을 붙여넣으세요.');
        const found = await searchPlace(parsed.name, bias);
        if (!found) throw new Error(`'${parsed.name}' 위치를 찾지 못했습니다.`);
        return { ...found, name: found.name || parsed.name };
    }

    // URL 이 아니면 장소 이름·주소로 검색
    const found = await searchPlace(text, bias);
    if (!found) throw new Error(`'${text}' 위치를 찾지 못했습니다. 더 자세한 이름이나 주소를 입력해 보세요.`);
    return found;
}
