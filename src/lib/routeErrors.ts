/** 요청·키·좌표를 출력하지 않고, SDK 오류의 제한된 속성만 수집합니다. */
export function routeErrorDetails(error: unknown): string {
    const parts: string[] = [];
    const seen = new Set<unknown>();
    const visit = (value: unknown, depth: number) => {
        if (depth > 2 || value === null || value === undefined || seen.has(value)) return;
        seen.add(value);
        if (typeof value === 'string') { parts.push(value); return; }
        if (typeof value !== 'object') return;
        const fields = value as Record<string, unknown>;
        for (const key of ['name', 'code', 'status', 'message', 'endpoint'] as const) {
            if (key in fields) {
                const field = fields[key];
                if (typeof field === 'string' || typeof field === 'number') parts.push(`${key}: ${field}`);
            }
        }
        if ('cause' in value) visit(value.cause, depth + 1);
        if ('error' in value) visit(value.error, depth + 1);
    };
    visit(error, 0);
    return (parts.join('\n') || '오류 상세 정보가 없습니다.')
        .replace(/AIza[A-Za-z0-9_-]+/g, '[API 키 숨김]')
        .replace(/([?&](?:key|api_?key|token)=)[^\s&#]+/gi, '$1[숨김]')
        .slice(0, 1200);
}

export function routeErrorMessage(error: unknown): string {
    const text = routeErrorDetails(error);
    if (/RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|QUOTA|429|code: 8\b/i.test(text)) return '경로 계산 한도에 도달했습니다. 잠시 후 또는 다음 날 다시 시도하거나 구글지도 길찾기를 이용하세요.';
    if (/BILLING|billing account|payment/i.test(text)) return '경로를 이용하려면 지도 서비스의 결제 연결을 확인해 주세요.';
    if (/API.*(?:not.*enabled|not.*activated|disabled)|SERVICE_DISABLED|ApiNotActivated/i.test(text)) return '경로 안내가 아직 준비되지 않았습니다. 설정에서 지도 연결을 확인해 주세요.';
    if (/PERMISSION_DENIED|UNAUTHENTICATED|REQUEST_DENIED|403|API_KEY|code: (7|16)\b/i.test(text)) return '경로를 확인할 권한이 없습니다. 설정에서 지도 연결을 확인해 주세요.';
    if (/ROUTES_LIBRARY_UNAVAILABLE|computeRoutes.*not a function|Cannot read.*computeRoutes/i.test(text)) return '현재 로드된 Google 지도에서 경로 계산 기능을 사용할 수 없습니다. 페이지를 완전히 새로고침해 주세요.';
    if (/INVALID_ARGUMENT|InvalidValueError|invalid.*field|unknown.*field|400|code: 3\b/i.test(text)) return '경로를 확인하지 못했습니다. 문제가 계속되면 오류 상세를 확인해 주세요.';
    if (/UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED|code: (13|14)\b/i.test(text)) return 'Google 경로 서비스가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.';
    return '경로를 불러오지 못했습니다. 아래 오류 상세에서 원인을 확인해 주세요.';
}

