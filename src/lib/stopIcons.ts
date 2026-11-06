export const STOP_ICON_LABELS = {
    hotel: '호텔', shopping: '쇼핑', restaurant: '식당', cafe: '카페',
    sightseeing: '관광지', airport: '공항', subway: '전철',
    train: '기차', bus: '버스', parking: '주차장', ferry: '페리',
    rest: '휴식', hospital: '병원', car: '자동차', fuel: '주유소',
    beach: '해변', mountain: '산', park: '공원', museum: '박물관', activity: '체험', luggage: '짐 보관', other: '기타',
} as const;

export type StopIcon = keyof typeof STOP_ICON_LABELS;

export function isStopIcon(value: unknown): value is StopIcon {
    return typeof value === 'string' && Object.hasOwn(STOP_ICON_LABELS, value);
}

/** 이전 백업에는 icon 이 없습니다. 기존 종류만 참고하고 사용자 제목은 변경하지 않습니다. */
export function inferStopIcon(kind: string): StopIcon {
    if (/숙소|숙박|호텔|체크인|체크아웃/.test(kind)) return 'hotel';
    if (/공항|항공|비행/.test(kind)) return 'airport';
    if (/쇼핑|구매|마트/.test(kind)) return 'shopping';
    if (/카페|커피/.test(kind)) return 'cafe';
    if (/식사|식당|맛집|조식|중식|석식/.test(kind)) return 'restaurant';
    if (/전철|지하철/.test(kind)) return 'subway';
    if (/기차|철도/.test(kind)) return 'train';
    if (/버스/.test(kind)) return 'bus';
    if (/렌터카|자동차|반납/.test(kind)) return 'car';
    if (/주차/.test(kind)) return 'parking';
    if (/페리|선박|항구/.test(kind)) return 'ferry';
    if (/휴식|휴게/.test(kind)) return 'rest';
    if (/병원|의료/.test(kind)) return 'hospital';
    return 'sightseeing';
}
