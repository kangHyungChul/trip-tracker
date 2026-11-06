import { blankStop, clone, newId } from './trip';
import { STOP_ICON_LABELS } from './stopIcons';
import type { ArrivalPoint, Stop, TravelMode, Trip } from '../types';

export const stopPosition = (stop: { lat: number; lng: number; arrival?: ArrivalPoint }) => ({ lat: stop.arrival?.lat ?? stop.lat, lng: stop.arrival?.lng ?? stop.lng });
export const stopDestination = (stop: Pick<Stop, 'lat' | 'lng' | 'arrival' | 'query'>) => stop.arrival ? `${stop.arrival.lat},${stop.arrival.lng}` : stop.query;
export const arrivalLabel = (arrival: ArrivalPoint) => `${arrival.type === 'parking' ? '주차장' : '출입구'}${arrival.name ? ` · ${arrival.name}` : ''}`;

export interface ScheduleCandidateInput {
    candidateId: string;
    dayId: string;
    afterStopId: string;
    start: string;
    mode: TravelMode;
    position: { lat: number; lng: number };
}

/** 후보는 보존하고 선택한 날짜·기준 장소 바로 뒤에 별도 일정으로 추가합니다. */
export function scheduleCandidate(trip: Trip, input: ScheduleCandidateInput) {
    const next = clone(trip);
    const candidate = next.candidates?.find(item => item.id === input.candidateId);
    const day = next.days.find(item => item.id === input.dayId);
    if (!candidate || !day) throw new Error('후보 또는 날짜가 변경되었습니다. 다시 선택해 주세요.');
    if (day.stops.some(stop => stop.sourceCandidateId === candidate.id)) throw new Error('이 날짜의 일정에 이미 추가한 후보입니다.');
    const anchor = input.afterStopId ? day.stops.findIndex(stop => stop.id === input.afterStopId) : -1;
    if (input.afterStopId && anchor < 0) throw new Error('삽입 기준 장소가 삭제되었습니다. 위치를 다시 선택해 주세요.');
    const stop: Stop = {
        ...blankStop(), id: newId(), title: candidate.name, query: candidate.query,
        ...input.position, icon: candidate.category, kind: STOP_ICON_LABELS[candidate.category],
        start: input.start, mode: input.mode, sourceCandidateId: candidate.id,
        fee: candidate.budget, parking: candidate.parking,
        note: [candidate.kind, candidate.menu, candidate.hours].filter(Boolean).join('\n'), source: candidate.source,
    };
    day.stops.splice(anchor + 1, 0, stop);
    // 등록 과정에서 위치를 보완했다면 원본 후보에도 반영합니다.
    candidate.lat = input.position.lat;
    candidate.lng = input.position.lng;
    return { trip: next, stop };
}
