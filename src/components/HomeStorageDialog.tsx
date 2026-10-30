// 첫 화면의 저장·백업 모달: JSON 백업 파일을 새 여행으로 추가, 클라우드에 저장된 내 여행 목록 가져오기.

import { useState, type ChangeEvent } from 'react';
import { readTripFile } from '../lib/backup';
import { formatDateRange } from '../lib/tripSummary';
import { newId } from '../lib/trip';
import { canAddTrip, listTripIds, MAX_TRIPS, writeTrip } from '../lib/tripStore';
import { useChoice, useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';
import { useRunner } from '../hooks/useRunner';
import type { Cloud, CloudTripSummary } from '../hooks/useCloud';
import { CloudAuthSection } from './CloudAuthSection';
import { Modal, ModalHead } from './Modal';
import type { Trip } from '../types';

interface HomeStorageDialogProps {
    open: boolean;
    onClose: () => void;
    cloud: Cloud;
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

function Body({ onClose, cloud, onChanged }: HomeStorageDialogProps) {
    const toast = useToast();
    const confirm = useConfirm(); // 예/아니오 확인창
    const choose = useChoice();   // 버튼 여러 개 확인창
    const runner = useRunner();
    const { pending, run } = runner;
    /** 클라우드 여행 목록 (아직 불러오지 않았으면 null) */
    const [cloudTrips, setCloudTrips] = useState<CloudTripSummary[] | null>(null);

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
                    title: `'${trip.title}' 여행이 이미 기기에 있습니다`,
                    message: '덮어쓰면 기기의 기존 내용은 사라집니다. 새 여행으로 추가하면 두 여행을 따로 보관합니다.',
                    choices: [
                        { value: 'copy', label: '새 여행으로 추가', tone: 'outline' },
                        { value: 'overwrite', label: '덮어쓰기', tone: 'danger' },
                    ],
                });
                if (picked === null) return; // 취소: 아무것도 하지 않음 (finally 에서 파일 선택만 초기화)
                // 새 여행으로 추가할 때는 ID 를 새로 만들어 기존 여행·클라우드 사본과 분리합니다.
                if (picked === 'copy') trip = { ...trip, id: newId() };
            }
            if (!listTripIds().includes(trip.id) && !canAddTrip()) throw new Error(`여행은 최대 ${MAX_TRIPS}개까지 저장할 수 있습니다.`);
            if (!writeTrip(trip)) throw new Error('기기 저장 공간이 부족합니다.');
            onChanged();
            toast(`'${trip.title}' 여행을 추가했습니다.`);
        } catch (error) {
            toast('불러오기 실패: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            input.value = '';
        }
    };

    /** 클라우드 여행 하나를 기기로 가져오기 */
    const importCloud = (summary: CloudTripSummary) =>
        run(`import-${summary.tripKey}`, async () => {
            if (!summary.trip) throw new Error('이 클라우드 데이터는 읽을 수 없습니다: ' + summary.error);
            const exists = listTripIds().includes(summary.tripKey);
            if (
                exists &&
                !(await confirm({
                    title: `기기의 '${summary.trip.title}' 여행을 클라우드 사본으로 교체할까요?`,
                    message: '기기에서 수정한 내용은 사라집니다. 필요하면 먼저 여행 화면에서 JSON 백업을 받으세요.',
                    confirmLabel: '교체',
                    danger: true,
                }))
            ) return;
            if (!exists && !canAddTrip()) throw new Error(`여행은 최대 ${MAX_TRIPS}개까지 저장할 수 있습니다.`);
            if (!writeTrip(summary.trip)) throw new Error('기기 저장 공간이 부족합니다.');
            await cloud.markImported(summary); // 이후 이 기기에서 클라우드 저장 시 충돌 검사 기준
            onChanged();
            toast(`'${summary.trip.title}' 여행을 가져왔습니다.`);
        });

    const localIds = listTripIds();
    return (
        <>
            <ModalHead id="home-storage-heading" eyebrow="YOUR TRAVEL NOTES" title="저장과 백업" onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <section className={block}>
                    <h3 className="mb-2 text-[16px] font-bold">백업 파일로 여행 추가</h3>
                    <p className={desc}>여행 화면의 ‘↓ JSON 백업’으로 받은 파일(예전 가고시마 앱 백업 포함)을 여행 목록에 추가합니다.</p>
                    <label className="btn btn-outline mt-2">
                        ↑ 백업 파일 불러오기
                        <input type="file" accept=".json,application/json" hidden onChange={importFile} />
                    </label>
                </section>

                <section className={block}>
                    <CloudAuthSection cloud={cloud} runner={runner}>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!!pending}
                            onClick={() => run('list', async () => setCloudTrips(await cloud.listCloudTrips()))}
                        >
                            ☁ 클라우드 여행 목록 보기
                        </button>
                        {cloudTrips && (
                            <ul className="my-3 list-none p-0">
                                {cloudTrips.length === 0 && <li className={desc}>클라우드에 저장된 여행이 없습니다.</li>}
                                {cloudTrips.map(summary => (
                                    <li key={summary.tripKey} className="mb-2 flex items-center gap-3 rounded-[10px] border border-line px-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <strong className="block truncate text-[13px]">{summary.trip?.title ?? summary.tripKey}</strong>
                                            <small className="text-[11px] text-muted">
                                                {summary.trip ? `${formatDateRange(summary.trip) || '날짜 미정'} · ${summary.trip.days.length}일 · ` : '읽을 수 없음 · '}
                                                {new Date(summary.updatedAt).toLocaleString('ko-KR')} 저장
                                                {localIds.includes(summary.tripKey) ? ' · 기기에 있음' : ''}
                                            </small>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-outline shrink-0"
                                            disabled={!!pending || !summary.trip}
                                            onClick={() => void importCloud(summary)}
                                        >
                                            가져오기
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className={desc}>각 여행의 클라우드 저장은 여행 화면의 ‘저장·백업’에서 합니다.</p>
                    </CloudAuthSection>
                </section>
            </div>
        </>
    );
}
