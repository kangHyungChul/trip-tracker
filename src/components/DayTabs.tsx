import type { RefObject } from 'react';
import { Plus } from 'lucide-react';
import { shortDate, weekdayOf } from '../lib/datetime';
import type { Day } from '../types';

interface Props {
    days: Day[];
    selectedId?: string;
    activeRef: RefObject<HTMLButtonElement | null>;
    onSelect: (id: string) => void;
    onAdd: () => void;
}

export function DayTabs({ days, selectedId, activeRef, onSelect, onAdd }: Props) {
    return <nav aria-label="여행 날짜" className="flex min-w-0 max-w-full shrink-0 scroll-px-2.5 gap-1.5 overflow-x-auto border-b border-line bg-paper px-2.5 py-2 [scrollbar-width:none]">
        {days.map((day, index) => {
            const active = day.id === selectedId;
            const weekday = weekdayOf(day.date);
            const label = day.date ? `${shortDate(day.date)}${weekday ? `(${weekday})` : ''}` : '미정';
            return <button key={day.id} ref={active ? activeRef : undefined} type="button" onClick={() => onSelect(day.id)} aria-current={active ? 'date' : undefined} title={[day.title, day.dateNote].filter(Boolean).join(' · ')} className={`shrink-0 rounded-full border px-3 py-[7px] text-[12px] whitespace-nowrap ${active ? 'border-green bg-green text-white' : 'border-line bg-paper text-ink'}`}>
                <b className="font-bold">DAY {index + 1}</b><span className={active ? 'text-[#cbd8c7]' : 'text-muted'}> · {label}</span>
            </button>;
        })}
        <button type="button" onClick={onAdd} className="shrink-0 rounded-full border border-dashed border-[#c9d0c4] px-3 py-[7px] text-[12px] font-semibold whitespace-nowrap text-green" aria-label="날짜 추가"><Plus className="icon mr-0.5" />날짜</button>
    </nav>;
}
