// 첫 화면의 저장·백업 모달: 저장 상태 안내, JSON 백업 파일을 여행으로 추가, 휴지통(삭제한 여행 복구).

import { useState, type ChangeEvent } from 'react';
import { readTripFile } from '../lib/backup';
import { isCloudEnabled, listDeletedTrips, restoreCloudTrip, type CloudRow } from '../lib/cloudTrips';
import { adoptRestored, markDirty } from '../lib/sync';
import { formatDateRange } from '../lib/tripSummary';
import { newId } from '../lib/trip';
import { canAddTrip, listTripIds, MAX_TRIPS, writeTrip } from '../lib/tripStore';
import { useChoice } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { useRunner } from '../hooks/useRunner';
import { Modal, ModalHead } from './Modal';
import type { Trip } from '../types';

interface HomeStorageDialogProps {
    open: boolean;
    onClose: () => void;
    /** 여행 목록이 바뀌었을 때 (첫 화면 다시 읽기) */
    onChanged: () => void;
}

export function HomeStorageDialog(props: HomeStorageDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="home-storage-heading">
            <Body {...props} />
        </Modal>
    );
}

const block = 'mb-[22px] border-b border-line pb-[22px] last:mb-0 last:border-0 last:pb-0';
const desc = 'text-[12px] text-muted';

function Body({ onClose, onChanged }: HomeStorageDialogProps) {
    const toast = useToast();
    const choose = useChoice(); // 버튼 여러 개 확인창
    const { pending, run } = useRunner();
    const cloud = isCloudEnabled();
    /** 휴지통 목록 (아직 불러오지 않았으면 null) */
    const [deleted, setDeleted] = useState<CloudRow[] | null>(null);

    /** 백업 파일을 여행으로 추가. 같은 ID 의 여행이 있으면 덮어쓸지, 새 여행으로 따로 둘지 묻습니다. */
    const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) return;
        try {
            let trip: Trip = await readTripFile(file);
            if (listTripIds().includes(trip.id)) {
                // 같은 여행이 이미 있으면 덮어쓰기 / 새 여행으로 추가 / 취소 중에서 고릅니다.
                const picked = await choose({
                    title: `'${trip.title}' 여행이 이미 있습니다`,
                    message: '덮어쓰면 기존 내용은 사라집니다(클라우드 포함). 새 여행으로 추가하면 두 여행을 따로 보관합니다.',
                    choices: [
                        { value: 'copy', label: '새 여행으로 추가', tone: 'outline' },
                        { value: 'overwrite', label: '덮어쓰기', tone: 'danger' },
                    ],
                });
                if (picked === null) return; // 취소: 아무것도 하지 않음 (finally 에서 파일 선택만 초기화)
                // 새 여행으로 추가할 때는 ID 를 새로 만들어 기존 여행·클라우드 행과 분리합니다.
                if (picked === 'copy') trip = { ...trip, id: newId() };
            }
            if (!listTripIds().includes(trip.id) && !canAddTrip()) throw new Error(`여행은 최대 ${MAX_TRIPS}개까지 저장할 수 있습니다.`);
            if (!writeTrip(trip)) throw new Error('기기 저장 공간이 부족합니다.');
            markDirty(trip.id); // Supabase 업로드 예약 (같은 ID 가 클라우드에서 바뀌어 있으면 충돌 선택창이 뜸)
            onChanged();
            toast(`'${trip.title}' 여행을 추가했습니다.`);
        } catch (error) {
            toast('불러오기 실패: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            input.value = '';
        }
    };

    /** 휴지통 여행 복구: 클라우드에서 복구한 뒤 기기 캐시에도 넣습니다. */
    const restore = (row: CloudRow) =>
        run(`restore-${row.id}`, async () => {
            if (!row.trip) throw new Error('이 여행 데이터는 읽을 수 없습니다: ' + row.error);
            if (!listTripIds().includes(row.id) && !canAddTrip()) throw new Error(`여행은 최대 ${MAX_TRIPS}개까지 저장할 수 있습니다.`);
            const revision = await restoreCloudTrip(row.id);
            adoptRestored(row.trip, revision);
            setDeleted(current => current?.filter(item => item.id !== row.id) ?? null);
            onChanged();
            toast(`'${row.trip.title}' 여행을 복구했습니다.`);
        });

    return (
        <>
            <ModalHead id="home-storage-heading" eyebrow="YOUR TRAVEL NOTES" title="저장과 백업" onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <section className={block}>
                    <h3 className="mb-2 text-[16px] font-bold">자동 저장</h3>
                    <p className={desc}>
                        {cloud
                            ? '모든 편집은 Supabase 에 자동 저장되어, 이 앱 주소로 접속한 모든 기기에서 같은 여행을 보고 편집할 수 있습니다. 오프라인일 때는 기기에 보관했다가 연결되면 올립니다.'
                            : 'Supabase 연결 설정이 없어 이 브라우저에만 저장됩니다. ⚙ 설정 또는 .env.local 에 Supabase URL·공개 키를 넣으면 자동으로 클라우드에 저장됩니다.'}
                    </p>
                    {cloud && <p className={`${desc} text-[#935e43]`}>로그인 기능이 없어 주소를 아는 누구나 편집·삭제할 수 있습니다. 주소를 공유할 때 주의하세요.</p>}
                </section>

                <section className={block}>
                    <h3 className="mb-2 text-[16px] font-bold">백업 파일로 여행 추가</h3>
                    <p className={desc}>여행 화면의 ‘↓ JSON 백업’으로 받은 파일(예전 가고시마 앱 백업 포함)을 여행 목록에 추가합니다.</p>
                    <label className="btn btn-outline mt-2">
                        ↑ 백업 파일 불러오기
                        <input type="file" accept=".json,application/json" hidden onChange={importFile} />
                    </label>
                </section>

                {cloud && (
                    <section className={block}>
                        <h3 className="mb-2 text-[16px] font-bold">휴지통</h3>
                        <p className={desc}>삭제한 여행은 클라우드 휴지통에 남아 있어 복구할 수 있습니다. (최근 50개)</p>
                        <button
                            type="button"
                            className="btn btn-outline mt-2"
                            disabled={!!pending}
                            onClick={() => run('list-deleted', async () => setDeleted(await listDeletedTrips()))}
                        >
                            {pending === 'list-deleted' ? '불러오는 중…' : '🗑 삭제한 여행 보기'}
                        </button>
                        {deleted && (
                            <ul className="my-3 list-none p-0">
                                {deleted.length === 0 && <li className={desc}>휴지통이 비어 있습니다.</li>}
                                {deleted.map(row => (
                                    <li key={row.id} className="mb-2 flex items-center gap-3 rounded-[10px] border border-line px-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <strong className="block truncate text-[13px]">{row.trip?.title ?? row.id}</strong>
                                            <small className="text-[11px] text-muted">
                                                {row.trip ? `${formatDateRange(row.trip) || '날짜 미정'} · ${row.trip.days.length}일 · ` : '읽을 수 없음 · '}
                                                {row.deletedAt ? `${new Date(row.deletedAt).toLocaleString('ko-KR')} 삭제` : ''}
                                            </small>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-outline shrink-0"
                                            disabled={!!pending || !row.trip}
                                            onClick={() => void restore(row)}
                                        >
                                            복구
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </div>
        </>
    );
}
