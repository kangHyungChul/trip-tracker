// 앱 최상위 컴포넌트.
// 여행 데이터(useTrip)·클라우드(useCloud) 상태를 받아 화면 영역과 모달에 나눠 주고,
// 장소/날짜 편집 같은 데이터 변경 동작을 한곳에서 처리합니다.

import { useEffect, useMemo, useState } from 'react';
import { DayEditDialog, type DayFields } from './components/DayEditDialog';
import { FoodCard } from './components/FoodCard';
import { NoteDialog } from './components/NoteDialog';
import { StopCard } from './components/StopCard';
import { StopDetailDialog } from './components/StopDetailDialog';
import { StopEditDialog } from './components/StopEditDialog';
import { StorageDialog } from './components/StorageDialog';
import { TripMap, type FocusRequest } from './components/TripMap';
import { useCloud } from './hooks/useCloud';
import { useToast } from './hooks/useToast';
import { SEED_TRIP, useTrip } from './hooks/useTrip';
import { LAST_DAY_KEY, readItem, writeItem } from './lib/storage';
import { clone, dayCost, foodMatches, newId, stopMatches, validateTrip } from './lib/trip';
import type { Day, Food, Stop, Trip } from './types';

/** 오른쪽 목록 보기 방식: 일정 / 맛집·카페 */
type View = 'route' | 'food';

/** 마지막으로 본 날짜 ID 읽기. v1 시절에는 숫자("3")로 저장했으므로 새 ID 형식("day-3")으로 바꿉니다. */
function loadLastDay(): string {
    const stored = readItem(LAST_DAY_KEY) ?? '';
    return /^\d+$/.test(stored) ? `day-${stored}` : stored;
}

