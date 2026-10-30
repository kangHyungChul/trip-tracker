// 첫 화면: 여행 목록(카드) + 새 여행 만들기 + 저장·백업.

import { useEffect, useState } from 'react';
import { AppHeader, headerButton } from '../components/AppHeader';
import { HomeStorageDialog } from '../components/HomeStorageDialog';
import { NewTripDialog } from '../components/NewTripDialog';
import { downloadText } from '../lib/backup';
import { clone, createTrip } from '../lib/trip';
import { countItems, formatDateRange } from '../lib/tripSummary';
import { canAddTrip, deleteTrip, MAX_TRIPS, readAllTrips, SAMPLE_TRIP, writeTrip, type StoredTrip } from '../lib/tripStore';
import type { Cloud } from '../hooks/useCloud';
import { useConfirm } from '../hooks/useConfirm';
import { goTrip } from '../hooks/useHashRoute';
import { useToast } from '../hooks/useToast';

interface HomePageProps {
    cloud: Cloud;
    onOpenSettings: () => void;
}

export function HomePage({ cloud, onOpenSettings }: HomePageProps) {
    const toast = useToast();
    const confirm = useConfirm(); // 앱 자체 확인창
    // 기기에 저장된 모든 여행 (손상된 여행도 안내를 위해 포함)
    const [entries, setEntries] = useState<StoredTrip[]>(readAllTrips);
    const [newOpen, setNewOpen] = useState(false);
    const [storageOpen, setStorageOpen] = useState(false);
    const refresh = () => setEntries(readAllTrips());

    useEffect(() => {
        document.title = 'TRIP TRACKER';
    }, []);

    // 다른 탭에서 여행을 추가·수정·삭제하면 목록을 다시 읽습니다.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key.startsWith('trip-tracker:')) setEntries(readAllTrips());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const create = (title: string) => {
        if (!canAddTrip()) {
            toast(`여행은 최대 ${MAX_TRIPS}개까지 저장할 수 있습니다.`);
            return;
        }
        const trip = createTrip(title);
        if (!writeTrip(trip)) toast('기기 저장 공간이 부족해 이 페이지에서만 임시로 유지됩니다. JSON 백업을 권장합니다.');
        setNewOpen(false);
        goTrip(trip.id); // 바로 새 여행 화면으로 이동
    };

    const remove = async (id: string, title: string) => {
        const ok = await confirm({
            title: `'${title}' 여행을 삭제할까요?`,
            message: '이 기기에서 날짜·장소·맛집이 모두 삭제되며 되돌릴 수 없습니다.\n클라우드에 저장한 사본은 남아 있습니다.',
            confirmLabel: '여행 삭제',
            danger: true,
        });
        if (!ok) return;
        deleteTrip(id);
        refresh();
        toast('여행을 삭제했습니다.');
    };

    const addSample = () => {
        writeTrip(clone(SAMPLE_TRIP));
        refresh();
        toast('예시 여행을 추가했습니다.');
    };

    const hasSample = entries.some(entry => entry.id === SAMPLE_TRIP.id);
    return (
        <>
            <AppHeader>
                <button type="button" className={headerButton} onClick={() => setStorageOpen(true)}>☁ 저장·백업</button>
                <button type="button" className={headerButton} onClick={onOpenSettings} aria-label="설정">⚙</button>
            </AppHeader>

            <main className="mx-auto max-w-[1500px] px-[5%] pb-10 max-tab:px-[22px] max-phone:px-[15px] wide:px-[50px]">
                <section className="flex items-end justify-between gap-5 pt-12 pb-8 max-tab:py-[30px]">
                    <div>
                        <p className="eyebrow">MY TRIPS · {entries.length}</p>
                        <h1 className="m-0 text-[clamp(25px,3vw,38px)] leading-[1.3] font-[550] tracking-[-1.8px]">나의 여행</h1>
                        <p className="mt-[13px] text-[13px] text-muted">여행을 고르거나 새 여행을 만들어 일정·맛집·지도를 정리하세요.</p>
                    </div>
                    <button type="button" className="btn btn-primary shrink-0" onClick={() => setNewOpen(true)}>＋ 새 여행</button>
                </section>

                {entries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
                        아직 여행이 없습니다. ‘＋ 새 여행’으로 시작하세요.
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
                TRIP TRACKER <span className="mx-[9px]">·</span> 여행별 기기 자동 저장 / 클라우드 동기화 / 구글지도
            </footer>

            <NewTripDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={create} />
            <HomeStorageDialog open={storageOpen} onClose={() => setStorageOpen(false)} cloud={cloud} onChanged={refresh} />
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
                    <span className="text-gold">{trip.days.length} DAYS</span> · 장소 {counts.stops} · 맛집 {counts.foods}
                </p>
                {trip.updatedAt && <small className="mt-1 block text-[10px] text-muted">{new Date(trip.updatedAt).toLocaleString('ko-KR')} 수정</small>}
            </a>
            <button
                type="button"
                onClick={() => onDelete(trip.id, trip.title)}
                aria-label={`${trip.title} 삭제`}
                className="absolute top-3 right-3 rounded-md px-2 py-1 text-[16px] text-muted hover:text-danger"
            >
                🗑
            </button>
        </article>
    );
}
