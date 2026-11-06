// 모든 화면 공통 상단 바: TRIP TRACKER 로고(첫 화면 링크) + 오른쪽 버튼 영역.

import type { ReactNode } from 'react';
import { Route } from 'lucide-react';

export function AppHeader({ children }: { children?: ReactNode }) {
    return (
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-paper px-6 max-phone:h-14 max-phone:px-4">
            {/* #/ : 여행 목록(첫 화면)으로 이동 */}
            <a href="#/" aria-label="TRIP TRACKER 여행 목록" className="flex min-w-0 items-center gap-2.5 text-[17px] leading-[1.3] font-semibold no-underline max-phone:text-[14px]">
                {/* 로고: 초록 원 안의 비행기 SVG 아이콘 (크기는 글자 크기 text-[20px]/[17px] 기준 .icon 비율) */}
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green text-paper">
                    <Route className="size-5" />
                </span>
                <span className="truncate tracking-[-0.04em]">Trip tracker</span>
            </a>
            <div className="flex shrink-0 items-center gap-2 print:hidden">{children}</div>
        </header>
    );
}

/** 헤더 오른쪽 작은 버튼 공통 스타일 */
export const headerButton = 'btn btn-soft h-10 shrink-0 text-[14px] leading-none max-phone:h-9 max-phone:px-2.5 max-phone:py-2 max-phone:text-[11px]';
export const headerIconButton = `${headerButton} w-10 px-0 max-phone:w-9 max-phone:px-0`;
