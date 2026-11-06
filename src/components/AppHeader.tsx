// 모든 화면 공통 상단 바: TRIP TRACKER 로고(첫 화면 링크) + 오른쪽 버튼 영역.

import type { ReactNode } from 'react';
import { Plane } from 'lucide-react';

export function AppHeader({ children }: { children?: ReactNode }) {
    return (
        <header className="flex h-[85px] items-center justify-between border-b border-line bg-paper px-[5%] max-tab:h-[73px] max-tab:px-[22px] max-phone:px-[15px]">
            {/* #/ : 여행 목록(첫 화면)으로 이동 */}
            <a href="#/" aria-label="TRIP TRACKER 여행 목록" className="flex items-center gap-3 text-[17px] leading-[1.3] font-bold no-underline max-phone:gap-2 max-phone:text-[14px]">
                {/* 로고: 초록 원 안의 비행기 SVG 아이콘 (크기는 글자 크기 text-[20px]/[17px] 기준 .icon 비율) */}
                <span className="grid h-[43px] w-[43px] place-items-center rounded-full bg-green text-[20px] text-paper max-phone:h-[35px] max-phone:w-[35px] max-phone:text-[17px]">
                    <Plane className="icon" />
                </span>
                <span className="tracking-[1.5px]">
                    TRIP TRACKER
                    <small className="mt-[5px] block text-[9px] font-medium tracking-[2px] text-muted max-phone:text-[8px]">TRAVEL JOURNAL</small>
                </span>
            </a>
            <div className="flex items-center gap-[18px] max-tab:gap-[9px] print:hidden">{children}</div>
        </header>
    );
}

/** 헤더 오른쪽 작은 버튼 공통 스타일 */
export const headerButton = 'btn btn-soft h-10 shrink-0 text-[14px] leading-none max-phone:h-9 max-phone:px-2.5 max-phone:py-2 max-phone:text-[11px]';
export const headerIconButton = `${headerButton} w-10 px-0 max-phone:w-9 max-phone:px-0`;
