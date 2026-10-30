// 동기화 판단 로직(reconcile) 테스트: 기기·클라우드 상태 조합마다 올바른 동작을 고르는지 확인합니다.

import { describe, expect, it } from 'vitest';
import { reconcile, sameTrip, type LocalState, type RemoteState } from './sync';
import { clone, createTrip } from './trip';

/** 기기 상태 기본값: 있음 · revision 3 으로 맞춤 · 변경 없음 · 내용 다름 */
const local = (patch: Partial<LocalState> = {}): LocalState => ({ exists: true, revision: 3, dirty: false, sameContent: false, ...patch });
/** 클라우드 상태 기본값: revision 3 · 사용 중 */
const remote = (patch: Partial<RemoteState> = {}): RemoteState => ({ revision: 3, deleted: false, ...patch });

describe('reconcile: 클라우드에 없음·휴지통', () => {
    it('양쪽 다 없으면 아무것도 안 함', () => {
        expect(reconcile(local({ exists: false, revision: null }), null)).toBe('none');
    });
    it('맞춘 적 있고 변경이 없으면 다른 기기에서 삭제된 것 → 기기에서도 삭제', () => {
        expect(reconcile(local(), null)).toBe('delete-local');
        expect(reconcile(local(), remote({ deleted: true, revision: 4 }))).toBe('delete-local');
    });
    it('한 번도 안 올린 기기 여행은 자동 업로드', () => {
        expect(reconcile(local({ revision: null }), null)).toBe('upload');
    });
    it('삭제됐지만 기기에 안 올린 변경이 있으면 업로드 (DB 가 충돌로 거부 → 사용자 선택)', () => {
        expect(reconcile(local({ dirty: true }), remote({ deleted: true, revision: 4 }))).toBe('upload');
    });
});

describe('reconcile: 클라우드에 있음', () => {
    it('기기에 없으면 받기', () => {
        expect(reconcile(local({ exists: false, revision: null }), remote())).toBe('download');
    });
    it('처음 연결한 기기에 같은 내용이 있으면 기록만 맞춤', () => {
        expect(reconcile(local({ revision: null, sameContent: true }), remote())).toBe('adopt');
    });
    it('처음 연결한 기기에 다른 내용이 있으면 업로드 (충돌로 사용자 선택)', () => {
        expect(reconcile(local({ revision: null }), remote())).toBe('upload');
    });
    it('기기 변경이 있으면 업로드', () => {
        expect(reconcile(local({ dirty: true }), remote({ revision: 5 }))).toBe('upload');
    });
    it('클라우드가 더 새로우면 받기', () => {
        expect(reconcile(local(), remote({ revision: 4 }))).toBe('download');
    });
    it('같은 revision 이면 아무것도 안 함', () => {
        expect(reconcile(local(), remote())).toBe('none');
    });
});

describe('sameTrip', () => {
    it('마지막 수정 시각만 다르면 같은 내용', () => {
        const a = createTrip('테스트');
        const b = { ...clone(a), updatedAt: '2030-01-01T00:00:00.000Z' };
        expect(sameTrip(a, b)).toBe(true);
    });
    it('내용이 다르면 다름', () => {
        const a = createTrip('테스트');
        expect(sameTrip(a, { ...a, title: '다른 제목' })).toBe(false);
    });
});
