// 일정 목록의 장소 카드 1개.

import { formatTime } from '../lib/datetime';
import { gmaps } from '../lib/links';
import { ExternalLink, Fact } from './common';
import { isInteractiveTarget } from './FoodCard';
import type { Stop } from '../types';

interface StopCardProps {
    stop: Stop;
    /** 지도와 같은 방문 순번 (검색으로 걸러져도 원래 순번 유지) */
    number: number;
    selected: boolean;
    /** 번호 버튼: 지도에서 해당 핀으로 이동 */
    onFocus: (id: string) => void;
    onToggleDone: (id: string, done: boolean) => void;
    onDetail: (id: string) => void;
    onEdit: (id: string) => void;
}

export function StopCard({ stop, number, selected, onFocus, onToggleDone, onDetail, onEdit }: StopCardProps) {
    return (
        <article
            // id 는 지도 핀 클릭 시 이 카드로 스크롤하기 위해 사용합니다.
            id={`item-${stop.id}`}
            // 카드 아무 곳이나 누르면 지도에서 위치 보기 (안의 링크·버튼·체크박스는 각자 동작)
            onClick={event => {
                if (!isInteractiveTarget(event.target)) onFocus(stop.id);
            }}
            className={[
                'mb-3 cursor-pointer scroll-mt-[15px] rounded-xl border bg-paper p-[18px] shadow-[0_2px_8px_#24452b03] max-tab:p-[17px] print:break-inside-avoid print:shadow-none',
                selected ? 'border-[#abbd9d] shadow-[0_0_0_2px_#e1e8d9]' : 'border-line',
                stop.done ? 'opacity-[0.66]' : '',
            ].join(' ')}
        >
            <div className="flex items-start gap-[11px]">
                <button
                    type="button"
                    onClick={() => onFocus(stop.id)}
                    aria-label={`${number}번 지도 보기`}
                    className="grid h-[30px] flex-[0_0_30px] place-items-center rounded-full bg-light text-[12px] font-bold text-green"
                >
                    {number}
                </button>
                <div className="min-w-0 flex-1">
                    <div className="mb-[3px] flex items-center gap-2 text-[10px] text-muted max-phone:flex-wrap">
                        {/* 시작~종료 + 메모를 한 줄로 (예: "18:50~20:20", "17:45 예상") */}
                        <span className="font-[650] text-green">{formatTime(stop.start, stop.end, stop.timeNote)}</span>
                        <span>· {stop.duration}</span>
                        <span className="rounded bg-[#f2f0e7] px-1.5 py-px text-[9px] text-[#8b7753]">{stop.kind}</span>
                    </div>
                    <h3 className={`m-0 text-[16px] leading-[1.5] font-[650] tracking-[-0.4px] max-phone:text-[15px] ${stop.done ? 'line-through' : ''}`}>
                        {stop.title}
                    </h3>
                </div>
                <input
                    type="checkbox"
                    checked={stop.done}
                    onChange={event => onToggleDone(stop.id, event.target.checked)}
                    aria-label={`${stop.title} 방문 완료`}
                    className="mt-1 h-[19px] w-[19px] cursor-pointer p-0 accent-green print:hidden"
                />
            </div>
            <p className="mt-[9px] mb-3 text-[11px] leading-[1.8] whitespace-pre-wrap text-muted">{stop.note}</p>
            <div className="grid gap-[7px] text-[11px]">
                <Fact label="비용">{stop.fee}</Fact>
                <Fact label="주차">{stop.parking}</Fact>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center gap-[7px] max-phone:gap-1.5 print:hidden">
                <ExternalLink href={gmaps(stop.query, true, stop.mode)} className="navlink">구글지도 길찾기 ↗</ExternalLink>
                <button type="button" onClick={() => onDetail(stop.id)} className="rounded-[7px] border border-line px-2.5 py-1.5 text-[11px]">
                    자세히
                </button>
                <button type="button" onClick={() => onEdit(stop.id)} className="ml-auto px-[3px] py-1.5 text-[11px] text-muted">
                    편집
                </button>
            </div>
        </article>
    );
}
