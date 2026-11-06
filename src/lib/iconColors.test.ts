import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import { DEFAULT_ICON_COLOR, iconColor, iconForeground, isIconColor } from './iconColors';
import { parseTrip } from './trip';
import { scheduleCandidate } from './itinerary';
import { routeKey } from './routes';

describe('사용자 아이콘 색상', () => {
    it('기본 검은색과 직접 지정한 색상을 일관되게 정규화한다', () => {
        expect(DEFAULT_ICON_COLOR).toBe('#000000');
        expect(iconColor()).toBe('#000000');
        expect(iconColor('#ABCDEF')).toBe('#abcdef');
        expect(isIconColor('#fff')).toBe(false);
        expect(isIconColor('red')).toBe(false);
    });
    it('밝은 색과 어두운 색에 읽을 수 있는 아이콘 전경을 지정한다', () => {
        expect(iconForeground('#ffffff')).toBe('#182c38');
        expect(iconForeground('#000000')).toBe('#ffffff');
    });
    it('일정·후보 색상을 백업 복원하고 후보의 일정 추가에도 유지한다', () => {
        const trip = parseTrip(seed);
        trip.days[0].stops[0].iconColor = '#AABBCC';
        trip.candidates![0].iconColor = '#123456';
        const restored = parseTrip(JSON.parse(JSON.stringify(trip)));
        expect(restored.days[0].stops[0].iconColor).toBe('#aabbcc');
        const result = scheduleCandidate(restored, { candidateId: restored.candidates![0].id, dayId: restored.days[0].id, afterStopId: '', start: '', mode: 'driving', position: { lat: 37, lng: 127 } });
        expect(result.stop.iconColor).toBe('#123456');
    });
    it('잘못된 색상은 가져오기를 거절하고 색상 변경은 경로를 무효화하지 않는다', () => {
        const trip = parseTrip(seed);
        const before = routeKey(trip.days[0].stops);
        trip.days[0].stops[0].iconColor = '#ffffff';
        expect(routeKey(trip.days[0].stops)).toBe(before);
        trip.days[0].stops[0].iconColor = 'invalid';
        expect(() => parseTrip(trip)).toThrow();
    });
});
