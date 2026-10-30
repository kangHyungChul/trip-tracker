# TRIP TRACKER

여러 여행 일정을 지도·맛집·주차·비용과 함께 정리하고 직접 편집하는 여행 플래너입니다.
첫 화면에서 여행을 고르거나 새로 만들고, 여행마다 날짜·장소·맛집/카페를 관리합니다.
기존 ‘가고시마, 함께 가는 4일’ 일정은 첫 번째 여행(예시)으로 들어 있습니다.

## 사용법

- **여행 목록(첫 화면):** ‘＋ 새 여행’(이름만 입력) → 여행 화면에서 ‘＋ 날짜’로 날짜를 추가합니다. 카드의 🗑로 삭제(모든 기기에서 사라지며 ‘저장·백업 → 휴지통’에서 복구 가능).
- **날짜:** 달력(날짜 선택기)으로 고르고, 비워 두면 ‘날짜 미정’. 요일은 자동 계산, ‘공휴일’ 같은 메모는 날짜 메모 칸에.
- **장소 추가/편집:** 구글지도 앱·웹에서 장소를 연 뒤 *공유 → 링크 복사*(또는 주소창 URL)를 붙여넣고 ‘위치 가져오기’를 누르면 좌표·이름이 채워집니다. 가게 이름만 입력해도 Google 장소 검색으로 찾습니다. 좌표 직접 수정은 접어 둔 ‘좌표 직접 수정’에서.
- **시간:** 시작·종료 시각을 선택기(5분 단위)로 고르고, ‘예상’ 같은 메모는 시간 메모 칸에.
- **순서 편집:** 일정 탭의 ‘↕ 순서 편집’ → ⠿ 손잡이를 끌어 같은 날 안에서 순서 변경(키보드: 손잡이 포커스 → Space → 화살표 → Space). ‘✓ 완료’로 종료.
- **맛집·카페:** 장소와 별개로 날짜별 ‘맛집·카페’ 탭에서 추가·편집합니다. 지도에는 번호 핀(●)과 다른 사각 배지(🍴 식당 / ☕ 카페)로 표시되며, ‘맛집’ 체크박스로 숨길 수 있습니다.
- **여행 정보:** 제목 옆 ‘여행 정보 편집’에서 제목·동행·소개 문구·오른쪽 강조 문구·통화·여행 메모를 수정합니다.
- **통화:** 여행마다 하나씩 정합니다. 새 여행은 원화(₩ KRW), 예전 데이터는 엔화(¥ JPY)로 시작합니다. 목록(KRW·JPY·USD·EUR·CNY·TWD·THB·VND 등)에 없으면 ‘직접 입력…’으로 ISO 4217 세 글자 코드를 넣습니다. 통화를 바꿔도 입력한 금액 숫자는 그대로이며 환율 환산은 하지 않습니다.
- **삭제·덮어쓰기 확인:** 장소·맛집·날짜·여행 삭제, 백업으로 덮어쓰기, 초기화, 키 삭제는 앱 안의 확인 창에서 한 번 더 확인합니다.
- 수정 내용은 Supabase에 자동 저장됩니다(아래 ‘Supabase 설정’). 중요한 변경 전에는 ‘저장·백업 → JSON 백업’을 권장합니다.

## Google 지도 설정

앱 지도·장소 검색에 Google Maps Platform 키가 필요합니다. (키가 없으면 지도 자리에 안내만 표시되고 나머지 기능은 동작합니다. 길찾기 버튼은 키 없이 구글지도 앱/웹으로 연결됩니다.)

