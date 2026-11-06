// 여행 목록 카드·소개 영역에 쓰는 요약 표시 도우미.

import { shortDate } from './datetime';
import type { Trip } from '../types';

/**
 * 여행의 날짜 범위 "10.31 — 11.03". 날짜가 정해진 날만 대상으로 합니다.
 * 연도가 올해가 아니거나 해를 넘기면 연도를 앞에 붙입니다. (예: "2027.01.02 — 01.05")
 */
export function formatDateRange(trip: Trip): string {
    const dates = trip.days.map(day => day.date).filter(Boolean).sort(); // ISO 문자열은 사전순 = 날짜순
    if (!dates.length) return '';
    const first = dates[0];
    const last = dates[dates.length - 1];
    const thisYear = String(new Date().getFullYear());
    const withYear = first.slice(0, 4) !== thisYear || first.slice(0, 4) !== last.slice(0, 4);
    const start = (withYear ? `${first.slice(0, 4)}.` : '') + shortDate(first);
    return first === last ? start : `${start} — ${shortDate(last)}`;
}

/** 여행의 장소·맛집 개수 */
export function countItems(trip: Trip) {
    return {
        stops: trip.days.reduce((sum, day) => sum + day.stops.length, 0),
        foods: trip.candidates?.length ?? trip.days.reduce((sum, day) => sum + day.foods.length, 0),
    };
}
