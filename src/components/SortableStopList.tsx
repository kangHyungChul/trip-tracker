// 순서 편집 모드의 장소 목록: 손잡이(점 6개 모양 아이콘)를 끌어 방문 순서를 바꿉니다. (@dnd-kit)
// 마우스·터치·키보드(손잡이에 포커스 → Space 로 잡기 → 화살표로 이동 → Space 로 놓기) 모두 지원합니다.

import {
    closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { formatTime } from '../lib/datetime';
import type { Stop } from '../types';

interface SortableStopListProps {
    stops: Stop[];
    /** 새 순서의 장소 배열을 전달합니다. */
    onReorder: (stops: Stop[]) => void;
}

export function SortableStopList({ stops, onReorder }: SortableStopListProps) {
    // 센서: 어떤 입력으로 끌기를 시작할지 정합니다.
    const sensors = useSensors(
        // 마우스: 5px 이상 움직여야 끌기 시작 (단순 클릭과 구분)
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        // 터치: 0.15초 누르고 있어야 시작 (스크롤과 구분)
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
        // 키보드: 목록 정렬에 맞는 화살표 이동 좌표 계산
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    /** 끌기를 놓았을 때: 원래 위치(active)와 놓은 위치(over)로 배열 순서를 바꿉니다. */
    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const from = stops.findIndex(stop => stop.id === active.id);
        const to = stops.findIndex(stop => stop.id === over.id);
        if (from < 0 || to < 0) return;
        onReorder(arrayMove(stops, from, to)); // arrayMove: from 위치 항목을 to 위치로 옮긴 새 배열
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            {/* SortableContext 에는 항목 순서와 같은 순서의 ID 배열을 넘깁니다. */}
            <SortableContext items={stops.map(stop => stop.id)} strategy={verticalListSortingStrategy}>
                <ol className="m-0 list-none p-0">
                    {stops.map((stop, index) => (
                        <SortableRow key={stop.id} stop={stop} number={index + 1} />
                    ))}
                </ol>
            </SortableContext>
        </DndContext>
    );
}

/** 끌 수 있는 한 줄 */
function SortableRow({ stop, number }: { stop: Stop; number: number }) {
    // useSortable: 이 항목의 끌기 상태와, 손잡이에 붙일 이벤트(listeners)·접근성 속성(attributes)을 제공합니다.
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
    return (
        <li
            ref={setNodeRef}
            // 끄는 동안 위치 이동은 CSS transform 으로 처리합니다. (실제 순서는 놓을 때 바뀜)
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`mb-2 flex items-center gap-3 rounded-xl border bg-paper px-3 py-2.5 ${isDragging ? 'relative z-10 border-gold shadow-card' : 'border-line'}`}
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                // 휴대폰 바텀시트 안에서 이 손잡이를 끌 때는 시트가 움직이지 않게 합니다. (BottomSheet 참고)
                data-sheet-nodrag=""
                aria-label={`${stop.title} 순서 옮기기`}
                // touch-none: 손잡이를 끌 때 페이지가 스크롤되지 않게 합니다.
                className="cursor-grab touch-none rounded-md px-2 py-1 text-[18px] leading-none text-muted active:cursor-grabbing"
            >
                {/* 손잡이 모양: 세로 점 6개 SVG 아이콘 */}
                <GripVertical className="icon" />
            </button>
            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-light text-[11px] font-bold text-green">{number}</span>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] text-muted">{formatTime(stop.start, stop.end, stop.timeNote)}</div>
                <div className="truncate text-[14px] font-[650]">{stop.title}</div>
            </div>
        </li>
    );
}