1. [Google Cloud 콘솔](https://console.cloud.google.com/google/maps-apis)에서 **Maps JavaScript API**, **Places API (New)** 를 사용 설정합니다.
2. API 키를 만들고 반드시 제한을 겁니다.
   - 애플리케이션 제한: **웹사이트(HTTP 리퍼러)** — `http://localhost:5173/*`, `https://배포주소.vercel.app/*`
   - API 제한: Maps JavaScript API, Places API (New)
3. 키를 넣는 방법(둘 중 하나, 앱 설정이 우선):
   - `.env.local`(Git 업로드 금지) 또는 Vercel 환경변수 `VITE_GOOGLE_MAPS_API_KEY`
   - 앱 ⚙ 설정에 입력 → 이 기기 브라우저에만 저장
4. 선택: 지도 스타일용 Map ID는 `VITE_GOOGLE_MAPS_MAP_ID` 또는 ⚙ 설정. 비우면 Google의 `DEMO_MAP_ID`를 사용합니다.

브라우저용 키는 어떤 방식이든 페이지에서 볼 수 있으므로 위 제한이 보안의 핵심입니다. 사용량은 Google Cloud 결제 계정에 청구될 수 있으니 예산 알림도 설정하세요.

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
2. `.env.local`(또는 Vercel 환경변수)에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 넣거나, 앱 ⚙ 설정의 Supabase 칸에 입력합니다.

동작 방식
- **자동 저장:** 편집하면 기기 캐시에 바로 쓰고 약 1초 모아서 Supabase에 올립니다. 헤더에 ‘저장 중… / 클라우드에 저장됨 ✓’이 표시됩니다.
- **다른 기기 변경:** 첫 화면을 열 때·창에 다시 들어올 때(10초 간격)·온라인으로 돌아올 때 클라우드와 맞춥니다. 열려 있는 여행이 바뀌었으면 화면이 자동으로 갱신됩니다(실시간 동기화는 아님).
- **충돌:** 저장할 때 revision을 비교해, 다른 기기가 먼저 바꿨으면 ‘클라우드 내용 불러오기 / 내 내용으로 덮어쓰기 / 나중에’를 묻습니다. ‘나중에’를 고르면 헤더의 ‘충돌 · 눌러서 해결’로 다시 열 수 있습니다.
- **오프라인:** 기기에 보관했다가 연결되면 자동으로 올립니다. 오프라인 중 삭제도 연결 후 반영됩니다.
- **처음 연결:** 이 기기에만 있던 여행은 자동으로 올라갑니다. 같은 ID가 클라우드에 다른 내용으로 있으면 충돌로 물어봅니다.
- **삭제:** 휴지통 방식(`deleted_at`). 첫 화면 ‘저장·백업 → 휴지통’에서 복구할 수 있습니다. 완전 삭제는 Supabase 대시보드에서 직접 합니다.
- **⚠ 접근:** 아직 로그인이 없어 **공개 키를 가진 누구나(= 앱 주소에 접속한 누구나) 모든 여행을 읽고·수정하고·휴지통으로 보낼 수 있습니다.** 공개 배포 시 주의하세요. 쓰기는 DB 함수(`save_trip`·`delete_trip`·`restore_trip`)로만 가능해 형식 검증과 revision 비교는 항상 거칩니다.
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

## 검증 범위

`npm test`(46개): 예시 데이터·길찾기 링크·잘못된 데이터 거부·v1/v2 변환(시간 분해·날짜·맛집 이동·연도 넘김)·URL 좌표 추출·도메인 판별·비용·검색·키 검사.
브라우저(개발 서버, 실제 키)에서 여행 목록·예전 데이터 이전·Google 지도 핀/맛집 배지/정보창·이름으로 위치 가져오기·날짜/시간 선택기·순서 드래그(포인터·키보드)·새 여행/날짜 추가·설정 화면·모바일 레이아웃을 확인했습니다. Supabase 자동 저장(자동 업로드·편집 저장·다른 기기 변경 반영·충돌 선택 두 가지·오프라인 후 재업로드·휴지통 삭제/복구)도 실제 프로젝트로 확인했습니다. 실제 짧은 공유 링크 해석, Vercel 배포는 미검증입니다.
