// 앱 전체에서 쓰는 여행 데이터 타입 정의.
// 기기 저장(localStorage), JSON 백업, Supabase payload 모두 이 Trip 형식(version 3)을 그대로 저장합니다.
//
// version 3 변경점 (version 2 대비)
//  - 여행마다 고유 id (여러 여행 지원, 클라우드 trip_key 로도 사용)
//  - 맛집·카페가 장소(Stop) 안이 아니라 날짜(Day)의 별도 목록(foods)으로 분리, 지도 좌표 보유
//  - 방문 시간: 자유 문구 → 시작/종료 시각(HH:mm) + 메모
//  - 날짜: "10.31" 문구 → ISO 날짜(YYYY-MM-DD), 요일은 자동 계산
//  - 첫 화면 소개 문구(동행·한 줄 소개·강조 문구)를 여행별 데이터로 이동
//  - 여행별 통화(currency). 같은 version 3 안에서 추가된 필드라 없으면 JPY(예전 엔화 고정)로 보정

/** 맛집 종류: 지도 배지 모양이 달라집니다. */
import type { StopIcon } from './lib/stopIcons';
export type FoodCategory = 'restaurant' | 'cafe';

/** 날짜별 맛집·카페 후보 */
export interface Food {
    id: string;               // 여행 전체에서 유일한 ID (장소 ID 와도 겹치지 않음)
    category: FoodCategory;   // 식당 / 카페
    name: string;             // 가게 이름
    query: string;            // 구글지도 검색어·주소 (길찾기 목적지)
    lat: number | null;       // 지도 배지 위도 (아직 위치를 모르면 null → 지도에 표시 안 함)
    lng: number | null;       // 지도 배지 경도
    menu: string;             // 대표 메뉴
    budget: string;           // 예상 예산 (자유 문구)
    kind: string;             // 선정 이유·스타일
    hours: string;            // 영업시간·휴무
    parking: string;          // 주차 안내
    source: string;           // 출처 URL
}

/** 비용 단위: adult = 1인당(인원수 곱함), vehicle = 차량·전체 1회 금액 */
export type CostUnit = 'adult' | 'vehicle';
/** 구글지도 길찾기 이동수단 */
export type TravelMode = 'driving' | 'walking';

/** 하루 일정 안의 방문 장소 */
export interface Stop {
    id: string;           // 여행 전체에서 유일한 ID
    start: string;        // 시작 시각 "HH:mm" (없으면 빈 문자열)
    end: string;          // 종료 시각 "HH:mm" (없으면 빈 문자열)
    timeNote: string;     // 시간 메모 (예: "예상", "선택", "까지")
    title: string;        // 장소 이름
    query: string;        // 구글지도 검색어 (길찾기 목적지)
    lat: number;          // 지도 핀 위도
    lng: number;          // 지도 핀 경도
    duration: string;     // 체류시간
    fee: string;          // 비용 설명 문구
    amount: number;       // 합계에 더할 기본금액 (여행 통화 기준)
    unit: CostUnit;       // amount 의 단위
    extraAmount: number;  // 인원과 무관하게 1회 더하는 추가 고정비 (여행 통화 기준). 예) 센간엔 주차 ¥500
    parking: string;      // 주차 안내
    parkingQuery: string; // 주차장 구글지도 검색어 (없으면 빈 문자열)
    note: string;         // 설명·메모
    source: string;       // 공식·참고 URL
    kind: string;         // 종류 태그 (관광, 식사, 숙소 …)
    icon?: StopIcon;       // 지도 아이콘. 이전 백업은 종류에 따라 기본값 지정
    mode: TravelMode;     // 길찾기 이동수단
    done: boolean;        // 방문 완료 체크
}

/** 하루 일정 */
export interface Day {
    id: string;       // 날짜 ID (순번과 분리된 문자열)
    date: string;     // ISO 날짜 "YYYY-MM-DD" (미정이면 빈 문자열). 요일은 화면에서 자동 계산
    dateNote: string; // 날짜 옆 짧은 메모 (예: "공휴일")
    title: string;    // 날짜 제목
    subtitle: string; // 부제 (첫 '·' 앞부분이 날짜 탭에 표시됨)
    hotel: string;    // 숙소·마무리 장소
    pace: string;     // 일정 강도 문구
    warning: string;  // 주의 문구
    tight: boolean;   // 빠듯한 날이면 주의 박스를 강조 색으로 표시
    costNote: string; // 비용 합계 아래 덧붙일 안내 (없으면 빈 문자열)
    stops: Stop[];    // 방문 순서대로 정렬된 장소 목록
    foods: Food[];    // 그날의 맛집·카페 후보
}

/** 여행 전체 (저장 단위) */
export interface Trip {
    version: 3;
    id: string;           // 여행 ID (영문·숫자·-·_). 기기 저장 키와 클라우드 trip_key 로 사용
    title: string;        // 여행 제목
    companion: string;    // 동행 문구 (예: "부모님과 둘이") — 날짜 범위 옆에 표시
    tagline: string;      // 한 줄 소개
    highlight: string;    // 오른쪽 강조 문구 (예: "전 일정 렌터카")
    highlightSub: string; // 강조 보조 문구 (예: "실크인 2박 → 시로야마 1박")
    travelers: number;    // 여행 인원 (1~20)
    currency: string;     // 금액 통화 ISO 코드 (KRW, JPY, USD …). 없던 예전 데이터는 JPY 로 채움
    checkedAt?: string;   // 정보 확인일 (선택)
    updatedAt?: string;   // 마지막 기기 저장 시각 (선택)
    notes: string;        // 여행 메모
    days: Day[];          // 날짜 목록 (새 여행은 0일로 시작 가능)
}
