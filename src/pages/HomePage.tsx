// 첫 화면: 여행 목록(카드) + 새 여행 만들기 + 저장·백업.
// 목록은 기기 캐시를 먼저 보여주고, Supabase 와 동기화(syncAll)가 끝나면 다시 읽습니다.

import { useEffect, useState } from 'react';
import { Check, Cloud, Plus, Settings, Trash2 } from 'lucide-react';
import { AppHeader, headerButton } from '../components/AppHeader';
import { HomeStorageDialog } from '../components/HomeStorageDialog';
import { NewTripDialog } from '../components/NewTripDialog';
import { downloadText } from '../lib/backup';
import { isCloudEnabled } from '../lib/cloudTrips';
import { markDirty, onSyncEvent, removeTrip, syncAll } from '../lib/sync';
import { clone, createTrip } from '../lib/trip';
import { countItems, formatDateRange } from '../lib/tripSummary';
import { canAddTrip, deleteTrip, MAX_TRIPS, readAllTrips, readTrip, SAMPLE_TRIP, writeTrip, type StoredTrip } from '../lib/tripStore';
import { useConfirm } from '../hooks/useConfirm';
import { goTrip } from '../hooks/useHashRoute';
import { useToast } from '../hooks/useToast';

interface HomePageProps {
    onOpenSettings: () => void;
}

/** 클라우드 목록 동기화 상태: 진행 중 / 완료 / 실패(사유) */
type CloudSync = { state: 'syncing' } | { state: 'done' } | { state: 'failed'; message: string };

