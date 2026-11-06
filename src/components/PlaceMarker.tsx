import { StopIcon } from './StopIcon';
import { DEFAULT_CANDIDATE_COLOR, iconMarkerStyle } from '../lib/iconColors';
import type { StopIcon as IconName } from '../lib/stopIcons';

interface Props { icon: IconName; color?: string; selected?: boolean; number?: number }
/** 지도에서 일정·후보가 동일한 사용자 색상·대비 규칙을 사용합니다. */
export function PlaceMarker({ icon, color, selected = false, number }: Props) {
    return <span className={number === undefined ? `food-badge ${selected ? 'food-badge-selected' : ''}` : `pin ${selected ? 'pin-selected' : ''}`} style={iconMarkerStyle(color ?? (number === undefined ? DEFAULT_CANDIDATE_COLOR : undefined))}>
        <StopIcon name={icon} className={number === undefined ? 'size-4' : 'size-[18px]'} />
        {number !== undefined && <span className="pin-number">{number}</span>}
    </span>;
}
