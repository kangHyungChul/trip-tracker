// 네이티브 <dialog> 요소를 React 상태(open)로 제어하는 공통 모달.
// showModal() 을 써야 배경 클릭 차단·포커스 가두기·Esc 닫기가 브라우저 기본 동작으로 처리됩니다.

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
    open: boolean;
    /** Esc 키·닫기 버튼 등으로 닫힐 때 호출됩니다. 부모는 여기서 open 을 false 로 바꿔야 합니다. */
    onClose: () => void;
    children: ReactNode;
    /** 모달 제목 요소의 id (화면 낭독기용) */
    labelledBy?: string;
    /** 모달 너비: 기본(최대 680px) / 작게(최대 420px, 확인창용) */
    size?: 'default' | 'small';
}

export function Modal({ open, onClose, children, labelledBy, size = 'default' }: ModalProps) {
    const ref = useRef<HTMLDialogElement>(null);

    // open 값과 실제 dialog 열림 상태를 맞춥니다.
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        else if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            // Esc 키로 닫으면 브라우저가 close 이벤트를 보냅니다. 부모 상태도 닫힘으로 맞춥니다.
            onClose={onClose}
            aria-labelledby={labelledBy}
            className={`max-h-[90dvh] w-[calc(100%-28px)] ${size === 'small' ? 'max-w-[420px]' : 'max-w-[680px]'} rounded-2xl border border-line bg-paper p-0 text-ink shadow-[0_20px_100px_#17291d30] backdrop:bg-[#102e2866] backdrop:backdrop-blur-[2px]`}
        >
            {/* 닫혀 있을 때는 내용을 렌더링하지 않아, 다시 열 때마다 폼 상태가 새로 초기화됩니다. */}
            {open && children}
        </dialog>
    );
}

/** 모달 상단 제목 영역 (작은 머리말 + 제목 + × 버튼) */
export function ModalHead({ id, eyebrow, title, onClose }: { id?: string; eyebrow?: string; title: string; onClose: () => void }) {
    return (
        <div className="flex items-center justify-between gap-2.5 border-b border-line px-[25px] py-[23px] max-phone:p-[18px]">
            <div>
                {eyebrow && <p className="eyebrow max-phone:text-[9px]">{eyebrow}</p>}
                <h2 id={id} className="m-0 text-[22px] leading-[1.4] font-semibold tracking-[-0.8px] max-phone:text-[20px]">
                    {title}
                </h2>
            </div>
            <button type="button" onClick={onClose} aria-label="닫기" className="shrink-0 px-2 py-[3px] text-[27px] leading-none">
                ×
            </button>
        </div>
    );
}

/** 모달 하단 버튼 영역. 내용이 길어 스크롤돼도 아래에 붙어 있습니다. */
export function ModalFooter({ children }: { children: ReactNode }) {
    return (
        <div className="sticky bottom-0 flex justify-end gap-2.5 border-t border-line bg-[#f6f6ef] px-[25px] py-[17px]">{children}</div>
    );
}
