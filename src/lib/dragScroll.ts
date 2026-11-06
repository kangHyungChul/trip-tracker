/** 터치·키보드는 기본 동작을 유지하고 마우스 왼쪽 드래그만 가로 스크롤로 처리합니다. */
export function attachDragScroll(element: HTMLElement) {
    const view = element.ownerDocument.defaultView;
    if (!view) return () => {};
    let start: { id: number; x: number; y: number; scroll: number } | null = null;
    let dragging = false;
    let suppressClick = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
        start = null;
        dragging = false;
        delete element.dataset.dragging;
        view.removeEventListener('pointermove', move);
        view.removeEventListener('pointerup', end);
        view.removeEventListener('pointercancel', cancel);
        view.removeEventListener('blur', cancel);
    };
    const cancel = () => { clear(); suppressClick = false; };
    const move = (event: PointerEvent) => {
        if (!start || event.pointerId !== start.id) return;
        if (!(event.buttons & 1)) { cancel(); return; }
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!dragging) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
            if (Math.abs(dy) > Math.abs(dx)) { cancel(); return; }
            dragging = true;
            element.dataset.dragging = 'true';
        }
        event.preventDefault();
        element.scrollLeft = start.scroll - dx;
    };
    const end = (event: PointerEvent) => {
        if (event.pointerId !== start?.id) return;
        suppressClick = dragging;
        clear();
        // pointerup 직후 발생하는 클릭만 차단하고 이후 클릭·키보드 선택은 허용합니다.
        clearTimeout(timer);
        timer = setTimeout(() => { suppressClick = false; }, 0);
    };
    const down = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || element.scrollWidth <= element.clientWidth) return;
        clear();
        clearTimeout(timer);
        suppressClick = false;
        start = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: element.scrollLeft };
        view.addEventListener('pointermove', move, { passive: false });
        view.addEventListener('pointerup', end);
        view.addEventListener('pointercancel', cancel);
        view.addEventListener('blur', cancel);
    };
    const click = (event: MouseEvent) => {
        if (!suppressClick || event.detail === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('click', click, true);
    return () => {
        clear();
        clearTimeout(timer);
        element.removeEventListener('pointerdown', down);
        element.removeEventListener('click', click, true);
    };
}
