// 날짜 추가·편집·삭제 모달.
// 기존의 "4일 고정" 제한을 없애면서 새로 추가한 화면입니다.

import { useState, type FormEvent, type ReactNode } from 'react';
import { blankDay, clone } from '../lib/trip';
import { Modal, ModalFooter, ModalHead } from './Modal';
import type { Day } from '../types';

/** 편집 가능한 날짜 필드 (장소 목록은 별도로 관리하므로 제외) */
export type DayFields = Omit<Day, 'id' | 'stops'>;

interface DayEditDialogProps {
    open: boolean;
    /** 편집할 날짜. null 이면 새 날짜 추가 */
    day: Day | null;
    /** 삭제 가능 여부 (최소 하루는 남아 있어야 함) */
    canDelete: boolean;
    onClose: () => void;
    onSave: (fields: DayFields) => void;
    onDelete: () => void;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="field">
            {label}
            {children}
        </label>
    );
}

export function DayEditDialog(props: DayEditDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="day-heading">
            <DayForm {...props} />
        </Modal>
    );
}

function DayForm({ day, canDelete, onClose, onSave, onDelete }: DayEditDialogProps) {
    // 처음 열릴 때 한 번만, 편집 가능한 필드만 골라 폼 상태로 복사합니다.
    const [draft, setDraft] = useState<DayFields>(() => {
        const source = day ? clone(day) : blankDay();
        return {
            date: source.date, weekday: source.weekday, title: source.title, subtitle: source.subtitle, hotel: source.hotel,
            pace: source.pace, warning: source.warning, tight: source.tight, costNote: source.costNote,
        };
    });
    const set = <K extends keyof DayFields>(key: K, value: DayFields[K]) => setDraft(prev => ({ ...prev, [key]: value }));
    // 텍스트 입력칸의 value/onChange 를 한 번에 연결하는 헬퍼
    const text = (key: Exclude<keyof DayFields, 'tight'>) => ({
        value: draft[key],
        onChange: (event: { target: { value: string } }) => set(key, event.target.value),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        // 저장 전에 모든 텍스트 필드의 앞뒤 공백을 제거합니다.
        onSave({
            date: draft.date.trim(), weekday: draft.weekday.trim(), title: draft.title.trim(), subtitle: draft.subtitle.trim(),
            hotel: draft.hotel.trim(), pace: draft.pace.trim(), warning: draft.warning.trim(), costNote: draft.costNote.trim(),
            tight: draft.tight,
        });
    };

    return (
        <form onSubmit={submit}>
            <ModalHead id="day-heading" eyebrow="PLAN YOUR DAY" title={day ? '날짜 편집' : '새 날짜 추가'} onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <div className="grid grid-cols-2 gap-x-3.5 max-phone:grid-cols-1">
                    <Field label="날짜 (예: 11.04)"><input maxLength={100} {...text('date')} /></Field>
                    <Field label="요일 (예: 수)"><input maxLength={100} {...text('weekday')} /></Field>
                </div>
                <Field label="날짜 제목"><input required maxLength={300} {...text('title')} /></Field>
                <Field label="부제 (첫 '·' 앞부분이 날짜 탭에 표시됩니다)"><input maxLength={300} {...text('subtitle')} /></Field>
                <div className="grid grid-cols-2 gap-x-3.5 max-phone:grid-cols-1">
                    <Field label="숙소·마무리"><input maxLength={300} {...text('hotel')} /></Field>
                    <Field label="일정 강도 (예: 가볍게)"><input maxLength={300} {...text('pace')} /></Field>
                </div>
                <Field label="주의 사항">
                    <textarea rows={3} maxLength={3000} {...text('warning')} />
                </Field>
                <Field label="비용 합계 추가 안내 (선택)"><input maxLength={1000} {...text('costNote')} /></Field>
                {/* 체크박스는 value 가 아니라 checked 로 상태를 다룹니다. */}
                <label className="mb-3.5 flex items-center gap-2 text-[12px]">
                    <input type="checkbox" className="h-4 w-4 p-0 accent-green" checked={draft.tight} onChange={event => set('tight', event.target.checked)} />
                    빠듯한 날로 강조 표시
                </label>
            </div>
            <ModalFooter>
                {/* 삭제 버튼은 기존 날짜 편집일 때만 보이고, 마지막 하루면 비활성화됩니다. */}
                {day && (
                    <button type="button" className="btn btn-danger mr-auto" onClick={onDelete} disabled={!canDelete} title={canDelete ? undefined : '최소 하루는 있어야 합니다.'}>
                        이 날짜 삭제
                    </button>
                )}
                <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
                <button type="submit" className="btn btn-primary">저장</button>
            </ModalFooter>
        </form>
    );
}
