# -*- coding: utf-8 -*-
# 위 인코딩 선언: Python 3.9 이하에서 아주 긴 한글 줄을 잘못 읽는 토크나이저 문제를 피하기 위해 필요합니다.
# 실행: py scripts/make-seed.py  →  src/data/seed.json 생성 (데이터 형식 version 3)
# 맛집 좌표는 scripts/food-coords.json (npm run geocode 로 만든 캐시)에서 채웁니다.
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def restaurant(name,jp,menu,budget,kind,hours,parking,url):
    return dict(name=name,query=jp,menu=menu,budget=budget,kind=kind,hours=hours,parking=parking,source=url)
R={
'chuo':[
restaurant('쿠로카츠테이 중앙역 본점','黒かつ亭 中央駅本店 鹿児島市中央町16-9','흑돼지 로스·히레 돈카츠','1인 약 ¥1,800~3,000','관광객 인기·흑돼지 전문','17:00~22:30 / LO 22:00','실크인에 주차하고 도보 추천. 점포 주차는 소수.','https://www.kurokatutei.net/'),
restaurant('이치니이산 아뮤플라자점','いちにぃさん アミュプラザ鹿児島店','소바 육수 흑돼지 샤부샤부','1인 약 ¥2,500~5,000','지역 브랜드·부모님 식사','11:00~22:00 / LO 21:00','아뮤플라자 유료·구매 할인 조건 확인','https://ichiniisan.jp/access/amu/'),
restaurant('자봉 라멘 중앙역점','ざぼんラーメン 鹿児島中央駅店','채소를 곁들인 가고시마 돈코츠 라멘','1인 약 ¥1,000~1,500','지역에서 오래 사랑받는 라멘','10:00~21:30 / 음식 LO 20:30','역 주변 유료. 호텔에서 도보 추천.','https://www.jrkagoshimacity.com/floor/detail/?cd=000320)')],
'ibusuki':[
restaurant('아오바','黒豚と郷土料理 青葉 指宿市湊1-2-11','흑돼지 온타마란동·돈카츠·향토요리','1인 약 ¥1,200~2,500','관광객 대표·향토요리','11:00~15:00 / LO 14:30, 수 휴무','전용 주차장 있음. 진입로가 좁을 수 있어 현장 표지 확인.','https://aoba-ibusuki.com/'),
restaurant('TAKETORA','TAKETORA 指宿市大牟礼1-1-13','가쓰오 풍미 라멘','1인 약 ¥1,000~1,500','지역 라멘 수상점·현지/관광객','일 11:30~14:30·17:30~20:00 / 품절 종료','전용 약 20대. 대기 길면 아오바 등으로 변경.','https://taketora-ibusuki.jp/about'),
restaurant('신슈안','信州庵 指宿市西方4393-1','소바·장어·흑돼지·일식 정식','1인 약 ¥1,500~3,000','지역 일식·메뉴 선택 폭','점심 11:00~14:30 / LO 14:00, 휴무 달력 확인','전용 주차장 이용. 당일 안내 확인.','https://shinshuan.com/'),
restaurant('쿠리야 식당여관','くり屋食堂旅館 指宿 山川','가다랑어 타타키·해산물','1인 약 ¥1,200~2,500','지역 해산물·관광협회 소개','당일 영업 확인 필요','주차 가능 여부·구역 현장 확인','https://www.jrkyushu.co.jp/train/kagonmarvelous/area/index.php')],
'ikeda':[
restaurant('danken COFFEE 이케다코 PAX','danken COFFEE いけだ湖パクス 指宿市池田5123-7','호수 전망·커피·크루아상 토스트·디저트','1인 약 ¥600~1,500','풍경 카페·공식 관광 소개','09:00~18:00, 연중무휴','PAX 무료 주차장 약 46대','https://ikedakopax.jp/'),
restaurant('도센쿄 소멘나가시','市営唐船峡そうめん流し','회전식 소멘·생선 요리','1인 약 ¥1,000~2,000','지역 명물 체험','계절별 단축 운영. 오후 늦게는 영업 확인 필요','주차장 있음. 이번 코스에서는 카페 대신 또는 점심 교체용.','https://visit-ibusuki.com/course/316/')],
'sakura':[
restaurant('MINATO CAFE','MINATO CAFE 桜島港 フェリーターミナル3階','사쿠라지마 카레·디저트·항구 전망','1인 약 ¥1,000~1,800','지역 관광 포털 추천','11:00~16:00 / 점심 14:30까지. 임시휴무 확인','약 4대. 만차 시 주차 위치 직원 문의.','https://www.sakurajima.gr.jp/spot/4104.html'),
restaurant('야부킨 페리 우동','桜島フェリー やぶ金','짧은 뱃길에서 먹는 우동','1인 약 ¥600~1,000','지역 페리 명물','선박·운항편별 운영. 식사 대체보다 간식','승선 차량 안에 주차. 항해 약 15분으로 빠듯.','https://www.city.kagoshima.lg.jp/sakurajima-ferry/kanko/documents/kankoguide1.pdf')],
'aquarium':[
restaurant('수족관의 카지츠도','水族館の果実堂 かごしま水族館','식사·과일 디저트·음료','1인 약 ¥1,000~2,000','동선 좋은 관내 식당','월 11:00~16:00 / 음식 LO 15:00·음료 15:30','수족관과 동일. 별도 주차 할인 없음.','https://ioworld.jp/facilities/shop'),
restaurant('멧케몬 돌핀포트점','廻る寿司 めっけもん ドルフィンポート店 鹿児島市住吉町10-1','가고시마 생선 회전초밥','1인 약 ¥2,000~4,000','지역 회전초밥·관광객 인기','11:00~15:00 LO 14:30 / 저녁 17:00~, 예약 불가','별도 이동·주차 필요. 대기가 길어 셋째 날에는 시간 여유 시만.','https://www.jf-group.co.jp/brand/mekkemon/mekkemon-shops/')],
'sengan':[
restaurant('센간엔 차료','仙巌園茶寮','차·화과자·시로쿠마','1인 약 ¥600~1,500','정원 카페','09:00~17:00 / LO 16:30','센간엔 주차 ¥500/대. 입장료 별도.','https://www.senganen.jp/food/sengan-en-matcha-cafe/'),
restaurant('잔보모치점','仙巌園 両棒餅屋','작은 꼬치떡·차','1인 약 ¥500~1,000','가고시마 전통 간식','09:00~17:00 / LO 16:50','센간엔과 동일','https://www.senganen.jp/food/'),
restaurant('오카테이','仙巌園 桜華亭','흑돼지·향토요리 정식','1인 ¥2,300~3,800대','전망 좋은 향토요리','11:00~16:00 / LO 15:30','센간엔과 동일. 이번 도착시간에는 간식이 더 현실적.','https://www.senganen.jp/food/ohkatei-restaurant/')],
'festival':[
restaurant('이치니이산 덴몬칸점','いちにぃさん 天文館店','소바 육수 흑돼지 샤부샤부','1인 약 ¥2,500~5,000','지역 브랜드·부모님 식사','축제일 영업·예약 확인','축제장은 도보 이동. 호텔 주차 활용 권장.','https://ichiniisan.jp/'),
restaurant('와카나 덴몬칸 본점','吾愛人 天文館本店','흑돼지·사쓰마아게 등 향토요리','1인 약 ¥3,000~6,000','가고시마 향토요리 대표','저녁 방문 후보. 축제일 예약 권장','주변 유료. 축제 통제 구간 진입 피하기.','https://www.kagoshima-yokanavi.jp/downloads/media/11935.pdf'),
restaurant('쿠마소테이','熊襲亭 鹿児島','향토요리 정식·코스','1인 약 ¥2,500~6,000','전통 향토요리·관광객','점심/저녁 영업·예약은 방문 전 확인','덴몬칸 주변 유료. 축제장 도보 이용.','https://www.kagoshima-yokanavi.jp/downloads/media/11935.pdf'),
restaurant('고무라사키 덴몬칸점','こむらさき 天文館店 鹿児島市東千石町11-19','채소·버섯을 올린 지역 라멘','1인 약 ¥1,000~1,800','지역 노포 라멘','월~수 11:00~18:00. 마지막 날 점심 후보','전용 주차 확인 필요. 축제장에서 도보.','https://www.kagoshimakomurasaki.com/shop.html'),
restaurant('돈토로 덴몬칸 본점','鹿児島ラーメン豚とろ 天文館本店','부드러운 차슈·진한 돈코츠','1인 약 ¥1,000~1,600','관광객 인기 라멘','일별 영업 차이. 점심 또는 밤축제 후 후보','주변 유료. 도보 접근 추천.','https://www.kagoshima-yokanavi.jp/gourmet/10265'),
restaurant('덴몬칸 무자키 본점','天文館むじゃき 本店','시로쿠마 빙수','1인 약 ¥800~1,500','관광객 대표 디저트','11:00~19:00 / 빙수·음료 LO 18:30','축제장 도보. 긴 대기 시 대체 카페.','https://mujyaki.co.jp/business-information/'),
restaurant('가카시요코초·차보 카카코','薩摩蒸氣屋 菓々子横丁 茶房珈花子','구운 도넛·가스타돈·커피','1인 약 ¥300~1,200','지역 과자·휴식','1층 09:00~20:00 / 2층 10:00~19:30 LO 19:00','전용 주차 없음. 축제장에서 도보.','https://www.jokiya.co.jp/shops/002.html')],
'airport':[
restaurant('오조라 식당','鹿児島空港 大空食堂','계반·흑돼지 정식·향토요리','1인 약 ¥1,000~2,000','공항 향토식·빠른 식사','10:00~20:30, 당일 변경 확인','국내선 2층·보안검색 전. 국제선 수속 이동시간 별도.','https://www.koj-ab.co.jp/shops/ozorashokudo.html'),
restaurant('후쿠후쿠 공항점','ふく福 鹿児島空港店','우동·소바·정식','1인 약 ¥1,000~2,000','지역 외식 브랜드','당일 공항 영업 안내 확인','국내선 3층·보안검색 전','https://www.koj-ab.co.jp/spend.html')]
}
# Remove accidental punctuation from source URLs.
R['chuo'][2]['source']=R['chuo'][2]['source'].rstrip(')')
# extra: 인원수와 무관하게 한 번만 더하는 추가 고정비(엔). 예) 센간엔 주차 ¥500/대
def p(id,time,title,jp,lat,lng,duration,fee,amount,unit,parking,note,source,food=None,kind='관광',mode='driving',parkq='',extra=0):
 return dict(id=id,time=time,title=title,query=jp,lat=lat,lng=lng,duration=duration,fee=fee,amount=amount,unit=unit,extraAmount=extra,parking=parking,note=note,source=source,food=food or [],kind=kind,mode=mode,parkingQuery=parkq,done=False)
