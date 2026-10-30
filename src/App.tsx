// 앱 최상위 컴포넌트: 주소(#/…)에 따라 여행 목록 또는 여행 화면을 보여줍니다.
// 설정 모달과 동기화 관리(SyncCoordinator)는 두 화면이 함께 씁니다.

import { useEffect, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { SettingsDialog } from './components/SettingsDialog';
import { SyncCoordinator } from './components/SyncCoordinator';
import { downloadText } from './lib/backup';
import { isCloudEnabled } from './lib/cloudTrips';
import { syncOne } from './lib/sync';
import { readTrip, type StoredTrip } from './lib/tripStore';
import { useHashRoute } from './hooks/useHashRoute';
import { HomePage } from './pages/HomePage';
import { TripPage } from './pages/TripPage';

export default function App() {
    const route = useHashRoute();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const openSettings = () => setSettingsOpen(true);

    return (
        <>
            {route.page === 'trip' ? (
                // key: 다른 여행으로 이동하면 화면 상태를 처음부터 다시 만듭니다.
                <TripRoute key={route.id} id={route.id} onOpenSettings={openSettings} />
            ) : (
                <HomePage onOpenSettings={openSettings} />
            )}
            <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <SyncCoordinator />
        </>
    );
}

/**
 * 여행 ID 로 여행을 찾아 여행 화면을 보여줍니다.
 * 기기 캐시에 없으면(공유받은 주소·새 기기) 클라우드에서 받아 온 뒤 보여주고, 그래도 없거나 손상됐으면 안내합니다.
 */
function TripRoute({ id, onOpenSettings }: { id: string; onOpenSettings: () => void }) {
    // 화면을 열 때 한 번 읽습니다. (이후 변경은 TripPage 의 useTrip 이 관리)
    const [stored, setStored] = useState<StoredTrip>(() => readTrip(id));
    // 기기에 없고 클라우드를 쓸 수 있으면 받아 오는 중으로 시작
    const [loading, setLoading] = useState(() => stored.status === 'missing' && isCloudEnabled());
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        if (!loading) return;
        let cancelled = false; // 화면을 떠난 뒤 늦게 도착한 응답 무시
        syncOne(id)
            .then(() => {
                if (!cancelled) setStored(readTrip(id)); // 받아 왔으면 기기 캐시에 들어 있음
            })
            .catch(error => {
                if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id, loading]);

    if (stored.status === 'ok') return <TripPage initialTrip={stored.trip} onOpenSettings={onOpenSettings} />;
    return (
        <>
            <AppHeader />
            <main className="mx-auto max-w-[700px] px-[22px] py-16 text-center">
                {loading ? (
                    <p className="text-[13px] text-muted">클라우드에서 여행을 불러오는 중…</p>
                ) : (
                    <>
                        <h1 className="text-[24px] font-semibold">{stored.status === 'missing' ? '여행을 찾을 수 없습니다' : '여행 데이터를 읽지 못했습니다'}</h1>
                        <p className="my-4 text-[13px] text-muted">
                            {stored.status === 'broken'
                                ? `기존 데이터는 지우지 않고 보존했습니다. 원본을 내려받아 확인하세요. (${stored.error})`
                                : loadError
                                  ? `클라우드에 연결하지 못했습니다. 인터넷 연결을 확인하세요. (${loadError})`
                                  : '삭제된 여행일 수 있습니다. 첫 화면의 ‘저장·백업 → 휴지통’에서 복구할 수 있습니다.'}
                        </p>
                        <div className="flex justify-center gap-2">
                            {stored.status === 'broken' && (
                                <button type="button" className="btn btn-outline" onClick={() => downloadText(`trip-tracker-raw-${id}.json`, stored.raw)}>
                                    원본 내려받기
                                </button>
                            )}
                            <a href="#/" className="btn btn-primary">여행 목록으로</a>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}
