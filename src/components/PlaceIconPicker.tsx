import { useId } from 'react';
import { StopIcon, STOP_ICON_OPTIONS } from './StopIcon';
import type { StopIcon as IconName } from '../lib/stopIcons';

interface Props {
    value: IconName;
    onChange: (value: IconName) => void;
    hint?: string;
}

/** 일정과 후보가 같은 아이콘·선택 상태·키보드 조작을 사용합니다. */
export function PlaceIconPicker({ value, onChange, hint }: Props) {
    const groupName = useId();
    return <fieldset className="mb-4">
        <legend className="mb-2 text-[13px] font-semibold">지도 아이콘</legend>
        <div className="grid grid-cols-4 gap-2 max-phone:grid-cols-3">
            {STOP_ICON_OPTIONS.map(([name, label]) => (
                <label key={name} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-2 py-2 text-[12px] ${value === name ? 'border-green bg-light font-semibold text-green' : 'border-line bg-paper text-muted'}`}>
                    <input type="radio" name={groupName} value={name} checked={value === name} onChange={() => onChange(name)} className="sr-only peer" />
                    <span className="flex items-center gap-1.5 rounded peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green"><StopIcon name={name} />{label}</span>
                </label>
            ))}
        </div>
        {hint && <p className="mt-2 text-[11px] text-muted">{hint}</p>}
    </fieldset>;
}
