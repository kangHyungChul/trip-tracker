// 앱 최상위 컴포넌트: 주소(#/…)에 따라 여행 목록 또는 여행 화면을 보여줍니다.
// 클라우드 연결(useCloud)과 ⚙ 설정 모달은 두 화면이 함께 씁니다.

import { useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { SettingsDialog } from './components/SettingsDialog';
import { downloadText } from './lib/backup';
import { readTrip } from './lib/tripStore';
import { useCloud, type Cloud } from './hooks/useCloud';
import { useHashRoute } from './hooks/useHashRoute';
import { HomePage } from './pages/HomePage';
import { TripPage } from './pages/TripPage';

export default function App() {
    const route = useHashRoute();
    const cloud = useCloud();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const openSettings = () => setSettingsOpen(true);

    return (
        <>
            {route.page === 'trip' ? (
                // key: 다른 여행으로 이동하면 화면 상태를 처음부터 다시 만듭니다.
                <TripRoute key={route.id} id={route.id} cloud={cloud} onOpenSettings={openSettings} />
            ) : (
                <HomePage cloud={cloud} onOpenSettings={openSettings} />
            )}
            <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
    );
}

/** 여행 ID 로 저장된 여행을 읽어 여행 화면을 보여주거나, 없거나 손상됐으면 안내합니다. */
function TripRoute({ id, cloud, onOpenSettings }: { id: string; cloud: Cloud; onOpenSettings: () => void }) {
    // 화면을 열 때 한 번만 읽습니다. (이후 변경은 TripPage 의 useTrip 이 관리)
    const [stored] = useState(() => readTrip(id));
    if (stored.status === 'ok') return <TripPage initialTrip={stored.trip} cloud={cloud} onOpenSettings={onOpenSettings} />;
    return (
        <>
            <AppHeader />
            <main className="mx-auto max-w-[700px] px-[22px] py-16 text-center">
                <h1 className="text-[24px] font-semibold">{stored.status === 'missing' ? '여행을 찾을 수 없습니다' : '여행 데이터를 읽지 못했습니다'}</h1>
                <p className="my-4 text-[13px] text-muted">
                    {stored.status === 'missing'
                        ? '삭제됐거나 다른 기기에서만 저장된 여행입니다. 첫 화면의 ‘저장·백업’에서 클라우드 여행을 가져올 수 있습니다.'
                        : `기존 데이터는 지우지 않고 보존했습니다. 원본을 내려받아 확인하세요. (${stored.error})`}
                </p>
                <div className="flex justify-center gap-2">
                    {stored.status === 'broken' && (
                        <button type="button" className="btn btn-outline" onClick={() => downloadText(`trip-tracker-raw-${id}.json`, stored.raw)}>
                            원본 내려받기
                        </button>
                    )}
                    <a href="#/" className="btn btn-primary">여행 목록으로</a>
                </div>
            </main>
        </>
    );
}
