export const DEFAULT_ICON_COLOR = '#000000';
/** 일정의 검은 핀과 구분되는 후보 기본색. 사용자가 지정한 색은 그대로 유지합니다. */
export const DEFAULT_CANDIDATE_COLOR = '#2563eb';
export const ICON_COLORS = [
    { value: DEFAULT_ICON_COLOR, label: '검은색' }, { value: '#ea580c', label: '주황색' }, { value: '#db2777', label: '분홍색' },
    { value: '#7c3aed', label: '보라색' }, { value: '#2563eb', label: '파란색' },
    { value: '#059669', label: '초록색' }, { value: '#182c38', label: '잉크색' },
] as const;
export const isIconColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
export const iconColor = (value?: string) => isIconColor(value) ? value.toLowerCase() : DEFAULT_ICON_COLOR;

/** 밝은 사용자 색상에서도 아이콘 형태를 읽을 수 있도록 전경 대비를 정합니다. */
export function iconForeground(value?: string) {
    const color = iconColor(value);
    const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return luminance > 0.179 ? '#182c38' : '#ffffff';
}

export const iconMarkerStyle = (value?: string) => ({ backgroundColor: iconColor(value), color: iconForeground(value) });