export function HomePage({ onOpenSettings }: HomePageProps) {
    const toast = useToast();
    const confirm = useConfirm(); // 앱 자체 확인창
    const cloud = isCloudEnabled();
    // 기기 캐시의 모든 여행 (손상된 여행도 안내를 위해 포함)
    const [entries, setEntries] = useState<StoredTrip[]>(readAllTrips);
    const [cloudSync, setCloudSync] = useState<CloudSync>({ state: cloud ? 'syncing' : 'done' });
    const [newOpen, setNewOpen] = useState(false);
    const [storageOpen, setStorageOpen] = useState(false);
    const refresh = () => setEntries(readAllTrips());

    useEffect(() => {
        document.title = 'TRIP TRACKER';
    }, []);

    // 화면을 열 때 클라우드 목록과 맞춘 뒤 다시 읽습니다. (다른 기기에서 추가·수정·삭제한 여행 반영)
    useEffect(() => {
        if (!cloud) return;
        let cancelled = false;
        syncAll()
            .then(() => !cancelled && setCloudSync({ state: 'done' }))
            .catch(error => !cancelled && setCloudSync({ state: 'failed', message: error instanceof Error ? error.message : String(error) }))
            .finally(() => !cancelled && setEntries(readAllTrips()));
        return () => {
            cancelled = true;
        };
    }, [cloud]);

    // 동기화로 기기 캐시가 바뀌거나(remote), 다른 탭에서 여행을 바꾸면(storage) 목록을 다시 읽습니다.
    useEffect(() => {
        const off = onSyncEvent(event => {
            if (event.type === 'remote') setEntries(readAllTrips());
        });
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key.startsWith('trip-tracker:')) setEntries(readAllTrips());
        };
        window.addEventListener('storage', onStorage);
        return () => {
            off();
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const create = (title: string) => {
        if (!canAddTrip()) {
            toast(`여행은 최대 ${MAX_TRIPS}개까지 저장할 수 있습니다.`);
            return;
        }
        const trip = createTrip(title);
        if (!writeTrip(trip)) toast('기기 저장 공간이 부족해 이 페이지에서만 임시로 유지됩니다. JSON 백업을 권장합니다.');
        markDirty(trip.id); // Supabase 업로드 예약
        setNewOpen(false);
        goTrip(trip.id); // 바로 새 여행 화면으로 이동
    };

    const remove = async (id: string, title: string) => {
        // 손상된 기기 사본은 기기에서만 지웁니다. (클라우드에 정상 사본이 있을 수 있으므로 휴지통으로 보내지 않음)
        if (readTrip(id).status !== 'ok') {
            if (!(await confirm({ title: '손상된 기기 사본을 삭제할까요?', message: '필요하면 먼저 ‘원본 내려받기’로 보관하세요.', confirmLabel: '삭제', danger: true }))) return;
            deleteTrip(id);
            refresh();
            void syncAll().then(refresh, () => {}); // 클라우드에 정상 사본이 있으면 다시 받아 옴
            return;
        }
        const ok = await confirm({
            title: `'${title}' 여행을 삭제할까요?`,
            message: cloud
                ? '날짜·장소·맛집이 모두 삭제되며, 이 앱을 쓰는 모든 기기에서 사라집니다.\n첫 화면 ‘저장·백업 → 휴지통’에서 복구할 수 있습니다.'
                : '이 기기에서 날짜·장소·맛집이 모두 삭제되며 되돌릴 수 없습니다.',
            confirmLabel: '여행 삭제',
            danger: true,
        });
        if (!ok) return;
        await removeTrip(id); // 기기에서 바로 지우고, 클라우드는 휴지통으로 (오프라인이면 연결 후 반영)
        refresh();
        toast('여행을 삭제했습니다.');
    };

    const addSample = () => {
        writeTrip(clone(SAMPLE_TRIP));
        markDirty(SAMPLE_TRIP.id);
        refresh();
        toast('예시 여행을 추가했습니다.');
    };

    const hasSample = entries.some(entry => entry.id === SAMPLE_TRIP.id);
    return (
        <>
            <AppHeader>
                <button type="button" className={headerButton} onClick={() => setStorageOpen(true)}><Cloud className="icon" />저장·백업</button>
                <button type="button" className={headerButton} onClick={onOpenSettings} aria-label="설정"><Settings className="icon" /></button>
            </AppHeader>

            <main className="mx-auto max-w-[1500px] px-[5%] pb-10 max-tab:px-[22px] max-phone:px-[15px] wide:px-[50px]">
                <section className="flex items-end justify-between gap-5 pt-12 pb-8 max-tab:py-[30px]">
                    <div>
                        <p className="eyebrow">MY TRIPS · {entries.length}</p>
                        <h1 className="m-0 text-[clamp(25px,3vw,38px)] leading-[1.3] font-[550] tracking-[-1.8px]">나의 여행</h1>
                        <p className="mt-[13px] text-[13px] text-muted">여행을 고르거나 새 여행을 만들어 일정·맛집·지도를 정리하세요.</p>
                        {/* 클라우드 동기화 상태 한 줄 */}
                        <p role="status" className="mt-1 text-[11px] text-muted">
                            {!cloud
                                ? 'Supabase 미설정 · 이 기기에만 저장됩니다.'
                                : cloudSync.state === 'syncing'
                                  ? '클라우드와 동기화 중…'
                                  : cloudSync.state === 'failed'
                                    ? `클라우드에 연결하지 못해 기기에 저장된 목록을 보여줍니다. 연결되면 자동으로 맞춥니다. (${cloudSync.message})`
                                    : (
                                        // 정상 연결: 문구 뒤에 초록 체크 SVG 아이콘
                                        <>
                                            클라우드 자동 저장 사용 중 <Check className="icon text-green" />
                                        </>
                                    )}
                        </p>
                    </div>
                    <button type="button" className="btn btn-primary shrink-0" onClick={() => setNewOpen(true)}><Plus className="icon" />새 여행</button>
                </section>

                {entries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
                        {cloudSync.state === 'syncing' ? '여행 목록을 불러오는 중…' : '아직 여행이 없습니다. ‘새 여행’으로 시작하세요.'}
                    </div>
                ) : (
                    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 p-0 max-phone:grid-cols-1">
                        {entries.map(entry => (
                            <li key={entry.id}>
                                <TripCard entry={entry} onDelete={remove} />
                            </li>
                        ))}
                    </ul>
                )}

                {!hasSample && (
                    <p className="mt-8 text-[12px] text-muted">
                        예시가 필요하면{' '}
                        <button type="button" className="btn-text p-0 underline" onClick={addSample}>
                            가고시마 예시 여행 추가
                        </button>
                    </p>
                )}
            </main>

            <footer className="mx-[5%] mt-4 mb-5 border-t border-line pt-5 text-[10px] text-muted print:hidden">
                TRIP TRACKER <span className="mx-[9px]">·</span> Supabase 자동 저장 / 구글지도
            </footer>

            <NewTripDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={create} />
            <HomeStorageDialog open={storageOpen} onClose={() => setStorageOpen(false)} onChanged={refresh} />
        </>
    );
}

