import { useId } from 'react';
import { StopIcon, STOP_ICON_OPTIONS } from './StopIcon';
import type { StopIcon as IconName } from '../lib/stopIcons';
import { ColorPicker } from './ColorPicker';
import { iconMarkerStyle } from '../lib/iconColors';

interface Props {
    value: IconName;
    onChange: (value: IconName) => void;
    hint?: string;
    color?: string;
    onColorChange: (color: string) => void;
}

/** 일정과 후보가 같은 아이콘·선택 상태·키보드 조작을 사용합니다. */
export function PlaceIconPicker({ value, onChange, hint, color, onColorChange }: Props) {
    const groupName = useId();
    return <div className="mb-5"><fieldset>
        <legend className="mb-2 text-[13px] font-semibold">지도 아이콘</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-2">
            {STOP_ICON_OPTIONS.map(([name, label]) => (
                <label key={name} title={label} className={`grid min-h-11 cursor-pointer place-items-center rounded-[10px] border p-1 ${value === name ? 'border-ink bg-bg' : 'border-line bg-paper'}`}>
                    <input type="radio" name={groupName} aria-label={label} value={name} checked={value === name} onChange={() => onChange(name)} className="sr-only peer" />
                    <span className="grid h-8 w-8 place-items-center rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-green" style={iconMarkerStyle(color)}><StopIcon name={name} className="size-5" /></span>
                </label>
            ))}
        </div>
        {hint && <p className="mt-2 text-[11px] text-muted">{hint}</p>}
    </fieldset><ColorPicker value={color} onChange={onColorChange} /></div>;
}
