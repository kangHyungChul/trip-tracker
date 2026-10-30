// 앱 전체에서 쓰는 여행 데이터 타입 정의.
// 기기 저장(localStorage), JSON 백업, Supabase payload 모두 이 Trip 형식(version 2)을 그대로 저장합니다.

/** 장소에 딸린 식당·카페 후보 */
export interface Food {
    name: string;    // 식당 이름
    query: string;   // 구글지도 검색어·주소 (길찾기 목적지)
    menu: string;    // 대표 메뉴
    budget: string;  // 예상 예산 (자유 문구)
    kind: string;    // 선정 이유·스타일
    hours: string;   // 영업시간·휴무
    parking: string; // 주차 안내
    source: string;  // 출처 URL
}

/** 비용 단위: adult = 1인당(인원수 곱함), vehicle = 차량·전체 1회 금액 */
export type CostUnit = 'adult' | 'vehicle';
/** 구글지도 길찾기 이동수단 */
export type TravelMode = 'driving' | 'walking';

/** 하루 일정 안의 방문 장소 */
export interface Stop {
    id: string;           // 전체 여행에서 유일한 ID
    time: string;         // 방문 시간 (자유 문구, 예: "17:45 예상")
    title: string;        // 장소 이름
    query: string;        // 구글지도 검색어 (길찾기 목적지)
    lat: number;          // 지도 핀 위도
    lng: number;          // 지도 핀 경도
    duration: string;     // 체류시간
    fee: string;          // 비용 설명 문구
    amount: number;       // 합계에 더할 기본금액(엔)
    unit: CostUnit;       // amount 의 단위
    extraAmount: number;  // 인원과 무관하게 1회 더하는 추가 고정비(엔). 예) 센간엔 주차 ¥500
    parking: string;      // 주차 안내
    parkingQuery: string; // 주차장 구글지도 검색어 (없으면 빈 문자열)
    note: string;         // 설명·메모
    source: string;       // 공식·참고 URL
    food: Food[];         // 식당 후보 목록
    kind: string;         // 종류 태그 (관광, 식사, 숙소 …)
    mode: TravelMode;     // 길찾기 이동수단
    done: boolean;        // 방문 완료 체크
}

/** 하루 일정 */
export interface Day {
    id: string;       // 날짜 ID (날짜 추가·삭제를 위해 순번과 분리된 문자열)
    date: string;     // 표시용 날짜 (예: "10.31")
    weekday: string;  // 요일 (예: "토")
    title: string;    // 날짜 제목
    subtitle: string; // 부제 (첫 '·' 앞부분이 날짜 탭에 표시됨)
    hotel: string;    // 숙소·마무리 장소
    pace: string;     // 일정 강도 문구
    warning: string;  // 주의 문구
    tight: boolean;   // 빠듯한 날이면 주의 박스를 강조 색으로 표시
    costNote: string; // 비용 합계 아래 덧붙일 안내 (없으면 빈 문자열)
    stops: Stop[];    // 방문 순서대로 정렬된 장소 목록
}

/** 여행 전체 (저장 단위) */
export interface Trip {
    version: 2;
    title: string;
    travelers: number;   // 여행 인원 (1~20)
    checkedAt?: string;  // 정보 확인일 (선택)
    updatedAt?: string;  // 마지막 기기 저장 시각 (선택)
    notes: string;       // 여행 메모
    days: Day[];
}
