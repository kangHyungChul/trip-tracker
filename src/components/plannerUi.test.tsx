import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlaceIconPicker } from './PlaceIconPicker';
import { PlannerHeading } from './PlannerHeading';
import { STOP_ICON_LABELS } from '../lib/stopIcons';
import { parseTrip } from '../lib/trip';
import seed from '../data/seed.json';

describe('일정·후보 공통 UI', () => {
    it('아이콘 이름은 툴팁·접근성 이름에만 두고 화면에는 아이콘만 표시한다', () => {
        const markup = renderToStaticMarkup(<PlaceIconPicker value="hotel" color="#ffffff" onChange={() => {}} onColorChange={() => {}} />);
        const visibleText = markup.replace(/<[^>]+>/g, '');
        for (const label of Object.values(STOP_ICON_LABELS)) {
            expect(visibleText).not.toContain(label);
            expect(markup).toContain(`aria-label="${label}"`);
        }
        expect(markup).toContain('type="color"');
        expect(markup).toContain('background-color:#ffffff;color:#182c38');
    });
    it.each(['desktop', 'phone', 'regular'] as const)('%s에서도 탭에 맞는 추가 버튼과 날짜 편집을 표시한다', layout => {
        const props = { day: parseTrip(seed).days[0], tripTitle: '여행', layout, onEditDay: () => {}, onAdd: () => {} };
        const route = renderToStaticMarkup(<PlannerHeading {...props} candidates={false} />);
        const candidates = renderToStaticMarkup(<PlannerHeading {...props} candidates />);
        expect(route).toContain('일정 추가');
        expect(route).toContain('aria-label="날짜 편집"');
        expect(candidates).toContain('후보 추가');
        expect(candidates).not.toContain('일정 추가');
        expect(candidates).not.toContain('aria-label="날짜 편집"');
    });
});
