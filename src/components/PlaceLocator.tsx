// "구글지도 URL 붙여넣기 → 위치 가져오기" 입력 영역. 장소·맛집 편집 화면에서 함께 사용합니다.
// URL 이 아닌 장소 이름·주소를 입력해도 Google 장소 검색으로 찾습니다.

import { useState } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import { gmaps } from '../lib/links';
import { resolveLocation, type FoundPlace, type LatLng } from '../lib/placeLookup';
import { ExternalLink } from './common';

interface PlaceLocatorProps {
    /** 현재 좌표 (아직 없으면 null) */
    lat: number | null;
    lng: number | null;
    /** 위치를 찾았을 때 호출 */
    onFound: (place: FoundPlace) => void;
    /** 이 근처 결과를 우선 검색 (예: 그날 첫 장소) */
    bias?: LatLng | null;
    /** 입력칸 라벨 */
    label?: string;
}

export function PlaceLocator({ lat, lng, onFound, bias, label = '구글지도 URL 또는 장소 이름' }: PlaceLocatorProps) {
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    // 결과 안내 문구와 성공/실패 여부
    const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

    const locate = async () => {
        if (busy) return;
        setBusy(true);
        setMessage(null);
        try {
            const place = await resolveLocation(input, bias);
            onFound(place);
            setMessage({ text: `위치를 가져왔습니다${place.name ? ` · ${place.name}` : ''}`, ok: true });
            setInput('');
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : String(error), ok: false });
        } finally {
            setBusy(false);
        }
    };

    const hasCoords = lat !== null && lng !== null;
    return (
        <div className="mb-3.5 rounded-[10px] border border-line bg-[#f7f8f2] p-3">
            <label className="field mb-2">
                {label}
                <div className="mt-[5px] flex gap-2">
                    <input
                        className="mt-0 min-w-0 flex-1"
                        value={input}
                        placeholder="https://maps.app.goo.gl/… 또는 가게 이름"
                        onChange={event => setInput(event.target.value)}
                        // 폼 안에서 Enter 를 누르면 저장이 아니라 위치 가져오기를 실행합니다.
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void locate();
                            }
                        }}
                    />
                    <button type="button" className="btn btn-outline shrink-0" onClick={() => void locate()} disabled={busy || !input.trim()}>
                        {busy ? '찾는 중…' : '위치 가져오기'}
                    </button>
                </div>
            </label>
            <p className="m-0 text-[11px] text-muted">
                구글지도 앱·웹에서 장소를 연 뒤 <b>공유 → 링크 복사</b> 또는 주소창 URL을 붙여넣으세요.
            </p>
            {message && <p className={`mt-1.5 mb-0 text-[11px] ${message.ok ? 'text-green' : 'text-danger'}`}>{message.text}</p>}
            <p className="mt-1.5 mb-0 text-[11px]">
                {hasCoords ? (
                    <>
                        <MapPin className="icon mr-1 text-green" />현재 위치 {lat.toFixed(5)}, {lng.toFixed(5)} ·{' '}
                        {/* 좌표를 구글지도에서 열어 맞는 위치인지 확인할 수 있게 합니다. (↗ 아이콘은 ExternalLink 가 붙임) */}
                        <ExternalLink href={gmaps(`${lat},${lng}`)} className="text-green">
                            지도에서 확인
                        </ExternalLink>
                    </>
                ) : (
                    <span className="text-danger">
                        <MapPinOff className="icon mr-1" />아직 위치가 없습니다.
                    </span>
                )}
            </p>
        </div>
    );
}