B='https://www.budgetrentacar.co.jp/shop/kagoshima/0006/'
S='https://www.silk-inn.jp/rootaccess/'
H='https://www.shiroyama-g.co.jp/access/'
F='https://www.city.kagoshima.lg.jp/sakurajima-ferry/unchin/unchin.html'
E='https://www.kagoshima-yokanavi.jp/event/10001'
pts={
'budget':p('budget','17:45 예상','버짓 공항점 · 차량 인수','バジェットレンタカー 鹿児島空港店 霧島市溝辺町麓1377-1',31.795,130.720,'40~60분','렌트 예약금액 별도',0,'vehicle','영업소에서 차량 인수. 공항 도착층에서 셔틀 요청.','15:30 한국 출발 기준 인수시각은 임시 추정. 예약 도착시각에 맞게 수정. 국제선 출구3→밖 약20m, 전화 0995-58-3543. 전화가 어려우면 공항 안내소에 요청.',B,R['airport'],'교통'),
'silk':p('silk','19:00','실크인 · 체크인','シルクイン鹿児島 上之園町19-30',31.5804,130.5444,'20분','주차 1박 ¥800/대',800,'vehicle','제1코인 또는 호텔 부지. 먼저 주차→프런트 할인카드. 15:00~익일11:00, 시간외 별도. 출차할 때마다 할인카드 필요.','첫날은 숙소 주차 후 중앙역 주변 도보. 숙박비 별도.',S,R['chuo'],'숙소',parkq='シルクイン第1駐車場'),
'chuo':p('chuo','19:30','중앙역 · 저녁과 산책','鹿児島中央駅',31.5837,130.5419,'60~90분','식사·쇼핑 별도',0,'adult','호텔에 주차 유지. 역 주차는 유료·구매 할인 조건 확인.','아뮤 일반매장 20시 마감. 도착이 늦으면 식사 후 돈키로. 아뮤란은 그날 최종탑승 시간 확인.','https://www.jrkagoshimacity.com/information/hours/',R['chuo'],'식사','walking'),
'donki':p('donki','20:45','돈키호테 중앙 이치방가이점','ドン・キホーテ 鹿児島中央一番街店',31.5822,130.5423,'30~45분','쇼핑 별도',0,'adult','호텔 주차 유지·도보','큰 쇼핑은 둘째 날 이온몰. 여기서는 간식·필요한 물건 위주. 지점별 영업시간 확인.','https://www.donki.com/',[],'쇼핑','walking'),
'saraku':p('saraku','09:30','사라쿠 · 모래찜질','砂むし会館 砂楽 指宿市湯の浜5-25-18',31.2297,130.6501,'90분＋대기','기본 ¥1,500/인 · 타월 세트 ¥1,800~2,100',1500,'adult','무료 주차 약90대. 혼잡 시 대기.','모래찜질·대욕장·유카타 기본. 타월 지참 여부로 요금 선택. 운영·기상 공지는 방문 전 확인.','https://www.ibusuki-saraku.jp/guide.html',R['ibusuki']),
'lunch':p('lunch','11:15','이부스키역 · 점심','黒豚と郷土料理 青葉 指宿市湊1-2-11',31.2355,130.6428,'60분','식사 약 ¥1,200~2,500/인',0,'adult','아오바 전용 주차장. 식당 선택 시 주차 링크도 확인.','기본 목적지는 아오바. TAKETORA 선택 시 11:30 오픈·대기 고려.', 'https://aoba-ibusuki.com/',R['ibusuki'],'식사'),
'flower':p('flower','12:45','플라워파크 가고시마','フラワーパークかごしま 山川岡児ケ水1611',31.1668,130.5774,'90분','¥630/인',630,'adult','무료 주차 약525대.','09:00~17:00·입장16:30까지. 주요 구역 위주. 원내버스 고령자 우선·카트1시간¥1,000(대수 제한, 운전면허·운영 여부 확인).','https://www.fp-k.org/information/'),
'ryugu':p('ryugu','14:25','용궁신사 · 나가사키바나','龍宮神社 指宿市山川岡児ケ水1581-34',31.1584,130.5887,'45분','참배·해안 산책 무료',0,'adult','시영 무료주차장과 민영 유료가 섞임. 시영 長崎鼻公園駐車場 표지 확인·신사까지 도보.','신사만 15~25분. 등대 방향까지 40~60분. 주차장 간판을 확인해 무료/구매조건부 구역 구분.','https://www.kagoshima-kankou.com/guide/50237',[],parkq='長崎鼻公園 駐車場'),
'nishi':p('nishi','15:25','니시오야마역','JR西大山駅 指宿市山川大山602-8',31.1905,130.5761,'20분','무료 · 도착증명서 ¥110 선택',0,'adult','역 앞 소규모 주차장 약10대. 요금 현장 확인.','가이몬다케·노란 우체통 사진. 기차를 기다리지 않는 기준.','https://www.ibusuki.or.jp/tourism/view/jrnishioyama/'),
'ikeda':p('ikeda','16:10','이케다호 · PAX 카페','IKEDAKO PAX 指宿市池田5123-7',31.2340,130.5439,'45분','호수 무료 · 카페 별도',0,'adult','PAX 무료 주차 약46대.','카페09:00~18:00. 이날 마지막 전망·휴식. 니시오야마역에서 약20~25분 추정.','https://ikedakopax.jp/',R['ikeda'],'카페'),
'aeon':p('aeon','18:15','이온몰 · 유니클로·GU·마트','イオンモール鹿児島 鹿児島市東開町7',31.5274,130.5360,'120분·저녁 포함','주차 무료 · 구매 별도',0,'adult','모든 주차장 무료. 층·구역 사진을 남겨두기.','중앙역 이온과 다른 남쪽 대형몰. 전문점21시 마감·식품매장23시(변경 가능). 주류매장도 함께 보기.','https://kagoshimabay.aeon-kyushu.info/access',[],'쇼핑'),
'silk2':p('silk2','20:45','실크인 · 두 번째 밤','シルクイン鹿児島 上之園町19-30',31.5804,130.5444,'숙박','주차 1박 ¥800/대',800,'vehicle','첫날과 동일. 출차마다 할인카드 필요.','다음 날 이른 출발 준비. 조식 시간 전 출발이면 아침 별도 준비.',S,[],'숙소'),
'ferryout':p('ferryout','07:30','가고시마항 · 차량 페리','桜島フェリー 鹿児島港 乗り場',31.5966,130.5655,'대기＋항해 약30~45분','차3~4m ¥1,700＋동승자¥250 / 편도',1950,'vehicle','차량 승선 대기 차선. 주차 후 도보 승선이 아니라 차량째 승선.','차4~5m이면 ¥2,350＋동승자¥250=¥2,600/편도. 운전자1명 포함. 실제 렌트차 길이 확인·표준 요금 기준. 요금은 사쿠라지마항 쪽에서 지불.',F,[],'페리',parkq='桜島フェリー 鹿児島港 車両乗船口'),
'yuno':p('yuno','08:25','유노히라 전망대','湯之平展望所 桜島小池町1025',31.5914,130.6303,'25분','무료',0,'adult','무료 주차. 산길·커브 주의.','전망 구역은 관람 자유, 매점09:00~17:00. 이른 도착 시 매점·시설 미개방 가능.','https://www.sakurajima.gr.jp/spot/4089.html'),
'kuro':p('kuro','09:40','구로카미 매몰 도리이','黒神埋没鳥居 黒神町647',31.5844,130.7065,'20분','관람 무료',0,'adult','인근 관람객 주차장 있음. 요금·이용 구역 현장 확인.','유노히라에서 내려와 북쪽 해안으로 일주. 이동45~50분 추정.','https://www.sakurajima.gr.jp/spot/4099.html'),
'arimura':p('arimura','10:20','아리무라 용암 전망소','有村溶岩展望所 有村町952',31.5552,130.6638,'35분','관람 무료',0,'adult','관광객 주차장 있음. 현장 요금 표지 확인.','용암 산책은 가까운 구간 중심. 화산 활동·강풍·비에 따라 통제 확인.','https://visitor.sakurajima.gr.jp/guide.html'),
'akamizu':p('akamizu','11:15','아카미즈 전망광장','赤水展望広場 叫びの肖像',31.5700,130.6017,'15분','관람 무료',0,'adult','광장 주차장 이용. 요금 현장 확인.','조형물·바다 사진을 짧게. 뒤 일정이 밀리면 차창/짧은 사진 위주.','https://www.sakurajima.gr.jp/'),
'minato':p('minato','11:40','사쿠라지마항 · 점심','MINATO CAFE 桜島港フェリーターミナル3階',31.5937,130.5993,'40분','식사 별도',0,'adult','카페 주차 약4대. 만차 시 직원 안내.','메구미칸 식당은 월요일 휴무라 제외. 점심 대기 시 페리 우동/수족관 식당으로 대체.','https://www.sakurajima.gr.jp/spot/4104.html',R['sakura'],'식사'),
'foot':p('foot','12:20 선택','나기사 족욕 / 비지터센터','桜島 溶岩なぎさ公園 足湯',31.5904,130.5956,'15분·선택','족욕·비지터센터 무료',0,'adult','주변 방문객 주차 구역. 요금·이용시간 현장 확인.','12:35 복귀 페리 대기 목표. 밀리면 이 포인트부터 생략. 타월 지참.','https://visitor.sakurajima.gr.jp/',[],kind='선택'),
'ferryback':p('ferryback','12:35','사쿠라지마항 · 복귀 페리','桜島フェリー 桜島港 車両乗船口',31.5937,130.5993,'대기＋항해 약30~45분','차3~4m＋성인2인 합계 ¥1,950 / 편도',1950,'vehicle','차량 대기 차선. 요금정산 후 안내대로 승선.','차4~5m이면 ¥2,600. 지도 연결선은 도로 경로가 아님. 구글지도에서 페리 경로를 직접 확인.',F,[],'페리'),
'aqua':p('aqua','13:20','가고시마 수족관','いおワールドかごしま水族館 本港新町3-1',31.5967,130.5684,'85분','시외 성인 ¥2,000/인',2000,'adult','현영 제1~3주차장. 1시간 무료, 이후 1시간당¥200. 관람 할인 없음.','09:30~18:00·입장17시까지. 큰 수조 중심으로, 쇼 대기는 생략 가능.','https://ioworld.jp/faq',R['aquarium'],parkq='鹿児島県営 第1駐車場 本港新町'),
'sengan':p('sengan','15:15','센간엔','仙巌園 鹿児島市吉野町9700-1',31.6178,130.5787,'80분','입장 ¥1,600/인＋주차¥500/대',1600,'adult','주차1일¥500/대. 총액 입장2인¥3,200＋주차¥500.','17시 폐장·입장16:30까지. 정원40분·저택30분 정도. 박물관·체험은 생략. 지연되면 차료 휴식 줄이기.','https://www.senganen.jp/faq/',R['sengan'],parkq='仙巌園 駐車場',extra=500),
'shiroyama':p('shiroyama','17:15','시로야마 · 체크인','SHIROYAMA HOTEL kagoshima 新照院町41-1',31.5968,130.5492,'체크인·저녁','주차 첫날 ¥1,300/대',1300,'vehicle','프런트 앞 지나 터널 후 입체 주차장. 직원 안내 우선.','15시부터 체크인. 밤축제 셔틀은 우회 운행·정류장 위치 확인. 호텔 저녁 또는 덴몬칸 사전 예약.',H,R['festival'][:3],'숙소'),
'night':p('night','18:50~20:20','오하라 밤축제 · 덴몬칸','天文館通 おはら祭',31.5905,130.5556,'60~90분','관람 무료',0,'adult','차는 호텔에. 셔틀·택시＋도보. 18:00~21:00 차량 통제.','공식 축제18:50~20:20. 귀환 셔틀 위치 확인. 호텔까지 언덕 도보는 부모님과 비추천.',E,R['festival'],'축제','walking'),
'morning':p('morning','06:30~09:15','시로야마 · 온천과 조식','SHIROYAMA HOTEL kagoshima 新照院町41-1',31.5968,130.5492,'온천·조식·체크아웃','조식 포함 여부 예약 확인',0,'adult','체크아웃 후13:30까지 주차·짐 보관 가능 여부 프런트 확인. 불가 시 통제 밖 유료주차로 이동.','조식06:30~10:00, 예약 시간제 가능. 09:15 전후 체크아웃 후 축제장 이동.',H,[],'숙소'),
'dayfest':p('dayfest','10:20~12:00','오하라 본축제','天文館通 おはら祭',31.5905,130.5556,'약100분','관람 무료',0,'adult','09:30~16:00 중심도로 통제. 차량은 호텔 또는 통제 밖 주차.','본축제10:20~15:25 중 오전 관람. 비행 때문에 끝까지 보지 않기. 돌아갈 셔틀 위치·시간 전날 확인.',E,R['festival'],'축제','walking'),
'cafe4':p('cafe4','12:00~12:50','덴몬칸 · 점심 / 간식','薩摩蒸氣屋 菓々子横丁 東千石町13-14',31.5916,130.5555,'50분','식사·간식 별도',0,'adult','축제장에서 도보. 차는 기존 주차장 유지.','조식이 든든하면 가카시요코초 차·과자. 점심은 고무라사키 등. 긴 대기 피하고13시대 차량 회수.', 'https://www.jokiya.co.jp/shops/002.html',R['festival'][3:],'식사','walking'),
'carreturn':p('carreturn','13:00~13:40','호텔 복귀 · 차량·짐 회수','SHIROYAMA HOTEL kagoshima 新照院町41-1',31.5968,130.5492,'차량회수·출발','추가 주차는 호텔 확인',0,'vehicle','호텔이 체크아웃 후 주차 허용한 경우의 기본안. 불가 시 실제 주차장으로 목적지 수정.','늦어도14시 전 공항 방향 출발 목표. 축제 통제구간을 피하는 경로 확인.',H,[],'교통','walking'),
'gas':p('gas','14:40~15:00','공항 근처 주유','ガソリンスタンド 鹿児島空港 レンタカー',31.792,130.717,'15~20분','유류 실비',0,'vehicle','반납 전 주유. 특정 점포 미지정·구글지도에서 영업 중인 곳 선택.','렌트계약 유종 확인·영수증 보관. 지도 위치는 공항 주변 대표 위치.',B,[],'교통'),
'budgetback':p('budgetback','15:00~15:30','버짓 공항점 · 차량 반납','バジェットレンタカー 鹿児島空港店 霧島市溝辺町麓1377-1',31.795,130.720,'반납·셔틀 30~40분','계약 정산',0,'vehicle','공항 터미널이 아니라 영업소에 반납→공항 셔틀.','주소:霧島市溝辺町麓1377-1 / 0995-58-3543. 예약 반납시각이 더 이르면 예약 우선.',B,[],'교통'),
'airport':p('airport','16:00까지','가고시마공항 · 18시 귀국편','鹿児島空港 国際線ターミナル',31.8004,130.7191,'수속·출국','추가 식사·쇼핑 별도',0,'adult','렌터카 반납 완료 후 셔틀 하차.','18시 출발·국제선16시 도착 목표. 항공사 수속 마감 우선. 국내선 식당 이용은 수속·보안검색 전 시간 여유 있을 때만.','https://www.koj-ab.co.jp/',R['airport'],'공항')
}
# 날짜 형식
#  - id: 문자열 ID (날짜 추가·삭제가 가능하므로 순번과 분리)
#  - date: ISO 날짜(YYYY-MM-DD). 요일은 앱이 자동 계산 / dateNote: 날짜 옆 메모(공휴일 등)
#  - tight: 빠듯한 날 강조 표시 여부
#  - costNote: 비용 합계 아래에 덧붙이는 날짜별 안내
days=[
 dict(id='day-1',date='2026-10-31',dateNote='',title='도착, 가고시마의 첫 저녁',subtitle='공항 → 실크인 → 중앙역',hotel='실크인 가고시마',pace='가볍게',warning='15:30 한국 출발 기준. 실제 도착·렌터카 인수에 따라 첫날 시간을 조정하세요.',tight=False,costNote='',stops=[pts[k] for k in ['budget','silk','chuo','donki']]),
 dict(id='day-2',date='2026-11-01',dateNote='',title='모래찜질과 남쪽 바다',subtitle='이부스키 5곳 · 이온몰 쇼핑',hotel='실크인 가고시마',pace='알찬 하루',warning='08시 출발. 사라쿠 대기가 길면 이케다호 카페·이온몰 체류시간을 줄이세요.',tight=False,costNote='',stops=[pts[k] for k in ['saraku','lunch','flower','ryugu','nishi','ikeda','aeon','silk2']]),
 dict(id='day-3',date='2026-11-02',dateNote='',title='화산을 돌고, 축제 속으로',subtitle='사쿠라지마 일주 · 수족관 · 센간엔',hotel='시로야마 호텔',pace='매우 빠듯',warning='07시 출발. 전부 포함한 도전 일정입니다. 12:35 복귀 페리 대기·15:15 센간엔 입장을 목표로 하고 지연 시 족욕/전시/카페부터 줄이세요.',tight=True,costNote='페리 차3~4m 기준·차4~5m은 왕복 ¥1,300 추가',stops=[pts[k] for k in ['ferryout','yuno','kuro','arimura','akamizu','minato','foot','ferryback','aqua','sengan','shiroyama','night']]),
 dict(id='day-4',date='2026-11-03',dateNote='공휴일',title='본축제와 여유 있는 귀국',subtitle='시로야마 조식 · 본축제 · 공항',hotel='18:00 귀국편',pace='공항 시간 우선',warning='본축제는 오전만 관람. 체크아웃 후 호텔 주차 가능 여부 확인. 13:40 출발·15시대 버짓 반납·16시 공항 도착 목표.',tight=False,costNote='',stops=[pts[k] for k in ['morning','dayfest','cafe4','carreturn','gas','budgetback','airport']])]

