// 화면 하단 알림(토스트) 공유 컨텍스트.
// 어느 컴포넌트에서든 useToast() 로 받은 함수를 호출하면 메시지가 5.2초 동안 표시됩니다.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ShowToast = (message: string) => void;

// 기본값은 아무것도 하지 않는 함수 (Provider 밖에서 호출돼도 오류가 나지 않도록)
const ToastContext = createContext<ShowToast>(() => {});

/** 토스트 표시 함수를 반환합니다. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [message, setMessage] = useState<string | null>(null);
    // 이전 타이머를 취소하기 위해 ref 에 보관합니다. (렌더링과 무관한 값)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // useCallback: 함수 참조를 고정해 이 함수를 의존성으로 쓰는 effect 가 불필요하게 다시 실행되지 않게 합니다.
    const show = useCallback<ShowToast>(text => {
        setMessage(text);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setMessage(null), 5200);
    }, []);

    // 컴포넌트가 사라질 때 남은 타이머 정리
    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <ToastContext.Provider value={show}>
            {children}
            {message !== null && (
                // role="status": 화면 낭독기가 메시지를 읽어 주도록 합니다.
                <div
                    role="status"
                    className="fixed bottom-[25px] left-1/2 z-[10000] max-w-[90vw] -translate-x-1/2 rounded-[10px] bg-ink px-5 py-3 text-[12px] text-white shadow-card"
                >
                    {message}
                </div>
            )}
        </ToastContext.Provider>
    );
}
