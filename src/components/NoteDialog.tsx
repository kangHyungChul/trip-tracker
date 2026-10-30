// 여행 제목·메모 편집 모달.

import { useState, type FormEvent } from 'react';
import { Modal, ModalFooter, ModalHead } from './Modal';

interface NoteDialogProps {
    open: boolean;
    title: string;
    notes: string;
    onClose: () => void;
    onSave: (title: string, notes: string) => void;
}

export function NoteDialog(props: NoteDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="note-heading">
            <NoteForm {...props} />
        </Modal>
    );
}

function NoteForm({ title, notes, onClose, onSave }: NoteDialogProps) {
    // 열릴 때 현재 값을 폼 상태로 복사합니다. (저장 버튼을 눌러야 부모에 반영)
    const [draftTitle, setDraftTitle] = useState(title);
    const [draftNotes, setDraftNotes] = useState(notes);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSave(draftTitle.trim(), draftNotes);
    };

    return (
        <form onSubmit={submit}>
            <ModalHead id="note-heading" title="여행 메모" onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <label className="field">
                    여행 제목
                    <input required maxLength={100} value={draftTitle} onChange={event => setDraftTitle(event.target.value)} />
                </label>
                <label className="field">
                    메모
                    <textarea rows={12} maxLength={10000} value={draftNotes} onChange={event => setDraftNotes(event.target.value)} />
                </label>
            </div>
            <ModalFooter>
                <button className="btn btn-primary" type="submit">저장</button>
            </ModalFooter>
        </form>
    );
}
