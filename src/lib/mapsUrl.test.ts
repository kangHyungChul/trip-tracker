// 구글지도 URL 해석·날짜/시간 도우미 테스트.

import { describe, expect, it } from 'vitest';
import { isGoogleHost, isShortMapsLink, parseMapsUrl } from './mapsUrl';
import { addDays, formatTime, shortDate, splitTimeText, weekdayOf } from './datetime';
import { formatDateRange } from './tripSummary';
import { createTrip } from './trip';

describe('parseMapsUrl', () => {
    it('장소 링크: data 의 !3d!4d(실제 핀)를 @화면중심보다 우선한다', () => {
        const url = 'https://www.google.com/maps/place/MINATO+CAFE/@31.5925,130.5980,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d31.592315!4d130.599934!16s';
        expect(parseMapsUrl(url)).toEqual({ lat: 31.592315, lng: 130.599934, name: 'MINATO CAFE' });
    });

    it('인코딩된 일본어 장소 이름을 읽는다', () => {
        const url = `https://www.google.co.jp/maps/place/${encodeURIComponent('仙巌園茶寮')}/@31.618,130.578,17z`;
        expect(parseMapsUrl(url)).toEqual({ lat: 31.618, lng: 130.578, name: '仙巌園茶寮' });
    });

    it('검색 파라미터의 좌표', () => {
        expect(parseMapsUrl('https://www.google.com/maps/search/?api=1&query=31.59,130.55')).toMatchObject({ lat: 31.59, lng: 130.55 });
        expect(parseMapsUrl('https://maps.google.com/?q=31.5,130.5')).toMatchObject({ lat: 31.5, lng: 130.5 });
    });

    it('좌표 없이 이름만 있는 링크', () => {
        expect(parseMapsUrl('https://maps.google.com/?q=MINATO+CAFE&ftid=0x1:0x2')).toEqual({ lat: null, lng: null, name: 'MINATO CAFE' });
    });

    it('구글지도가 아니거나 URL 이 아니면 null', () => {
        expect(parseMapsUrl('https://evil.example.com/maps/@31,130')).toBeNull();
        expect(parseMapsUrl('google.com 아님')).toBeNull();
    });

    it('범위를 벗어난 좌표는 무시한다', () => {
        expect(parseMapsUrl('https://www.google.com/maps/@95.1,130.5,15z')).toMatchObject({ lat: null, lng: null });
    });
});

describe('도메인 판별', () => {
    it('짧은 공유 링크', () => {
        expect(isShortMapsLink('https://maps.app.goo.gl/AbCd123')).toBe(true);
        expect(isShortMapsLink('https://goo.gl/maps/AbCd')).toBe(true);
        expect(isShortMapsLink('https://goo.gl/other')).toBe(false);
        expect(isShortMapsLink('https://www.google.com/maps')).toBe(false);
    });

    it('구글 도메인', () => {
        expect(isGoogleHost('www.google.com')).toBe(true);
        expect(isGoogleHost('maps.google.co.jp')).toBe(true);
        expect(isGoogleHost('google.com.evil.io')).toBe(false);
        expect(isGoogleHost('notgoogle.com')).toBe(false);
    });
});

describe('날짜·시간', () => {
    it('예전 자유 문구 시간 분해', () => {
        expect(splitTimeText('17:45 예상')).toEqual({ start: '17:45', end: '', note: '예상' });
        expect(splitTimeText('18:50~20:20')).toEqual({ start: '18:50', end: '20:20', note: '' });
        expect(splitTimeText('9:05')).toEqual({ start: '09:05', end: '', note: '' });
        expect(splitTimeText('시간 미정')).toEqual({ start: '', end: '', note: '시간 미정' });
        expect(splitTimeText('25:00 늦게')).toEqual({ start: '', end: '', note: '25:00 늦게' });
    });

    it('시간 표시', () => {
        expect(formatTime('18:50', '20:20', '')).toBe('18:50~20:20');
        expect(formatTime('17:45', '', '예상')).toBe('17:45 예상');
        expect(formatTime('', '16:00', '')).toBe('~16:00');
        expect(formatTime('', '', '')).toBe('시간 미정');
    });

    it('날짜 계산·표시', () => {
        expect(shortDate('2026-10-31')).toBe('10.31');
        expect(weekdayOf('2026-10-31')).toBe('토');
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('', 1)).toBe('');
    });

    it('여행 날짜 범위', () => {
        const trip = createTrip('테스트');
        expect(formatDateRange(trip)).toBe('');
        const year = new Date().getFullYear();
        trip.days = [`${year}-03-01`, `${year}-03-04`].map((date, i) => ({
            id: `d${i}`, date, dateNote: '', title: '', subtitle: '', hotel: '', pace: '', warning: '', tight: false, costNote: '', stops: [], foods: [],
        }));
        expect(formatDateRange(trip)).toBe('03.01 — 03.04');
    });
});