# Departure markers make each day's route readable without relying on yesterday's map.
from copy import deepcopy
for day_id,newid,time,title in [(2,'silk-depart2','08:00','실크인 · 이부스키로 출발'),(3,'silk-depart3','07:00','실크인 · 체크아웃')]:
    dep=deepcopy(pts['silk'])
    dep.update(id=newid,time=time,title=title,duration='출발 준비',fee='추가 입장료 없음',amount=0,extraAmount=0,food=[],note='호텔 주차장에서 출발. 나가기 전 할인카드·짐을 확인하세요.')
    days[day_id-1]['stops'].insert(0,dep)

# ── version 3 변환 ──
# 카페로 표시할 가게 (지도에서 식당과 다른 배지)
CAFES={'danken COFFEE 이케다코 PAX','MINATO CAFE','센간엔 차료','잔보모치점','덴몬칸 무자키 본점','가카시요코초·차보 카카코'}
coords_file=ROOT/'scripts'/'food-coords.json'
coords=json.loads(coords_file.read_text(encoding='utf-8')) if coords_file.exists() else {}

def split_time(text):
    """'17:45 예상' → ('17:45','','예상'), '18:50~20:20' → ('18:50','20:20',''). 앱의 splitTimeText 와 같은 규칙."""
    m=re.match(r'^(\d{1,2}:\d{2})?\s*(?:[~〜-]\s*(\d{1,2}:\d{2}))?\s*([\s\S]*)$',text.strip())
    norm=lambda t: t.zfill(5) if t else ''
    return norm(m.group(1)),norm(m.group(2)),m.group(3).strip()

