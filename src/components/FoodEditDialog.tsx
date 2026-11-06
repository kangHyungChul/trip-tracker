// 맛집·카페 추가·편집 모달.
// 날짜별 맛집 목록의 항목 하나를 편집합니다. 위치는 구글지도 URL(또는 가게 이름)로 가져옵니다.

import { useState, type FormEvent, type ReactNode } from 'react';
import { blankFood, clone } from '../lib/trip';
import type { LatLng } from '../lib/placeLookup';
import { Hint } from './common';
import { Modal, ModalFooter, ModalHead } from './Modal';
import { PlaceLocator } from './PlaceLocator';
import type { Food } from '../types';
import { PlaceIconPicker } from './PlaceIconPicker';

interface FoodEditDialogProps {
    open: boolean;
    /** 편집할 맛집. null 이면 새로 추가 */
    food: Food | null;
    /** 가게 이름 검색 시 이 근처를 우선 */
    bias?: LatLng | null;
    onClose: () => void;
    onSave: (food: Omit<Food, 'id'> & { id?: string }) => void;
    onDelete: (id: string) => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="field">
            {label}
            {children}
        </label>
    );
}

const Row2 = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-x-3.5 max-phone:grid-cols-1">{children}</div>;

export function FoodEditDialog(props: FoodEditDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="food-heading">
            <FoodForm {...props} />
        </Modal>
    );
}

function FoodForm({ food, bias, onClose, onSave, onDelete }: FoodEditDialogProps) {
    // 처음 열릴 때 한 번만 폼 상태를 만듭니다. (새 맛집은 빈 값, 좌표 null)
    const [draft, setDraft] = useState<Omit<Food, 'id'> & { id?: string }>(() => (food ? clone(food) : blankFood()));
    const set = <K extends keyof Food>(key: K, value: Food[K]) => setDraft(prev => ({ ...prev, [key]: value }));
    // 텍스트 입력칸 공통 속성
    const text = (key: 'name' | 'query' | 'menu' | 'budget' | 'kind' | 'hours' | 'parking' | 'source') => ({
        value: draft[key],
        onChange: (event: { target: { value: string } }) => set(key, event.target.value),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSave({
            ...draft,
            name: draft.name.trim(), query: draft.query.trim(), menu: draft.menu.trim(), budget: draft.budget.trim(),
            kind: draft.kind.trim(), hours: draft.hours.trim(), parking: draft.parking.trim(), source: draft.source.trim(),
        });
    };

    return (
        <form onSubmit={submit}>
            <ModalHead id="food-heading" eyebrow="PLACE CANDIDATES" title={food ? '장소 후보 편집' : '장소 후보 추가'} onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <PlaceLocator
                    lat={draft.lat}
                    lng={draft.lng}
                    bias={bias}
                    onFound={place =>
                        setDraft(prev => ({
                            ...prev,
                            lat: place.lat,
                            lng: place.lng,
                            name: prev.name || place.name,
                            query: prev.query || place.name || place.address,
                        }))
                    }
                />
                <Field label="장소 이름"><input required {...text('name')} /></Field>
                <Field label="구글지도 검색어·주소 (길찾기 목적지)"><input required {...text('query')} /></Field>
                <PlaceIconPicker value={draft.category} onChange={value => set('category', value)} hint="후보 목록과 지도에 이 아이콘이 표시되며, 일정에 추가할 때도 이어집니다." />
                <Row2>
                    <Field label="메뉴·주요 정보 (선택)"><input {...text('menu')} /></Field>
                    <Field label="예상 예산"><input {...text('budget')} /></Field>
                </Row2>
                <Field label="선정 이유·스타일"><input {...text('kind')} /></Field>
                <Field label="영업시간·휴무"><input {...text('hours')} /></Field>
                <Field label="주차 안내"><input {...text('parking')} /></Field>
                <Field label="출처 URL"><input type="url" {...text('source')} /></Field>
                <Hint>후보는 여행 전체에서 공유하며 날짜에 속하지 않습니다. 방문을 정하면 ‘일정에 추가’에서 날짜와 순서를 선택하세요.</Hint>
            </div>
            <ModalFooter>
                {food && (
                    <button type="button" className="btn btn-danger mr-auto" onClick={() => onDelete(food.id)}>
                        삭제
                    </button>
                )}
                <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
                <button type="submit" className="btn btn-primary">저장</button>
            </ModalFooter>
        </form>
    );
}
