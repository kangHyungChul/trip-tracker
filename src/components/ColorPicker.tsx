import { useId } from 'react';
import { ICON_COLORS, iconColor } from '../lib/iconColors';

interface Props { value?: string; onChange: (value: string) => void }
export function ColorPicker({ value, onChange }: Props) {
    const group = useId();
    const current = iconColor(value);
    return <fieldset className="mt-4">
        <legend className="mb-2 text-[13px] font-semibold">아이콘 색상</legend>
        <div className="flex flex-wrap items-center gap-2">
            {ICON_COLORS.map(color => <label key={color.value} title={color.label} className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-line">
                <input type="radio" name={group} value={color.value} aria-label={color.label} checked={current === color.value} onChange={() => onChange(color.value)} className="sr-only peer" />
                <span className="h-7 w-7 rounded-full border-2 border-white shadow-sm peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-green" style={{ backgroundColor: color.value }} />
            </label>)}
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-2 text-[12px]">
                <input type="color" aria-label="아이콘 색상 직접 선택" value={current} onChange={event => onChange(event.target.value)} className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0" />직접 선택
            </label>
        </div>
    </fieldset>;
}
