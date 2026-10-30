// 하루 일정의 방문 순서를 번호 핀으로 보여주는 지도 (react-leaflet).
// 배경 지도는 일본 국토지리원 타일을 사용합니다. (API 키 불필요)

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { gmaps } from '../lib/links';
import { useToast } from '../hooks/useToast';
import { ExternalLink } from './common';
import type { Stop } from '../types';

/** 지도 포커스 요청. 같은 장소를 다시 눌러도 동작하도록 매번 다른 nonce 를 붙입니다. */
export interface FocusRequest {
    id: string;
    nonce: number;
}

interface TripMapProps {
    stops: Stop[];
    selectedId: string;
    focusRequest: FocusRequest | null;
    onMarkerClick: (id: string) => void;
    onDetail: (id: string) => void;
}

/** 가고시마 시내 중심 좌표 (첫 표시 위치) */
const DEFAULT_CENTER: L.LatLngTuple = [31.59, 130.56];

/** 번호 핀 아이콘 생성. className 을 비워 Leaflet 기본 흰 상자 스타일을 없애고 .pin 스타일만 씁니다. */
const pinIcon = (number: number, selected: boolean) =>
    L.divIcon({
        className: '',
        html: `<span class="pin ${selected ? 'pin-selected' : ''}">${number}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15], // 원의 중심이 좌표에 오도록
    });

export function TripMap({ stops, selectedId, focusRequest, onMarkerClick, onDetail }: TripMapProps) {
    const toast = useToast();
    // MapContainer 의 ref 로 Leaflet Map 인스턴스를 받습니다. (생성 전에는 null)
    const [map, setMap] = useState<L.Map | null>(null);
    // 장소 ID → 마커 인스턴스. 목록의 번호 버튼으로 팝업을 열 때 사용합니다.
    const markers = useRef(new Map<string, L.Marker>());
    const tileFailures = useRef(0);
    const [tileFailed, setTileFailed] = useState(false);
    const [myPosition, setMyPosition] = useState<L.LatLngTuple | null>(null);

    // 같은 좌표에 여러 번 방문하면 핀이 겹쳐 클릭할 수 없으므로, 반복될 때마다 살짝 비켜서 표시합니다.
    const positions = useMemo(() => {
        const counts = new Map<string, number>();
        return stops.map(stop => {
            const key = `${stop.lat},${stop.lng}`;
            const n = counts.get(key) ?? 0;
            counts.set(key, n + 1);
            return [stop.lat + n * 0.00035, stop.lng + n * 0.00035] as L.LatLngTuple;
        });
    }, [stops]);

    // 핀 아이콘은 순번·선택 상태가 바뀔 때만 새로 만듭니다. (새 아이콘 객체가 오면 Leaflet 이 핀 DOM 을 다시 그림)
    const icons = useMemo(() => stops.map((stop, index) => pinIcon(index + 1, stop.id === selectedId)), [stops, selectedId]);

    /** 오늘의 모든 핀이 보이도록 확대·이동 */
    const fitAll = () => {
        if (!map || !stops.length) return;
        map.invalidateSize(); // 레이아웃이 바뀐 뒤 지도 크기를 다시 계산
        map.fitBounds(L.latLngBounds(stops.map(stop => [stop.lat, stop.lng] as L.LatLngTuple)), { padding: [35, 35], maxZoom: 14 });
    };

    // 날짜가 바뀌거나 좌표가 바뀐 경우에만 전체 보기로 맞춥니다.
    // (체크 표시 같은 다른 변경 때 사용자가 움직인 지도가 되돌아가지 않도록 좌표 문자열을 의존성으로 사용)
    const coordsKey = stops.map(stop => `${stop.id}:${stop.lat},${stop.lng}`).join('|');
    useEffect(() => {
        fitAll();
    }, [map, coordsKey]);

    // 처음 그려질 때 컨테이너 크기가 확정되기 전일 수 있어 잠시 후 크기를 다시 계산합니다.
    useEffect(() => {
        if (!map) return;
        const timer = setTimeout(() => map.invalidateSize(), 100);
        return () => clearTimeout(timer);
    }, [map]);

    // 목록의 번호 버튼을 누르면 해당 핀의 팝업을 열고 그 위치로 이동합니다.
    // (기존 버전은 마커가 없을 때 getLatLng 호출로 오류가 났으므로 존재 여부를 먼저 확인)
    useEffect(() => {
        if (!focusRequest || !map) return;
        const marker = markers.current.get(focusRequest.id);
        if (!marker) return;
        marker.openPopup();
        map.panTo(marker.getLatLng());
    }, [focusRequest, map]);

    /** 브라우저 위치 권한으로 현재 위치를 표시 */
    const locate = () => {
        if (!map || !navigator.geolocation) {
            toast('이 환경에서는 위치를 사용할 수 없습니다.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            position => {
                const point: L.LatLngTuple = [position.coords.latitude, position.coords.longitude];
                setMyPosition(point);
                map.setView(point, 14);
                toast('내 위치를 표시했습니다. 구글지도에서는 현재 위치로 길찾기합니다.');
            },
            () => toast('위치 접근이 허용되지 않았습니다. 브라우저 권한을 확인하세요.'),
            { timeout: 12000 },
        );
    };

    return (
        <div className="overflow-hidden rounded-[14px] border border-line bg-paper shadow-card">
            <div className="flex items-center justify-between px-4 py-[13px] max-phone:p-[11px]">
                <strong className="text-[12px] max-phone:text-[11px]">오늘의 이동 포인트</strong>
                <div>
                    <button type="button" className="btn btn-mini" onClick={fitAll}>전체 보기</button>
                    <button type="button" className="btn btn-mini" onClick={locate} aria-label="내 위치 표시">◎ 내 위치</button>
                </div>
            </div>
            {/* MapContainer 는 aria 속성을 전달하지 않으므로 바깥 영역에 지도 설명을 붙입니다. */}
            <div role="region" aria-label="방문 순서가 표시된 지도">
                <MapContainer
                    ref={setMap}
                    center={DEFAULT_CENTER}
                    zoom={12}
                    scrollWheelZoom={false} // 페이지 스크롤 중 지도가 확대되는 것을 방지
                    className="z-0 h-[365px] bg-[#e2e9df] max-tab:h-[310px] max-phone:h-[270px]"
                >
                    <TileLayer
                        url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
                        attribution='<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル / 国土地理院</a>'
                        maxZoom={18}
                        minZoom={5}
                        eventHandlers={{
                            // 타일이 3번 이상 실패하면 안내 문구 표시, 하나라도 성공하면 숨김
                            tileerror: () => {
                                tileFailures.current += 1;
                                if (tileFailures.current >= 3) setTileFailed(true);
                            },
                            tileload: () => setTileFailed(false),
                        }}
                    />
                    {/* 방문 순서를 잇는 점선 (실제 도로 경로 아님) */}
                    {stops.length > 1 && (
                        <Polyline
                            positions={stops.map(stop => [stop.lat, stop.lng] as L.LatLngTuple)}
                            pathOptions={{ color: '#8a9d7a', weight: 2, dashArray: '5 7', opacity: 0.8 }}
                        />
                    )}
                    {stops.map((stop, index) => (
                        <Marker
                            key={stop.id}
                            position={positions[index]}
                            icon={icons[index]}
                            title={`${index + 1}. ${stop.title}`}
                            keyboard
                            // ref 콜백: 마커가 만들어지면 등록, 사라지면 제거
                            ref={marker => {
                                if (marker) markers.current.set(stop.id, marker);
                                else markers.current.delete(stop.id);
                            }}
                            eventHandlers={{ click: () => onMarkerClick(stop.id) }}
                        >
                            <Popup>
                                <strong>
                                    {index + 1}. {stop.title}
                                </strong>
                                <br />
                                {stop.time} · {stop.duration}
                                <br />
                                <ExternalLink href={gmaps(stop.query, true, stop.mode)}>구글지도 길찾기 ↗</ExternalLink>
                                <br />
                                <button type="button" className="btn btn-mini" onClick={() => onDetail(stop.id)}>
                                    자세히 · 맛집
                                </button>
                            </Popup>
                        </Marker>
                    ))}
                    {myPosition && (
                        <CircleMarker center={myPosition} radius={7} pathOptions={{ color: '#267ac2', fillOpacity: 0.9 }}>
                            <Popup>내 위치</Popup>
                        </CircleMarker>
                    )}
                </MapContainer>
            </div>
            {tileFailed && (
                <div className="p-2.5 text-[12px] text-danger">배경 지도를 불러오지 못했습니다. 아래 장소와 길찾기는 그대로 이용할 수 있습니다.</div>
            )}
            <div className="px-3.5 py-2.5 text-[10px] leading-[1.6] text-muted max-phone:text-[9px]">
                <span className="mr-[5px] inline-block h-1.5 w-1.5 rounded-full bg-gold" /> 숫자는 방문 순서 · 연결선은 순서 안내이며 실제 도로
                경로가 아닙니다.
            </div>
        </div>
    );
}
