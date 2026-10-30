// JSON 백업 파일 내려받기·읽기 도우미.

import { parseTrip } from './trip';
import type { Trip } from '../types';

/** 불러오기 파일 최대 크기 (3MB, Supabase 테이블 제한과 동일) */
export const MAX_IMPORT_BYTES = 3_000_000;

/** 파일 이름에 쓸 수 없는 글자를 '-' 로 바꾸고 길이를 줄입니다. */
const safeFileName = (text: string) => text.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'trip';

/** 텍스트를 파일로 내려받기 (임시 링크를 만들어 클릭) */
export function downloadText(fileName: string, text: string) {
    const blob = new Blob([text], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    // 다운로드가 시작된 뒤 임시 URL 메모리를 해제합니다.
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** 여행을 JSON 백업 파일로 내려받기. 파일 이름: trip-tracker-<제목>-<날짜>.json */
export function exportTrip(trip: Trip) {
    downloadText(`trip-tracker-${safeFileName(trip.title)}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(trip, null, 4));
}

/**
 * 선택한 백업 파일을 읽어 검증된 Trip 으로 만듭니다. (예전 버전 파일은 자동 변환)
 * @param id 지정하면 여행 ID 를 이 값으로 고정 (현재 여행에 덮어쓸 때)
 */
export async function readTripFile(file: File, id?: string): Promise<Trip> {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('백업 파일은 3MB 이하만 가능합니다.');
    return parseTrip(JSON.parse(await file.text()), { id });
}
