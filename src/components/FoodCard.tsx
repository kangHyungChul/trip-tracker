// 맛집·카페 카드. "맛집·카페" 탭에서 사용합니다.

import { gmaps } from '../lib/links';
import { ExternalLink, SourceLink } from './common';
import type { Food } from '../types';

interface FoodCardProps {
    food: Food;
    selected: boolean;
    /** 배지 버튼: 지도에서 해당 맛집으로 이동 */
    onFocus: (id: string) => void;
    onEdit: (id: string) => void;
}

/** 종류별 배지 글자·이름. icon(이모지)은 글자 속 표시(정보창 제목·범례)에 쓰고, 배지 안에는 FoodIcon(흰색 SVG)을 씁니다. */
export const FOOD_BADGE = {
    restaurant: { icon: '🍴', label: '식당' },
    cafe: { icon: '☕', label: '카페' },
} as const;

/** 배지 안의 흰색 아이콘. 이모지는 OS 마다 색이 고정(회색 등)이라 색을 바꿀 수 없어 SVG 를 씁니다. */
const FOOD_ICON_PATH: Record<Food['category'], string> = {
    // 포크·나이프 (Material Icons "restaurant")
    restaurant: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
    // 커피잔 (Material Icons "local_cafe")
    cafe: 'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z',
};

export function FoodIcon({ category }: { category: Food['category'] }) {
    // fill="currentColor": 배지의 글자색(.food-badge 의 흰색)을 그대로 따라갑니다.
    // aria-hidden: 장식용 아이콘이므로 화면 낭독기에서는 건너뜁니다. (버튼에 aria-label 이 따로 있음)
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d={FOOD_ICON_PATH[category]} />
        </svg>
    );
}

/** 카드 안의 링크·버튼·체크박스를 누른 경우인지 (그때는 카드 클릭 동작을 하지 않음) */
export const isInteractiveTarget = (target: EventTarget) =>
    target instanceof Element && target.closest('a, button, input, label, select, textarea') !== null;

export function FoodCard({ food, selected, onFocus, onEdit }: FoodCardProps) {
    const badge = FOOD_BADGE[food.category];
    const located = food.lat !== null && food.lng !== null;
    return (
        <article
            id={`item-${food.id}`}
            // 카드 아무 곳이나 누르면 지도에서 위치 보기 (위치가 있을 때만, 안의 링크·버튼은 각자 동작)
            onClick={event => {
                if (located && !isInteractiveTarget(event.target)) onFocus(food.id);
            }}
            className={`mb-3 scroll-mt-[15px] rounded-[11px] border bg-paper p-[17px] ${located ? 'cursor-pointer' : ''} ${selected ? 'border-[#d9b98a] shadow-[0_0_0_2px_#f3e6d2]' : 'border-line'}`}
        >
            <div className="flex items-start gap-[11px]">
                {/* 지도 배지와 같은 모양의 버튼. 위치가 없으면 지도 이동 대신 비활성 */}
                <button
                    type="button"
                    onClick={() => onFocus(food.id)}
                    disabled={!located}
                    aria-label={`${food.name} 지도 보기`}
                    title={located ? '지도에서 보기' : '위치 없음'}
                    className={`food-badge food-badge-${food.category} shrink-0`}
                >
                    <FoodIcon category={food.category} />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-[#9d875b]">
                        {badge.label}
                        {food.kind ? ` · ${food.kind}` : ''}
                    </div>
                    <h3 className="my-[3px] text-[16px] font-bold">{food.name}</h3>
                </div>
                <button type="button" onClick={() => onEdit(food.id)} className="px-[3px] py-1 text-[11px] text-muted print:hidden">
                    편집
                </button>
            </div>
            {food.menu && <p className="my-[5px] text-[12px] text-[#657361]">{food.menu}</p>}
            {food.budget && (
                <p className="my-[5px] text-[12px] text-[#657361]">
                    <strong>{food.budget}</strong>
                </p>
            )}
            {food.hours && <small className="block text-[11px] text-muted">영업 · {food.hours}</small>}
            {food.parking && <small className="block text-[11px] text-muted">주차 · {food.parking}</small>}
            {!located && <small className="mt-1 block text-[11px] text-danger">📍 위치 없음 · 편집에서 구글지도 URL로 지정하면 지도에 표시됩니다.</small>}
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[11px] print:hidden">
                {/* 자동차 길찾기와 도보 길찾기를 모두 제공합니다. */}
                <ExternalLink href={gmaps(food.query, true)} className="navlink">길찾기 ↗</ExternalLink>
                <ExternalLink href={gmaps(food.query, true, 'walking')}>도보 ↗</ExternalLink>
                <SourceLink url={food.source} label="정보 원문 ↗" />
            </div>
        </article>
    );
}
