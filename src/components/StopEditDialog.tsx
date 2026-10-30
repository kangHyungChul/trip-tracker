// 장소 추가·편집 모달. 식당 후보 목록도 함께 편집합니다.

import { useState, type FormEvent, type ReactNode } from 'react';
import { blankFood, blankStop, clone } from '../lib/trip';
import { Hint } from './common';
import { Modal, ModalFooter, ModalHead } from './Modal';
import type { CostUnit, Food, Stop, TravelMode } from '../types';

interface StopEditDialogProps {
    open: boolean;
    /** 편집할 장소. null 이면 새 장소 추가 */
    stop: Stop | null;
    onClose: () => void;
    /** 저장 요청. id 가 없으면 새 장소입니다. 검증에 성공하면 부모가 모달을 닫습니다. */
    onSave: (stop: Omit<Stop, 'id'> & { id?: string }) => void;
}

/**
 * 폼 입력 중 상태.
 * 숫자 필드는 입력 도중 빈 값·"-" 같은 중간 상태가 있어 문자열로 들고 있다가 저장할 때 숫자로 바꿉니다.
 */
type Draft = Omit<Stop, 'lat' | 'lng' | 'amount' | 'extraAmount' | 'id'> & {
    id?: string;
    lat: string;
    lng: string;
    amount: string;
    extraAmount: string;
};

/** 장소 데이터 → 폼 상태 */
function toDraft(stop: Stop | null): Draft {
    const base = stop ? clone(stop) : blankStop();
    return { ...base, lat: String(base.lat), lng: String(base.lng), amount: String(base.amount), extraAmount: String(base.extraAmount) };
}

/** 라벨 + 입력칸 묶음 */
function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="field">
            {label}
            {children}
        </label>
    );
}

/** 두 칸 나란히 (휴대폰에서는 한 줄씩) */
const Row2 = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-x-3.5 max-phone:grid-cols-1">{children}</div>;

export function StopEditDialog(props: StopEditDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="edit-heading">
            {/* Modal 은 열려 있을 때만 children 을 렌더링하므로, 열 때마다 EditForm 이 새로 만들어져 상태가 초기화됩니다. */}
            <EditForm {...props} />
        </Modal>
    );
}

