import { describe, expect, it } from 'vitest';
import { buildRouteBatches, routeKey } from './routes';
import { createTrip, parseTrip, validateTrip } from './trip';
import { arrivalLabel, scheduleCandidate, stopDestination, stopPosition } from './itinerary';
import { STOP_ICON_LABELS } from './stopIcons';
import seed from '../data/seed.json';

const fresh = () => parseTrip(seed);
const input = (trip = fresh()) => ({ candidateId: trip.candidates![0].id, dayId: trip.days[0].id, afterStopId: '', start: '12:00', mode: 'walking' as const, position: { lat: 31.5, lng: 130.5 } });

describe('여행 공통 후보', () => {
    it('모든 카테고리는 날짜 없이 저장·백업 왕복할 수 있다', () => {
        for (const category of Object.keys(STOP_ICON_LABELS)) {
            const trip = createTrip('날짜 미정 여행');
            trip.candidates = [{ ...fresh().candidates![0], category: category as keyof typeof STOP_ICON_LABELS }];
            const restored = parseTrip(JSON.parse(JSON.stringify(trip)));
            expect(restored.days).toHaveLength(0);
            expect(restored.candidates![0].category).toBe(category);
        }
    });
    it('날짜를 삭제해도 후보함은 유지된다', () => {
        const trip = fresh();
        const candidates = trip.candidates;
        trip.days = [];
        expect(validateTrip(trip).candidates).toEqual(candidates);
    });
    it('후보를 유지하고 지정 장소 바로 뒤에 삽입하며 원본을 변경하지 않는다', () => {
        const trip = fresh();
        const options = { ...input(trip), afterStopId: trip.days[0].stops[0].id };
        const result = scheduleCandidate(trip, options);
        expect(result.trip.days[0].stops[1]).toEqual(result.stop);
        expect(result.stop.sourceCandidateId).toBe(options.candidateId);
        expect(result.stop.id).not.toBe(options.candidateId);
        expect(result.stop.start).toBe('12:00');
        expect(result.stop.mode).toBe('walking');
        expect(result.trip.candidates).toHaveLength(trip.candidates!.length);
        expect(trip.days[0].stops).not.toContainEqual(result.stop);
        expect(validateTrip(result.trip).days[0].stops[1].sourceCandidateId).toBe(options.candidateId);
    });
    it('다른 날짜·맨 앞·맨 뒤에도 삽입할 수 있다', () => {
        const trip = fresh();
        const front = scheduleCandidate(trip, { ...input(trip), dayId: trip.days[1].id });
        expect(front.trip.days[1].stops[0].id).toBe(front.stop.id);
        const lastDay = trip.days[2];
        const end = scheduleCandidate(trip, { ...input(trip), dayId: lastDay.id, afterStopId: lastDay.stops.at(-1)!.id });
        expect(end.trip.days[2].stops.at(-1)!.id).toBe(end.stop.id);
    });
    it('같은 날짜 중복 추가와 삭제된 삽입 기준을 거부한다', () => {
        const first = scheduleCandidate(fresh(), input());
        expect(() => scheduleCandidate(first.trip, input(first.trip))).toThrow('이미');
        expect(() => scheduleCandidate(fresh(), { ...input(), afterStopId: 'deleted' })).toThrow('삭제');
        expect(() => scheduleCandidate(fresh(), { ...input(), dayId: 'deleted' })).toThrow('변경');
    });
    it('후보를 삭제해도 등록한 일정은 유지된다', () => {
        const result = scheduleCandidate(fresh(), input());
        result.trip.candidates = [];
        expect(validateTrip(result.trip).days[0].stops[0].id).toBe(result.stop.id);
    });
});

describe('실제 도착 지점', () => {
    it('장소 위치를 보존하면서 지도·경로·길찾기에 도착 좌표를 사용한다', () => {
        const trip = fresh();
        const stop = trip.days[0].stops[1];
        const original = { lat: stop.lat, lng: stop.lng };
        const key = routeKey(trip.days[0].stops);
        stop.arrival = { type: 'parking', name: '동문 주차장', lat: 31.123, lng: 130.456 };
        expect(stopPosition(stop)).toEqual({ lat: 31.123, lng: 130.456 });
        expect(stopDestination(stop)).toBe('31.123,130.456');
        expect(arrivalLabel(stop.arrival)).toBe('주차장 · 동문 주차장');
        expect(routeKey(trip.days[0].stops)).not.toBe(key);
        const batch = buildRouteBatches(trip.days[0].stops.slice(0, 2))[0];
        expect(batch.request.destination).toEqual(stopPosition(stop));
        const restored = parseTrip(JSON.parse(JSON.stringify(trip))).days[0].stops[1];
        expect(restored.arrival).toEqual(stop.arrival);
        expect({ lat: restored.lat, lng: restored.lng }).toEqual(original);
        delete stop.arrival;
        expect(stopPosition(stop)).toEqual(original);
        expect(stopDestination(stop)).toBe(stop.query);
    });
    it('잘못된 도착 지점과 좌표를 거부한다', () => {
        for (const arrival of [{ type: 'exit', name: '', lat: 30, lng: 130 }, { type: 'entrance', name: '', lat: 999, lng: 130 }, { type: 'parking', name: '', lat: 30 }]) {
            const trip = fresh();
            Object.assign(trip.days[0].stops[0], { arrival });
            expect(() => validateTrip(trip)).toThrow();
        }
    });
});
