// 여행 화면: 날짜 탭, 지도, 일정·맛집 목록과 각종 편집 모달.
// 여행 데이터(useTrip) 상태를 받아 화면 영역과 모달에 나눠 주고, 데이터 변경 동작을 한곳에서 처리합니다.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader, headerButton } from '../components/AppHeader';
import { DayEditDialog, type DayFields } from '../components/DayEditDialog';
import { FoodCard } from '../components/FoodCard';
import { FoodEditDialog } from '../components/FoodEditDialog';
import { SortableStopList } from '../components/SortableStopList';
import { StopCard } from '../components/StopCard';
import { StopDetailDialog } from '../components/StopDetailDialog';
import { StopEditDialog } from '../components/StopEditDialog';
import { TripInfoDialog, type TripInfo } from '../components/TripInfoDialog';
import { TripMap, type FocusRequest } from '../components/TripMap';
import { TripStorageDialog } from '../components/TripStorageDialog';
import { currencySymbol, formatMoney } from '../lib/currency';
import { addDays, shortDate, weekdayOf } from '../lib/datetime';
import { lastDayKey, readItem, writeItem } from '../lib/storage';
import { clone, dayCost, foodMatches, newId, stopMatches, validateTrip } from '../lib/trip';
import { formatDateRange } from '../lib/tripSummary';
import { useAutoLocateFoods } from '../hooks/useAutoLocateFoods';
import type { Cloud } from '../hooks/useCloud';
import { useConfirm } from '../hooks/useConfirm';
import { useMapsReady } from '../hooks/useMaps';
import { useToast } from '../hooks/useToast';
import { useTrip } from '../hooks/useTrip';
import type { Day, Food, Stop, Trip } from '../types';

/** 오른쪽 목록 보기 방식: 일정 / 맛집·카페 */
type View = 'route' | 'food';

/** 모달 열림 상태: undefined = 닫힘, null = 새 항목, 문자열 = 해당 항목 편집 */
type EditTarget = string | null | undefined;

/** 사용자 메시지용 오류 문구 추출 */
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface TripPageProps {
    initialTrip: Trip;
    cloud: Cloud;
    onOpenSettings: () => void;
}