/** 여행 카드 1개 */
function TripCard({ entry, onDelete }: { entry: StoredTrip; onDelete: (id: string, title: string) => void }) {
    // 저장값을 읽지 못한 여행: 원문 내려받기·삭제만 제공
    if (entry.status !== 'ok') {
        return (
            <article className="h-full rounded-[14px] border border-[#e8d1c4] bg-[#f7ede5] p-5 text-[12px] text-[#935e43]">
                <strong className="block text-[15px]">읽을 수 없는 여행</strong>
                <p className="my-2">{entry.status === 'broken' ? entry.error : '저장된 데이터가 없습니다.'}</p>
                <p className="my-2">이 기기의 손상된 사본이며 클라우드에는 올라가지 않습니다.</p>
                <div className="flex gap-2">
                    {entry.status === 'broken' && (
                        <button type="button" className="btn btn-outline" onClick={() => downloadText(`trip-tracker-raw-${entry.id}.json`, entry.raw)}>
                            원본 내려받기
                        </button>
                    )}
                    <button type="button" className="btn btn-danger" onClick={() => onDelete(entry.id, entry.id)}>삭제</button>
                </div>
            </article>
        );
    }
    const { trip } = entry;
    const range = formatDateRange(trip);
    const counts = countItems(trip);
    return (
        <article className="group relative h-full rounded-[14px] border border-line bg-paper shadow-card transition-colors hover:border-[#abbd9d]">
            {/* 카드 전체를 여행 화면 링크로 (삭제 버튼은 링크 위에 따로 배치) */}
            <a href={`#/trip/${trip.id}`} className="block h-full p-5 pr-12 no-underline">
                <p className="eyebrow">{[range || '날짜 미정', trip.companion].filter(Boolean).join(' · ')}</p>
                <h2 className="m-0 text-[20px] leading-[1.4] font-semibold tracking-[-0.6px]">{trip.title}</h2>
                {trip.tagline && <p className="mt-1.5 mb-0 text-[12px] text-muted">{trip.tagline}</p>}
                <p className="mt-4 mb-0 text-[11px] text-[#5b685b]">
                    <span className="text-gold">{trip.days.length} DAYS</span> · 일정 {counts.stops} · 후보 {counts.foods}
                </p>
                {trip.updatedAt && <small className="mt-1 block text-[10px] text-muted">{new Date(trip.updatedAt).toLocaleString('ko-KR')} 수정</small>}
            </a>
            <button
                type="button"
                onClick={() => onDelete(trip.id, trip.title)}
                aria-label={`${trip.title} 삭제`}
                className="absolute top-3 right-3 rounded-md px-2 py-1 text-[16px] text-muted hover:text-danger"
            >
                {/* 휴지통 SVG 아이콘 (선 색이 글자색을 따라가 마우스를 올리면 빨간색) */}
                <Trash2 className="icon" />
            </button>
        </article>
    );
}