for day in days:
    foods=[]
    seen=set()
    stops=[]
    for stop in day['stops']:
        stop=deepcopy(stop)
        # 장소마다 붙어 있던 식당 후보를 그날의 별도 목록으로 옮깁니다. (같은 검색어는 한 번만)
        for f in stop.pop('food'):
            if f['query'] in seen: continue
            seen.add(f['query'])
            c=coords.get(f['query'])
            foods.append(dict(id='%s-food-%d'%(day['id'],len(foods)+1),category='cafe' if f['name'] in CAFES else 'restaurant',
                              name=f['name'],query=f['query'],lat=c['lat'] if c else None,lng=c['lng'] if c else None,
                              menu=f['menu'],budget=f['budget'],kind=f['kind'],hours=f['hours'],parking=f['parking'],source=f['source']))
        start,end,note=split_time(stop.pop('time'))
        stop.update(start=start,end=end,timeNote=note)
        stops.append(stop)
    day['stops']=stops
    day['foods']=foods

# restaurantGroups(식당 원본 묶음)는 앱에서 쓰지 않으므로 출력하지 않습니다.
# companion·tagline·highlight·highlightSub: 첫 화면 소개 문구 (예전에는 화면에 고정돼 있던 값)
seed=dict(version=3,id='kagoshima-2026',title='가고시마, 함께 가는 4일',
          companion='부모님과 둘이',tagline='따뜻한 온천, 바다 너머 화산, 그리고 가을 축제.',
          highlight='전 일정 렌터카',highlightSub='실크인 2박 → 시로야마 1박',
          travelers=2,currency='JPY',checkedAt='2026-10-30',days=days,notes='부모님과 2인 · 전 일정 렌터카 · 실크인 2박 / 시로야마 1박\n10/31 15:30 한국 출발 / 11/3 18:00 가고시마 출발\n금액은 엔화. 식당 예산은 추정이며 입장료 외 식비·숙박·렌트·톨비·유류·쇼핑은 합계에서 제외. 지도 핀 좌표는 대략적인 위치이며 실제 진입로는 구글지도 목적지로 확인.\n11/2 통제18~21시 / 11/3 통제09:30~16시. 축제 셔틀 우회·정류장 변경 확인.')
# React 앱이 import 하는 JSON 파일로 출력합니다.
# Windows 기본 인코딩(cp949)으로 저장되면 한글·일본어가 깨지므로 UTF-8을 명시합니다.
out=ROOT/'src'/'data'/'seed.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(seed,ensure_ascii=False,indent=4)+'\n',encoding='utf-8')
