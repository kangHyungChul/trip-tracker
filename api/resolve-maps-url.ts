// Vercel 서버 함수: 구글지도 짧은 공유 링크(maps.app.goo.gl/…)를 원래의 긴 주소로 풀어 줍니다.
//
// 왜 서버가 필요한가?
//  짧은 링크에는 좌표가 없고, 브라우저는 CORS 정책 때문에 다른 사이트의 리디렉션 주소(Location 헤더)를 읽을 수 없습니다.
//  서버에서는 리디렉션을 "따라가지 않고" Location 헤더만 읽을 수 있으므로 여기서 처리합니다.
//
// 보안 (SSRF 방지)
//  임의 주소를 대신 요청해 주는 통로가 되지 않도록, 시작 주소와 모든 중간 리디렉션 주소를
//  구글 짧은 링크 도메인 또는 구글 도메인으로만 제한하고, 페이지 본문은 읽지 않습니다.
//
// 요청: GET /api/resolve-maps-url?url=https://maps.app.goo.gl/xxxx
// 응답: 200 { "url": "https://www.google.com/maps/place/…" } / 400·502 { "error": "…" }
//
// 개발 서버(npm run dev)에서는 vite.config.ts 의 미들웨어가 같은 resolveShortMapsLink 를 호출합니다.

import { isGoogleHost, isShortHost, isShortMapsLink } from '../src/lib/mapsUrl.js';

/** 리디렉션 최대 추적 횟수 (무한 리디렉션 방지) */
const MAX_REDIRECTS = 6;

/**
 * 짧은 링크를 따라가 최종 구글지도 주소를 반환합니다.
 * 실패하면 사용자에게 보여줄 한국어 메시지로 Error 를 던집니다.
 */
export async function resolveShortMapsLink(input: string): Promise<string> {
    if (!isShortMapsLink(input)) throw new Error('구글지도 짧은 공유 링크(maps.app.goo.gl)가 아닙니다.');
    let current = new URL(input);
    for (let i = 0; i < MAX_REDIRECTS; i += 1) {
        // 구글 도메인(짧은 링크 도메인 제외)에 도착하면 그 주소가 최종 장소 주소입니다.
        if (isGoogleHost(current.hostname) && !isShortHost(current.hostname)) return current.href;
        // redirect: 'manual' → 자동으로 따라가지 않고 3xx 응답의 Location 헤더를 직접 읽습니다.
        const response = await fetch(current.href, {
            method: 'GET',
            redirect: 'manual',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TripTracker/1.0)' },
            signal: AbortSignal.timeout(8000), // 8초 안에 응답이 없으면 중단
        });
        // 본문은 필요 없으므로 바로 버려 연결 자원을 돌려줍니다.
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (response.status < 300 || response.status >= 400 || !location) {
            throw new Error('짧은 링크를 풀지 못했습니다. 링크가 만료됐거나 잘못됐을 수 있습니다.');
        }
        // Location 은 상대 경로일 수도 있어 현재 주소를 기준으로 절대 주소로 만듭니다.
        const next = new URL(location, current);
        if (next.protocol !== 'https:' || !(isGoogleHost(next.hostname) || isShortHost(next.hostname))) {
            throw new Error('구글지도가 아닌 주소로 이동하는 링크입니다.');
        }
        current = next;
    }
    throw new Error('리디렉션이 너무 많습니다.');
}

/** JSON 응답 도우미 */
const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // 같은 짧은 링크는 결과가 바뀌지 않으므로 CDN 에 하루 캐시합니다.
            'Cache-Control': status === 200 ? 'public, s-maxage=86400' : 'no-store',
        },
    });

/** Vercel 함수 진입점 (웹 표준 Request/Response 방식) */
export async function GET(request: Request): Promise<Response> {
    const target = new URL(request.url).searchParams.get('url') ?? '';
    if (!target || target.length > 2000) return json({ error: 'url 파라미터가 필요합니다.' }, 400);
    try {
        return json({ url: await resolveShortMapsLink(target) });
    } catch (error) {
        const message = error instanceof Error ? error.message : '짧은 링크를 풀지 못했습니다.';
        // 입력이 잘못된 경우 400, 구글 쪽 응답 문제는 502
        return json({ error: message }, isShortMapsLink(target) ? 502 : 400);
    }
}
