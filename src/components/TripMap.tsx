// 하루 일정을 Google 지도에 표시하는 컴포넌트 (@vis.gl/react-google-maps).
//  - 방문 장소: 번호 핀(초록 원) + 방문 순서를 잇는 점선
//  - 맛집·카페: 다른 모양의 배지(🍴 식당 / ☕ 카페)
//  - API 키가 없거나 로드에 실패하면 지도 대신 안내를 보여줍니다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancedMarker, APILoadingStatus, InfoWindow, Map, Polyline, useMap } from '@vis.gl/react-google-maps';
import { formatTime } from '../lib/datetime';
import { gmaps } from '../lib/links';
import { useMaps } from '../hooks/useMaps';
import { useToast } from '../hooks/useToast';
import { ExternalLink } from './common';
import { FOOD_BADGE, FoodIcon } from './FoodCard';
import type { Food, Stop } from '../types';

/** 지도 포커스 요청. 같은 항목을 다시 눌러도 동작하도록 매번 다른 nonce 를 붙입니다. */
export interface FocusRequest {
    id: string;
    nonce: number;
}

interface TripMapProps {
    stops: Stop[];
    foods: Food[];
    /** 선택된 장소 또는 맛집 ID */
    selectedId: string;
    focusRequest: FocusRequest | null;
    /** 핀·배지를 눌렀을 때 (목록에서 해당 카드 선택) */
    onSelect: (id: string) => void;
    onStopDetail: (id: string) => void;
    onFoodEdit: (id: string) => void;
    /** 키가 없을 때 설정 화면 열기 */
    onOpenSettings: () => void;
}

/** 이 지도의 ID. useMap(MAP_ID) 로 지도 인스턴스를 꺼낼 때 사용합니다. */
const MAP_ID = 'trip-map';
/** 처음 표시 위치·확대 수준 (표시할 장소·맛집이 하나도 없을 때). 한국~일본이 한 화면에 보이는 넓은 지도 */
const DEFAULT_CENTER = { lat: 35.5, lng: 132 };
const DEFAULT_ZOOM = 5;
/** 지도 높이 (화면 크기별) */
const MAP_HEIGHT = 'h-[365px] max-tab:h-[310px] max-phone:h-[270px]';

/** 지도에 그릴 항목 하나 (장소 핀 또는 맛집 배지) */
type MapItem =
    | { type: 'stop'; id: string; position: google.maps.LatLngLiteral; number: number; stop: Stop }
    | { type: 'food'; id: string; position: google.maps.LatLngLiteral; food: Food };

export function TripMap(props: TripMapProps) {
    const { status } = useMaps();
    return (
        <div className="overflow-hidden rounded-[14px] border border-line bg-paper shadow-card">
            {status === APILoadingStatus.LOADED ? (
                <GoogleTripMap {...props} />
            ) : (
                <>
                    <div className="px-4 py-[13px] max-phone:p-[11px]">
                        <strong className="text-[12px] max-phone:text-[11px]">오늘의 이동 포인트</strong>
                    </div>
                    <MapPlaceholder status={status} onOpenSettings={props.onOpenSettings} />
                </>
            )}
        </div>
    );
}

/** 지도를 그릴 수 없을 때의 안내 영역 */
function MapPlaceholder({ status, onOpenSettings }: { status: ReturnType<typeof useMaps>['status']; onOpenSettings: () => void }) {
    let body;
    if (status === 'no-key') {
        body = (
            <>
                <strong className="text-[14px]">Google Maps API 키가 필요합니다</strong>
                <p className="my-2 text-[12px] text-muted">
                    ⚙ 설정에서 키를 입력하거나 .env.local 에 VITE_GOOGLE_MAPS_API_KEY 를 넣고 다시 실행하세요. 길찾기 버튼은 키 없이도 동작합니다.
                </p>
                <button type="button" className="btn btn-primary" onClick={onOpenSettings}>⚙ 지도 설정</button>
            </>
        );
    } else if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
        body = (
            <>
                <strong className="text-[14px] text-danger">지도를 불러오지 못했습니다</strong>
                <p className="my-2 text-[12px] text-muted">
                    API 키, 허용 웹사이트(HTTP 리퍼러)에 지금 주소가 있는지, Maps JavaScript API 사용 설정을 확인하세요.
                </p>
                <button type="button" className="btn btn-outline" onClick={onOpenSettings}>⚙ 지도 설정</button>
            </>
        );
    } else {
        body = <span className="text-[12px] text-muted">지도를 불러오는 중…</span>;
    }
    return <div className={`${MAP_HEIGHT} grid place-items-center bg-[#e9eee4] p-6 text-center`}><div>{body}</div></div>;
}

