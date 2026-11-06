// 장소 추가·편집 모달.
// 위치는 구글지도 URL(또는 장소 이름)로 가져오고, 방문 시각은 시간 선택기로 고릅니다.
// (맛집·카페는 이제 장소가 아니라 날짜의 별도 목록에서 관리합니다)

import { useState, type FormEvent, type ReactNode } from 'react';
import { currencySymbol } from '../lib/currency';
import { blankStop, clone } from '../lib/trip';
import type { LatLng } from '../lib/placeLookup';
import { Hint } from './common';
import { TimeInput } from './DateTimeInputs';
import { Modal, ModalFooter, ModalHead } from './Modal';
import { PlaceLocator } from './PlaceLocator';
import { StopIcon, STOP_ICON_OPTIONS, stopIconName } from './StopIcon';
import type { CostUnit, Stop, TravelMode } from '../types';

interface StopEditDialogProps {
    open: boolean;
    /** 편집할 장소. null 이면 새 장소 추가 */
    stop: Stop | null;
    /** 장소 이름 검색 시 이 근처를 우선 (그날 첫 장소 좌표) */
    bias?: LatLng | null;
    /** 여행 통화 코드 (금액 입력칸 라벨에 표시) */
    currency: string;
    onClose: () => void;
    /** 저장 요청. id 가 없으면 새 장소입니다. 검증에 성공하면 부모가 모달을 닫습니다. */
    onSave: (stop: Omit<Stop, 'id'> & { id?: string }) => void;
}

/**
 * 폼 입력 중 상태.
 * 숫자 필드는 입력 도중 빈 값·"-" 같은 중간 상태가 있어 문자열로 들고 있다가 저장할 때 숫자로 바꿉니다.
 * 좌표가 빈 문자열이면 "아직 위치 없음"입니다.
 */
type Draft = Omit<Stop, 'lat' | 'lng' | 'amount' | 'extraAmount' | 'id'> & {
    id?: string;
    lat: string;
    lng: string;
    amount: string;
    extraAmount: string;
};

/** 장소 데이터 → 폼 상태 (새 장소는 좌표 없이 시작) */
function toDraft(stop: Stop | null): Draft {
    if (!stop) return { ...blankStop(), lat: '', lng: '', amount: '0', extraAmount: '0' };
    const base = clone(stop);
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

/** 문자열 좌표 → 숫자 (빈 값·숫자 아님이면 null) */
const toCoord = (value: string) => (value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null);

export function StopEditDialog(props: StopEditDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="edit-heading">
            {/* Modal 은 열려 있을 때만 children 을 렌더링하므로, 열 때마다 EditForm 이 새로 만들어져 상태가 초기화됩니다. */}
            <EditForm {...props} />
        </Modal>
    );
}

