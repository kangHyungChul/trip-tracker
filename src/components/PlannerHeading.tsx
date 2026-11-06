import { Pencil, Plus } from 'lucide-react';
import type { Day } from '../types';

interface Props {
    day: Day;
    candidates: boolean;
    tripTitle: string;
    layout: 'desktop' | 'phone' | 'regular';
    onEditDay: () => void;
    onAdd: () => void;
}

const layouts = {
    desktop: { wrapper: 'flex items-center gap-2 border-b border-line py-5', subtitle: 'truncate text-[11px] text-muted', title: 'min-w-0 truncate text-[20px] font-semibold tracking-[-0.6px]' },
    phone: { wrapper: 'flex items-center gap-1.5 px-[15px] pb-2.5', subtitle: 'eyebrow mb-0.5 truncate text-[9px]', title: 'm-0 min-w-0 truncate text-[18px] leading-[1.35] font-semibold tracking-[-0.6px]' },
    regular: { wrapper: 'mt-[29px] mb-5 flex items-center justify-between gap-3 max-tab:mt-[23px] max-tab:mb-4', subtitle: 'eyebrow max-phone:text-[9px]', title: 'm-0 text-[23px] leading-[1.4] font-semibold tracking-[-0.8px] max-phone:text-[21px]' },
};

/** 화면별 크기만 달리하고, 탭의 제목·편집·추가 동작은 한곳에서 관리합니다. */
export function PlannerHeading({ day, candidates, tripTitle, layout, onEditDay, onAdd }: Props) {
    const styles = layouts[layout];
    const title = candidates ? '장소 후보' : day.title;
    const subtitle = candidates ? '여행 전체 공통' : layout === 'desktop' ? tripTitle : [day.subtitle, day.hotel].filter(Boolean).join(' · ');
    const Heading = layout === 'desktop' ? 'h1' : 'h2';
    return <div className={styles.wrapper}>
        <div className="min-w-0 flex-1">
            {subtitle && <p className={styles.subtitle} title={subtitle}>{subtitle}</p>}
            <div className="flex min-w-0 items-center gap-1">
                <Heading className={styles.title} title={title}>{title}</Heading>
                {!candidates && <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full" onClick={onEditDay} aria-label="날짜 편집" title="날짜 편집"><Pencil className="size-4" /></button>}
            </div>
        </div>
        <button type="button" className="btn btn-primary shrink-0 gap-1 whitespace-nowrap px-2.5 py-2 text-[11px] print:hidden" onClick={onAdd}>
            <Plus className="size-4" />{candidates ? '후보 추가' : '일정 추가'}
        </button>
    </div>;
}
