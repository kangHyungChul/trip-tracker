// 휴대폰 화면용 바텀시트: 지도 위에 겹쳐 아래에서 올라오는 목록 패널 (네이버지도 방식).
//  - 높이 3단계: peek(손잡이·제목만) / half(절반) / full(거의 전체)
//  - 손잡이·제목 영역을 쓸어올리거나 내리면 높이가 바뀌고, 손을 떼면 가장 가까운 단계(빠르게 튕기면 그 방향 다음 단계)에 멈춥니다.
//  - 목록 부분: full 이 아닐 때는 쓸어올리면 시트가 커지고, full 일 때는 목록이 스크롤됩니다.
//    full 에서 목록이 맨 위일 때 아래로 쓸면 시트가 내려갑니다.
//  - 손잡이를 탭하면 peek → half → full → half 순으로 바뀝니다.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export type SheetSnap = 'peek' | 'half' | 'full';
/** 단계별 시트 높이(px) */
export type SheetHeights = Record<SheetSnap, number>;

/** full 일 때도 위쪽에 남겨 둘 지도 높이(px). 지도가 아래에 있다는 걸 알 수 있게 합니다. */
const FULL_GAP = 40;
/** 이 속도(px/ms)보다 빠르게 튕기면 가까운 단계 대신 움직인 방향의 다음 단계로 갑니다. */
const FLICK_SPEED = 0.4;
/** 손가락이 이만큼(px) 움직여야 시트 끌기인지 목록 스크롤인지 판단합니다. (단순 탭과 구분) */
const DRAG_SLOP = 6;
/** 탭할 때 바뀌는 다음 단계 */
const NEXT_ON_TAP: Record<SheetSnap, SheetSnap> = { peek: 'half', half: 'full', full: 'half' };

interface BottomSheetProps {
    snap: SheetSnap;
    onSnapChange: (snap: SheetSnap) => void;
    /** 단계별 높이가 바뀔 때(화면 크기·제목 높이 변화) 알려 줍니다. 지도 여백 계산용 */
    onHeightsChange: (heights: SheetHeights) => void;
    /** 손잡이 아래 고정 영역 (peek 일 때 보이는 부분) */
    header: ReactNode;
    /** 스크롤되는 본문 */
    children: ReactNode;
    /** 본문 스크롤 영역 요소 (바깥에서 특정 카드로 스크롤할 때 사용) */
    scrollerRef: RefObject<HTMLDivElement | null>;
}

/** 값을 최소~최대 사이로 자르기 */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 손을 뗀 높이와 속도로 멈출 단계 고르기 (velocity > 0 = 위로 = 커지는 방향) */
function pickSnap(height: number, velocity: number, heights: SheetHeights): SheetSnap {
    const order: SheetSnap[] = ['peek', 'half', 'full']; // 작은 것부터
    if (velocity > FLICK_SPEED) return order.find(snap => heights[snap] > height + 1) ?? 'full';
    if (velocity < -FLICK_SPEED) return [...order].reverse().find(snap => heights[snap] < height - 1) ?? 'peek';
    // 천천히 놓았으면 가장 가까운 단계
    return order.reduce((best, snap) => (Math.abs(heights[snap] - height) < Math.abs(heights[best] - height) ? snap : best));
}

