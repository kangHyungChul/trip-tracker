// 하루 일정을 Google 지도에 표시하는 컴포넌트 (@vis.gl/react-google-maps).
//  - 방문 장소: 아이콘·번호 핀 + 사용자가 요청한 실제 이동 경로
//  - 맛집·카페: 다른 모양의 배지(포크·나이프 = 식당 / 커피잔 = 카페 SVG 아이콘)
//  - API 키가 없거나 로드에 실패하면 지도 대신 안내를 보여줍니다.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AdvancedMarker, APILoadingStatus, InfoWindow, Map, Polyline, useMap } from '@vis.gl/react-google-maps';
import { LocateFixed, Settings } from 'lucide-react';
import { formatTime } from '../lib/datetime';
import { gmaps } from '../lib/links';
import { useMaps } from '../hooks/useMaps';
import { useToast } from '../hooks/useToast';
import { ExternalLink } from './common';
import { FoodIcon } from './FoodCard';
import { StopIcon, stopIconName } from './StopIcon';
import { formatRouteDistance, formatRouteDuration, routeClient, routeKey, type RouteResult } from '../lib/routes';
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
    /**
     * 휴대폰 전체화면 모드: 부모 영역을 꽉 채우고, 한 손가락으로 지도를 움직이며(greedy),
     * 상단 버튼을 지도 위에 띄웁니다. 아래에 바텀시트가 겹쳐 있다는 전제입니다.
     */
    fill?: boolean;
    /** 지도 아래쪽을 가리는 높이(px, 바텀시트). 위치 이동·전체 보기 때 이만큼을 피해 보이는 영역 가운데에 맞춥니다. */
    bottomInset?: number;
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
        // fill: 부모 높이를 꽉 채우고 테두리·둥근 모서리 없이 / 기본: 카드 모양
        <div className={props.fill ? 'relative h-full bg-paper' : 'overflow-hidden rounded-[14px] border border-line bg-paper shadow-card'}>
            {status === APILoadingStatus.LOADED ? (
                <GoogleTripMap {...props} />
            ) : (
                <>
                    {!props.fill && (
                        <div className="px-4 py-[13px] max-phone:p-[11px]">
                            <strong className="text-[12px] max-phone:text-[11px]">오늘의 이동 포인트</strong>
                        </div>
                    )}
                    <MapPlaceholder status={status} onOpenSettings={props.onOpenSettings} fill={props.fill} />
                </>
            )}
        </div>
    );
}

/** 지도를 그릴 수 없을 때의 안내 영역 */
function MapPlaceholder({ status, onOpenSettings, fill }: { status: ReturnType<typeof useMaps>['status']; onOpenSettings: () => void; fill?: boolean }) {
    let body;
    if (status === 'no-key') {
        body = (
            <>
                <strong className="text-[14px]">Google Maps API 키가 필요합니다</strong>
                <p className="my-2 text-[12px] text-muted">
                    설정에서 키를 입력하거나 .env.local 에 VITE_GOOGLE_MAPS_API_KEY 를 넣고 다시 실행하세요. 길찾기 버튼은 키 없이도 동작합니다.
                </p>
                <button type="button" className="btn btn-primary" onClick={onOpenSettings}><Settings className="icon" />지도 설정</button>
            </>
        );
    } else if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
        body = (
            <>
                <strong className="text-[14px] text-danger">지도를 불러오지 못했습니다</strong>
                <p className="my-2 text-[12px] text-muted">
                    API 키, 허용 웹사이트(HTTP 리퍼러)에 지금 주소가 있는지, Maps JavaScript API 사용 설정을 확인하세요.
                </p>
                <button type="button" className="btn btn-outline" onClick={onOpenSettings}><Settings className="icon" />지도 설정</button>
            </>
        );
    } else {
        body = <span className="text-[12px] text-muted">지도를 불러오는 중…</span>;
    }
    // fill 모드: 아래쪽은 바텀시트가 가리므로 안내를 위쪽(items-start)에 둡니다.
    const layout = fill ? 'h-full place-items-start pt-10' : `${MAP_HEIGHT} place-items-center`;
    return <div className={`${layout} grid bg-[#e9eee4] p-6 text-center`}><div>{body}</div></div>;
}