function EditForm({ stop, onClose, onSave }: StopEditDialogProps) {
    // useState 초기화 함수: 처음 열렸을 때 한 번만 장소 데이터를 폼 상태로 복사합니다.
    const [draft, setDraft] = useState<Draft>(() => toDraft(stop));

    /** 필드 하나를 바꾸는 헬퍼. 제네릭 K 로 key 와 value 의 타입이 서로 맞는지 컴파일 시점에 검사합니다. */
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(prev => ({ ...prev, [key]: value }));

    /** 식당 후보 i 번째의 필드 하나를 변경 */
    const setFood = (index: number, key: keyof Food, value: string) =>
        setDraft(prev => ({ ...prev, food: prev.food.map((food, i) => (i === index ? { ...food, [key]: value } : food)) }));

    const addFood = () => setDraft(prev => ({ ...prev, food: [...prev.food, blankFood()] }));
    const removeFood = (index: number) => setDraft(prev => ({ ...prev, food: prev.food.filter((_, i) => i !== index) }));

    const submit = (event: FormEvent) => {
        event.preventDefault(); // 브라우저 기본 폼 제출(페이지 이동) 방지
        // 문자열은 앞뒤 공백 제거, 숫자 필드는 Number 로 변환합니다. 빈 칸은 Number('') = 0 이 되므로 좌표는 별도 검증됩니다.
        const result = {
            ...draft,
            time: draft.time.trim(), title: draft.title.trim(), query: draft.query.trim(), duration: draft.duration.trim(),
            kind: draft.kind.trim(), fee: draft.fee.trim(), parking: draft.parking.trim(), parkingQuery: draft.parkingQuery.trim(),
            note: draft.note.trim(), source: draft.source.trim(),
            lat: Number(draft.lat), lng: Number(draft.lng), amount: Number(draft.amount), extraAmount: Number(draft.extraAmount),
        };
        onSave(result);
    };

    // 입력칸 공통 속성: value 와 onChange 를 한 번에 연결합니다.
    const text = (key: 'time' | 'title' | 'query' | 'duration' | 'kind' | 'fee' | 'parkingQuery' | 'source') => ({
        value: draft[key],
        onChange: (event: { target: { value: string } }) => set(key, event.target.value),
    });
    const number = (key: 'lat' | 'lng' | 'amount' | 'extraAmount') => ({
        type: 'number',
        step: 'any', // 소수점 좌표 입력 허용
        value: draft[key],
        onChange: (event: { target: { value: string } }) => set(key, event.target.value),
    });

    return (
        <form onSubmit={submit}>
            <ModalHead id="edit-heading" eyebrow="MAKE IT YOURS" title={stop ? '장소 편집' : '새 장소 추가'} onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <Row2>
                    <Field label="방문 시간"><input required {...text('time')} /></Field>
                    <Field label="체류시간"><input {...text('duration')} /></Field>
                </Row2>
                <Field label="장소 이름"><input required {...text('title')} /></Field>
                <Field label="구글지도 검색어·일본어 주소"><input required {...text('query')} /></Field>
                <Hint>새 장소는 아래 좌표도 변경해야 지도 핀이 정확해집니다. 구글지도 우클릭·장소 좌표를 참고하세요.</Hint>
                <Row2>
                    <Field label="위도"><input required {...number('lat')} /></Field>
                    <Field label="경도"><input required {...number('lng')} /></Field>
                </Row2>
                <Row2>
                    <Field label="종류"><input {...text('kind')} /></Field>
                    <Field label="길찾기 이동수단">
                        <select value={draft.mode} onChange={event => set('mode', event.target.value as TravelMode)}>
                            <option value="driving">자동차</option>
                            <option value="walking">도보</option>
                        </select>
                    </Field>
                </Row2>
                <Field label="비용 설명"><input {...text('fee')} /></Field>
                <Row2>
                    <Field label="합계에 더할 기본금액(엔)"><input min="0" {...number('amount')} /></Field>
                    <Field label="기본금액 단위">
                        <select value={draft.unit} onChange={event => set('unit', event.target.value as CostUnit)}>
                            <option value="adult">1인당 (인원수 곱하기)</option>
                            <option value="vehicle">차량·전체 금액 (1회)</option>
                        </select>
                    </Field>
                </Row2>
                <Field label="추가 고정비(엔, 인원과 무관하게 1회)"><input min="0" {...number('extraAmount')} /></Field>
                <Hint>식비·불확정 비용은 기본금액을 0으로 두세요. 주차비처럼 1인당 요금과 따로 붙는 정액은 추가 고정비에 넣으면 그날 합계에 더해집니다.</Hint>
                <Field label="주차장 안내">
                    <textarea rows={3} value={draft.parking} onChange={event => set('parking', event.target.value)} />
                </Field>
                <Field label="주차장 구글지도 검색어(선택)"><input {...text('parkingQuery')} /></Field>
                <Field label="설명·메모">
                    <textarea rows={3} value={draft.note} onChange={event => set('note', event.target.value)} />
                </Field>
                <Field label="공식·참고 URL"><input type="url" {...text('source')} /></Field>

                <div className="mt-2.5 flex items-center justify-between border-t border-line pt-[15px]">
                    <h3 className="m-0 text-[16px] font-bold">식당·카페 후보</h3>
                    <button type="button" className="btn btn-outline" onClick={addFood}>＋ 후보 추가</button>
                </div>
                {draft.food.map((food, index) => (
                    // 식당은 고유 ID 가 없어 순번을 key 로 사용합니다. (삭제 시 아래 항목이 한 칸씩 당겨짐)
                    <details key={index} open className="my-3 rounded-[9px] border border-line p-3">
                        <summary className="cursor-pointer text-[12px] font-[650]">
                            후보 {index + 1} · {food.name || '새 식당'}
                        </summary>
                        <div className="pt-[13px]">
                            <Field label="식당 이름"><input value={food.name} onChange={e => setFood(index, 'name', e.target.value)} /></Field>
                            <Field label="구글지도 검색어·주소"><input value={food.query} onChange={e => setFood(index, 'query', e.target.value)} /></Field>
                            <Row2>
                                <Field label="대표 메뉴"><input value={food.menu} onChange={e => setFood(index, 'menu', e.target.value)} /></Field>
                                <Field label="예상 예산"><input value={food.budget} onChange={e => setFood(index, 'budget', e.target.value)} /></Field>
                            </Row2>
                            <Field label="선정 이유·스타일"><input value={food.kind} onChange={e => setFood(index, 'kind', e.target.value)} /></Field>
                            <Field label="영업시간·휴무"><input value={food.hours} onChange={e => setFood(index, 'hours', e.target.value)} /></Field>
                            <Field label="주차 안내"><input value={food.parking} onChange={e => setFood(index, 'parking', e.target.value)} /></Field>
                            <Field label="출처 URL"><input type="url" value={food.source} onChange={e => setFood(index, 'source', e.target.value)} /></Field>
                            <button type="button" className="btn px-0 text-[11px] text-danger" onClick={() => removeFood(index)}>이 후보 삭제</button>
                        </div>
                    </details>
                ))}
            </div>
            <ModalFooter>
                <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
                <button type="submit" className="btn btn-primary">수정하고 저장</button>
            </ModalFooter>
        </form>
    );
}
