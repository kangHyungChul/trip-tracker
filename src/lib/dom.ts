/** 카드 내부의 버튼·링크·입력 조작은 카드 전체 클릭과 구분합니다. */
export const isInteractiveTarget = (target: EventTarget) =>
    target instanceof Element && target.closest('a, button, input, label, select, textarea') !== null;
