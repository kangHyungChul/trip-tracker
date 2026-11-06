# TRIP TRACKER

여러 여행 일정을 지도·맛집·주차·비용과 함께 정리하고 직접 편집하는 여행 플래너입니다.
첫 화면에서 여행을 고르거나 새로 만들고, 날짜별 일정과 날짜에 속하지 않는 여행 공통 장소 후보함을 관리합니다.
기존 ‘가고시마, 함께 가는 4일’ 일정은 첫 번째 여행(예시)으로 들어 있습니다.

## 사용법

- **여행 목록(첫 화면):** ‘새 여행’(이름만 입력) → 여행 화면에서 ‘날짜’ 추가 버튼으로 날짜를 추가합니다. 카드의 휴지통 아이콘으로 삭제(모든 기기에서 사라지며 ‘저장·백업 → 휴지통’에서 복구 가능).
- **날짜:** 달력(날짜 선택기)으로 고르고, 비워 두면 ‘날짜 미정’. 요일은 자동 계산, ‘공휴일’ 같은 메모는 날짜 메모 칸에.
- **장소 추가/편집:** 구글지도 앱·웹에서 장소를 연 뒤 *공유 → 링크 복사*(또는 주소창 URL)를 붙여넣고 ‘위치 가져오기’를 누르면 좌표·이름이 채워집니다. 가게 이름만 입력해도 Google 장소 검색으로 찾습니다. 좌표 직접 수정은 접어 둔 ‘좌표 직접 수정’에서.
- **시간:** 시작·종료 시각을 선택기(5분 단위)로 고르고, ‘예상’ 같은 메모는 시간 메모 칸에.
- **순서 편집:** 일정 탭의 ‘순서 편집’ → 왼쪽 손잡이를 끌어 같은 날 안에서 순서 변경(키보드: 손잡이 포커스 → Space → 화살표 → Space). ‘완료’로 종료.
- **지도 핀 아이콘:** 일정과 후보에서 Lucide 아이콘 22종을 선택합니다. 호텔·쇼핑·식당·카페·관광지·공항·전철·기차·버스·주차장·페리·휴식·병원에 자동차·주유소·해변·산·공원·박물관·체험·짐 보관·기타를 제공합니다. 지도 일정 핀은 아이콘과 방문 순번을 함께 표시합니다.
- **실제 도착 지점:** 일정 편집에서 ‘장소 원래 위치 / 주차장 / 출입구’를 고릅니다. 주차장·출입구는 별도의 URL·이름으로 위치를 가져오거나 좌표를 직접 입력합니다. 원래 장소 좌표는 유지하고, 지도 핀·경로 계산·구글지도 길찾기는 실제 도착 좌표를 사용합니다. ‘장소 원래 위치’를 다시 고르면 원래 지점으로 돌아갑니다.
- **실제 이동 경로:** 지도의 ‘실제 경로 보기’를 누르면 방문 순서를 유지해 자동차(실선)·도보(점선) 경로를 계산합니다. 각 장소의 이동수단은 이전 장소에서 해당 장소까지의 이동 기준입니다. ‘구간별 이동 정보·길찾기’에서 교통 미반영 예상 시간·거리와 출발지가 지정된 구글지도 링크를 확인합니다. 날짜·좌표·순서·이동수단이 바뀌면 버튼을 다시 눌러 계산합니다. 맛집·카페 후보는 경로에 포함되지 않습니다.
- **장소 후보:** 여행 공통 보관함이며 날짜가 없어도 추가·편집할 수 있습니다. 호텔·쇼핑·관광지 등 모든 카테고리를 지원합니다. 기존 날짜별 맛집·카페는 불러올 때 공통 후보로 이동하며 ID·위치·메뉴·예산·출처를 보존합니다. 날짜를 삭제해도 후보는 유지됩니다.
- **후보 → 일정:** 후보 카드의 ‘일정에 추가’에서 날짜·삽입 위치·방문 시각·이동수단을 선택합니다. 위치가 없으면 등록 중 위치를 지정합니다. 원본 후보는 보존하고, 같은 날짜 중복 추가를 막습니다. 해당 날짜에 추가된 후보는 지도에서 별도의 후보 배지를 숨깁니다. 후보 삭제 후에도 이미 추가된 일정은 유지됩니다. 후보와 일정의 이후 편집은 각각 독립적으로 적용됩니다.
- **등록 UI:** 일정·후보 등록은 동일한 아이콘 타일 선택 UI를 사용합니다. 일정 탭의 제목 옆 연필은 날짜 편집, 오른쪽 버튼은 ‘일정 추가’입니다. 후보 탭은 ‘장소 후보 / 여행 전체 공통’ 제목과 ‘후보 추가’ 버튼을 표시하고 날짜 편집은 숨깁니다. 별도의 중복 후보 추가 버튼은 표시하지 않습니다.
- **경로 안내·색상:** ‘경로 안내 접기 / 펼치기’로 패널을 접을 수 있습니다. 색상은 자홍색(기본)·선홍색·보라색·남색 중 고르며 흰색 외곽선과 굵은 선으로 구분합니다. 접기·색상 변경은 경로 API를 호출하지 않습니다.
- **PC 레이아웃(851px 이상):** 날짜별 칩과 일정·후보 목록은 왼쪽 사이드바, 지도는 오른쪽 남은 화면을 채웁니다. 전체 날짜 탭은 제공하지 않습니다. 목록은 지도와 독립적으로 스크롤됩니다. 경로 안내는 기본 접힘 상태이며 PC에서는 지도 아래에서 열립니다.
- **지도 조작:** 우측 하단의 레이어(후보 표시), 전체 보기, 내 위치 아이콘으로 조작합니다. 모바일에서는 바텀시트 높이에 맞춰 버튼이 위로 이동합니다. 기본 줌 버튼과 방향 이동 화살표는 숨기고 휠·드래그·터치 조작을 사용합니다. 버튼 이름은 마우스 툴팁과 스크린리더로 확인할 수 있습니다. 모바일에서 접힌 경로 안내는 좌측 상단의 작은 경로 아이콘으로 표시됩니다.
- **여행 정보:** 제목 옆 ‘여행 정보 편집’에서 제목·동행·소개 문구·오른쪽 강조 문구·통화·여행 메모를 수정합니다.
- **통화:** 여행마다 하나씩 정합니다. 새 여행은 원화(₩ KRW), 예전 데이터는 엔화(¥ JPY)로 시작합니다. 목록(KRW·JPY·USD·EUR·CNY·TWD·THB·VND 등)에 없으면 ‘직접 입력…’으로 ISO 4217 세 글자 코드를 넣습니다. 통화를 바꿔도 입력한 금액 숫자는 그대로이며 환율 환산은 하지 않습니다.
- **삭제·덮어쓰기 확인:** 장소·맛집·날짜·여행 삭제, 백업으로 덮어쓰기, 초기화, 키 삭제는 앱 안의 확인 창에서 한 번 더 확인합니다.
- **휴대폰(폭 480px 이하):** 지도가 화면을 채우고 한 손가락으로 움직입니다. 일정·맛집 목록은 아래 시트로, 쓸어올리고 내려 ‘손잡이만 / 절반 / 거의 전체’ 높이로 바꿉니다(손잡이를 탭해도 바뀜). 핀을 누르면 시트가 올라와 해당 카드를 보여주고, 카드를 누르면 시트가 절반으로 내려가 지도에서 위치를 보여줍니다.
- **홈 화면 아이콘:** 휴대폰 브라우저의 ‘홈 화면에 추가’로 앱 아이콘을 만들 수 있습니다(누르면 브라우저 탭으로 열림). 아이콘 원본은 `public/icon.svg`·`public/favicon.svg`이며, 고친 뒤 `npm run icons`로 PNG를 다시 만듭니다.
- 수정 내용은 Supabase에 자동 저장됩니다(아래 ‘Supabase 설정’). 중요한 변경 전에는 ‘저장·백업 → JSON 백업’을 권장합니다.

