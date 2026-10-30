// 여행 정보 편집 모달: 제목, 첫 화면 소개 문구(동행·한 줄 소개·강조 문구), 통화, 메모.
// (예전 "여행 메모" 모달을 확장했습니다. 소개 문구는 예전에는 화면에 고정돼 있던 값입니다)

import { useState, type FormEvent } from 'react';
import { currencyName, currencySymbol, isCurrencyCode, normalizeCurrency, PRESET_CURRENCIES } from '../lib/currency';
import { Modal, ModalFooter, ModalHead } from './Modal';
import type { Trip } from '../types';

/** 이 모달에서 편집하는 필드 */
export type TripInfo = Pick<Trip, 'title' | 'companion' | 'tagline' | 'highlight' | 'highlightSub' | 'currency' | 'notes'>;

interface TripInfoDialogProps {
    open: boolean;
    info: TripInfo;
    onClose: () => void;
    onSave: (info: TripInfo) => void;
}

export function TripInfoDialog(props: TripInfoDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="trip-info-heading">
            <InfoForm {...props} />
        </Modal>
    );
}

/** 통화 선택 목록에서 '직접 입력'을 뜻하는 값 (실제 통화 코드와 겹치지 않게 소문자) */
const CUSTOM = 'custom';
/** 목록에 있는 통화인지 */
const isPreset = (code: string) => (PRESET_CURRENCIES as readonly string[]).includes(code);

function InfoForm({ info, onClose, onSave }: TripInfoDialogProps) {
    // 열릴 때 현재 값을 폼 상태로 복사합니다. (저장 버튼을 눌러야 부모에 반영)
    const [draft, setDraft] = useState<TripInfo>(info);
    // 통화 직접 입력 모드: 현재 통화가 목록에 없으면 처음부터 직접 입력 모드로 엽니다.
    const [customCurrency, setCustomCurrency] = useState(!isPreset(info.currency));
    const [error, setError] = useState('');
    const bind = (key: Exclude<keyof TripInfo, 'currency'>) => ({
        value: draft[key],
        onChange: (event: { target: { value: string } }) => setDraft(prev => ({ ...prev, [key]: event.target.value })),
    });

    const currency = normalizeCurrency(draft.currency);
    const currencyValid = isCurrencyCode(currency);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!currencyValid) {
            setError('통화 코드를 확인하세요. 예: KRW, JPY, USD, MYR (영문 세 글자)');
            return;
        }
        onSave({
            title: draft.title.trim(), companion: draft.companion.trim(), tagline: draft.tagline.trim(),
            highlight: draft.highlight.trim(), highlightSub: draft.highlightSub.trim(), currency, notes: draft.notes,
        });
    };

    return (
        <form onSubmit={submit}>
            <ModalHead id="trip-info-heading" eyebrow="ABOUT THIS TRIP" title="여행 정보" onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <label className="field">
                    여행 제목
                    <input required maxLength={100} {...bind('title')} />
                </label>
                <label className="field">
                    동행 (날짜 옆에 표시, 예: 부모님과 둘이)
                    <input maxLength={300} {...bind('companion')} />
                </label>
                <label className="field">
                    한 줄 소개
                    <input maxLength={300} {...bind('tagline')} />
                </label>
                <div className="grid grid-cols-2 gap-x-3.5 max-phone:grid-cols-1">
                    <label className="field">
                        강조 문구 (예: 전 일정 렌터카)
                        <input maxLength={300} {...bind('highlight')} />
                    </label>
                    <label className="field">
                        강조 보조 문구 (예: 호텔 2박)
                        <input maxLength={300} {...bind('highlightSub')} />
                    </label>
                </div>
                <div className="grid grid-cols-2 gap-x-3.5 max-phone:grid-cols-1">
                    <label className="field">
                        통화 (장소 금액·비용 합계 단위)
                        <select
                            value={customCurrency ? CUSTOM : draft.currency}
                            onChange={event => {
                                const value = event.target.value;
                                setError('');
                                if (value === CUSTOM) {
                                    // 직접 입력으로 바꾸면 입력칸을 비워 새 코드를 적게 합니다.
                                    setCustomCurrency(true);
                                    setDraft(prev => ({ ...prev, currency: '' }));
                                } else {
                                    setCustomCurrency(false);
                                    setDraft(prev => ({ ...prev, currency: value }));
                                }
                            }}
                        >
                            {/* 예: "KRW · 대한민국 원 (₩)" */}
                            {PRESET_CURRENCIES.map(code => (
                                <option key={code} value={code}>
                                    {code} · {currencyName(code)} ({currencySymbol(code)})
                                </option>
                            ))}
                            <option value={CUSTOM}>직접 입력…</option>
                        </select>
                    </label>
                    {customCurrency && (
                        <label className="field">
                            통화 코드 (ISO 영문 세 글자)
                            <input
                                required
                                maxLength={3}
                                placeholder="예: MYR"
                                // 입력하는 대로 대문자로 바꿉니다.
                                value={draft.currency}
                                onChange={event => {
                                    setError('');
                                    setDraft(prev => ({ ...prev, currency: normalizeCurrency(event.target.value) }));
                                }}
                            />
                            {/* 올바른 코드를 입력하면 통화 이름·기호를 미리 보여줍니다. */}
                            <small className={`mt-1 block text-[11px] ${currency && !currencyValid ? 'text-danger' : 'text-muted'}`}>
                                {currencyValid ? `${currencyName(currency)} (${currencySymbol(currency)})` : currency.length === 3 ? '알 수 없는 통화 코드입니다.' : 'ISO 4217 통화 코드'}
                            </small>
                        </label>
                    )}
                </div>
                <p className="-mt-1 mb-3 text-[11px] text-muted">통화를 바꿔도 입력해 둔 금액 숫자는 그대로이며 환율 환산은 하지 않습니다.</p>
                <label className="field">
                    메모 (일정·비용 안내)
                    <textarea rows={8} maxLength={10000} {...bind('notes')} />
                </label>
            </div>
            <ModalFooter>
                {error && <span className="mr-auto self-center text-[12px] text-danger">{error}</span>}
                <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
                <button className="btn btn-primary" type="submit">저장</button>
            </ModalFooter>
        </form>
    );
}
