// 시드 데이터의 맛집·카페 좌표를 Google Places API (New) 텍스트 검색으로 한 번 조회해 캐시 파일에 저장합니다.
// 실행: npm run geocode   (.env.local 의 VITE_GOOGLE_MAPS_API_KEY 사용)
//
// - 결과는 scripts/food-coords.json 에 { "검색어": { lat, lng, name, address } } 형태로 누적 저장됩니다.
// - 이미 캐시에 있는 검색어는 다시 조회하지 않으므로 여러 번 실행해도 요금이 추가로 들지 않습니다.
// - scripts/make-seed.py 가 이 캐시를 읽어 seed.json 의 맛집 좌표를 채웁니다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'scripts', 'food-coords.json');
const SEED = join(ROOT, 'src', 'data', 'seed.json');

/** .env.local → .env 순서로 읽어 KEY=VALUE 를 객체로 만듭니다. (dotenv 없이 간단히 파싱) */
function readEnv() {
    const env = {};
    for (const name of ['.env', '.env.local']) {
        const file = join(ROOT, name);
        if (!existsSync(file)) continue;
        for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
            // 주석(#)·빈 줄은 건너뛰고, 첫 '=' 기준으로 이름과 값을 나눕니다.
            const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        }
    }
    return env;
}

/** seed.json 에서 모든 맛집 검색어를 모읍니다. (v2: 장소 안 food, v3: 날짜의 foods 둘 다 지원) */
function collectQueries(seed) {
    const queries = new Set();
    for (const day of seed.days ?? []) {
        for (const food of day.foods ?? []) queries.add(food.query);
        for (const stop of day.stops ?? []) for (const food of stop.food ?? []) queries.add(food.query);
    }
    return [...queries].filter(Boolean);
}

/**
 * Places API (New) Text Search 1건 조회.
 * 웹사이트(HTTP 리퍼러) 제한 키도 동작하도록 개발 서버 주소를 Referer 헤더로 보냅니다.
 */
async function searchPlace(key, query) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            // FieldMask: 필요한 필드만 요청해야 요금 등급이 낮게 유지됩니다.
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
            Referer: 'http://localhost:5173/',
        },
        // 일본 장소이므로 일본어·일본 지역 우선으로 검색합니다.
        body: JSON.stringify({ textQuery: query, languageCode: 'ja', regionCode: 'JP', pageSize: 1 }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`${response.status} ${body.error?.message ?? JSON.stringify(body)}`);
    const place = body.places?.[0];
    if (!place?.location) return null;
    return {
        lat: Number(place.location.latitude.toFixed(6)),
        lng: Number(place.location.longitude.toFixed(6)),
        name: place.displayName?.text ?? '',
        address: place.formattedAddress ?? '',
    };
}

const key = readEnv().VITE_GOOGLE_MAPS_API_KEY;
if (!key) {
    console.error('VITE_GOOGLE_MAPS_API_KEY 가 .env.local 에 없습니다.');
    process.exit(1);
}
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const queries = collectQueries(JSON.parse(readFileSync(SEED, 'utf8')));
let found = 0;
let missing = 0;
for (const query of queries) {
    if (cache[query]) continue; // 이미 조회한 검색어는 건너뜀
    try {
        const result = await searchPlace(key, query);
        if (result) {
            cache[query] = result;
            found += 1;
            console.log(`✓ ${query} → ${result.lat}, ${result.lng} (${result.name})`);
        } else {
            missing += 1;
            console.log(`✗ ${query} → 결과 없음`);
        }
    } catch (error) {
        // 키 제한·API 미사용 설정 등 공통 오류면 반복해도 실패하므로 바로 중단합니다.
        console.error(`조회 실패: ${query}\n${error.message}`);
        process.exit(1);
    }
}
writeFileSync(CACHE, JSON.stringify(cache, null, 4) + '\n', 'utf8');
console.log(`완료: 새로 찾음 ${found}곳, 못 찾음 ${missing}곳, 캐시 총 ${Object.keys(cache).length}곳 → scripts/food-coords.json`);