## Google 지도 설정

앱 지도·장소 검색에 Google Maps Platform 키가 필요합니다. (키가 없으면 지도 자리에 안내만 표시되고 나머지 기능은 동작합니다. 길찾기 버튼은 키 없이 구글지도 앱/웹으로 연결됩니다.)

1. [Google Cloud 콘솔](https://console.cloud.google.com/google/maps-apis)에서 **Maps JavaScript API**, **Places API (New)**, 실제 경로를 위한 **Routes API** 를 사용 설정하고 결제 계정을 연결합니다.
2. API 키를 만들고 반드시 제한을 겁니다.
   - 애플리케이션 제한: **웹사이트(HTTP 리퍼러)** — `http://localhost:5173/*`, `https://배포주소.vercel.app/*`
   - API 제한: Maps JavaScript API, Places API (New), Routes API
3. 키를 넣는 방법(둘 중 하나, 앱 설정이 우선):
   - `.env.local`(Git 업로드 금지) 또는 Vercel 환경변수 `VITE_GOOGLE_MAPS_API_KEY`
   - 앱 설정(톱니바퀴)에 입력 → 이 기기 브라우저에만 저장
4. 선택: 지도 스타일용 Map ID는 `VITE_GOOGLE_MAPS_MAP_ID` 또는 앱 설정. 비우면 Google의 `DEMO_MAP_ID`를 사용합니다.

브라우저용 키는 어떤 방식이든 페이지에서 볼 수 있으므로 위 제한이 보안의 핵심입니다. 사용량은 Google Cloud 결제 계정에 청구될 수 있으니 예산 알림도 설정하세요.

### Routes 사용량 관리

**지원 지역:** 2026-11-05 기준 [Google 공식 지원표](https://developers.google.com/maps/coverage)에서 한국은 자동차·도보 길찾기가 미지원입니다. 국내 구간에서 빈 경로 응답이 오면 API 키나 할당량을 변경해도 해결되지 않습니다. 국내 이동 동선을 지도에 그리려면 별도 국내 경로 API 연동이 필요합니다. 경로 없음은 완료 상태와 구분해 안내하며, 직선을 실제 이동 경로로 대체 표시하지 않습니다.

- Google Cloud → Routes API → 할당량에서 `Directions - ComputeRoutes per request quota per day`를 **300**, `per minute`을 **30**으로 설정합니다. 이 설정은 앱 코드에서 자동으로 변경하지 않습니다.
- 기본 경로(Essentials)만 요청합니다. 실시간 교통·대안 경로·자동 방문 순서 최적화를 사용하지 않고, 요청당 중간 경유지를 최대 10곳으로 제한합니다. 이동수단이 같으면 묶어서 호출하며, 긴 일정은 연결 지점을 공유해 나눕니다.
- API는 버튼을 누를 때만 호출합니다. 동일한 요청은 페이지 메모리에서 15분 동안 재사용하고, 진행 중인 동일 요청도 공유합니다. 결과는 기기·클라우드·백업에 영구 저장하지 않습니다. 선택·완료 체크·메모·아이콘 변경만으로는 호출하지 않습니다.
- 한도·권한·통신 오류는 자동 재시도하지 않습니다. 경로를 찾지 못한 구간에는 직선 연결을 대신 그리지 않고 ‘경로 확인 필요’와 외부 길찾기를 제공합니다. 변경된 일정의 이전 응답은 표시하지 않고 남은 요청을 중단합니다.
- 2026-11-05 기준 Compute Routes Essentials 월 무료 사용량은 10,000회입니다. 일일 300회는 최대 9,300회/31일입니다. 같은 결제 계정의 다른 사용량이 합산되며, 지도 로드와 Places는 별도 과금 항목입니다. 예산 알림은 자동 차단이 아닙니다. 최신 기준은 [요금표](https://developers.google.com/maps/billing-and-pricing/pricing)와 [비용 관리](https://developers.google.com/maps/billing-and-pricing/manage-costs)를 확인하세요.

### 짧은 공유 링크(maps.app.goo.gl)

짧은 링크는 브라우저에서 바로 풀 수 없어 서버 함수 `api/resolve-maps-url.ts`가 리다이렉트를 따라가 원래 URL을 알려 줍니다. Google·단축 링크 도메인만 허용합니다.
- `npm run dev`: Vite 개발 서버가 같은 함수를 실행합니다.
- Vercel 배포: 자동으로 서버리스 함수가 됩니다.
- `npm run preview`(정적 미리보기)에서는 동작하지 않습니다. 이때는 긴 URL이나 가게 이름을 사용하세요.

## 개발 구조

React 19 + TypeScript + Vite + Tailwind CSS v4. 지도 `@vis.gl/react-google-maps`, 날짜·시간 `react-datepicker`(+ date-fns 한국어), 드래그 `@dnd-kit`, 클라우드 `@supabase/supabase-js`. Node.js 20.19 이상.

```
api/resolve-maps-url.ts   짧은 구글지도 링크 해석 (Vercel 함수 + 개발 서버 미들웨어)
src/
  main.tsx                진입점 (저장소 준비 · 지도 Provider)
  App.tsx                 #/ (여행 목록) · #/trip/<id> (여행 화면) 라우팅
  pages/                  HomePage(여행 목록) · TripPage(여행 화면)
  types.ts                여행 데이터 타입 (version 3)
  data/seed.json          예시 여행 (scripts/make-seed.py 로 생성)
  lib/trip.ts             검증 · v1/v2→v3 변환 · 비용 · 검색
  lib/tripStore.ts        여러 여행 저장(목록·읽기·쓰기·삭제) · 예전 데이터 이전
  lib/datetime.ts         날짜·시각 문자열 도우미
  lib/mapsUrl.ts          구글지도 URL에서 좌표·이름 추출
  lib/placeLookup.ts      URL/이름 → 위치 (Places API)
  lib/googleMaps.ts       Google 키 설정(환경변수·기기)
  lib/storage.ts          localStorage 키 · 안전한 읽기/쓰기
  lib/currency.ts         통화 목록 · 코드 검사 · 금액 표시(Intl)
  lib/cloudTrips.ts       Supabase 공용 trips 테이블 요청 (목록·저장·휴지통·복구)
  lib/sync.ts             자동 동기화 엔진 (업로드 예약·충돌·오프라인 대기열·클라우드↔기기 맞추기)
  hooks/                  useTrip · useSyncStatus · useMaps · useAutoLocateFoods · useToast · useConfirm(확인 창) …
  components/             지도 · 카드 · 모달 · 날짜/시간 입력 · 순서 편집 목록
scripts/
  make-seed.py            예시 여행 seed.json 생성
  geocode-foods.mjs       예시 맛집 좌표 조회 → scripts/food-coords.json
```

```sh
npm install
npm run dev       # 개발 서버 http://localhost:5173 (짧은 링크 API 포함)
npm test          # Vitest: 데이터 검증·변환·URL 해석·시간 분해 등
npm run build     # 타입 검사 + dist/ 생성
npm run preview   # 빌드 결과 확인 (/api 없음)
npm run geocode   # (선택) 예시 맛집 좌표 다시 조회. .env.local 의 키 사용
npm run seed      # food-coords.json 반영해 src/data/seed.json 재생성 (Python 3)
```

### 데이터 형식 (version 3)

- 여행: `id`(영문·숫자·`_`·`-`), `title`, `companion`, `tagline`, `highlight`, `highlightSub`, `currency`(ISO 4217 대문자 3글자, 없으면 `JPY`로 간주), `travelers`, `notes`, `days`. 금액(`amount`·`extraAmount`)은 여행 통화 기준입니다.
- 날짜: `date`(`YYYY-MM-DD` 또는 빈 값), `dateNote`, `stops`, `foods`. 요일은 저장하지 않고 계산합니다. 날짜 0개도 허용.
- 장소: `start`/`end`(`HH:mm` 또는 빈 값) + `timeNote`. 식당 목록은 더 이상 장소 안에 없습니다.
- 맛집: 날짜의 `foods` 배열. `category`(`restaurant`/`cafe`), `lat`/`lng`(위치 미정이면 `null`).
- version 1·2(기존 가고시마 앱) 데이터는 불러올 때 자동 변환됩니다: 날짜 `"11.03"` → `2026-11-03`(확인일 기준 연도), 시간 `"18:50~20:20"` → 시작·종료, 장소별 식당 → 날짜별 맛집(중복 제거). 예시 일정에 있던 맛집은 좌표가 채워지고, 모르는 가게는 지도 키가 있을 때 앱이 자동으로 위치를 조회합니다.
- 변환 후 저장하면 version 3으로 기록되므로 이전 버전 앱에서는 읽을 수 없습니다.

### 기기 저장 키

`trip-tracker:trips`(여행 ID 목록), `trip-tracker:trip:<id>`, `trip-tracker:last-day:<id>`, `trip-tracker:cloud-base:<id>`, `trip-tracker:supabase-config`, `trip-tracker:google-maps`.
처음 실행 시 예전 키(`kagoshima-trip-v1` 등)의 데이터를 첫 여행으로 옮기며, 예전 키는 백업으로 남겨 둡니다.

## Vercel 배포

1. 이 폴더를 본인 GitHub 저장소에 업로드합니다. `.env`, `.env.local`은 업로드하지 마세요.
2. Vercel에서 Import합니다. Framework `Vite`, Build Command `npm run build`, Output `dist` (`vercel.json`에도 설정). `api/` 폴더는 자동으로 함수가 됩니다.
3. Environment Variables:

| 변수 | 값 |
|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | 리퍼러·API 제한을 건 브라우저용 키 |
| `VITE_GOOGLE_MAPS_MAP_ID` | (선택) Map ID |
| `VITE_SUPABASE_URL` | `https://프로젝트.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase의 `sb_publishable_...` 공개 키 |

구형 공개 anon JWT는 `VITE_SUPABASE_ANON_KEY`로 지원합니다. `VITE_` 값은 브라우저 번들에 포함되므로 service_role / `sb_secret_`는 절대 사용하지 마세요(빌드가 거부합니다).

## Supabase 설정 (자동 저장)

Supabase URL·공개 키가 있으면 모든 저장·편집이 Supabase 공용 테이블(`public.trips`)에 자동 저장됩니다. 없으면 이 브라우저에만 저장합니다.

1. Supabase 프로젝트를 만들고 DB 스키마를 넣습니다. 둘 중 하나:
   - **CLI(권장):** `npm run db:login`(브라우저 로그인) → `npm run db:link`(프로젝트 선택, DB 비밀번호 입력) → `npm run db:push`. `supabase/migrations/`의 SQL이 순서대로 실행되고 이력이 남습니다. 스키마를 바꿀 때는 새 마이그레이션 파일을 추가한 뒤 다시 `db:push`.
   - **SQL Editor:** `supabase/migrations/`의 파일을 이름 순서대로 붙여넣고 실행(`supabase/schema.sql` 안내 참고).

   DB 비밀번호·연결 문자열은 전체 권한 비밀값이므로 `VITE_` 변수나 Git에 넣지 마세요.
2. `.env.local`(또는 Vercel 환경변수)에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 넣거나, 앱 설정의 Supabase 칸에 입력합니다.

동작 방식
- **자동 저장:** 편집하면 기기 캐시에 바로 쓰고 약 1초 모아서 Supabase에 올립니다. 헤더에 ‘저장 중… / 클라우드에 저장됨’(체크 아이콘)이 표시됩니다.
- **다른 기기 변경:** 첫 화면을 열 때·창에 다시 들어올 때(10초 간격)·온라인으로 돌아올 때 클라우드와 맞춥니다. 열려 있는 여행이 바뀌었으면 화면이 자동으로 갱신됩니다(실시간 동기화는 아님).
- **충돌:** 저장할 때 revision을 비교해, 다른 기기가 먼저 바꿨으면 ‘클라우드 내용 불러오기 / 내 내용으로 덮어쓰기 / 나중에’를 묻습니다. ‘나중에’를 고르면 헤더의 ‘충돌 · 눌러서 해결’로 다시 열 수 있습니다.
- **오프라인:** 기기에 보관했다가 연결되면 자동으로 올립니다. 오프라인 중 삭제도 연결 후 반영됩니다.
- **처음 연결:** 이 기기에만 있던 여행은 자동으로 올라갑니다. 같은 ID가 클라우드에 다른 내용으로 있으면 충돌로 물어봅니다.
- **삭제:** 휴지통 방식(`deleted_at`). 첫 화면 ‘저장·백업 → 휴지통’에서 복구할 수 있습니다. 완전 삭제는 Supabase 대시보드에서 직접 합니다.
- **주의 · 접근:** 아직 로그인이 없어 **공개 키를 가진 누구나(= 앱 주소에 접속한 누구나) 모든 여행을 읽고·수정하고·휴지통으로 보낼 수 있습니다.** 공개 배포 시 주의하세요. 쓰기는 DB 함수(`save_trip`·`delete_trip`·`restore_trip`)로만 가능해 형식 검증과 revision 비교는 항상 거칩니다.
- 예전 로그인용 `travel_plans` 테이블은 나중 로그인 작업 때 정리하기 위해 DB에 남아 있습니다(앱은 사용하지 않음).

## 예시 여행(가고시마) 기준

- 부모님과 2인, 2026.10.31~11.03, 버짓 가고시마공항점 렌터카, 실크인 2박·시로야마 1박. 출처 확인일 2026.10.30.
- 첫날 15:30은 한국 출발 가정, 도착/인수시각은 ‘예상’. 11/2는 사쿠라지마 일주·수족관·센간엔·밤축제를 모두 넣은 빠듯한 일정.
- 페리 기본금액은 차량 3~4m + 성인 2명 편도 ¥1,950(4~5m ¥2,600). 비용 합계는 입력된 기본금액(×인원 또는 1회) + 추가 고정비이며 식비·숙박·렌트·유류·톨비·쇼핑은 제외.
- 맛집 좌표는 `npm run geocode`(Places API)로 조회한 값입니다. 진입로·주차장 입구는 구글지도 길찾기로 확인하세요.

주요 출처: [버짓 공항점](https://www.budgetrentacar.co.jp/shop/kagoshima/0006/) · [실크인 주차](https://www.silk-inn.jp/rootaccess/) · [시로야마](https://www.shiroyama-g.co.jp/access/) · [축제](https://www.kagoshima-yokanavi.jp/event/10001) · [센간엔](https://www.senganen.jp/faq/) · [수족관](https://ioworld.jp/faq) · [페리 요금](https://www.city.kagoshima.lg.jp/sakurajima-ferry/unchin/unchin.html)

## 라이선스·약관

- 지도·장소 데이터: Google Maps Platform 이용약관을 따릅니다. 지도 안의 Google 로고·저작권 표시는 가리지 마세요.
- react-datepicker, @dnd-kit, @vis.gl/react-google-maps, Supabase JS: MIT.
- 아이콘 lucide-react: ISC. (아이콘 PNG 생성용 개발 도구 @resvg/resvg-js: MPL-2.0, 배포 번들에는 포함되지 않음)

## 검증 범위

`npm test`(46개): 예시 데이터·길찾기 링크·잘못된 데이터 거부·v1/v2 변환(시간 분해·날짜·맛집 이동·연도 넘김)·URL 좌표 추출·도메인 판별·비용·검색·키 검사.
브라우저(개발 서버, 실제 키)에서 여행 목록·예전 데이터 이전·Google 지도 핀/맛집 배지/정보창·이름으로 위치 가져오기·날짜/시간 선택기·순서 드래그(포인터·키보드)·새 여행/날짜 추가·설정 화면·모바일 레이아웃을 확인했습니다. Supabase 자동 저장(자동 업로드·편집 저장·다른 기기 변경 반영·충돌 선택 두 가지·오프라인 후 재업로드·휴지통 삭제/복구)도 실제 프로젝트로 확인했습니다. 실제 짧은 공유 링크 해석, Vercel 배포는 미검증입니다.