export function TripPage({ initialTrip, cloud, onOpenSettings }: TripPageProps) {
    const toast = useToast();
    const confirm = useConfirm(); // 앱 자체 확인창 (브라우저 confirm() 대신)
    const { trip, saveStatus, commit, update, replace, isSaveBlocked, getTrip } = useTrip(initialTrip);
    // 좌표 없는 맛집이 있으면 지도 스크립트가 준비된 뒤 자동으로 위치를 찾아 채웁니다.
    useAutoLocateFoods(trip, update, useMapsReady(), toast);

    // ── 화면 상태 ──
    const [selectedDayId, setSelectedDayId] = useState(() => readItem(lastDayKey(trip.id)) ?? '');
    /** 선택된 장소 또는 맛집 ID (지도와 목록이 공유) */
    const [selectedId, setSelectedId] = useState('');
    const [view, setView] = useState<View>('route');
    const [search, setSearch] = useState('');
    const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
    /** 순서 편집 모드 (드래그로 장소 순서 변경) */
    const [reorder, setReorder] = useState(false);
    const reordered = useRef(false); // 순서 편집 중 실제로 바뀐 적이 있는지 (완료 시 안내용)
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
    const [editStopId, setEditStopId] = useState<EditTarget>(undefined);
    const [editDayId, setEditDayId] = useState<EditTarget>(undefined);
    const [editFoodId, setEditFoodId] = useState<EditTarget>(undefined);
    const [infoOpen, setInfoOpen] = useState(false);
    const [storageOpen, setStorageOpen] = useState(false);

    // 브라우저 탭 제목을 여행 제목과 맞춥니다.
    useEffect(() => {
        document.title = `${trip.title} · TRIP TRACKER`;
    }, [trip.title]);

    // 저장된 날짜가 삭제됐거나 없으면 첫째 날을 보여줍니다. 새 여행처럼 날짜가 하나도 없으면 null.
    const day: Day | null = trip.days.find(item => item.id === selectedDayId) ?? trip.days[0] ?? null;

    // ── 파생 값 ──
    const filteredStops = useMemo(() => (day ? day.stops.filter(stop => stopMatches(stop, search)) : []), [day, search]);
    const filteredFoods = useMemo(() => (day ? day.foods.filter(food => foodMatches(food, search)) : []), [day, search]);
    const detailStop = day && detailId ? day.stops.find(stop => stop.id === detailId) ?? null : null;
    const editStop = day && editStopId ? day.stops.find(stop => stop.id === editStopId) ?? null : null;
    const editFood = day && editFoodId ? day.foods.find(food => food.id === editFoodId) ?? null : null;
    const editDay = editDayId ? trip.days.find(item => item.id === editDayId) ?? null : null;
    // 장소 이름으로 검색할 때 이 근처 결과를 우선하도록 그날(없으면 여행) 첫 장소 좌표를 씁니다.
    const firstStop = day?.stops[0] ?? trip.days.flatMap(item => item.stops)[0];
    const bias = firstStop ? { lat: firstStop.lat, lng: firstStop.lng } : null;
    // 새 날짜의 기본값: 날짜가 정해진 마지막 날의 다음 날
    const lastDated = [...trip.days].reverse().find(item => item.date);
    const nextDate = lastDated ? addDays(lastDated.date, 1) : '';
    const dateRange = formatDateRange(trip);

    // ── 데이터 변경 도우미 ──

    /** 현재 날짜의 데이터만 바꿔서 저장 */
    const updateDay = (recipe: (current: Day) => Day) => {
        if (!day) return;
        update(current => ({ ...current, days: current.days.map(item => (item.id === day.id ? recipe(item) : item)) }));
    };

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
        writeItem(lastDayKey(trip.id), id); // 새로고침해도 같은 날짜를 보여주기 위해 기억
        setSelectedId('');
        setSearch('');
        setReorder(false);
    };

    // ── 지도·목록 선택 ──

    /** 목록 카드(또는 번호·배지 버튼) 클릭: 지도에서 해당 위치로 이동하고 정보창 열기 */
    const focusItem = (id: string) => {
        setSelectedId(id);
        setFocusRequest({ id, nonce: Date.now() });
    };

    /** 지도 핀·배지 클릭: 해당 종류의 탭으로 바꾸고 목록에서 카드가 보이도록 스크롤 */
    const onMapSelect = (id: string) => {
        setSelectedId(id);
        const isFood = !!day?.foods.some(food => food.id === id);
        setView(isFood ? 'food' : 'route');
        setReorder(false);
        setSearch(''); // 검색으로 카드가 숨겨져 있을 수 있으므로 검색어를 지웁니다.
        // 탭 전환 후 카드가 그려진 다음에 스크롤하도록 한 프레임 미룹니다.
        requestAnimationFrame(() => document.getElementById(`item-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    };

    // ── 장소 동작 ──
    const toggleDone = (id: string, done: boolean) =>
        updateDay(current => ({ ...current, stops: current.stops.map(stop => (stop.id === id ? { ...stop, done } : stop)) }));

    const openDetail = (id: string) => {
        setSelectedId(id);
        setDetailId(id);
    };

    const openStopEdit = (id: string | null) => {
        setDetailId(null); // 상세 모달 위에 편집 모달이 겹치지 않도록 먼저 닫습니다.
        setEditStopId(id);
    };

    /** 순서 편집 모드에서 드래그로 바뀐 순서 저장 */
    const reorderStops = (stops: Stop[]) => {
        reordered.current = true;
        updateDay(current => ({ ...current, stops }));
    };

    const toggleReorder = () => {
        if (reorder && reordered.current) toast('순서를 저장했습니다. 방문 시각은 필요하면 직접 조정하세요.');
        reordered.current = false;
        setSearch('');
        setReorder(!reorder);
    };

    const deleteStop = async (id: string) => {
        const title = day?.stops.find(stop => stop.id === id)?.title ?? '이 장소';
        // await: 사용자가 확인창에서 고를 때까지 기다립니다. 취소하면 아무것도 하지 않음
        if (!(await confirm({ title: `'${title}'을(를) 일정에서 삭제할까요?`, message: '삭제한 장소는 되돌릴 수 없습니다.', confirmLabel: '삭제', danger: true }))) return;
        updateDay(current => ({ ...current, stops: current.stops.filter(stop => stop.id !== id) }));
        setDetailId(null);
        if (selectedId === id) setSelectedId('');
    };

    /** 장소 편집 저장. id 가 없으면 새 장소로 오늘 일정 끝에 추가합니다. */
    const saveStop = (input: Omit<Stop, 'id'> & { id?: string }) => {
        if (!day) return;
        const stop: Stop = { ...input, id: input.id ?? newId() };
        const next = clone(getTrip());
        const target = next.days.find(item => item.id === day.id);
        if (!target) return;
        const index = target.stops.findIndex(item => item.id === stop.id);
        if (index >= 0) target.stops[index] = stop;
        else target.stops.push(stop);
        if (!commitValidated(next)) return;
        setSelectedId(stop.id);
        setEditStopId(undefined);
        toast('장소를 저장했습니다.');
    };

    // ── 맛집 동작 ──

    /** 맛집 저장. id 가 없으면 오늘 맛집 목록 끝에 추가합니다. */
    const saveFood = (input: Omit<Food, 'id'> & { id?: string }) => {
        if (!day) return;
        const food: Food = { ...input, id: input.id ?? newId() };
        const next = clone(getTrip());
        const target = next.days.find(item => item.id === day.id);
        if (!target) return;
        const index = target.foods.findIndex(item => item.id === food.id);
        if (index >= 0) target.foods[index] = food;
        else target.foods.push(food);
        if (!commitValidated(next)) return;
        setSelectedId(food.id);
        setEditFoodId(undefined);
        toast(food.lat === null ? '저장했습니다. 위치가 없어 지도에는 표시되지 않습니다.' : '맛집을 저장했습니다.');
    };

    const deleteFood = async (id: string) => {
        const name = day?.foods.find(food => food.id === id)?.name ?? '이 맛집·카페';
        if (!(await confirm({ title: `'${name}'을(를) 삭제할까요?`, message: '삭제한 맛집·카페는 되돌릴 수 없습니다.', confirmLabel: '삭제', danger: true }))) return;
        updateDay(current => ({ ...current, foods: current.foods.filter(food => food.id !== id) }));
        setEditFoodId(undefined);
        if (selectedId === id) setSelectedId('');
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
            next.days.push({ id: targetId, ...fields, stops: [], foods: [] });
        }
        if (!commitValidated(next)) return;
        setEditDayId(undefined);
        selectDay(targetId);
        toast(editDayId ? '날짜 정보를 저장했습니다.' : '새 날짜를 추가했습니다. ‘＋ 장소 추가’로 일정을 채우세요.');
    };

    const deleteDay = async () => {
        if (!editDay) return;
        const ok = await confirm({
            title: `'${editDay.title || shortDate(editDay.date) || '이 날짜'}'을(를) 삭제할까요?`,
            message: `이 날짜의 장소 ${editDay.stops.length}곳과 맛집·카페 ${editDay.foods.length}곳도 함께 삭제되며 되돌릴 수 없습니다.`,
            confirmLabel: '날짜 삭제',
            danger: true,
        });
        if (!ok) return;
        const index = trip.days.findIndex(item => item.id === editDay.id);
        const days = trip.days.filter(item => item.id !== editDay.id);
        update(current => ({ ...current, days: current.days.filter(item => item.id !== editDay.id) }));
        setEditDayId(undefined);
        // 삭제한 자리의 바로 앞 날짜(첫째 날이었으면 새 첫째 날)로 이동. 남은 날짜가 없으면 빈 화면
        selectDay(days[Math.max(0, index - 1)]?.id ?? '');
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

    const saveInfo = (info: TripInfo) => {
        if (commitValidated({ ...getTrip(), ...info })) setInfoOpen(false);
    };

    const checkedLabel = trip.checkedAt ? trip.checkedAt.replace(/-/g, '.') : '';

    return (
        <>
            <AppHeader>
                <span role="status" className="text-[11px] text-muted max-tab:text-[10px] max-phone:hidden">
                    {saveStatus}
                </span>
                <button type="button" className={headerButton} onClick={() => setStorageOpen(true)}>☁ 저장·백업</button>
                <button type="button" className={headerButton} onClick={onOpenSettings} aria-label="설정">⚙</button>
            </AppHeader>

            <main className="mx-auto max-w-[1500px] px-[5%] max-tab:px-[22px] max-phone:px-[15px] wide:px-[50px]">
                {/* ── 상단 소개 ── */}
                <section className="flex items-center justify-between gap-5 pt-10 pb-9 max-tab:py-[26px] print:py-[15px]">
                    <div className="min-w-0">
                        <a href="#/" className="mb-3 inline-block text-[11px] text-muted no-underline print:hidden">← 여행 목록</a>
                        <p className="eyebrow max-phone:text-[9px]">{[dateRange || '날짜 미정', trip.companion].filter(Boolean).join(' · ')}</p>
                        <h1 className="m-0 text-[clamp(25px,3vw,38px)] leading-[1.3] font-[550] tracking-[-1.8px] max-phone:text-[27px]">
                            {trip.title}
                            <button type="button" className="btn btn-text ml-3 align-middle text-[11px] font-semibold print:hidden" onClick={() => setInfoOpen(true)}>
                                여행 정보 편집
                            </button>
                        </h1>
                        {trip.tagline && <p className="mt-[13px] text-[13px] text-muted max-tab:text-[12px]">{trip.tagline}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-[3px] border-l border-line pl-7 max-tab:hidden">
                        <span className="text-[10px] tracking-[2px] text-gold">{trip.days.length} DAYS</span>
                        {trip.highlight && <strong className="text-[15px]">{trip.highlight}</strong>}
                        {trip.highlightSub && <small className="text-[11px] text-muted">{trip.highlightSub}</small>}
                    </div>
                </section>

                {/* ── 날짜 탭 (날짜가 많으면 가로 스크롤) ── */}
                {/* [scrollbar-width:none]: 가로 스크롤은 유지하되 스크롤 막대는 숨깁니다. */}
                <nav aria-label="여행 날짜" className="flex overflow-x-auto rounded-xl border border-line bg-paper [scrollbar-width:none] max-tab:sticky max-tab:top-0 max-tab:z-[5] print:static">
                    {trip.days.map((item, index) => {
                        const active = item.id === day?.id;
                        const sub = [weekdayOf(item.date), item.dateNote].filter(Boolean).join(' · ');
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
                                <span className="text-[20px] font-medium tracking-[-1px] whitespace-nowrap max-phone:text-[18px]">
                                    {shortDate(item.date) || '미정'}
                                    <small className={`block text-[11px] font-normal tracking-normal max-phone:text-[9px] max-phone:whitespace-nowrap ${active ? 'text-[#cbd8c7]' : 'text-muted'}`}>
                                        {sub || '\u00a0'}
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
                    <button type="button" onClick={() => setEditDayId(null)} className="shrink-0 px-4 py-4 text-[12px] font-semibold whitespace-nowrap text-green print:hidden" aria-label="날짜 추가">
                        ＋ 날짜
                    </button>
                </nav>

                {!day ? (
                    // 새 여행처럼 날짜가 하나도 없을 때
                    <div className="my-10 rounded-xl border border-dashed border-line p-10 text-center">
                        <p className="mb-4 text-muted">아직 날짜가 없습니다. 첫 날짜를 추가하고 장소와 맛집을 채워 보세요.</p>
                        <button type="button" className="btn btn-primary" onClick={() => setEditDayId(null)}>＋ 첫 날짜 추가</button>
                    </div>
                ) : (
                    <>
                        {/* ── 선택한 날짜 제목 ── */}
                        <div className="mt-[29px] mb-5 flex items-center justify-between gap-3 max-tab:mt-[23px] max-tab:mb-4">
                            <div className="min-w-0">
                                <p className="eyebrow max-phone:text-[9px]">{[day.subtitle, day.hotel].filter(Boolean).join(' · ')}</p>
                                <h2 className="m-0 text-[23px] leading-[1.4] font-semibold tracking-[-0.8px] max-phone:text-[21px]">{day.title}</h2>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-2 print:hidden">
                                <button type="button" className="btn btn-outline max-phone:px-2.5 max-phone:py-2 max-phone:text-[11px]" onClick={() => setEditDayId(day.id)}>
                                    날짜 편집
                                </button>
                                <button type="button" className="btn btn-outline whitespace-nowrap max-phone:px-2.5 max-phone:py-2 max-phone:text-[11px]" onClick={() => openStopEdit(null)}>
                                    ＋ 장소 추가
                                </button>
                            </div>
                        </div>

                        <section className="grid grid-cols-[minmax(320px,0.9fr)_minmax(400px,1.1fr)] items-start gap-7 max-tab:grid-cols-1 max-tab:gap-[22px] print:block">
                            {/* ── 왼쪽: 지도·비용·안내 ── */}
                            <aside className="sticky top-5 max-tab:static print:hidden">
                                <TripMap
                                    stops={day.stops}
                                    foods={day.foods}
                                    selectedId={selectedId}
                                    focusRequest={focusRequest}
                                    onSelect={onMapSelect}
                                    onStopDetail={openDetail}
                                    onFoodEdit={id => setEditFoodId(id)}
                                    onOpenSettings={onOpenSettings}
                                />

                                <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-[#e9eee4] px-5 py-[19px] max-tab:mt-3 max-tab:px-4 max-tab:py-3">
                                    <div>
                                        <small className="text-[10px] text-muted max-phone:text-[9px]">성인 {trip.travelers}명 기준 · 장소별로 입력한 금액 합계</small>
                                        {/* formatMoney: 여행 통화의 기호·자릿수로 표시 (예: ₩19,500 / ¥1,950 / $19.5) */}
                                        <strong className="block text-[27px] font-[550] tracking-[-1px] max-tab:text-[24px]">약 {formatMoney(dayCost(day, trip.travelers), trip.currency)}</strong>
                                        <p className="mt-0.5 text-[10px] text-muted">
                                            식비·숙박·렌트·유류·쇼핑 등 입력하지 않은 비용 제외{day.costNote ? ` / ${day.costNote}` : ''}
                                        </p>
                                    </div>
                                    {/* 장식용 큰 통화 기호 (기호가 긴 통화는 글자를 줄임) */}
                                    <span aria-hidden="true" className={`font-serif text-[#a6b19c] ${currencySymbol(trip.currency).length > 2 ? 'text-[20px]' : 'text-[35px]'}`}>
                                        {currencySymbol(trip.currency)}
                                    </span>
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
                                    <button type="button" className="btn btn-text" onClick={() => setInfoOpen(true)}>
                                        여행 메모 편집 ↗
                                    </button>
                                </div>

                                <details className="border-t border-line pt-3 text-[11px] text-muted">
                                    <summary className="cursor-pointer text-ink">일정·비용 안내 / 출처</summary>
                                    {trip.notes && <p className="my-3 whitespace-pre-wrap">{trip.notes}</p>}
                                    <p className="my-3">
                                        {checkedLabel ? `${checkedLabel} 확인. ` : ''}식당 예산과 이동·체류시간은 계획용 추정입니다. 휴무·입장료·주차는 현장 공지가 우선합니다.
                                        각 장소의 ‘자세히’에서 원문을 확인할 수 있습니다.
                                    </p>
                                    <p className="my-3">지도는 Google 지도입니다. 장소 좌표는 구글지도 URL 기준이며, 진입로는 구글지도 길찾기로 확인하세요.</p>
                                </details>
                            </aside>

                            {/* ── 오른쪽: 일정 / 맛집 목록 ── */}
                            <section>
                                <div className="mb-3.5 flex items-center justify-between gap-2.5 max-tab:sticky max-tab:top-[73px] max-tab:z-[2] max-tab:bg-bg max-tab:py-[9px] max-phone:top-[75px] print:hidden">
                                    <div className="flex gap-[18px] border-b border-line max-phone:gap-[15px]">
                                        {(
                                            [
                                                ['route', `일정 ${day.stops.length}`],
                                                ['food', `맛집·카페 ${day.foods.length}`],
                                            ] as const
                                        ).map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => {
                                                    setView(key);
                                                    setReorder(false);
                                                }}
                                                className={`rounded-none px-0 py-[9px] text-[12px] whitespace-nowrap ${view === key ? 'border-b-2 border-green text-green' : 'text-muted'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {/* 순서 편집 중에는 검색으로 일부만 보이면 순서가 헷갈리므로 검색칸을 숨깁니다. */}
                                        {!reorder && (
                                            <label className="flex items-center gap-1.5 rounded-[7px] bg-[#eceee7] px-2.5 py-1">
                                                <span aria-hidden>⌕</span>
                                                <input
                                                    type="search"
                                                    placeholder={view === 'food' ? '맛집 검색' : '장소 검색'}
                                                    aria-label={view === 'food' ? '맛집 검색' : '장소 검색'}
                                                    value={search}
                                                    onChange={event => setSearch(event.target.value)}
                                                    className="w-[110px] border-0 bg-transparent p-[3px] text-[11px] max-phone:w-[80px]"
                                                />
                                            </label>
                                        )}
                                        {view === 'route' ? (
                                            <button
                                                type="button"
                                                className={`btn btn-mini whitespace-nowrap ${reorder ? 'bg-green text-white' : ''}`}
                                                onClick={toggleReorder}
                                                disabled={!reorder && day.stops.length < 2}
                                            >
                                                {reorder ? '✓ 완료' : '↕ 순서 편집'}
                                            </button>
                                        ) : (
                                            <button type="button" className="btn btn-mini whitespace-nowrap" onClick={() => setEditFoodId(null)}>
                                                ＋ 맛집
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {view === 'food' ? (
                                    filteredFoods.length ? (
                                        <>
                                            <p className="mb-3 text-[11px] text-muted">맛집은 방문 후보입니다. 예산은 추정이며 휴무·대기시간을 확인하세요. 🍴·☕ 버튼을 누르면 지도에서 위치를 보여줍니다.</p>
                                            {filteredFoods.map(food => (
                                                <FoodCard key={food.id} food={food} selected={food.id === selectedId} onFocus={focusItem} onEdit={id => setEditFoodId(id)} />
                                            ))}
                                        </>
                                    ) : (
                                        <Empty>{day.foods.length ? '검색된 맛집이 없습니다.' : '아직 맛집·카페가 없습니다. ‘＋ 맛집’으로 추가하세요.'}</Empty>
                                    )
                                ) : reorder ? (
                                    <>
                                        <p className="mb-3 text-[11px] text-muted">⠿ 손잡이를 끌어 순서를 바꾸세요. 바뀐 순서는 바로 저장됩니다.</p>
                                        <SortableStopList stops={day.stops} onReorder={reorderStops} />
                                    </>
                                ) : filteredStops.length ? (
                                    filteredStops.map(stop => (
                                        <StopCard
                                            key={stop.id}
                                            stop={stop}
                                            // 검색으로 걸러져도 지도와 같은 원래 순번을 표시
                                            number={day.stops.indexOf(stop) + 1}
                                            selected={stop.id === selectedId}
                                            onFocus={focusItem}
                                            onToggleDone={toggleDone}
                                            onDetail={openDetail}
                                            onEdit={openStopEdit}
                                        />
                                    ))
                                ) : (
                                    <Empty>{day.stops.length ? '검색 결과가 없습니다.' : '아직 장소가 없습니다. ‘＋ 장소 추가’로 일정을 채우세요.'}</Empty>
                                )}
                            </section>
                        </section>
                    </>
                )}
            </main>

            <footer className="mx-[5%] mt-10 mb-5 border-t border-line pt-5 text-[10px] text-muted max-phone:text-[9px] print:hidden">
                TRIP TRACKER <span className="mx-[9px]">·</span> 구글지도 길찾기 / 직접 편집 / 기기 자동 저장
            </footer>

            {/* ── 모달 ── */}
            <StopDetailDialog stop={detailStop} checkedAt={trip.checkedAt} onClose={() => setDetailId(null)} onEdit={openStopEdit} onDelete={deleteStop} />
            <StopEditDialog open={editStopId !== undefined} stop={editStop} bias={bias} currency={trip.currency} onClose={() => setEditStopId(undefined)} onSave={saveStop} />
            <FoodEditDialog
                open={editFoodId !== undefined}
                food={editFood}
                bias={bias}
                onClose={() => setEditFoodId(undefined)}
                onSave={saveFood}
                onDelete={deleteFood}
            />
            <DayEditDialog
                open={editDayId !== undefined}
                day={editDay}
                defaultDate={nextDate}
                onClose={() => setEditDayId(undefined)}
                onSave={saveDay}
                onDelete={deleteDay}
            />
            <TripInfoDialog
                open={infoOpen}
                info={{ title: trip.title, companion: trip.companion, tagline: trip.tagline, highlight: trip.highlight, highlightSub: trip.highlightSub, currency: trip.currency, notes: trip.notes }}
                onClose={() => setInfoOpen(false)}
                onSave={saveInfo}
            />
            <TripStorageDialog
                open={storageOpen}
                onClose={() => setStorageOpen(false)}
                getTrip={getTrip}
                replace={replace}
                isSaveBlocked={isSaveBlocked}
                cloud={cloud}
            />
        </>
    );
}

/** 목록이 비었을 때 안내 */
function Empty({ children }: { children: string }) {
    return <div className="p-[35px] text-center text-muted">{children}</div>;
}