/** Google 지도 본체 (스크립트 로드 완료 후에만 렌더링) */
function GoogleTripMap({ stops, foods, selectedId, focusRequest, onSelect, onStopDetail, onFoodEdit }: TripMapProps) {
    const toast = useToast();
    const { config } = useMaps();
    // useMap(MAP_ID): 아래 <Map id={MAP_ID}> 가 만들어지면 그 google.maps.Map 인스턴스를 돌려줍니다. (그 전에는 null)
    const map = useMap(MAP_ID);
    /** 정보창을 열어 둔 항목 ID */
    const [infoId, setInfoId] = useState<string | null>(null);
    const [showFoods, setShowFoods] = useState(true);
    const [myPosition, setMyPosition] = useState<google.maps.LatLngLiteral | null>(null);
    /** 지도 영역 요소 (목록에서 선택했을 때 지도가 화면 밖이면 스크롤하기 위해) */
    const regionRef = useRef<HTMLDivElement>(null);

    // 지도에 그릴 항목 목록. 같은 좌표에 여러 번 방문하면 핀이 겹쳐 누를 수 없으므로 반복될 때마다 살짝 비켜 둡니다.
    const items = useMemo<MapItem[]>(() => {
        const counts = new globalThis.Map<string, number>(); // 이 파일의 Map(지도 컴포넌트)과 구분하기 위해 globalThis.Map
        const shift = (lat: number, lng: number) => {
            const key = `${lat},${lng}`;
            const n = counts.get(key) ?? 0;
            counts.set(key, n + 1);
            return { lat: lat + n * 0.00035, lng: lng + n * 0.00035 };
        };
        const list: MapItem[] = stops.map((stop, index) => ({ type: 'stop', id: stop.id, position: shift(stop.lat, stop.lng), number: index + 1, stop }));
        if (showFoods) {
            for (const food of foods) {
                if (food.lat === null || food.lng === null) continue; // 위치 없는 맛집은 지도에 표시하지 않음
                list.push({ type: 'food', id: food.id, position: shift(food.lat, food.lng), food });
            }
        }
        return list;
    }, [stops, foods, showFoods]);

    /** 모든 핀·배지가 보이도록 확대·이동 */
    const fitAll = useCallback(() => {
        if (!map || !items.length) return;
        if (items.length === 1) {
            map.setCenter(items[0].position);
            map.setZoom(15);
            return;
        }
        const bounds = new google.maps.LatLngBounds();
        items.forEach(item => bounds.extend(item.position));
        map.fitBounds(bounds, 40); // 40px 여백
        // 항목이 아주 가까이 모여 있으면 지나치게 확대되므로, 이동이 끝난 뒤(idle) 최대 16단계로 제한합니다.
        google.maps.event.addListenerOnce(map, 'idle', () => {
            if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
        });
    }, [map, items]);

    // 날짜가 바뀌거나 좌표가 바뀐 경우에만 전체 보기로 맞춥니다.
    // (체크 표시 같은 다른 변경 때 사용자가 움직인 지도가 되돌아가지 않도록 좌표 문자열을 의존성으로 사용)
    const coordsKey = items.map(item => `${item.id}:${item.position.lat},${item.position.lng}`).join('|');
    useEffect(() => {
        fitAll();
        // fitAll 은 items 가 바뀔 때마다 새로 만들어지므로 의존성에서 빼고 coordsKey 로만 판단합니다.
    }, [map, coordsKey]);

    // 목록에서 카드(또는 번호·배지)를 누르면 해당 위치로 이동하고 정보창을 엽니다.
    useEffect(() => {
        if (!focusRequest || !map) return;
        const item = items.find(entry => entry.id === focusRequest.id);
        if (!item) return; // 위치 없는 맛집이거나 맛집 숨김 상태
        map.panTo(item.position);
        if ((map.getZoom() ?? 0) < 14) map.setZoom(15);
        setInfoId(item.id);
        // 좁은 화면에서는 지도가 목록 위에 있어 화면 밖일 수 있으므로 지도까지 스크롤합니다.
        // (넓은 화면은 지도가 sticky 로 고정돼 항상 보이므로 스크롤하지 않음)
        // 판단 기준: 지도 아래쪽 1/3 이 화면 위로 가려졌거나, 지도 위쪽이 화면 아래로 벗어난 경우
        const region = regionRef.current;
        if (region) {
            const rect = region.getBoundingClientRect();
            if (rect.bottom < rect.height / 3 + 80 || rect.top > window.innerHeight - 80) {
                region.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        }
        // items 는 의존성에서 제외: 새 요청(nonce)이 왔을 때만 이동합니다.
    }, [focusRequest, map]);

    /** 브라우저 위치 권한으로 현재 위치 표시 */
    const locate = () => {
        if (!map || !navigator.geolocation) {
            toast('이 환경에서는 위치를 사용할 수 없습니다.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            position => {
                const point = { lat: position.coords.latitude, lng: position.coords.longitude };
                setMyPosition(point);
                map.panTo(point);
                map.setZoom(14);
                toast('내 위치를 표시했습니다. 구글지도에서는 현재 위치로 길찾기합니다.');
            },
            () => toast('위치 접근이 허용되지 않았습니다. 브라우저 권한을 확인하세요.'),
            { timeout: 12000 },
        );
    };

    const infoItem = infoId ? items.find(item => item.id === infoId) : undefined;
    const hiddenFoods = foods.filter(food => food.lat === null).length;

    return (
        <>
            <div className="flex items-center justify-between px-4 py-[13px] max-phone:p-[11px]">
                <strong className="text-[12px] max-phone:text-[11px]">오늘의 이동 포인트</strong>
                <div className="flex items-center gap-1">
                    <label className="mr-1 flex cursor-pointer items-center gap-1 text-[11px] text-muted">
                        <input type="checkbox" className="h-3.5 w-3.5 p-0 accent-green" checked={showFoods} onChange={event => setShowFoods(event.target.checked)} />
                        맛집
                    </label>
                    <button type="button" className="btn btn-mini" onClick={fitAll}>전체 보기</button>
                    <button type="button" className="btn btn-mini" onClick={locate} aria-label="내 위치 표시">◎ 내 위치</button>
                </div>
            </div>
            {/* scroll-mt: 좁은 화면에서 위에 고정된 날짜 탭(약 85px)에 지도가 가려지지 않도록 스크롤 위치를 띄웁니다. */}
            <div ref={regionRef} role="region" aria-label="방문 순서와 맛집이 표시된 지도" className="scroll-mt-[100px]">
                <Map
                    id={MAP_ID}
                    mapId={config.mapId} // 고급 마커(AdvancedMarker)를 쓰려면 Map ID 가 필요
                    // 첫 항목(장소 → 위치 있는 맛집 순) 근처에서 시작하고, 곧바로 fitAll 이 전체가 보이게 맞춥니다.
                    defaultCenter={items[0]?.position ?? DEFAULT_CENTER}
                    defaultZoom={items[0] ? 11 : DEFAULT_ZOOM}
                    gestureHandling="cooperative" // 페이지 스크롤 중 지도가 확대되지 않도록 (두 손가락·Ctrl+휠로 조작)
                    mapTypeControl={false}
                    streetViewControl={false}
                    clickableIcons={false} // 구글 기본 장소 아이콘 클릭 정보창 끄기
                    onClick={() => setInfoId(null)}
                    className={`${MAP_HEIGHT} bg-[#e2e9df]`}
                >
                    {/* 방문 순서를 잇는 점선 (실제 도로 경로 아님). 선은 투명하게 두고 짧은 선분 기호를 반복해 점선을 만듭니다. */}
                    {stops.length > 1 && (
                        <Polyline
                            path={stops.map(stop => ({ lat: stop.lat, lng: stop.lng }))}
                            strokeOpacity={0}
                            icons={[{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: '#8a9d7a', scale: 2 }, offset: '0', repeat: '10px' }]}
                        />
                    )}
                    {items.map(item => {
                        const selected = item.id === selectedId;
                        const open = () => {
                            onSelect(item.id);
                            setInfoId(item.id);
                        };
                        return item.type === 'stop' ? (
                            <AdvancedMarker
                                key={item.id}
                                position={item.position}
                                title={`${item.number}. ${item.stop.title}`}
                                onClick={open}
                                // anchorLeft/Top -50%: 원의 중심이 좌표에 오도록 (기본값은 아래쪽 가운데)
                                anchorLeft="-50%"
                                anchorTop="-50%"
                                // 선택된 핀을 맨 위에, 장소 핀은 맛집 배지보다 위에
                                zIndex={selected ? 1000 : 500 - item.number}
                            >
                                <span className={`pin ${selected ? 'pin-selected' : ''}`}>{item.number}</span>
                            </AdvancedMarker>
                        ) : (
                            <AdvancedMarker
                                key={item.id}
                                position={item.position}
                                title={item.food.name}
                                onClick={open}
                                anchorLeft="-50%"
                                anchorTop="-50%"
                                zIndex={selected ? 1000 : 100}
                            >
                                <span className={`food-badge food-badge-${item.food.category} ${selected ? 'food-badge-selected' : ''}`}>
                                    <FoodIcon category={item.food.category} />
                                </span>
                            </AdvancedMarker>
                        );
                    })}
                    {myPosition && (
                        <AdvancedMarker position={myPosition} title="내 위치" anchorLeft="-50%" anchorTop="-50%" zIndex={2000}>
                            <span className="block h-4 w-4 rounded-full border-[3px] border-white bg-[#267ac2] shadow-[0_0_0_4px_#267ac240]" />
                        </AdvancedMarker>
                    )}
                    {infoItem && (
                        // pixelOffset: 핀 위쪽에 정보창이 뜨도록 위로 18px
                        <InfoWindow
                            position={infoItem.position}
                            pixelOffset={[0, -18]}
                            // headerContent: 제목을 닫기(X) 버튼과 같은 줄에 둡니다. (없으면 X 줄이 비어 위쪽 공간이 생김)
                            headerContent={<InfoTitle item={infoItem} />}
                            onCloseClick={() => setInfoId(null)}
                            shouldFocus={false}
                        >
                            <InfoContent item={infoItem} onStopDetail={onStopDetail} onFoodEdit={onFoodEdit} />
                        </InfoWindow>
                    )}
                </Map>
            </div>
            <div className="px-3.5 py-2.5 text-[10px] leading-[1.6] text-muted max-phone:text-[9px]">
                <span className="mr-[5px] inline-block h-1.5 w-1.5 rounded-full bg-gold" /> 숫자는 방문 순서 · 🍴 식당 · ☕ 카페 · 점선은 순서 안내이며 실제 도로 경로가 아닙니다.
                {hiddenFoods > 0 && ` 위치 없는 맛집 ${hiddenFoods}곳은 지도에 표시되지 않습니다.`}
            </div>
        </>
    );
}

