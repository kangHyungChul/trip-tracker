// react-datepicker 를 감싼 날짜·시간 입력칸.
// 데이터는 문자열("YYYY-MM-DD", "HH:mm")로 주고받고, 선택기 내부에서만 Date 객체로 바꿉니다.

import DatePicker, { registerLocale } from 'react-datepicker';
import { ko } from 'date-fns/locale';
import { dateToTime, parseISODate, timeToDate, toISODate } from '../lib/datetime';

// 달력의 월·요일 이름을 한국어로 표시하기 위해 date-fns 한국어 로케일을 'ko' 이름으로 등록합니다.
registerLocale('ko', ko);

interface DateInputProps {
    /** "YYYY-MM-DD" 또는 빈 문자열 */
    value: string;
    onChange: (value: string) => void;
    id?: string;
    placeholder?: string;
    /** 달력을 열었을 때 처음 보여줄 날짜 (값이 비어 있을 때) */
    openTo?: string;
}

/** 날짜 선택 입력칸 (달력) */
export function DateInput({ value, onChange, id, placeholder = '날짜 선택', openTo }: DateInputProps) {
    return (
        <DatePicker
            id={id}
            locale="ko"
            selected={parseISODate(value)}
            // 선택값이 없을 때 달력이 열릴 기준 날짜 (예: 앞 날짜의 다음 날)
            openToDate={!value && openTo ? parseISODate(openTo) ?? undefined : undefined}
            // selectsRange/selectsMultiple 을 쓰지 않으므로 onChange 는 Date 하나(또는 지움 null)를 받습니다.
            onChange={(date: Date | null) => onChange(date ? toISODate(date) : '')}
            // 표시 형식: 2026.10.31 (토)
            dateFormat="yyyy.MM.dd (eee)"
            placeholderText={placeholder}
            isClearable // × 버튼으로 "날짜 미정"으로 되돌리기
            clearButtonTitle="날짜 지우기"
            autoComplete="off"
        />
    );
}

interface TimeInputProps {
    /** "HH:mm" 또는 빈 문자열 */
    value: string;
    onChange: (value: string) => void;
    id?: string;
    placeholder?: string;
    /** 목록을 열었을 때 처음 보여줄 시각 "HH:mm" (값이 비어 있을 때. 예: 종료 시각은 시작 시각 근처) */
    openTo?: string;
}

/** 시각 선택 입력칸 (5분 단위 목록 + 직접 입력) */
export function TimeInput({ value, onChange, id, placeholder = '시각 선택', openTo }: TimeInputProps) {
    return (
        <DatePicker
            id={id}
            locale="ko"
            selected={timeToDate(value)}
            // 값이 없으면 기본적으로 '지금 시각' 근처가 보이므로, 지정한 기준 시각 근처로 스크롤되게 합니다.
            openToDate={!value && openTo ? timeToDate(openTo) ?? undefined : undefined}
            onChange={(date: Date | null) => onChange(date ? dateToTime(date) : '')}
            showTimeSelect
            showTimeSelectOnly // 달력 없이 시간 목록만
            timeIntervals={5}
            timeCaption="시각"
            dateFormat="HH:mm"
            timeFormat="HH:mm"
            placeholderText={placeholder}
            isClearable
            clearButtonTitle="시각 지우기"
            autoComplete="off"
        />
    );
}