/** Google 지도 본체 (스크립트 로드 완료 후에만 렌더링) */
function GoogleTripMap({ stops, foods, selectedId, focusRequest, onSelect, onStopDetail, onFoodEdit, fill = false, bottomInset = 0 }: TripMapProps) {
    const toast = useToast();
    const { config } = useMaps();
    // useMap(MAP_ID): 아래 <Map id={MAP_ID}> 가 만들어지면 그 google.maps.Map 인스턴스를 돌려줍니다. (그 전에는 null)
    const map = useMap(MAP_ID);
    /** 정보창을 열어 둔 항목 ID */
    const [infoId, setInfoId] = useState<string | null>(null);
    const [showFoods, setShowFoods] = useState(true);
    const [myPosition, setMyPosition] = useState<google.maps.LatLngLiteral | null>(null);
    const routingKey = routeKey(stops);
    const routeRequest = useRef(0);
    const routeBusy = useRef(false);
    const [routeState, setRouteState] = useState<{ key: string; loading: boolean; results: RouteResult[]; error: string; diagnostic?: string } | null>(null);
    const currentRoute = routeState?.key === routingKey ? routeState : null;
    const routeResults = currentRoute?.results;
    const confirmedLegs = routeResults?.reduce((sum, result) => sum + (result.data ? result.batch.end - result.batch.start : 0), 0) ?? 0;
    // 날짜·위치·순서·이동수단 변경 시 이전 응답과 남은 요청을 무효화합니다. 자동 호출은 하지 않습니다.
    useLayoutEffect(() => {
        routeBusy.current = false;
        return () => { routeRequest.current++; };
    }, [routingKey]);
    const calculateRoutes = async () => {
        if (routeBusy.current || stops.length < 2) return;
        routeBusy.current = true;
        const requestId = ++routeRequest.current;
        setRouteState({ key: routingKey, loading: true, results: [], error: '' });
        try {
            const response = await routeClient.calculate(stops, () => routeRequest.current === requestId);
            if (routeRequest.current !== requestId) return;
            setRouteState({ key: routingKey, loading: false, ...response });
        } catch {
            if (routeRequest.current === requestId) setRouteState({ key: routingKey, loading: false, results: [], error: '경로 계산을 시작하지 못했습니다. 잠시 후 다시 시도하세요.' });
        } finally {
            if (routeRequest.current === requestId) routeBusy.current = false;
        }
    };
    /** 지도 영역 요소 (목록에서 선택했을 때 지도가 화면 밖이면 스크롤하기 위해) */
    const regionRef = useRef<HTMLDivElement>(null);
    /** 최신 아래쪽 가림 높이 (fitAll 처럼 나중에 실행되는 함수에서 읽기 위해 ref 로 보관) */
    const insetRef = useRef(bottomInset);
    // 아래 effect 들보다 먼저 실행되도록 맨 앞에서 갱신합니다.
    useLayoutEffect(() => {
        insetRef.current = bottomInset;
    }, [bottomInset]);

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
        if (items.length === 1 && !routeResults?.length) {
            map.setZoom(15);
            map.setCenter(shiftForInset(map, items[0].position, insetRef.current));
            return;
        }
        const bounds = new google.maps.LatLngBounds();
        items.forEach(item => bounds.extend(item.position));
        routeResults?.forEach(result => result.data?.path.forEach(point => bounds.extend(point)));
        // 40px 여백. 아래가 바텀시트로 가려지면 그만큼 아래 여백을 더해 보이는 영역 안에 모두 들어오게 합니다.
        // (fill 모드는 위쪽에 지도 버튼이 떠 있으므로 위 여백도 조금 더)
        map.fitBounds(bounds, { top: fill ? 150 : 40, right: 40, left: 40, bottom: 40 + insetRef.current });
        // 항목이 아주 가까이 모여 있으면 지나치게 확대되므로, 이동이 끝난 뒤(idle) 최대 16단계로 제한합니다.
        google.maps.event.addListenerOnce(map, 'idle', () => {
            if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
        });
    }, [map, items, fill, routeResults]);

    // 날짜가 바뀌거나 좌표가 바뀐 경우에만 전체 보기로 맞춥니다.
    // (체크 표시 같은 다른 변경 때 사용자가 움직인 지도가 되돌아가지 않도록 좌표 문자열을 의존성으로 사용)
    const coordsKey = items.map(item => `${item.id}:${item.position.lat},${item.position.lng}`).join('|');
    useEffect(() => {
        fitAll();
        // fitAll 은 items 가 바뀔 때마다 새로 만들어지므로 의존성에서 빼고 coordsKey 로만 판단합니다.
    }, [map, coordsKey, routeResults]);

    // 목록에서 카드(또는 번호·배지)를 누르면 해당 위치로 이동하고 정보창을 엽니다.
    useEffect(() => {
        if (!focusRequest || !map) return;
        const item = items.find(entry => entry.id === focusRequest.id);
        if (!item) return; // 위치 없는 맛집이거나 맛집 숨김 상태
        // 확대를 먼저 맞춘 뒤, 그 확대 수준 기준으로 바텀시트에 가리지 않는 위치로 이동합니다.
        if ((map.getZoom() ?? 0) < 14) map.setZoom(15);
        map.panTo(shiftForInset(map, item.position, insetRef.current));
        setInfoId(item.id);
        // 좁은 화면에서는 지도가 목록 위에 있어 화면 밖일 수 있으므로 지도까지 스크롤합니다.
        // (넓은 화면은 지도가 sticky 로 고정돼 항상 보이고, fill 모드는 페이지가 스크롤되지 않으므로 제외)
        // 판단 기준: 지도 아래쪽 1/3 이 화면 위로 가려졌거나, 지도 위쪽이 화면 아래로 벗어난 경우
        const region = regionRef.current;
        if (region && !fill) {
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

    // 지도 조작 버튼 (맛집 표시 / 전체 보기 / 내 위치)
    const controls = (
        <div className="flex items-center gap-1">
            <label className="mr-1 flex cursor-pointer items-center gap-1 text-[11px] text-muted">
                <input type="checkbox" className="h-3.5 w-3.5 p-0 accent-green" checked={showFoods} onChange={event => setShowFoods(event.target.checked)} />
                맛집
            </label>
            <button type="button" className="btn btn-mini" onClick={fitAll}>전체 보기</button>
            <button type="button" className="btn btn-mini" onClick={locate} aria-label="내 위치 표시"><LocateFixed className="icon" />내 위치</button>
        </div>
    );

    const routePanel = (
        <div className={fill ? 'absolute top-[52px] right-2.5 left-2.5 z-[2] rounded-[10px] bg-paper/95 px-3 py-2 shadow-card' : 'border-t border-line px-4 py-2.5'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted">{stops.length < 2 ? '장소를 2곳 이상 추가하면 경로를 볼 수 있어요.' : '자동차 실선 · 도보 점선 · 교통 미반영'}</span>
                {stops.length > 1 && <button type="button" className="btn btn-mini" onClick={calculateRoutes} disabled={currentRoute?.loading || (!!currentRoute && !currentRoute.error)}>
                    {currentRoute?.loading ? '경로 계산 중…' : currentRoute?.error ? '경로 다시 시도' : currentRoute ? '경로 표시 중' : '실제 경로 보기'}
                </button>}
            </div>
            <div role="status" aria-live="polite" className="mt-1 text-[11px] text-muted">
                {!currentRoute && stops.length > 1 && `버튼을 누르면 일정 순서대로 경로를 계산합니다.${routeState ? ' 변경된 일정은 다시 계산해 주세요.' : ''}`}
                {currentRoute?.loading && '경로를 불러오고 있습니다.'}
                {currentRoute?.error && <span className="text-danger">{currentRoute.error}</span>}
                {currentRoute && !currentRoute.loading && !currentRoute.error && `${confirmedLegs}/${Math.max(0, stops.length - 1)}개 이동 구간 확인${confirmedLegs < stops.length - 1 ? ' · 경로 확인이 필요한 구간이 있어요.' : ''}`}
            </div>
            {currentRoute?.diagnostic && (
                <details className="mt-1 text-[11px]">
                    <summary className="cursor-pointer text-danger">오류 상세</summary>
                    <p className="mt-1 max-h-[100px] overflow-y-auto break-all whitespace-pre-wrap text-muted">{currentRoute.diagnostic}</p>
                </details>
            )}
            {currentRoute && !currentRoute.loading && (
                <details className="mt-1 text-[11px]">
                    <summary className="cursor-pointer text-green">구간별 이동 정보·길찾기</summary>
                    <div className="mt-2 max-h-[150px] overflow-y-auto overscroll-contain" data-sheet-nodrag="">
                        {stops.slice(1).map((stop, i) => {
                            const result = routeResults?.find(r => r.batch.start <= i && r.batch.end > i);
                            const leg = result?.data?.legs[i - result.batch.start];
                            return <div key={`${stops[i].id}-${stop.id}`} className="flex flex-wrap items-center justify-between gap-1 border-b border-line py-1.5">
                                <span>{i + 1} → {i + 2} · {stop.mode === 'walking' ? '도보' : '자동차'} · {leg ? `${formatRouteDuration(leg.durationMillis)} · ${formatRouteDistance(leg.distanceMeters)}` : '경로 확인 필요'}</span>
                                <ExternalLink href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${stops[i].lat},${stops[i].lng}`)}&destination=${encodeURIComponent(`${stop.lat},${stop.lng}`)}&travelmode=${stop.mode}`}>구글지도</ExternalLink>
                            </div>;
                        })}
                        <p className="mt-2 text-muted">각 장소의 이동수단은 이전 장소에서 오는 구간 기준입니다. 맛집·카페 후보는 동선에서 제외됩니다.</p>
                    </div>
                </details>
            )}
            {routeResults?.flatMap(r => r.data?.warnings ?? []).map((warning, i) => <p key={`${i}-${warning}`} className="mt-1 text-[10px] text-muted">{warning}</p>)}
        </div>
    );

    return (
        <>
            {fill ? (
                // fill 모드: 제목 줄 없이 버튼만 지도 오른쪽 위에 띄웁니다.
                <div className="absolute top-2.5 right-2.5 z-[2] rounded-[10px] bg-paper/95 px-2 py-1.5 shadow-card">{controls}</div>
            ) : (
                <div className="flex items-center justify-between px-4 py-[13px] max-phone:p-[11px]">
                    <strong className="text-[12px] max-phone:text-[11px]">오늘의 이동 포인트</strong>
                    {controls}
                </div>
            )}
            {routePanel}
            {/* scroll-mt: 좁은 화면에서 위에 고정된 날짜 탭(약 85px)에 지도가 가려지지 않도록 스크롤 위치를 띄웁니다. */}
            <div ref={regionRef} role="region" aria-label="방문 순서와 맛집이 표시된 지도" className={fill ? 'h-full' : 'scroll-mt-[100px]'}>
                <Map
                    id={MAP_ID}
                    mapId={config.mapId} // 고급 마커(AdvancedMarker)를 쓰려면 Map ID 가 필요
                    // 첫 항목(장소 → 위치 있는 맛집 순) 근처에서 시작하고, 곧바로 fitAll 이 전체가 보이게 맞춥니다.
                    defaultCenter={items[0]?.position ?? DEFAULT_CENTER}
                    defaultZoom={items[0] ? 11 : DEFAULT_ZOOM}
                    // greedy: 한 손가락으로 바로 이동·확대 (fill 모드는 페이지가 스크롤되지 않으므로 ‘두 손가락을 사용하세요’ 안내 없이 조작)
                    // cooperative: 페이지 스크롤 중 지도가 움직이지 않도록 두 손가락·Ctrl+휠로만 조작
                    gestureHandling={fill ? 'greedy' : 'cooperative'}
                    mapTypeControl={false}
                    streetViewControl={false}
                    // fill 모드: 확대·전체화면 버튼은 손가락 확대로 대신하고, 아래 바텀시트·위 버튼과 겹치지 않게 숨깁니다.
                    zoomControl={!fill}
                    fullscreenControl={!fill}
                    cameraControl={!fill}
                    clickableIcons={false} // 구글 기본 장소 아이콘 클릭 정보창 끄기
                    onClick={() => setInfoId(null)}
                    className={`${fill ? 'h-full' : MAP_HEIGHT} bg-[#e2e9df]`}
                >
                    {routeResults?.map(({ batch, data }) => data && (
                        <Polyline
                            key={`${batch.start}-${batch.end}`}
                            path={data.path}
                            strokeColor="#426b50"
                            strokeWeight={4}
                            strokeOpacity={batch.mode === 'walking' ? 0 : 0.85}
                            icons={batch.mode === 'walking' ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#426b50', strokeWeight: 3, scale: 1 }, offset: '0', repeat: '9px' }] : []}
                        />
                    ))}
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
                                <span className={`pin ${selected ? 'pin-selected' : ''}`}>
                                    <StopIcon name={stopIconName(item.stop)} className="size-[18px]" />
                                    <span className="pin-number">{item.number}</span>
                                </span>
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
                                    <FoodIcon category={item.food.category} className="size-4" />
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
            {/* 범례: fill 모드는 바텀시트에 가려지므로 생략 */}
            {!fill && (
                <div className="px-3.5 py-2.5 text-[10px] leading-[1.6] text-muted max-phone:text-[9px]">
                    숫자는 방문 순서 · 핀 안의 아이콘은 장소 종류 · <FoodIcon category="restaurant" /> 식당 후보 · <FoodIcon category="cafe" /> 카페 후보 · 실제 경로는 버튼을 눌러 표시합니다.
                    {hiddenFoods > 0 && ` 위치 없는 맛집 ${hiddenFoods}곳은 지도에 표시되지 않습니다.`}
                </div>
            )}
        </>
    );
}

/**
 * 아래쪽이 inset(px)만큼 가려진 지도에서, position 이 ‘보이는 영역’의 가운데에 오도록 할 지도 중심 좌표.
 * 지도 중심을 inset/2 픽셀만큼 남쪽(아래)으로 옮기면 position 은 그만큼 위로 올라가 보입니다.
 * 지도 투영(projection)이 아직 준비되지 않았거나 inset 이 0이면 원래 좌표를 그대로 돌려줍니다.
 */
function shiftForInset(map: google.maps.Map, position: google.maps.LatLngLiteral, inset: number): google.maps.LatLngLiteral {
    const projection = map.getProjection();
    const zoom = map.getZoom();
    if (!inset || !projection || zoom === undefined) return position;
    // fromLatLngToPoint: 위경도 → ‘세계 좌표’(확대 0 기준 픽셀). 확대 z 에서는 화면 픽셀 = 세계 좌표 × 2^z
    const point = projection.fromLatLngToPoint(position);
    if (!point) return position;
    const shifted = new google.maps.Point(point.x, point.y + inset / 2 / 2 ** zoom);
    return projection.fromPointToLatLng(shifted)?.toJSON() ?? position;
}

/** 정보창 제목 (닫기 버튼과 같은 줄에 표시) */
function InfoTitle({ item }: { item: MapItem }) {
    return (
        <strong className="map-info-title">
            {item.type === 'stop' ? (
                `${item.number}. ${item.stop.title}`
            ) : (
                // 맛집: 종류 아이콘(SVG) + 이름. 아이콘 색은 식당 주황 / 카페 갈색(배지와 같은 색)
                <>
                    <FoodIcon category={item.food.category} className={`mr-1 ${item.food.category === 'cafe' ? 'text-[#8a5a3c]' : 'text-[#e8743b]'}`} />
                    {item.food.name}
                </>
            )}
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
                    <ExternalLink href={gmaps(stop.query, true, stop.mode)}>길찾기</ExternalLink>
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
                <ExternalLink href={gmaps(food.query, true)}>길찾기</ExternalLink>
                <ExternalLink href={gmaps(food.query, true, 'walking')}>도보</ExternalLink>
                <button type="button" className="btn btn-mini" onClick={() => onFoodEdit(food.id)}>
                    편집
                </button>
            </div>
        </div>
    );
}
