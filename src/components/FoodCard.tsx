// 맛집·카페 카드. "맛집·카페" 탭에서 사용합니다.

import { MapPinOff, Plus } from 'lucide-react';
import { gmaps } from '../lib/links';
import { ExternalLink, SourceLink } from './common';
import type { Food } from '../types';
import { StopIcon } from './StopIcon';
import { STOP_ICON_LABELS } from '../lib/stopIcons';
import { DEFAULT_CANDIDATE_COLOR, iconMarkerStyle } from '../lib/iconColors';
import { isInteractiveTarget } from '../lib/dom';

interface FoodCardProps {
    food: Food;
    selected: boolean;
    /** 배지 버튼: 지도에서 해당 맛집으로 이동 */
    onFocus: (id: string) => void;
    onEdit: (id: string) => void;
    onSchedule: (id: string) => void;
    scheduled?: boolean;
}

export function FoodCard({ food, selected, onFocus, onEdit, onSchedule, scheduled }: FoodCardProps) {
    const located = food.lat !== null && food.lng !== null;
    return (
        <article
            id={`item-${food.id}`}
            // 카드 아무 곳이나 누르면 지도에서 위치 보기 (위치가 있을 때만, 안의 링크·버튼은 각자 동작)
            onClick={event => {
                if (located && !isInteractiveTarget(event.target)) onFocus(food.id);
            }}
            className={`min-w-0 scroll-mt-[15px] border-b border-line px-3 py-[18px] wrap-anywhere ${located ? 'cursor-pointer' : ''} ${selected ? 'rounded-xl bg-light' : ''}`}
        >
            <div className="flex items-start gap-[11px]">
                {/* 지도 배지와 같은 모양의 버튼. 위치가 없으면 지도 이동 대신 비활성 */}
                <button
                    type="button"
                    onClick={() => onFocus(food.id)}
                    disabled={!located}
                    aria-label={`${food.name} 지도 보기`}
                    title={located ? '지도에서 보기' : '위치 없음'}
                    className="food-badge shrink-0"
                    style={iconMarkerStyle(food.iconColor ?? DEFAULT_CANDIDATE_COLOR)}
                >
                    <StopIcon name={food.category} className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-muted">
                        {STOP_ICON_LABELS[food.category]}{scheduled ? ' · 일정에 추가됨' : ''}
                        {food.kind ? ` · ${food.kind}` : ''}
                    </div>
                    <h3 className="my-[3px] text-[16px] font-semibold">{food.name}</h3>
                </div>
                <button type="button" onClick={() => onEdit(food.id)} className="shrink-0 px-[3px] py-1 text-[11px] text-muted print:hidden">
                    편집
                </button>
            </div>
            <div className="ml-[39px]">
            {food.menu && <p className="my-[5px] text-[12px] text-muted">{food.menu}</p>}
            {food.budget && (
                <p className="my-[5px] text-[12px] text-ink">
                    <strong>{food.budget}</strong>
                </p>
            )}
            {food.hours && <small className="block text-[11px] text-muted">영업 · {food.hours}</small>}
            {food.parking && <small className="block text-[11px] text-muted">주차 · {food.parking}</small>}
            {!located && (
                <small className="mt-1 block text-[11px] text-danger">
                    <MapPinOff className="icon mr-1" />위치 없음 · 편집에서 구글지도 URL로 지정하면 지도에 표시됩니다.
                </small>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[11px] print:hidden">
                <button type="button" className="btn btn-outline px-2 py-1.5 text-[11px]" onClick={() => onSchedule(food.id)}><Plus className="icon" />일정에 추가</button>
                {/* 자동차 길찾기와 도보 길찾기를 모두 제공합니다. (↗ 아이콘은 ExternalLink 가 붙임) */}
                <ExternalLink href={gmaps(food.query, true)} className="navlink">길찾기</ExternalLink>
                <ExternalLink href={gmaps(food.query, true, 'walking')}>도보</ExternalLink>
                <SourceLink url={food.source} label="정보 원문" />
            </div>
            </div>
        </article>
    );
}
