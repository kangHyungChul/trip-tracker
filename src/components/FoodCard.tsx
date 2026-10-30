// 식당·카페 후보 카드. "맛집·카페" 탭과 장소 상세 모달에서 함께 사용합니다.

import { gmaps } from '../lib/links';
import { ExternalLink, SourceLink } from './common';
import type { Food } from '../types';

interface FoodCardProps {
    food: Food;
    /** 어느 장소의 후보인지 (맛집 탭에서만 표시) */
    context?: string;
}

export function FoodCard({ food, context }: FoodCardProps) {
    return (
        <article className="mb-3 rounded-[11px] border border-line bg-paper p-[17px]">
            <div className="text-[10px] text-[#9d875b]">
                {food.kind}
                {context ? ` · ${context}` : ''}
            </div>
            <h3 className="my-[5px] text-[16px] font-bold">{food.name}</h3>
            <p className="my-[5px] text-[12px] text-[#657361]">{food.menu}</p>
            <p className="my-[5px] text-[12px] text-[#657361]">
                <strong>{food.budget}</strong>
            </p>
            <small className="text-[11px] text-muted">영업 · {food.hours}</small>
            <p className="my-[5px] text-[12px] text-[#657361]">
                <small className="text-[11px] text-muted">주차 · {food.parking}</small>
            </p>
            <div className="mt-3 flex items-center gap-2.5 text-[11px]">
                {/* 자동차 길찾기와 도보 길찾기를 모두 제공합니다. */}
                <ExternalLink href={gmaps(food.query, true)} className="navlink">식당 길찾기 ↗</ExternalLink>
                <ExternalLink href={gmaps(food.query, true, 'walking')}>도보 ↗</ExternalLink>
                <SourceLink url={food.source} label="정보 원문 ↗" />
            </div>
        </article>
    );
}
