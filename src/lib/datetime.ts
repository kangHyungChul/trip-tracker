// 날짜·시간 문자열 도우미.
// 데이터에는 시간대 문제를 피하려고 Date 객체 대신 문자열("YYYY-MM-DD", "HH:mm")로 저장합니다.

/** ISO 날짜 형식 검사용 정규식 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** "HH:mm" 24시간 형식 검사용 정규식 */
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 요일 이름 (Date.getDay() 순서: 0 = 일요일) */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "YYYY-MM-DD" → 로컬 자정 Date. 형식이 틀리거나 존재하지 않는 날짜(2월 30일 등)면 null */
export function parseISODate(value: string): Date | null {
    const match = ISO_DATE.exec(value);
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    // new Date(…) 는 13월·32일 같은 값을 다음 달로 넘겨 버리므로, 다시 읽어 같은지 확인합니다.
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Date → "YYYY-MM-DD" (로컬 날짜 기준. toISOString 은 UTC 라 하루가 밀릴 수 있어 쓰지 않음) */
export function toISODate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 빈 문자열 또는 실제 존재하는 ISO 날짜인지 */
export const isValidISODate = (value: string) => value === '' || parseISODate(value) !== null;

/** ISO 날짜에 days 일을 더한 ISO 날짜. 입력이 잘못되면 빈 문자열 */
export function addDays(value: string, days: number): string {
    const date = parseISODate(value);
    if (!date) return '';
    date.setDate(date.getDate() + days);
    return toISODate(date);
}

/** 날짜 탭 표시용 "MM.DD" (예: 2026-10-31 → "10.31"). 미정이면 빈 문자열 */
export function shortDate(value: string): string {
    const date = parseISODate(value);
    if (!date) return '';
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

/** 요일 한 글자 (예: "토"). 미정이면 빈 문자열 */
export function weekdayOf(value: string): string {
    const date = parseISODate(value);
    return date ? WEEKDAYS[date.getDay()] : '';
}

/** 빈 문자열 또는 "HH:mm" 인지 */
export const isValidTime = (value: string) => value === '' || HHMM.test(value);

/** "HH:mm" → 오늘 날짜의 Date (시간 선택기용). 비어 있거나 형식이 틀리면 null */
export function timeToDate(value: string): Date | null {
    const match = HHMM.exec(value);
    if (!match) return null;
    const date = new Date();
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return date;
}

/** Date → "HH:mm" */
export const dateToTime = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * 예전 버전의 자유 문구 시간을 시작/종료/메모로 나눕니다.
 *  "17:45 예상"   → { start: "17:45", end: "",      note: "예상" }
 *  "18:50~20:20"  → { start: "18:50", end: "20:20", note: "" }
 *  "16:00까지"    → { start: "16:00", end: "",      note: "까지" }
 *  "시간 미정"    → { start: "",      end: "",      note: "시간 미정" }
 */
export function splitTimeText(text: string): { start: string; end: string; note: string } {
    const value = text.trim();
    // (시작 시각)? (~ 종료 시각)? (나머지 메모) — 시각은 "9:05" 처럼 한 자리 시도 허용
    const match = /^(\d{1,2}:\d{2})?\s*(?:[~〜-]\s*(\d{1,2}:\d{2}))?\s*([\s\S]*)$/.exec(value);
    const normalize = (time?: string) => {
        if (!time) return '';
        const padded = time.padStart(5, '0'); // "9:05" → "09:05"
        return HHMM.test(padded) ? padded : '';
    };
    const start = normalize(match?.[1]);
    const end = normalize(match?.[2]);
    // 시각으로 인식하지 못했으면(예: "25:00") 원문 전체를 메모로 남겨 정보가 사라지지 않게 합니다.
    if ((match?.[1] && !start) || (match?.[2] && !end)) return { start: '', end: '', note: value };
    return { start, end, note: (match?.[3] ?? '').trim() };
}

/** 시작/종료/메모를 화면 표시용 한 줄로 합칩니다. 예) "18:50~20:20", "17:45 예상", "~16:00" */
export function formatTime(start: string, end: string, note: string): string {
    const range = start && end ? `${start}~${end}` : start || (end ? `~${end}` : '');
    return [range, note].filter(Boolean).join(' ') || '시간 미정';
}
