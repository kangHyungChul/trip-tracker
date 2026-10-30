# 가고시마, 함께 가는 4일

부모님과 2인, 2026.10.31~11.03. 버짓 가고시마공항점 렌터카, 실크인 2박·시로야마 1박.

## 바로 보기

- 함께 제공한 `kagoshima-trip.html`을 다운로드하고 브라우저로 열면 됩니다.
- 또는 이 폴더의 `public/index.html`을 여세요. 지도 배경·구글지도는 인터넷 연결이 필요합니다.
- 날짜 선택 → 지도 번호 또는 장소의 ‘자세히’ → 구글지도 길찾기.
- ‘편집’으로 시간·장소·좌표·비용·주차·식당 후보 수정, ‘자세히’에서 순서 이동·삭제.
- 수정 내용은 기기에 자동 저장됩니다. 브라우저·파일 위치에 따라 저장 공간이 다를 수 있으므로 이동 전 ‘저장·백업 → JSON 백업’을 권장합니다.
- 새 장소는 일본어 장소명/주소와 위도·경도를 함께 입력하세요. 목적지 검색어가 실제 길찾기에 사용되고 좌표는 앱 지도에 사용됩니다.
- 식당 후보는 대안이며 전부 방문하는 일정이 아닙니다. 음식 예산·이동시간은 추정입니다.

## Vercel 배포

프레임워크와 런타임 패키지 설치가 필요 없는 정적 앱입니다. Node.js 20 이상을 사용합니다.

1. 이 폴더를 본인 GitHub 저장소에 업로드합니다. `.env`, `.env.local`은 업로드하지 마세요.
2. Vercel에서 해당 저장소를 Import합니다. Framework는 `Other`, Build Command는 `npm run build`, Output Directory는 `dist`입니다. `vercel.json`에도 설정되어 있습니다.
3. Supabase 없이 먼저 배포해도 기기 저장·편집·백업·지도 기능이 동작합니다.
4. 클라우드 저장을 쓰려면 아래 Supabase 설정 후 Vercel Environment Variables에 두 공개 값을 설정하고 재배포합니다.

| 변수 | 값 |
|---|---|
| `SUPABASE_URL` | `https://프로젝트.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase의 `sb_publishable_...` 공개 키 |

구형 공개 anon JWT는 `SUPABASE_ANON_KEY`로 지원합니다. service_role / `sb_secret_`는 사용하지 마세요. 빌드 스크립트도 거부합니다.
앱 ‘저장·백업 → Supabase 연결 설정’에 공개 URL·키를 넣어 개별 브라우저에 연결하는 방식도 가능합니다. Vercel 환경변수 방식이 여러 기기에서 편합니다.

### 로컬 확인

```sh
npm test
npm run build
python3 -m http.server 8000 --directory dist
```

`http://localhost:8000`을 엽니다. npm 의존 패키지는 없습니다. SDK·지도 라이브러리는 `public/vendor/`에 포함했습니다.

## Supabase 설정

1. 본인의 Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다. `travel_plans` 테이블과 RLS, 충돌 방지 저장 함수를 만듭니다.
3. Authentication → Providers에서 Email을 활성화합니다.
4. Authentication → URL Configuration의 Site URL에 Vercel URL을, Redirect URLs에도 실제 사용하는 앱 주소를 등록합니다. 로컬 테스트 시 `http://localhost:8000/`도 추가합니다.
5. 앱 ‘저장·백업’에서 이메일 로그인 링크를 받습니다. 같은 브라우저에서 링크를 엽니다. Supabase의 이메일 템플릿이 인증 코드를 제공하도록 구성되어 있으면 코드 입력도 지원합니다.
6. 로그인 후 ‘클라우드에 저장’을 누르면 내 계정의 일정 1개가 저장됩니다. 다른 기기에서는 같은 이메일로 로그인한 뒤 ‘클라우드 불러오기’를 누릅니다.

### 저장 동작

- **기기 저장:** 편집·체크·순서 변경 시 자동 저장. 네트워크 불필요.
- **클라우드 저장:** 로그인 후 버튼으로 저장. 자동 업로드하지 않습니다.
- **백업:** JSON 내보내기·불러오기. 파일은 검증 후 적용하고 교체 전 확인합니다.
- **충돌:** 클라우드 revision을 비교해 오래된 기기가 새 데이터를 덮어쓰지 못하도록 합니다. 충돌하면 현재 내용을 백업하고 클라우드를 불러온 뒤 수정합니다.
- **접근:** RLS로 자신의 Auth 사용자 ID에 해당하는 행만 접근합니다. 데이터베이스·메일 발송 설정은 본인 계정에서 실제 확인해야 합니다.

