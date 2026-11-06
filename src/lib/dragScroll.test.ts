import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachDragScroll } from './dragScroll';

function setup(width = 800) {
    const view = new EventTarget();
    const element = Object.assign(new EventTarget(), { ownerDocument: { defaultView: view }, dataset: {} as Record<string, string>, scrollWidth: width, clientWidth: 200, scrollLeft: 100 });
    const cleanup = attachDragScroll(element as unknown as HTMLElement);
    const send = (target: EventTarget, type: string, props: Record<string, unknown> = {}) => {
        const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 100, clientY: 100, detail: 1 }, props);
        target.dispatchEvent(event);
        return event;
    };
    return { element, view, send, cleanup };
}
afterEach(() => { vi.useRealTimers(); });

describe('날짜 탭 마우스 드래그', () => {
    it('영역 밖까지 이어지는 마우스 드래그로 스크롤하고 직후 클릭만 차단한다', () => {
        vi.useFakeTimers();
        const { element, view, send, cleanup } = setup();
        send(element, 'pointerdown');
        expect(send(view, 'pointermove', { clientX: 60 }).defaultPrevented).toBe(true);
        expect(element.scrollLeft).toBe(140);
        expect(element.dataset.dragging).toBe('true');
        send(view, 'pointerup', { clientX: 60, buttons: 0 });
        expect(element.dataset.dragging).toBeUndefined();
        expect(send(element, 'click').defaultPrevented).toBe(true);
        vi.runAllTimers();
        expect(send(element, 'click').defaultPrevented).toBe(false);
        cleanup();
    });
    it('작은 손떨림은 드래그로 보지 않고 날짜 클릭을 유지한다', () => {
        const { element, view, send, cleanup } = setup();
        send(element, 'pointerdown');
        send(view, 'pointermove', { clientX: 98 });
        send(view, 'pointerup');
        expect(element.scrollLeft).toBe(100);
        expect(send(element, 'click').defaultPrevented).toBe(false);
        cleanup();
    });
    it.each([{ pointerType: 'touch' }, { pointerType: 'pen' }, { button: 2 }])('터치·펜·우클릭의 기본 동작을 방해하지 않는다: %j', props => {
        const { element, view, send, cleanup } = setup();
        send(element, 'pointerdown', props);
        expect(send(view, 'pointermove', { clientX: 60 }).defaultPrevented).toBe(false);
        expect(element.scrollLeft).toBe(100);
        cleanup();
    });
    it('세로 이동은 가로 드래그로 처리하지 않는다', () => {
        const { element, view, send, cleanup } = setup();
        send(element, 'pointerdown');
        expect(send(view, 'pointermove', { clientY: 150 }).defaultPrevented).toBe(false);
        expect(element.scrollLeft).toBe(100);
        cleanup();
    });
    it.each(['pointercancel', 'blur'])('%s에서 드래그를 끝내고 클릭·키보드 선택을 차단하지 않는다', type => {
        const { element, view, send, cleanup } = setup();
        send(element, 'pointerdown'); send(view, 'pointermove', { clientX: 60 });
        send(view, type);
        send(view, 'pointermove', { clientX: 20 });
        expect(element.scrollLeft).toBe(140);
        expect(element.dataset.dragging).toBeUndefined();
        expect(send(element, 'click', { detail: 0 }).defaultPrevented).toBe(false);
        cleanup();
    });
    it('내용이 넘치지 않으면 드래그를 시작하지 않으며 해제 후 이벤트를 제거한다', () => {
        const { element, view, send, cleanup } = setup(100);
        send(element, 'pointerdown'); send(view, 'pointermove', { clientX: 60 });
        expect(element.scrollLeft).toBe(100);
        element.scrollWidth = 800;
        send(element, 'pointerdown'); cleanup();
        send(view, 'pointermove', { clientX: 60 });
        expect(element.scrollLeft).toBe(100);
        expect(element.dataset.dragging).toBeUndefined();
    });
});