/** 사용자 메시지용 오류 문구 추출 */
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function App() {
    const toast = useToast();
    const { trip, saveStatus, commit, update, replace, isSaveBlocked, getTrip } = useTrip();
    const cloud = useCloud();

    // ── 화면 상태 ──
    const [selectedDayId, setSelectedDayId] = useState(loadLastDay);
    const [selectedStopId, setSelectedStopId] = useState('');
    const [view, setView] = useState<View>('route');
    const [search, setSearch] = useState('');
    const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
    // 여행 인원 입력칸. 입력 도중의 빈 값도 허용하기 위해 문자열로 따로 보관합니다.
    const [travelersInput, setTravelersInput] = useState(String(trip.travelers));
    // 렌더링 중 상태 조정 패턴: 데이터 쪽 인원이 바뀌면(백업 불러오기 등) 입력칸도 맞춰 줍니다.
    const [syncedTravelers, setSyncedTravelers] = useState(trip.travelers);
    if (syncedTravelers !== trip.travelers) {
        setSyncedTravelers(trip.travelers);
        setTravelersInput(String(trip.travelers));
    }

    // ── 모달 상태 ──
    const [detailId, setDetailId] = useState<string | null>(null);
    /** 장소 편집 모달: undefined = 닫힘, null = 새 장소, 문자열 = 해당 장소 편집 */
    const [editStopId, setEditStopId] = useState<string | null | undefined>(undefined);
    /** 날짜 편집 모달: undefined = 닫힘, null = 새 날짜, 문자열 = 해당 날짜 편집 */
    const [editDayId, setEditDayId] = useState<string | null | undefined>(undefined);
    const [noteOpen, setNoteOpen] = useState(false);
    const [storageOpen, setStorageOpen] = useState(false);

    // 브라우저 탭 제목을 여행 제목과 맞춥니다.
    useEffect(() => {
        document.title = trip.title;
    }, [trip.title]);

    // 저장된 날짜가 삭제됐거나 없으면 첫째 날을 보여줍니다. (검증상 최소 하루는 항상 존재)
    const day: Day = trip.days.find(item => item.id === selectedDayId) ?? trip.days[0];

    // ── 파생 값 ──
    const total = dayCost(day, trip.travelers);
    const filteredStops = useMemo(() => day.stops.filter(stop => stopMatches(stop, search)), [day, search]);
    // 맛집 탭: 오늘 장소들의 식당을 모아 같은 검색어(query)는 한 번만 보여줍니다.
    const foods = useMemo(() => {
        const seen = new Set<string>();
        const list: { food: Food; context: string }[] = [];
        for (const stop of day.stops) {
            for (const food of stop.food) {
                if (seen.has(food.query)) continue;
                seen.add(food.query);
                if (foodMatches(food, search)) list.push({ food, context: stop.title });
            }
        }
        return list;
    }, [day, search]);
    const detailStop = detailId ? day.stops.find(stop => stop.id === detailId) ?? null : null;
    const editStop = editStopId ? day.stops.find(stop => stop.id === editStopId) ?? null : null;
    const editDay = editDayId ? trip.days.find(item => item.id === editDayId) ?? null : null;
    const firstDate = trip.days[0].date;
    const lastDate = trip.days[trip.days.length - 1].date;

    // ── 데이터 변경 도우미 ──

    /** 현재 날짜의 데이터만 바꿔서 저장 */
    const updateDay = (recipe: (current: Day) => Day) =>
        update(current => ({ ...current, days: current.days.map(item => (item.id === day.id ? recipe(item) : item)) }));

    /** 전체 검증을 통과한 경우에만 저장. 실패하면 오류를 토스트로 보여주고 false */
    const commitValidated = (next: Trip): boolean => {
        try {
            commit(validateTrip(next));
            return true;
        } catch (error) {
            toast(errorMessage(error));
            return false;
        }
    };

    // ── 날짜 선택 ──
    const selectDay = (id: string) => {
        setSelectedDayId(id);
        writeItem(LAST_DAY_KEY, id); // 새로고침해도 같은 날짜를 보여주기 위해 기억
        setSelectedStopId('');
        setSearch('');
    };

    // ── 장소 동작 ──
    const toggleDone = (id: string, done: boolean) =>
        updateDay(current => ({ ...current, stops: current.stops.map(stop => (stop.id === id ? { ...stop, done } : stop)) }));

    const openDetail = (id: string) => {
        setSelectedStopId(id);
        setDetailId(id);
    };

    const openEdit = (id: string | null) => {
        setDetailId(null); // 상세 모달 위에 편집 모달이 겹치지 않도록 먼저 닫습니다.
        setEditStopId(id);
    };

    /** 목록의 번호 버튼: 지도에서 해당 핀 팝업 열기 */
    const focusStop = (id: string) => {
        setSelectedStopId(id);
        setFocusRequest({ id, nonce: Date.now() });
    };

    /** 지도 핀 클릭: 목록에서 해당 카드를 선택하고 보이도록 스크롤 */
    const onMarkerClick = (id: string) => {
        setSelectedStopId(id);
        if (view === 'route') {
            document.getElementById(`stop-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    };

    /** 방문 순서 이동 (delta: -1 앞으로, 1 뒤로) */
    const moveStop = (id: string, delta: -1 | 1) => {
        const from = day.stops.findIndex(stop => stop.id === id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= day.stops.length) {
            toast('더 이동할 수 없습니다.');
            return;
        }
        updateDay(current => {
            const stops = [...current.stops];
            [stops[from], stops[to]] = [stops[to], stops[from]]; // 구조 분해 할당으로 두 항목 자리 바꾸기
            return { ...current, stops };
        });
        setDetailId(null);
        toast('순서를 바꿨습니다. 방문 시각은 직접 조정하세요.');
    };

    const deleteStop = (id: string) => {
        if (!confirm('이 장소를 일정에서 삭제할까요?')) return;
        updateDay(current => ({ ...current, stops: current.stops.filter(stop => stop.id !== id) }));
        setDetailId(null);
        if (selectedStopId === id) setSelectedStopId('');
    };

    /** 장소 편집 저장. id 가 없으면 새 장소로 오늘 일정 끝에 추가합니다. */
    const saveStop = (input: Omit<Stop, 'id'> & { id?: string }) => {
        const stop: Stop = { ...input, id: input.id ?? newId() };
        const next = clone(getTrip());
        const target = next.days.find(item => item.id === day.id);
        if (!target) return;
        const index = target.stops.findIndex(item => item.id === stop.id);
        if (index >= 0) target.stops[index] = stop;
        else target.stops.push(stop);
        if (!commitValidated(next)) return;
        setSelectedStopId(stop.id);
        setEditStopId(undefined);
        toast('수정 내용을 기기에 저장했습니다.');
    };

    // ── 날짜 동작 ──

    /** 날짜 저장. 편집 중인 날짜가 없으면 새 날짜를 맨 뒤에 추가하고 그 날짜로 이동합니다. */
    const saveDay = (fields: DayFields) => {
        const next = clone(getTrip());
        let targetId = editDayId;
        if (targetId) {
            next.days = next.days.map(item => (item.id === targetId ? { ...item, ...fields } : item));
        } else {
            targetId = newId();
            next.days.push({ id: targetId, ...fields, stops: [] });
        }
        if (!commitValidated(next)) return;
        setEditDayId(undefined);
        selectDay(targetId);
        toast(editDayId ? '날짜 정보를 저장했습니다.' : '새 날짜를 추가했습니다. ‘＋ 장소 추가’로 일정을 채우세요.');
    };

    const deleteDay = () => {
        if (!editDay) return;
        if (trip.days.length <= 1) {
            toast('최소 하루는 있어야 합니다.');
            return;
        }
        if (!confirm(`'${editDay.title || editDay.date}' 날짜와 장소 ${editDay.stops.length}곳을 삭제할까요?`)) return;
        const index = trip.days.findIndex(item => item.id === editDay.id);
        const days = trip.days.filter(item => item.id !== editDay.id);
        update(current => ({ ...current, days: current.days.filter(item => item.id !== editDay.id) }));
        setEditDayId(undefined);
        // 삭제한 자리의 바로 앞 날짜(첫째 날이었으면 새 첫째 날)로 이동
        selectDay(days[Math.max(0, index - 1)].id);
        toast('날짜를 삭제했습니다.');
    };

    // ── 기타 ──

    /** 여행 인원 입력: 1~20 정수일 때만 즉시 반영 */
    const changeTravelers = (value: string) => {
        setTravelersInput(value);
        const n = Number(value);
        if (Number.isInteger(n) && n >= 1 && n <= 20) update(current => ({ ...current, travelers: n }));
    };
    /** 입력칸을 벗어날 때 잘못된 값이면 원래 값으로 되돌리기 */
    const blurTravelers = () => {
        if (travelersInput !== String(trip.travelers)) {
            setTravelersInput(String(trip.travelers));
            toast('인원은 1~20명입니다.');
        }
    };

    const saveNote = (title: string, notes: string) => {
        if (commitValidated({ ...getTrip(), title, notes })) setNoteOpen(false);
    };

    const checkedLabel = trip.checkedAt ? trip.checkedAt.replace(/-/g, '.') : '';

    return (
        <>
            <header className="flex h-[85px] items-center justify-between border-b border-line bg-paper px-[5%] max-tab:h-[73px] max-tab:px-[22px] max-phone:px-[15px]">
                <a href="#" aria-label="여행 첫 화면" className="flex items-center gap-3 text-[17px] leading-[1.3] font-bold no-underline max-phone:gap-2 max-phone:text-[14px]">
                    <span className="grid h-[43px] w-[43px] place-items-center rounded-full bg-green font-serif text-[26px] text-paper max-phone:h-[35px] max-phone:w-[35px] max-phone:text-[22px]">
                        旅
                    </span>
                    <span>
                        함께, 가고시마
                        <small className="mt-[5px] block text-[9px] font-medium tracking-[2px] max-phone:text-[8px]">KAGOSHIMA JOURNAL</small>
                    </span>
                </a>
                <div className="flex items-center gap-[18px] max-tab:gap-[9px] print:hidden">
                    <span role="status" className="text-[11px] text-muted max-tab:text-[10px] max-phone:max-w-[60px] max-phone:leading-[1.4]">
                        {saveStatus}
                    </span>
                    <button type="button" className="btn btn-soft max-phone:px-2.5 max-phone:py-2 max-phone:text-[11px]" onClick={() => setStorageOpen(true)}>
                        ☁ 저장·백업
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-[1500px] px-[5%] max-tab:px-[22px] max-phone:px-[15px] wide:px-[50px]">
                {/* ── 상단 소개 ── */}
                <section className="flex items-center justify-between gap-5 pt-12 pb-9 max-tab:py-[30px] print:py-[15px]">
                    <div>
                        <p className="eyebrow max-phone:text-[9px]">
                            {firstDate}
                            {lastDate !== firstDate ? ` — ${lastDate}` : ''} · 부모님과 둘이
                        </p>
                        <h1 className="m-0 text-[clamp(25px,3vw,38px)] leading-[1.3] font-[550] tracking-[-1.8px] max-phone:text-[27px]">{trip.title}</h1>
                        <p className="mt-[13px] text-[13px] text-muted max-tab:text-[12px]">따뜻한 온천, 바다 너머 화산, 그리고 가을 축제.</p>
                    </div>
                    <div className="flex flex-col gap-[3px] border-l border-line pl-7 max-tab:hidden">
                        <span className="text-[10px] tracking-[2px] text-gold">{trip.days.length} DAYS</span>
                        <strong className="text-[15px]">전 일정 렌터카</strong>
                        <small className="text-[11px] text-muted">실크인 2박 → 시로야마 1박</small>
                    </div>
                </section>

                {/* ── 날짜 탭 (날짜가 많으면 가로 스크롤) ── */}
                {/* [scrollbar-width:none]: 가로 스크롤은 유지하되 스크롤 막대는 숨깁니다. */}
                <nav aria-label="여행 날짜" className="flex overflow-x-auto rounded-xl border border-line bg-paper [scrollbar-width:none] max-tab:sticky max-tab:top-0 max-tab:z-[5] print:static">
                    {trip.days.map((item, index) => {
                        const active = item.id === day.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => selectDay(item.id)}
                                aria-current={active ? 'date' : undefined}
                                className={[
                                    'flex min-w-[150px] flex-1 basis-0 items-center justify-start gap-4 border-r border-line px-5 py-4 text-left',
                                    'max-tab:gap-2 max-tab:px-[15px] max-tab:py-[13px] max-phone:block max-phone:min-w-[78px] max-phone:px-[9px] max-phone:py-2.5',
                                    active ? 'bg-green text-white' : '',
                                ].join(' ')}
                            >
                                <span className="text-[20px] font-medium tracking-[-1px] max-phone:text-[18px]">
                                    {item.date || '날짜 미정'}
                                    <small className={`block text-[11px] font-normal tracking-normal max-phone:text-[9px] max-phone:whitespace-nowrap ${active ? 'text-[#cbd8c7]' : 'text-muted'}`}>
                                        {item.weekday}
                                    </small>
                                </span>
                                <span className="text-[10px] tracking-[1px] max-phone:text-[8px]">
                                    {/* DAY 01, DAY 02 … 처럼 두 자리 순번 */}
                                    DAY {String(index + 1).padStart(2, '0')}
                                    <small className={`block text-[11px] font-normal max-phone:max-w-[70px] max-phone:overflow-hidden max-phone:text-[9px] max-phone:text-ellipsis max-phone:whitespace-nowrap ${active ? 'text-[#cbd8c7]' : 'text-muted'}`}>
                                        {item.subtitle.split('·')[0]}
                                    </small>
                                </span>
                            </button>
                        );
                    })}
                    <button type="button" onClick={() => setEditDayId(null)} className="shrink-0 px-4 text-[12px] font-semibold whitespace-nowrap text-green print:hidden" aria-label="날짜 추가">
                        ＋ 날짜
                    </button>
                </nav>

                {/* ── 선택한 날짜 제목 ── */}
                <div className="mt-[29px] mb-5 flex items-center justify-between gap-3 max-tab:mt-[23px] max-tab:mb-4">
                    <div>
                        <p className="eyebrow max-phone:text-[9px]">{[day.subtitle, day.hotel].filter(Boolean).join(' · ')}</p>
                        <h2 className="m-0 text-[23px] leading-[1.4] font-semibold tracking-[-0.8px] max-phone:text-[21px]">{day.title}</h2>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2 print:hidden">
                        <button type="button" className="btn btn-outline max-phone:px-2.5 max-phone:py-2 max-phone:text-[11px]" onClick={() => setEditDayId(day.id)}>
                            날짜 편집
                        </button>
                        <button type="button" className="btn btn-outline whitespace-nowrap max-phone:px-2.5 max-phone:py-2 max-phone:text-[11px]" onClick={() => openEdit(null)}>
                            ＋ 장소 추가
                        </button>
                    </div>
                </div>

                <section className="grid grid-cols-[minmax(320px,0.9fr)_minmax(400px,1.1fr)] items-start gap-7 max-tab:grid-cols-1 max-tab:gap-[22px] print:block">
                    {/* ── 왼쪽: 지도·비용·안내 ── */}
                    <aside className="sticky top-5 max-tab:static print:hidden">
                        <TripMap stops={day.stops} selectedId={selectedStopId} focusRequest={focusRequest} onMarkerClick={onMarkerClick} onDetail={openDetail} />

                        <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-[#e9eee4] px-5 py-[19px] max-tab:mt-3 max-tab:px-4 max-tab:py-3">
                            <div>
                                <small className="text-[10px] text-muted max-phone:text-[9px]">성인 {trip.travelers}명 기준 · 입장·정액 교통·호텔 주차</small>
                                {/* toLocaleString('ko-KR'): 1950 → "1,950" 처럼 천 단위 쉼표 */}
                                <strong className="block text-[27px] font-[550] tracking-[-1px] max-tab:text-[24px]">약 ¥{total.toLocaleString('ko-KR')}</strong>
                                <p className="mt-0.5 text-[10px] text-muted">
                                    식비·숙박·렌트·유류·톨비·쇼핑·변동 주차 제외{day.costNote ? ` / ${day.costNote}` : ''}
                                </p>
                            </div>
                            <span className="font-serif text-[35px] text-[#a6b19c]">¥</span>
                        </div>

                        {(day.pace || day.warning) && (
                            <div
                                className={`mt-[15px] rounded-[10px] border px-[17px] py-[15px] text-[11px] max-tab:mt-2.5 ${
                                    day.tight ? 'border-[#e8d1c4] bg-[#f7ede5] text-[#935e43]' : 'border-[#e7dfcb] bg-[#f5f0e3] text-[#78613b]'
                                }`}
                            >
                                {[day.pace, day.warning].filter(Boolean).join(' · ')}
                            </div>
                        )}

                        <div className="my-3.5 flex items-center justify-between text-[11px] max-tab:my-2.5 max-phone:gap-2">
                            <label>
                                여행 인원
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={travelersInput}
                                    onChange={event => changeTravelers(event.target.value)}
                                    onBlur={blurTravelers}
                                    className="mx-[3px] w-[45px] px-[5px] py-[3px]"
                                />
                                명
                            </label>
                            <button type="button" className="btn btn-text" onClick={() => setNoteOpen(true)}>
                                여행 메모 편집 ↗
                            </button>
                        </div>

                        <details className="border-t border-line pt-3 text-[11px] text-muted">
                            <summary className="cursor-pointer text-ink">일정·비용 안내 / 출처</summary>
                            <p className="my-3 whitespace-pre-wrap">{trip.notes}</p>
                            <p className="my-3">
                                {checkedLabel ? `${checkedLabel} 확인. ` : ''}식당 예산과 이동·체류시간은 계획용 추정입니다. 휴무·입장료·주차는 현장 공지가 우선합니다. 각
                                장소의 ‘자세히’에서 원문을 확인할 수 있습니다.
                            </p>
                            <p className="my-3">지도는 일본 국토지리원 지리원 타일. 표시 좌표는 대략적인 위치입니다. 구글지도에서 장소명·주소와 진입로를 확인하세요.</p>
                        </details>
                    </aside>

                    {/* ── 오른쪽: 일정 / 맛집 목록 ── */}
                    <section>
                        <div className="mb-3.5 flex items-center justify-between gap-2.5 max-tab:sticky max-tab:top-[73px] max-tab:z-[2] max-tab:bg-bg max-tab:py-[9px] max-phone:top-[75px] print:hidden">
                            <div className="flex gap-[18px] border-b border-line max-phone:gap-[15px]">
                                {(
                                    [
                                        ['route', '일정'],
                                        ['food', '맛집·카페'],
                                    ] as const
                                ).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setView(key)}
                                        className={`rounded-none px-0 py-[9px] text-[12px] ${view === key ? 'border-b-2 border-green text-green' : 'text-muted'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <label className="flex items-center gap-1.5 rounded-[7px] bg-[#eceee7] px-2.5 py-1">
                                <span aria-hidden>⌕</span>
                                <input
                                    type="search"
                                    placeholder="장소·음식 검색"
                                    aria-label="장소·음식 검색"
                                    value={search}
                                    onChange={event => setSearch(event.target.value)}
                                    className="w-[120px] border-0 bg-transparent p-[3px] text-[11px] max-phone:w-[115px]"
                                />
                            </label>
                        </div>

                        {view === 'food' ? (
                            foods.length ? (
                                <>
                                    <p className="mb-3 text-[11px] text-muted">식당은 방문 후보입니다. 예산은 추정·휴무 및 대기시간 확인. 일정의 ‘편집’에서 후보를 수정할 수 있습니다.</p>
                                    {foods.map(({ food, context }) => (
                                        <FoodCard key={food.query} food={food} context={context} />
                                    ))}
                                </>
                            ) : (
                                <Empty>검색된 식당이 없습니다. 장소 편집에서 후보를 추가하세요.</Empty>
                            )
                        ) : filteredStops.length ? (
                            filteredStops.map(stop => (
                                <StopCard
                                    key={stop.id}
                                    stop={stop}
                                    // 검색으로 걸러져도 지도와 같은 원래 순번을 표시
                                    number={day.stops.indexOf(stop) + 1}
                                    selected={stop.id === selectedStopId}
                                    onFocus={focusStop}
                                    onToggleDone={toggleDone}
                                    onDetail={openDetail}
                                    onEdit={openEdit}
                                />
                            ))
                        ) : (
                            <Empty>{day.stops.length ? '검색 결과가 없습니다.' : '아직 장소가 없습니다. ‘＋ 장소 추가’로 일정을 채우세요.'}</Empty>
                        )}
                    </section>
                </section>
            </main>

            <footer className="mx-[5%] mt-10 mb-5 border-t border-line pt-5 text-[10px] text-muted max-phone:text-[9px] print:hidden">
                가고시마 여행 노트 <span className="mx-[9px]">·</span> 구글지도 길찾기 / 직접 편집 / 기기 자동 저장
            </footer>

            {/* ── 모달 ── */}
            <StopDetailDialog
                stop={detailStop}
                checkedAt={trip.checkedAt}
                onClose={() => setDetailId(null)}
                onMove={moveStop}
                onEdit={openEdit}
                onDelete={deleteStop}
            />
            <StopEditDialog open={editStopId !== undefined} stop={editStop} onClose={() => setEditStopId(undefined)} onSave={saveStop} />
            <DayEditDialog
                open={editDayId !== undefined}
                day={editDay}
                canDelete={trip.days.length > 1}
                onClose={() => setEditDayId(undefined)}
                onSave={saveDay}
                onDelete={deleteDay}
            />
            <NoteDialog open={noteOpen} title={trip.title} notes={trip.notes} onClose={() => setNoteOpen(false)} onSave={saveNote} />
            <StorageDialog
                open={storageOpen}
                onClose={() => setStorageOpen(false)}
                getTrip={getTrip}
                replace={replace}
                isSaveBlocked={isSaveBlocked}
                cloud={cloud}
                seed={SEED_TRIP}
            />
        </>
    );
}

/** 목록이 비었을 때 안내 */
function Empty({ children }: { children: string }) {
    return <div className="p-[35px] text-center text-muted">{children}</div>;
}