function EditForm({ stop, bias, currency, onClose, onSave }: StopEditDialogProps) {
    // useState 초기화 함수: 처음 열렸을 때 한 번만 장소 데이터를 폼 상태로 복사합니다.
    const [draft, setDraft] = useState<Draft>(() => toDraft(stop));
    const [error, setError] = useState('');
    const [arrivalType, setArrivalType] = useState<'' | 'parking' | 'entrance'>(stop?.arrival?.type ?? '');
    const [arrivalLat, setArrivalLat] = useState(stop?.arrival ? String(stop.arrival.lat) : '');
    const [arrivalLng, setArrivalLng] = useState(stop?.arrival ? String(stop.arrival.lng) : '');
    const [arrivalName, setArrivalName] = useState(stop?.arrival?.name ?? '');
    // 금액 입력칸 라벨에 붙일 통화 표시 (예: "JPY ¥", 기호가 코드와 같으면 코드만)
    const symbol = currencySymbol(currency);
    const unitLabel = symbol === currency ? currency : `${currency} ${symbol}`;

    /** 필드 하나를 바꾸는 헬퍼. 제네릭 K 로 key 와 value 의 타입이 서로 맞는지 컴파일 시점에 검사합니다. */
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(prev => ({ ...prev, [key]: value }));

    const submit = (event: FormEvent) => {
        event.preventDefault(); // 브라우저 기본 폼 제출(페이지 이동) 방지
        const lat = toCoord(draft.lat);
        const lng = toCoord(draft.lng);
        if (lat === null || lng === null) {
            setError('지도 위치가 없습니다. 위의 "위치 가져오기"로 구글지도 URL이나 장소 이름을 입력하세요.');
            return;
        }
        const actualLat = toCoord(arrivalLat);
        const actualLng = toCoord(arrivalLng);
        if (arrivalType && (actualLat === null || actualLng === null || Math.abs(actualLat) > 90 || Math.abs(actualLng) > 180)) {
            setError('주차장·출입구의 위치를 가져오거나 올바른 좌표를 입력해 주세요.');
            return;
        }
        // 문자열은 앞뒤 공백 제거, 숫자 필드는 Number 로 변환합니다.
        onSave({
            ...draft,
            arrival: arrivalType && actualLat !== null && actualLng !== null ? { type: arrivalType, name: arrivalName.trim(), lat: actualLat, lng: actualLng } : undefined,
            timeNote: draft.timeNote.trim(), title: draft.title.trim(), query: draft.query.trim(), duration: draft.duration.trim(),
            kind: draft.kind.trim(), fee: draft.fee.trim(), parking: draft.parking.trim(), parkingQuery: draft.parkingQuery.trim(),
            note: draft.note.trim(), source: draft.source.trim(),
            lat, lng, amount: Number(draft.amount), extraAmount: Number(draft.extraAmount),
        });
    };

    // 입력칸 공통 속성: value 와 onChange 를 한 번에 연결합니다.
    const text = (key: 'timeNote' | 'title' | 'query' | 'duration' | 'kind' | 'fee' | 'parkingQuery' | 'source') => ({
        value: draft[key],
        onChange: (event: { target: { value: string } }) => set(key, event.target.value),
    });
    const number = (key: 'lat' | 'lng' | 'amount' | 'extraAmount') => ({
        type: 'number',
        step: 'any', // 소수점 입력 허용
        value: draft[key],
        onChange: (event: { target: { value: string } }) => set(key, event.target.value),
    });

    return (
        <form onSubmit={submit}>
            <ModalHead id="edit-heading" eyebrow="MAKE IT YOURS" title={stop ? '장소 편집' : '새 장소 추가'} onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <PlaceLocator
                    lat={toCoord(draft.lat)}
                    lng={toCoord(draft.lng)}
                    bias={bias}
                    onFound={place =>
                        setDraft(prev => ({
                            ...prev,
                            lat: String(place.lat),
                            lng: String(place.lng),
                            // 이름·검색어가 비어 있을 때만 찾은 장소 정보로 채웁니다. (직접 쓴 내용은 유지)
                            title: prev.title || place.name,
                            query: prev.query || place.name || place.address,
                        }))
                    }
                />
                <Field label="장소 이름"><input required {...text('title')} /></Field>
                <Field label="구글지도 검색어·현지 주소 (길찾기 목적지)"><input required {...text('query')} /></Field>
                <fieldset className="mb-4 rounded-lg border border-line p-3">
                    <legend className="px-1 text-[12px] font-bold">실제 도착 지점</legend>
                    <Field label="경로·길찾기 목적지">
                        <select value={arrivalType} onChange={event => setArrivalType(event.target.value as typeof arrivalType)}>
                            <option value="">장소 원래 위치</option><option value="parking">주차장</option><option value="entrance">출입구</option>
                        </select>
                    </Field>
                    {arrivalType && <>
                        <PlaceLocator key={arrivalType} lat={toCoord(arrivalLat)} lng={toCoord(arrivalLng)} bias={latLngBias(draft)} label={`${arrivalType === 'parking' ? '주차장' : '출입구'} URL 또는 이름`} onFound={place => { setArrivalLat(String(place.lat)); setArrivalLng(String(place.lng)); setArrivalName(place.name || place.address); }} />
                        <Field label="도착 지점 이름 (선택)"><input value={arrivalName} onChange={event => setArrivalName(event.target.value)} /></Field>
                        <details className="text-[12px]"><summary className="mb-2 cursor-pointer text-muted">도착 좌표 직접 입력</summary>
                            <Row2><Field label="도착 위도"><input type="number" step="any" min="-90" max="90" value={arrivalLat} onChange={event => setArrivalLat(event.target.value)} /></Field><Field label="도착 경도"><input type="number" step="any" min="-180" max="180" value={arrivalLng} onChange={event => setArrivalLng(event.target.value)} /></Field></Row2>
                        </details>
                    </>}
                    <p className="mt-1 text-[11px] text-muted">지도 핀과 이동 경로·길찾기는 선택한 도착 지점을 사용합니다. 장소의 원래 위치는 유지됩니다.</p>
                </fieldset>
                <fieldset className="mb-4">
                    <legend className="mb-2 text-[12px] font-bold">지도 핀 아이콘</legend>
                    <div className="grid grid-cols-4 gap-2 max-phone:grid-cols-3">
                        {STOP_ICON_OPTIONS.map(([name, label]) => (
                            <label key={name} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-[11px] ${stopIconName(draft) === name ? 'border-green bg-light text-green' : 'border-line'}`}>
                                <input type="radio" name="stop-icon" value={name} checked={stopIconName(draft) === name} onChange={() => set('icon', name)} className="sr-only peer" />
                                <span className="flex items-center gap-1.5 rounded peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-green"><StopIcon name={name} />{label}</span>
                            </label>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted">아이콘과 방문 순서가 지도에 함께 표시됩니다. 아래 종류·메모와 별도로 선택할 수 있습니다.</p>
                </fieldset>
                <Row2>
                    <Field label="시작 시각"><TimeInput value={draft.start} onChange={value => set('start', value)} /></Field>
                    <Field label="종료 시각 (선택)"><TimeInput value={draft.end} onChange={value => set('end', value)} placeholder="없음" openTo={draft.start} /></Field>
                </Row2>
                <Row2>
                    <Field label="시간 메모 (예: 예상, 선택)"><input maxLength={200} {...text('timeNote')} /></Field>
                    <Field label="체류시간"><input {...text('duration')} /></Field>
                </Row2>
                <Row2>
                    <Field label="종류"><input {...text('kind')} /></Field>
                    <Field label="이전 장소 → 이 장소 이동수단">
                        <select value={draft.mode} onChange={event => set('mode', event.target.value as TravelMode)}>
                            <option value="driving">자동차</option>
                            <option value="walking">도보</option>
                        </select>
                    </Field>
                </Row2>
                <Field label="비용 설명"><input {...text('fee')} /></Field>
                <Row2>
                    <Field label={`합계에 더할 기본금액 (${unitLabel})`}><input min="0" {...number('amount')} /></Field>
                    <Field label="기본금액 단위">
                        <select value={draft.unit} onChange={event => set('unit', event.target.value as CostUnit)}>
                            <option value="adult">1인당 (인원수 곱하기)</option>
                            <option value="vehicle">차량·전체 금액 (1회)</option>
                        </select>
                    </Field>
                </Row2>
                <Field label={`추가 고정비 (${unitLabel}, 인원과 무관하게 1회)`}><input min="0" {...number('extraAmount')} /></Field>
                <Hint>식비·불확정 비용은 기본금액을 0으로 두세요. 주차비처럼 1인당 요금과 따로 붙는 정액은 추가 고정비에 넣으면 그날 합계에 더해집니다.</Hint>
                <Field label="주차장 안내">
                    <textarea rows={3} value={draft.parking} onChange={event => set('parking', event.target.value)} />
                </Field>
                <Field label="주차장 구글지도 검색어(선택)"><input {...text('parkingQuery')} /></Field>
                <Field label="설명·메모">
                    <textarea rows={3} value={draft.note} onChange={event => set('note', event.target.value)} />
                </Field>
                <Field label="공식·참고 URL"><input type="url" {...text('source')} /></Field>
                {/* 위치 가져오기로 해결되지 않는 경우를 위한 직접 입력 (평소에는 접어 둠) */}
                <details className="mt-1 text-[12px]">
                    <summary className="mb-3 cursor-pointer text-muted">좌표 직접 수정</summary>
                    <Row2>
                        <Field label="위도"><input {...number('lat')} /></Field>
                        <Field label="경도"><input {...number('lng')} /></Field>
                    </Row2>
                </details>
            </div>
            <ModalFooter>
                {error && <p className="m-0 mr-auto self-center text-[11px] text-danger">{error}</p>}
                <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
                <button type="submit" className="btn btn-primary">저장</button>
            </ModalFooter>
        </form>
    );
}

function latLngBias(draft: Draft): LatLng | null {
    const lat = toCoord(draft.lat);
    const lng = toCoord(draft.lng);
    return lat !== null && lng !== null ? { lat, lng } : null;
}