/** 정보창 제목 (닫기 버튼과 같은 줄에 표시) */
function InfoTitle({ item }: { item: MapItem }) {
    return (
        <strong className="map-info-title">
            {item.type === 'stop' ? `${item.number}. ${item.stop.title}` : `${FOOD_BADGE[item.food.category].icon} ${item.food.name}`}
        </strong>
    );
}

/** 정보창 본문: 한 줄 요약 + 링크·버튼 한 줄 */
function InfoContent({ item, onStopDetail, onFoodEdit }: { item: MapItem; onStopDetail: (id: string) => void; onFoodEdit: (id: string) => void }) {
    if (item.type === 'stop') {
        const { stop } = item;
        return (
            <div className="map-info">
                <p>
                    {formatTime(stop.start, stop.end, stop.timeNote)}
                    {stop.duration && ` · ${stop.duration}`}
                </p>
                <div className="map-info-actions">
                    <ExternalLink href={gmaps(stop.query, true, stop.mode)}>길찾기 ↗</ExternalLink>
                    <button type="button" className="btn btn-mini" onClick={() => onStopDetail(stop.id)}>
                        자세히
                    </button>
                </div>
            </div>
        );
    }
    const { food } = item;
    // 메뉴·예산을 " · " 로 이어 한 줄로 (둘 다 비어 있으면 줄 생략)
    const summary = [food.menu, food.budget].filter(Boolean).join(' · ');
    return (
        <div className="map-info">
            {summary && <p>{summary}</p>}
            <div className="map-info-actions">
                <ExternalLink href={gmaps(food.query, true)}>길찾기 ↗</ExternalLink>
                <ExternalLink href={gmaps(food.query, true, 'walking')}>도보 ↗</ExternalLink>
                <button type="button" className="btn btn-mini" onClick={() => onFoodEdit(food.id)}>
                    편집
                </button>
            </div>
        </div>
    );
}
