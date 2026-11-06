// 새 여행 만들기 모달: 이름만 입력하면 빈 여행을 만들고, 날짜는 여행 화면에서 하나씩 추가합니다.

import { useState, type FormEvent } from 'react';
import { Modal, ModalFooter, ModalHead } from './Modal';

interface NewTripDialogProps {
    open: boolean;
    onClose: () => void;
    onCreate: (title: string) => void;
}

export function NewTripDialog(props: NewTripDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="new-trip-heading">
            <NewTripForm {...props} />
        </Modal>
    );
}

function NewTripForm({ onClose, onCreate }: NewTripDialogProps) {
    const [title, setTitle] = useState('');
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (title.trim()) onCreate(title.trim());
    };
    return (
        <form onSubmit={submit}>
            <ModalHead id="new-trip-heading" title="새 여행 만들기" onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <label className="field">
                    여행 이름
                    {/* autoFocus: 모달이 열리면 바로 입력할 수 있게 */}
                    <input required autoFocus maxLength={100} placeholder="예: 오사카 가족 여행" value={title} onChange={event => setTitle(event.target.value)} />
                </label>
                <p className="text-[12px] text-muted">만든 뒤 여행 화면에서 ‘날짜’ 추가 버튼으로 날짜를 추가하고 장소를 채우세요.</p>
            </div>
            <ModalFooter>
                <button type="button" className="btn btn-outline" onClick={onClose}>취소</button>
                <button type="submit" className="btn btn-primary">여행 만들기</button>
            </ModalFooter>
        </form>
    );
}
