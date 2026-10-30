// 앱 자체 확인창 (브라우저 기본 confirm() 대체).
// 일부 환경(내장 브라우저·웹뷰)은 confirm() 창을 띄우지 않고 바로 통과시켜 확인 없이 삭제되는 문제가 있어
// 모든 삭제·덮어쓰기·초기화 확인을 이 모달로 처리합니다.
//
// 사용법:
//   const confirm = useConfirm();
//   if (!(await confirm({ title: '삭제할까요?', confirmLabel: '삭제', danger: true }))) return;
//
//   const choose = useChoice();   // 버튼이 3개 이상 필요할 때
//   const picked = await choose({ title: '…', choices: [{ value: 'a', label: 'A' }, …] });  // 취소하면 null

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../components/Modal';

/** 선택 버튼 하나 */
export interface Choice {
    value: string;
    label: string;
    /** 'primary' = 초록 강조, 'danger' = 빨간색(삭제 등), 'outline' = 보조 */
    tone?: 'primary' | 'danger' | 'outline';
}

/** 확인창 내용 */
export interface ChoiceOptions {
    title: string;
    /** 본문 설명 (줄바꿈 \n 은 그대로 줄바꿈으로 표시) */
    message?: string;
    /** 오른쪽부터 차례로 표시할 선택 버튼들 (배열 마지막이 가장 오른쪽) */
    choices: Choice[];
    /** 취소 버튼 글자 (기본 '취소'). Esc 키·× 와 같은 동작 */
    cancelLabel?: string;
}

/** 예/아니오 확인창 옵션 */
export interface ConfirmOptions {
    title: string;
    message?: string;
    /** 확인 버튼 글자 (기본 '확인') */
    confirmLabel?: string;
    cancelLabel?: string;
    /** true 면 확인 버튼을 빨간색(삭제 등 되돌릴 수 없는 동작)으로 표시 */
    danger?: boolean;
}

type ChooseFn = (options: ChoiceOptions) => Promise<string | null>;

// Provider 밖에서 호출되면 확인 없이 진행되지 않도록 항상 '취소(null)'를 돌려줍니다.
const ChoiceContext = createContext<ChooseFn>(async () => null);

/** 여러 버튼 중 하나를 고르는 확인창. 고른 value, 취소하면 null */
export const useChoice = () => useContext(ChoiceContext);

/** 예/아니오 확인창. 확인하면 true, 취소·Esc 면 false */
export function useConfirm() {
    const choose = useContext(ChoiceContext);
    return useCallback(
        async ({ confirmLabel = '확인', danger = false, ...rest }: ConfirmOptions) =>
            (await choose({ ...rest, choices: [{ value: 'ok', label: confirmLabel, tone: danger ? 'danger' : 'primary' }] })) === 'ok',
        [choose],
    );
}

/** 지금 떠 있는 확인창 요청 (내용 + 결과를 돌려줄 resolve 함수) */
interface Pending extends ChoiceOptions {
    resolve: (value: string | null) => void;
}

const TONE_CLASS: Record<NonNullable<Choice['tone']>, string> = {
    primary: 'btn-primary',
    danger: 'btn-danger',
    outline: 'btn-outline',
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState<Pending | null>(null);
    // 닫는 중 중복 처리(버튼 클릭 + dialog close 이벤트)를 막기 위해 현재 요청을 ref 로도 보관합니다.
    const current = useRef<Pending | null>(null);

    // Promise 를 만들어 두고, 사용자가 버튼을 누를 때 resolve 합니다.
    const choose = useCallback<ChooseFn>(
        options =>
            new Promise(resolve => {
                current.current?.resolve(null); // 이전 확인창이 남아 있으면 취소 처리
                const next = { ...options, resolve };
                current.current = next;
                setPending(next);
            }),
        [],
    );

    /** 확인창을 닫고 결과 전달 (한 요청에 한 번만) */
    const finish = (value: string | null) => {
        const request = current.current;
        if (!request) return;
        current.current = null;
        setPending(null);
        request.resolve(value);
    };

    return (
        <ChoiceContext.Provider value={choose}>
            {children}
            {/* size="small": 짧은 확인 문구에 맞는 좁은 모달. Esc 로 닫히면 onClose → 취소 */}
            <Modal open={pending !== null} onClose={() => finish(null)} labelledBy="confirm-heading" size="small">
                {pending && (
                    <div>
                        <div className="px-[25px] pt-[24px] pb-[18px] max-phone:px-[18px]">
                            <h2 id="confirm-heading" className="m-0 text-[18px] leading-[1.45] font-semibold tracking-[-0.5px]">
                                {pending.title}
                            </h2>
                            {pending.message && <p className="mt-2.5 mb-0 text-[13px] leading-[1.7] break-keep whitespace-pre-line text-muted">{pending.message}</p>}
                        </div>
                        {/* 버튼: 취소가 왼쪽, 선택 버튼들은 오른쪽. 모바일에서 줄이 넘치면 줄바꿈 */}
                        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-[#f6f6ef] px-[25px] py-[15px] max-phone:px-[18px]">
                            {/* autoFocus: 실수로 Enter 를 눌러도 삭제되지 않도록 기본 포커스는 취소 버튼 */}
                            <button type="button" autoFocus className="btn btn-outline" onClick={() => finish(null)}>
                                {pending.cancelLabel ?? '취소'}
                            </button>
                            {pending.choices.map(choice => (
                                <button key={choice.value} type="button" className={`btn ${TONE_CLASS[choice.tone ?? 'primary']}`} onClick={() => finish(choice.value)}>
                                    {choice.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </ChoiceContext.Provider>
    );
}
