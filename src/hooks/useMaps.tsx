// Google 지도 스크립트 로드와 상태 공유.
//  - API 키가 있으면 APIProvider 가 Google Maps JavaScript API 를 한 번 불러옵니다.
//  - 앱 어디서든 useMaps() 로 로드 상태('no-key' / LOADING / LOADED / FAILED / AUTH_FAILURE)와 설정을 읽을 수 있습니다.

import { createContext, useContext, useState, type ReactNode } from 'react';
import { APIProvider, APILoadingStatus, useApiLoadingStatus } from '@vis.gl/react-google-maps';
import { loadGoogleMapsConfig, type GoogleMapsConfig } from '../lib/googleMaps';

/** 지도 상태: 키 없음 + 라이브러리의 로딩 상태 값 */
export type MapsStatus = 'no-key' | APILoadingStatus;

interface MapsContextValue {
    status: MapsStatus;
    config: GoogleMapsConfig;
}

const MapsContext = createContext<MapsContextValue>({ status: 'no-key', config: loadGoogleMapsConfig() });

/** 지도 상태·설정 읽기 */
export const useMaps = () => useContext(MapsContext);

/** 지도 기능을 쓸 준비가 됐는지 (스크립트 로드 완료) */
export const useMapsReady = () => useMaps().status === APILoadingStatus.LOADED;

export function MapsProvider({ children }: { children: ReactNode }) {
    // 키는 페이지를 연 시점의 값만 사용합니다. (Google 지도 스크립트는 한 페이지에서 한 번만 불러올 수 있음)
    const [config] = useState(loadGoogleMapsConfig);
    if (!config.apiKey) return <MapsContext.Provider value={{ status: 'no-key', config }}>{children}</MapsContext.Provider>;
    return (
        // language="ko": 지도 라벨·검색 결과를 한국어 우선으로 표시
        // libraries: 처음부터 함께 불러올 기능 (marker: 고급 마커, places: 장소 검색)
        <APIProvider apiKey={config.apiKey} language="ko" libraries={['marker', 'places']}>
            <StatusBridge config={config}>{children}</StatusBridge>
        </APIProvider>
    );
}

/** APIProvider 안쪽에서만 쓸 수 있는 로딩 상태 훅 값을 우리 컨텍스트로 옮겨 줍니다. */
function StatusBridge({ config, children }: { config: GoogleMapsConfig; children: ReactNode }) {
    const status = useApiLoadingStatus();
    return <MapsContext.Provider value={{ status, config }}>{children}</MapsContext.Provider>;
}