export function BottomSheet({ snap, onSnapChange, onHeightsChange, header, children, scrollerRef }: BottomSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    /** 시트가 놓인 영역(지도 영역) 높이 */
    const [areaHeight, setAreaHeight] = useState(0);
    /** 손잡이 + 제목 영역 높이 = peek 높이 */
    const [headerHeight, setHeaderHeight] = useState(0);
    /** 끄는 중의 높이. null 이면 단계 높이를 쓰고 애니메이션으로 이동 */
    const [dragHeight, setDragHeight] = useState<number | null>(null);

    // 단계별 높이. half 는 영역의 절반, full 은 위에 FULL_GAP 만큼 지도를 남긴 높이 (peek 보다 작아지지 않게)
    const peek = headerHeight;
    const half = Math.max(peek, Math.round(areaHeight * 0.5));
    const full = Math.max(half, areaHeight - FULL_GAP);
    const height = dragHeight ?? { peek, half, full }[snap];

    // 터치 처리 함수(한 번만 등록)에서 최신 값을 읽기 위한 ref
    const live = useRef({ snap, heights: { peek, half, full }, onSnapChange });
    useLayoutEffect(() => {
        live.current = { snap, heights: { peek, half, full }, onSnapChange };
    });

    // 영역·제목 크기를 재고, 바뀔 때마다 다시 잽니다. (화면 회전, 날짜 제목 길이 변화 등)
    useLayoutEffect(() => {
        const area = sheetRef.current?.parentElement;
        const head = headerRef.current;
        if (!area || !head) return;
        const measure = () => {
            setAreaHeight(area.clientHeight);
            setHeaderHeight(head.offsetHeight);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(area);
        observer.observe(head);
        return () => observer.disconnect();
    }, []);

    // 단계 높이가 바뀌면 바깥(지도 여백 계산)에 알려 줍니다.
    useEffect(() => {
        if (areaHeight > 0) onHeightsChange({ peek, half, full });
    }, [peek, half, full, areaHeight, onHeightsChange]);

    // ── 터치로 끌기 ──
    // touchmove 에서 preventDefault(목록 스크롤 막기)를 하려면 passive:false 가 필요해 React 이벤트 대신 직접 등록합니다.
    useEffect(() => {
        const sheet = sheetRef.current;
        if (!sheet) return;
        /** 이번 터치 시작 정보. null 이면 이번 터치는 무시 */
        let start: { x: number; y: number; height: number; fromHeader: boolean; atTop: boolean } | null = null;
        /** undecided: 아직 판단 전 / drag: 시트 끌기 / scroll: 목록 스크롤(브라우저 기본 동작) */
        let mode: 'undecided' | 'drag' | 'scroll' = 'undecided';
        let lastY = 0;
        let lastTime = 0;
        let velocity = 0;

        const onStart = (event: TouchEvent) => {
            const target = event.target as Element;
            // 두 손가락이거나, 순서 편집 손잡이처럼 자체 끌기가 있는 요소에서 시작하면 시트는 움직이지 않습니다.
            if (event.touches.length !== 1 || target.closest('[data-sheet-nodrag]')) {
                start = null;
                return;
            }
            const touch = event.touches[0];
            const { snap: current, heights } = live.current;
            start = {
                x: touch.clientX,
                y: touch.clientY,
                height: heights[current],
                fromHeader: !!headerRef.current?.contains(target),
                atTop: (scrollerRef.current?.scrollTop ?? 0) <= 0,
            };
            mode = 'undecided';
            lastY = touch.clientY;
            lastTime = event.timeStamp;
            velocity = 0;
        };

        const onMove = (event: TouchEvent) => {
            if (!start || event.touches.length !== 1) return;
            const touch = event.touches[0];
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y; // 양수 = 아래로
            if (mode === 'undecided') {
                if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
                const vertical = Math.abs(dy) > Math.abs(dx);
                // 시트를 끄는 경우: 세로 이동이면서 ① 손잡이·제목에서 시작 ② 아직 full 이 아님 ③ full 인데 목록 맨 위에서 아래로
                const drag = vertical && (start.fromHeader || live.current.snap !== 'full' || (start.atTop && dy > 0));
                mode = drag ? 'drag' : 'scroll';
            }
            if (mode !== 'drag') return;
            event.preventDefault(); // 목록 스크롤·당겨서 새로고침 막기
            const { heights } = live.current;
            // 손가락을 위로 올린 만큼 시트가 커집니다.
            setDragHeight(clamp(start.height - dy, heights.peek, heights.full));
            // 속도(px/ms): 직전 이동과 비교. 위로 움직이면 양수
            const dt = event.timeStamp - lastTime;
            if (dt > 0) velocity = (lastY - touch.clientY) / dt;
            lastY = touch.clientY;
            lastTime = event.timeStamp;
        };

        const onEnd = () => {
            if (start && mode === 'drag') {
                const { heights, onSnapChange: change } = live.current;
                const released = clamp(start.height - (lastY - start.y), heights.peek, heights.full);
                change(pickSnap(released, velocity, heights));
                setDragHeight(null); // 단계 높이로 애니메이션
            }
            start = null;
            mode = 'undecided';
        };

        sheet.addEventListener('touchstart', onStart, { passive: true });
        sheet.addEventListener('touchmove', onMove, { passive: false });
        sheet.addEventListener('touchend', onEnd);
        sheet.addEventListener('touchcancel', onEnd);
        return () => {
            sheet.removeEventListener('touchstart', onStart);
            sheet.removeEventListener('touchmove', onMove);
            sheet.removeEventListener('touchend', onEnd);
            sheet.removeEventListener('touchcancel', onEnd);
        };
    }, [scrollerRef]);

    return (
        <div
            ref={sheetRef}
            role="region"
            aria-label="일정·맛집 목록"
            // 처음 크기를 재기 전(areaHeight 0)에는 보이지 않게 둡니다.
            style={{ height: areaHeight ? height : undefined, visibility: areaHeight ? undefined : 'hidden' }}
            className={[
                'absolute inset-x-0 bottom-0 z-[3] flex flex-col overflow-hidden rounded-t-[18px] bg-bg shadow-[0_-6px_24px_rgba(32,60,53,0.16)]',
                // 끄는 중에는 손가락을 바로 따라오도록 애니메이션을 끕니다.
                dragHeight === null ? 'transition-[height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]' : '',
            ].join(' ')}
        >
            <div ref={headerRef} className="shrink-0">
                {/* 손잡이: 탭하면 다음 단계로. 화면읽기 도구용 이름 포함 */}
                <button
                    type="button"
                    onClick={() => onSnapChange(NEXT_ON_TAP[snap])}
                    aria-label={snap === 'full' ? '목록 줄이기' : '목록 펼치기'}
                    className="flex w-full justify-center rounded-none pt-2.5 pb-1.5"
                >
                    <span className="block h-[5px] w-10 rounded-full bg-[#c9d0c4]" />
                </button>
                {header}
            </div>
            {/* overscroll-contain: 목록 끝까지 스크롤해도 바깥(페이지)이 같이 움직이지 않게 */}
            <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[15px] pb-8">
                {children}
            </div>
        </div>
    );
}