## 일정·비용 기준

- 첫날 15:30은 한국 출발로 가정했습니다. 도착/버짓 인수시각은 미정이어서 ‘예상’으로 표시했습니다.
- 11/1: 사라쿠, 플라워파크, 용궁신사·나가사키바나, 니시오야마역, 이케다호, 이온몰.
- 11/2: 요청한 사쿠라지마 일주 핵심 명소, 수족관, 센간엔, 밤축제를 모두 넣은 빠듯한 일정. 교통·대기·화산 통제에 따라 조정이 필요합니다.
- 11/3: 호텔 조식·온천, 본축제 오전 관람, 점심·차량 회수, 주유, 버짓 영업소 반납·셔틀, 16시 공항 도착·18시 귀국편.
- 체크아웃 후 호텔 주차·짐 보관은 미확정입니다. 체크인 때 가능 여부와 추가요금을 확인하세요. 불가하면 통제 구간 밖 주차장을 이용하고 앱 목적지도 수정하세요.
- 페리 기본금액은 **차량 3~4m + 성인 2명 = 편도 ¥1,950**입니다. 4~5m 차량은 편도 ¥2,600. 운전자 1명은 차량 요금에 포함됩니다. 렌트차 길이를 확인 후 앱 금액을 바꾸세요.
- 앱 비용 합계는 입력된 기본금액×인원 또는 차량요금 + 센간엔 주차¥500입니다. 식비·숙박비·렌트·유류·톨비·쇼핑·변동 주차는 제외합니다. 페리는 2인 기본 설정이므로 인원을 바꾸면 차량·동승자 합계도 직접 수정하세요.
- 출처 확인일 2026.10.30. 주차 무료 여부를 확정하지 못한 곳은 ‘현장 확인’으로 표시했습니다.
- 지도 좌표는 대략적인 방문 위치이며 정확한 차량 진입로·주차장 입구를 보장하지 않습니다. 구글지도 목적지명·주소를 확인하고 이동하세요.

## 주요 출처

각 포인트·식당 카드에도 공식·참고 원문 링크가 있습니다.

- 버짓 공항점: https://www.budgetrentacar.co.jp/shop/kagoshima/0006/
- 실크인 주차: https://www.silk-inn.jp/rootaccess/
- 시로야마: https://www.shiroyama-g.co.jp/access/
- 축제: https://www.kagoshima-yokanavi.jp/event/10001
- 사라쿠: https://www.ibusuki-saraku.jp/guide.html
- 플라워파크: https://www.fp-k.org/information/
- 수족관 요금: https://ioworld.jp/faq
- 수족관 주차: https://ioworld.jp/access
- 센간엔 요금: https://www.senganen.jp/faq/
- 센간엔 주차: https://www.senganen.jp/about/
- 페리 요금: https://www.city.kagoshima.lg.jp/sakurajima-ferry/unchin/unchin.html
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel 설정: https://vercel.com/docs/project-configuration

## 지도와 라이선스

- Leaflet 1.9.4: BSD-2-Clause, https://leafletjs.com/ (vendor 헤더 포함)
- Supabase JS: MIT, https://github.com/supabase/supabase-js (vendor 번들 포함)
- 배경지도: 국토지리원 지리원 타일(일본), https://maps.gsi.go.jp/development/ichiran.html . 출처를 지도에 표시합니다. 실시간 타일 호출 방식이며 Google Maps API나 유료 지도 API 키를 사용하지 않습니다. 지도 제공처 조건 변경 시 소스의 타일 URL·출처를 함께 변경하세요.
- 구글지도 링크는 Maps URLs 규격을 사용하며 유료 Google Maps API를 호출하지 않습니다.

## 검증 범위

앱 문법·일정 데이터·길찾기 링크 인코딩·잘못된 백업 거부·외부 링크 안전처리 검사 통과. 브라우저에서 지도 타일·날짜 전환·편집 저장·새로고침 보존·맛집 표시·백업 화면을 확인했습니다. 실제 Vercel 배포와 Supabase Auth/RPC는 계정 연결 전이라 미검증입니다.
