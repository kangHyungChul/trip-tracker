// 여행 화면의 저장·백업 모달: 이 여행의 JSON 백업/불러오기, 예시 여행 초기화.
// (편집 내용은 Supabase 에 자동 저장되므로 따로 저장 버튼은 없습니다)

import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportTrip, readTripFile } from '../lib/backup';
import { isCloudEnabled } from '../lib/cloudTrips';
import { clone } from '../lib/trip';
import { SAMPLE_TRIP } from '../lib/tripStore';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { Modal, ModalHead } from './Modal';
import type { Trip } from '../types';

interface TripStorageDialogProps {
    open: boolean;
    onClose: () => void;
    /** 최신 여행 데이터 읽기 */
    getTrip: () => Trip;
    /** 여행 데이터 통째로 교체 (불러오기·초기화). 교체 내용도 자동 저장됩니다. */
    replace: (trip: Trip) => void;
    /** 현재 저장 상태 문구 (헤더와 같은 내용) */
    saveStatus: string;
}

export function TripStorageDialog(props: TripStorageDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="storage-heading">
            <StorageBody {...props} />
        </Modal>
    );
}

const block = 'mb-[22px] border-b border-line pb-[22px] last:mb-0 last:border-0 last:pb-0';
const desc = 'text-[12px] text-muted';

function StorageBody({ onClose, getTrip, replace, saveStatus }: TripStorageDialogProps) {
    const toast = useToast();
    const confirm = useConfirm(); // 앱 자체 확인창
    const tripId = getTrip().id;
    const cloud = isCloudEnabled();

    /** 백업 파일로 이 여행 덮어쓰기: 검증(예전 형식은 자동 변환) → 확인 → 교체. 여행 ID 는 현재 여행 것으로 유지 */
    const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) return;
        try {
            const candidate = await readTripFile(file, tripId);
            const ok = await confirm({
                title: `현재 여행을 백업 파일('${candidate.title}')로 덮어쓸까요?`,
                message: cloud
                    ? '현재 여행이 백업 내용으로 바뀌고 다른 기기에도 반영됩니다. 필요하면 먼저 현재 여행을 백업해 주세요.'
                    : '현재 여행이 백업 내용으로 바뀝니다. 필요하면 먼저 현재 여행을 백업해 주세요.',
                confirmLabel: '덮어쓰기',
                danger: true,
            });
            if (!ok) return;
            replace(candidate);
            toast('백업을 불러왔습니다.');
        } catch (error) {
            toast('불러오기 실패: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 값을 비웁니다.
            input.value = '';
        }
    };

    const reset = async () => {
        const ok = await confirm({
            title: '이 여행을 원래 예시 일정으로 초기화할까요?',
            message: cloud ? '수정한 내용은 모두 사라지며, 다른 기기에도 초기화된 내용이 반영됩니다.' : '수정한 내용은 모두 사라지며 되돌릴 수 없습니다.',
            confirmLabel: '초기화',
            danger: true,
        });
        if (!ok) return;
        replace(clone(SAMPLE_TRIP)); // 원본 예시 객체가 공유되지 않도록 복사본으로 교체
        toast('원래 예시 일정으로 초기화했습니다.');
    };

    return (
        <>
            <ModalHead id="storage-heading" title="이 여행 저장과 백업" onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <section className={block}>
                    <h3 className="mb-2 text-[16px] font-bold">자동 저장</h3>
                    <p className={desc}>
                        현재 상태: <b>{saveStatus}</b>
                    </p>
                    <p className={desc}>
                        {cloud
                            ? '변경한 내용은 자동으로 저장됩니다. 인터넷에 연결되면 다른 기기에서도 이어서 볼 수 있습니다.'
                            : '이 여행은 이 기기에 저장됩니다. 다른 기기로 옮기려면 백업 파일을 이용해 주세요.'}
                    </p>
                </section>

                <section className={block}>
                    <h3 className="mb-2 text-[16px] font-bold">여행 백업</h3>
                    <p className={desc}>이 여행을 파일로 내려받아 보관하거나, 받아 둔 파일로 이 여행을 덮어씁니다.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                        <button type="button" className="btn btn-primary" onClick={() => exportTrip(getTrip())}><Download className="icon" />백업 파일 내려받기</button>
                        {/* 파일 입력칸은 숨기고 라벨을 버튼처럼 보이게 합니다. 라벨 클릭 = 파일 선택 */}
                        <label className="btn btn-outline">
                            <Upload className="icon" />백업으로 덮어쓰기
                            <input type="file" accept=".json,application/json" hidden onChange={importFile} />
                        </label>
                    </div>
                    <p className={desc}>새 여행으로 추가하려면 첫 화면의 ‘저장·백업’에서 불러오세요.</p>
                </section>

                {/* 예시 여행일 때만 원래 일정으로 초기화 제공 */}
                {tripId === SAMPLE_TRIP.id && (
                    <section className={block}>
                        <button type="button" className="btn btn-danger" onClick={reset}>원래 예시 일정으로 초기화</button>
                        <p className={desc}>초기화 전에 백업을 권장합니다.</p>
                    </section>
                )}
            </div>
        </>
    );
}
