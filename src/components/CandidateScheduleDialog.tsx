import { useState, type FormEvent } from 'react';
import { Modal, ModalFooter, ModalHead } from './Modal';
import { TimeInput } from './DateTimeInputs';
import { PlaceLocator } from './PlaceLocator';
import type { ScheduleCandidateInput } from '../lib/itinerary';
import type { Day, Food, TravelMode } from '../types';
import { PlaceMarker } from './PlaceMarker';

interface Props {
    candidate: Food;
    days: Day[];
    initialDayId: string;
    onClose: () => void;
    onSave: (input: ScheduleCandidateInput) => void;
}

export function CandidateScheduleDialog({ candidate, days, initialDayId, onClose, onSave }: Props) {
    const initialDay = days.find(day => day.id === initialDayId) ?? days[0];
    const [dayId, setDayId] = useState(initialDay?.id ?? '');
    const [afterStopId, setAfterStopId] = useState(initialDay?.stops.at(-1)?.id ?? '');
    const [start, setStart] = useState('');
    const [mode, setMode] = useState<TravelMode>('driving');
    const [position, setPosition] = useState(candidate.lat !== null && candidate.lng !== null ? { lat: candidate.lat, lng: candidate.lng } : null);
    const [error, setError] = useState('');
    const day = days.find(item => item.id === dayId);
    const alreadyAdded = day?.stops.some(stop => stop.sourceCandidateId === candidate.id);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!day) { setError('일정을 넣을 날짜를 먼저 추가해 주세요.'); return; }
        if (!position) { setError('후보의 위치를 먼저 지정해 주세요.'); return; }
        if (alreadyAdded) { setError('선택한 날짜에 이미 추가되어 있습니다.'); return; }
        onSave({ candidateId: candidate.id, dayId, afterStopId, start, mode, position });
    };
    return <Modal open onClose={onClose} labelledBy="candidate-schedule-title">
        <form onSubmit={submit}>
            <ModalHead id="candidate-schedule-title" title="후보를 일정에 추가" onClose={onClose} />
            <div className="px-[25px] py-5 max-phone:px-[18px]">
                <p className="mb-4 flex items-center gap-2 font-semibold"><PlaceMarker icon={candidate.category} color={candidate.iconColor} />{candidate.name}</p>
                <label className="field">방문 날짜
                    <select required value={dayId} onChange={event => { const next = days.find(item => item.id === event.target.value); setDayId(event.target.value); setAfterStopId(next?.stops.at(-1)?.id ?? ''); setError(''); }}>
                        {!days.length && <option value="">등록된 날짜 없음</option>}
                        {days.map((item, index) => <option key={item.id} value={item.id}>DAY {index + 1} · {item.date || '날짜 미정'} · {item.title}</option>)}
                    </select>
                </label>
                <label className="field">삽입 위치
                    <select value={afterStopId} onChange={event => setAfterStopId(event.target.value)}>
                        <option value="">첫 번째 일정으로 추가</option>
                        {day?.stops.map((stop, index) => <option key={stop.id} value={stop.id}>{index + 1}. {stop.title} 다음{index === day.stops.length - 1 ? ' (맨 뒤)' : ''}</option>)}
                    </select>
                </label>
                <label className="field">시작 시각 (선택)<TimeInput value={start} onChange={setStart} /></label>
                <label className="field">이전 장소 → 이 장소 이동수단
                    <select value={mode} onChange={event => setMode(event.target.value as TravelMode)}><option value="driving">자동차</option><option value="walking">도보</option></select>
                </label>
                {!position && <PlaceLocator lat={null} lng={null} onFound={setPosition} label="후보의 지도 위치 지정" />}
                <p className="text-[11px] text-muted">후보는 보관함에 유지됩니다. 일정에 추가한 뒤 시간·도착 지점·비용은 일정 편집에서 조정할 수 있습니다.</p>
                {(error || alreadyAdded) && <p role="alert" className="mt-2 text-[12px] text-danger">{error || '선택한 날짜에 이미 추가되어 있습니다.'}</p>}
            </div>
            <ModalFooter><button type="button" className="btn btn-outline" onClick={onClose}>취소</button><button type="submit" className="btn btn-primary" disabled={!day || alreadyAdded}>일정에 추가</button></ModalFooter>
        </form>
    </Modal>;
}
