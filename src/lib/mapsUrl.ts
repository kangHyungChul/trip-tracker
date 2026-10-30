// 구글지도 URL 해석 (순수 함수 — 네트워크 없이 문자열만 분석).
//
// 구글지도 링크에는 여러 형태가 있습니다.
//  1) 장소 링크:   https://www.google.com/maps/place/가게이름/@31.59,130.55,17z/data=!3m1!4b1!4m6!3m5!...!3d31.5912!4d130.5539...
//                 → data 안의 !3d(위도)!4d(경도)가 실제 장소 핀 좌표, @위도,경도 는 화면 중심 좌표
//  2) 검색·좌표:   https://www.google.com/maps/search/?api=1&query=31.59,130.55  /  https://maps.google.com/?q=31.59,130.55
//  3) 이름만:      https://maps.google.com/?q=MINATO+CAFE&ftid=…   (좌표 없음 → 이름으로 검색해야 함)
//  4) 짧은 공유:   https://maps.app.goo.gl/AbCd…  (좌표 없음 → 서버에서 원래 주소로 풀어야 함)

/** 좌표 + (있다면) 장소 이름 */
export interface ParsedMapsUrl {
    lat: number | null;
    lng: number | null;
    /** URL 에서 읽은 장소 이름·검색어 (없으면 빈 문자열) */
    name: string;
}

/** 짧은 공유 링크 도메인. 브라우저에서 바로 풀 수 없어 /api/resolve-maps-url 서버 함수를 거칩니다. */
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co']);

/** google.com, google.co.jp, maps.google.com 같은 구글 도메인인지 */
export function isGoogleHost(hostname: string): boolean {
    return /^([a-z0-9-]+\.)*google\.[a-z]{2,3}(\.[a-z]{2})?$/i.test(hostname);
}

/** 짧은 공유 링크인지 (goo.gl 은 /maps 경로만, g.co 는 /kgs 경로만 구글지도 링크) */
export function isShortMapsLink(value: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
        if (url.hostname === 'maps.app.goo.gl') return true;
        if (url.hostname === 'goo.gl') return url.pathname.startsWith('/maps');
        if (url.hostname === 'g.co') return url.pathname.startsWith('/kgs');
        return false;
    } catch {
        return false;
    }
}

/** 짧은 링크 처리용 도메인 허용 여부 (서버 함수의 리디렉션 추적에서도 사용) */
export const isShortHost = (hostname: string) => SHORT_HOSTS.has(hostname);

/** 위도·경도 범위 검사 */
const validCoords = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** "31.59,130.55" 같은 좌표 문자열 → [위도, 경도] */
function coordsFromText(text: string): [number, number] | null {
    const match = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
    if (!match) return null;
    const [lat, lng] = [Number(match[1]), Number(match[2])];
    return validCoords(lat, lng) ? [lat, lng] : null;
}

/** URL 경로 조각의 + 와 %XX 인코딩을 사람이 읽는 글자로 되돌립니다. */
function decodePart(part: string): string {
    try {
        return decodeURIComponent(part.replace(/\+/g, ' ')).trim();
    } catch {
        return part.replace(/\+/g, ' ').trim();
    }
}

/**
 * 구글지도 URL 에서 좌표와 장소 이름을 읽습니다.
 * 구글지도 링크가 아니거나 URL 형식이 아니면 null 을 반환합니다.
 */
export function parseMapsUrl(value: string): ParsedMapsUrl | null {
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        return null;
    }
    if (!isGoogleHost(url.hostname)) return null;
    const full = decodePart(url.href);
    const result: ParsedMapsUrl = { lat: null, lng: null, name: '' };

    // ── 이름: /maps/place/이름/… 또는 /maps/search/이름/… ──
    const pathName = /\/maps\/(?:place|search)\/([^/@?]+)/.exec(url.pathname);
    if (pathName) result.name = decodePart(pathName[1]);

    // ── 좌표 1순위: data 파라미터의 !3d위도!4d경도 (실제 장소 핀) ──
    const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(full);
    if (pin && validCoords(Number(pin[1]), Number(pin[2]))) {
        result.lat = Number(pin[1]);
        result.lng = Number(pin[2]);
    }

    // ── 좌표 2순위: 검색 파라미터(q, query, ll, destination, center)에 좌표가 직접 들어 있는 경우 ──
    for (const key of ['q', 'query', 'll', 'destination', 'center', 'daddr']) {
        const param = url.searchParams.get(key);
        if (!param) continue;
        const coords = coordsFromText(param.replace(/^loc:/, ''));
        if (coords && result.lat === null) [result.lat, result.lng] = coords;
        // 좌표가 아닌 글자면 장소 이름·검색어로 사용합니다.
        else if (!coords && !result.name) result.name = param.trim();
    }

    // ── 좌표 3순위: 경로의 @위도,경도,확대 (화면 중심. 장소 핀과 약간 다를 수 있음) ──
    if (result.lat === null) {
        const center = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname);
        if (center && validCoords(Number(center[1]), Number(center[2]))) {
            result.lat = Number(center[1]);
            result.lng = Number(center[2]);
        }
    }

    // 좌표를 소수점 6자리(약 10cm)로 정리합니다.
    if (result.lat !== null && result.lng !== null) {
        result.lat = Number(result.lat.toFixed(6));
        result.lng = Number(result.lng.toFixed(6));
    }
    return result;
}
