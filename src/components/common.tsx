// 여러 화면에서 함께 쓰는 작은 표시용 컴포넌트 모음.

import type { ReactNode } from 'react';
import { safeURL } from '../lib/links';

/** 새 창으로 여는 외부 링크. rel 속성으로 원래 창 접근(window.opener)과 리퍼러 노출을 막습니다. */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
        </a>
    );
}

/** 출처 링크. 안전한 http(s) URL 일 때만 링크를 표시하고 아니면 아무것도 그리지 않습니다. */
export function SourceLink({ url, label = '공식·참고 원문 ↗', className }: { url: string; label?: string; className?: string }) {
    const href = safeURL(url);
    return href ? <ExternalLink href={href} className={className}>{label}</ExternalLink> : null;
}

/** "비용 / 주차" 처럼 이름표와 값을 한 줄로 보여주는 항목 */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex gap-[9px]">
            <span className="min-w-[30px] shrink-0 text-[10px] text-[#9d875b]">{label}</span>
            <span className="text-[#5b685b]">{children}</span>
        </div>
    );
}

/** 회색 작은 안내 문구 */
export function Hint({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <p className={`text-[11px] text-muted ${className}`}>{children}</p>;
}
