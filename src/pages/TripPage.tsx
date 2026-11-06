// 여행 화면: 날짜 탭, 지도, 일정·맛집 목록과 각종 편집 모달.
// 여행 데이터(useTrip) 상태를 받아 화면 영역과 모달에 나눠 주고, 데이터 변경 동작을 한곳에서 처리합니다.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpDown, ArrowUpRight, Check, Cloud, Pencil, Plus, Search, Settings, TriangleAlert } from 'lucide-react';
import { AppHeader, headerButton, headerIconButton } from '../components/AppHeader';
import { BottomSheet, type SheetHeights, type SheetSnap } from '../components/BottomSheet';
import { DayEditDialog, type DayFields } from '../components/DayEditDialog';
import { DayTabs } from '../components/DayTabs';
import { FoodCard } from '../components/FoodCard';
import { FoodEditDialog } from '../components/FoodEditDialog';
import { CandidateScheduleDialog } from '../components/CandidateScheduleDialog';
import { scheduleCandidate, type ScheduleCandidateInput } from '../lib/itinerary';
import { SortableStopList } from '../components/SortableStopList';
import { StopCard } from '../components/StopCard';
import { StopDetailDialog } from '../components/StopDetailDialog';
import { StopEditDialog } from '../components/StopEditDialog';
import { TripInfoDialog, type TripInfo } from '../components/TripInfoDialog';
import { TripMap, type FocusRequest } from '../components/TripMap';
import { TripStorageDialog } from '../components/TripStorageDialog';
import { currencySymbol, formatMoney } from '../lib/currency';
import { addDays, shortDate } from '../lib/datetime';
import { lastDayKey, readItem, writeItem } from '../lib/storage';
import { clone, dayCost, foodMatches, newId, stopMatches, validateTrip } from '../lib/trip';
import { formatDateRange } from '../lib/tripSummary';
import { requestConflictPrompt } from '../lib/sync';
import { useAutoLocateFoods } from '../hooks/useAutoLocateFoods';
import { useConfirm } from '../hooks/useConfirm';
import { useMapsReady } from '../hooks/useMaps';
import { PHONE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../hooks/useToast';
import { useTrip } from '../hooks/useTrip';
import type { Day, Food, Stop, Trip } from '../types';

/** 오른쪽 목록 보기 방식: 일정 / 맛집·카페 */
type View = 'route' | 'food';

/** 모달 열림 상태: undefined = 닫힘, null = 새 항목, 문자열 = 해당 항목 편집 */
type EditTarget = string | null | undefined;

/** 휴대폰 바텀시트에서 카드로 스크롤할 때, 위에 고정된 ‘일정/맛집’ 탭 줄에 가리지 않도록 띄울 높이(px) */
const SHEET_STICKY_OFFSET = 60;
/** 휴대폰 화면의 동그란 아이콘 버튼 공통 스타일 (상단바·시트 머리) */
const PHONE_ICON_BUTTON = 'grid h-9 w-9 shrink-0 place-items-center rounded-full p-0 text-[15px] leading-none';

/** 사용자 메시지용 오류 문구 추출 */
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface TripPageProps {
    initialTrip: Trip;
    onOpenSettings: () => void;
}

export function TripPage({ initialTrip, onOpenSettings }: TripPageProps) {
    const toast = useToast();
    const confirm = useConfirm(); // 앱 자체 확인창 (브라우저 confirm() 대신)
    const { trip, saveStatus, syncState, syncMessage, commit, update, replace, getTrip } = useTrip(initialTrip);
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

    // ── 휴대폰 화면(폭 480px 이하) 상태 ──
    const isPhone = useMediaQuery(PHONE_QUERY);
    const isDesktop = useMediaQuery('(min-width: 851px)');
    const desktopScrollerRef = useRef<HTMLDivElement>(null);
    /** 바텀시트 높이 단계. 처음에는 절반 높이로 목록 일부를 보여줍니다. */
    const [sheetSnap, setSheetSnap] = useState<SheetSnap>('half');
    /** 바텀시트 단계별 높이(px). BottomSheet 가 화면 크기를 재서 알려 줍니다. */
    const [sheetHeights, setSheetHeights] = useState<SheetHeights>({ peek: 0, half: 0, full: 0 });
    /** 바텀시트 목록 스크롤 영역 */
    const sheetScrollerRef = useRef<HTMLDivElement>(null);
    /** 휴대폰 날짜 칩 중 선택된 칩 (날짜가 바뀌면 가로 스크롤해서 보이게 하기 위해) */
    const activeChipRef = useRef<HTMLButtonElement>(null);

    // ── 모달 상태 ──
    const [detailId, setDetailId] = useState<string | null>(null);
    const [editStopId, setEditStopId] = useState<EditTarget>(undefined);
    const [editDayId, setEditDayId] = useState<EditTarget>(undefined);
    const [editFoodId, setEditFoodId] = useState<EditTarget>(undefined);
    const [scheduleCandidateId, setScheduleCandidateId] = useState<string | null>(null);
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
    const filteredFoods = useMemo(() => (trip.candidates ?? []).filter(food => foodMatches(food, search)), [trip.candidates, search]);
    const detailStop = day && detailId ? day.stops.find(stop => stop.id === detailId) ?? null : null;
    const editStop = day && editStopId ? day.stops.find(stop => stop.id === editStopId) ?? null : null;
    const editFood = editFoodId ? trip.candidates?.find(food => food.id === editFoodId) ?? null : null;
    const schedulingCandidate = trip.candidates?.find(item => item.id === scheduleCandidateId);
    const editDay = editDayId ? trip.days.find(item => item.id === editDayId) ?? null : null;
    // 장소 이름으로 검색할 때 이 근처 결과를 우선하도록 그날(없으면 여행) 첫 장소 좌표를 씁니다.
    const firstStop = day?.stops[0] ?? trip.days.flatMap(item => item.stops)[0];
    const bias = firstStop ? { lat: firstStop.lat, lng: firstStop.lng } : null;
    // 새 날짜의 기본값: 날짜가 정해진 마지막 날의 다음 날
    const lastDated = [...trip.days].reverse().find(item => item.date);
    const nextDate = lastDated ? addDays(lastDated.date, 1) : '';
    const dateRange = formatDateRange(trip);
    // 휴대폰 + 날짜가 있을 때만 ‘전체화면 지도 + 바텀시트’ 구성 (날짜가 없으면 안내 화면이라 일반 구성)
    const phoneLayout = isPhone && !!day;
    const desktopLayout = isDesktop && !!day;
    // 지도 아래쪽이 바텀시트에 가려지는 높이. 지도에서 위치를 옮길 때 이만큼을 피해 보이는 영역 가운데에 맞춥니다.
    // (시트 단계를 바꾸는 것과 같은 렌더링에서 새 높이가 지도에 전달되도록 여기서 계산)
    const bottomInset = phoneLayout ? sheetHeights[sheetSnap] : 0;

    // 휴대폰: 선택한 날짜 칩이 가로 스크롤 밖에 있으면 보이는 곳으로 옮깁니다. (날짜가 많을 때)
    // inline 'nearest': 이미 보이면 움직이지 않고, 가려졌을 때만 가까운 쪽 끝에 맞춥니다.
    useEffect(() => {
        activeChipRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }, [phoneLayout, day?.id]);

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

    /**
     * 목록에서 해당 카드가 보이도록 스크롤합니다. 탭 전환 등으로 카드가 그려진 다음에 하도록 한 프레임 미룹니다.
     * 휴대폰: 바텀시트 목록 안에서만 스크롤해 카드를 시트 위쪽(고정 탭 줄 바로 아래)에 둡니다.
     *        (scrollIntoView 는 바깥 영역까지 움직일 수 있어 직접 위치를 계산)
     */
    const revealCard = (id: string) => {
        requestAnimationFrame(() => {
            const card = document.getElementById(`item-${id}`);
            if (!card) return;
            const scroller = phoneLayout ? sheetScrollerRef.current : desktopLayout ? desktopScrollerRef.current : null;
            if (scroller) {
                // 카드의 ‘목록 내용 기준’ 위치 = 화면상 위치 차이 + 현재 스크롤 양
                const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
                scroller.scrollTo({ top: Math.max(0, top - SHEET_STICKY_OFFSET), behavior: 'smooth' });
            } else {
                card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    };

    /** 목록 카드(또는 번호·배지 버튼) 클릭: 지도에서 해당 위치로 이동하고 정보창 열기 */
    const focusItem = (id: string) => {
        setSelectedId(id);
        if (phoneLayout) {
            // 휴대폰: 시트를 절반으로 내려 지도의 해당 위치가 보이게 하고, 누른 카드는 시트 위쪽에 남깁니다.
            setSheetSnap('half');
            revealCard(id);
        }
        setFocusRequest({ id, nonce: Date.now() });
    };

    /** 지도 핀·배지 클릭: 해당 종류의 탭으로 바꾸고 목록에서 카드가 보이도록 스크롤 */
    const onMapSelect = (id: string) => {
        setSelectedId(id);
        const isFood = !!trip.candidates?.some(food => food.id === id);
        setView(isFood ? 'food' : 'route');
        setReorder(false);
        setSearch(''); // 검색으로 카드가 숨겨져 있을 수 있으므로 검색어를 지웁니다.
        if (phoneLayout && sheetSnap === 'peek') {
            // 휴대폰에서 시트가 손잡이만 보이면 절반까지 올려 카드를 보여줍니다.
            // 올라온 시트에 핀이 가려질 수 있으므로 핀도 보이는 영역 가운데로 옮깁니다.
            setSheetSnap('half');
            setFocusRequest({ id, nonce: Date.now() });
        }
        revealCard(id);
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
        const food: Food = { ...input, id: input.id ?? newId() };
        const next = clone(getTrip());
        next.candidates ??= [];
        const index = next.candidates.findIndex(item => item.id === food.id);
        if (index >= 0) next.candidates[index] = food;
        else next.candidates.push(food);
        if (!commitValidated(next)) return;
        setSelectedId(food.id);
        setEditFoodId(undefined);
        toast(food.lat === null ? '후보를 저장했습니다. 위치가 없어 지도에는 표시되지 않습니다.' : '여행 공통 후보함에 저장했습니다.');
    };

    const deleteFood = async (id: string) => {
        const name = trip.candidates?.find(food => food.id === id)?.name ?? '이 후보';
        if (!(await confirm({ title: `'${name}' 후보를 삭제할까요?`, message: '후보함에서 삭제됩니다. 이미 추가한 일정은 유지됩니다.', confirmLabel: '삭제', danger: true }))) return;
        update(current => ({ ...current, candidates: current.candidates?.filter(food => food.id !== id) ?? [] }));
        setEditFoodId(undefined);
        if (selectedId === id) setSelectedId('');
    };

    const addCandidateToSchedule = (input: ScheduleCandidateInput) => {
        try {
            const result = scheduleCandidate(getTrip(), input);
            if (!commitValidated(result.trip)) return;
            setScheduleCandidateId(null);
            setSelectedDayId(input.dayId);
            setSelectedId(result.stop.id);
            setView('route');
            setSearch('');
            setReorder(false);
            toast('선택한 위치에 일정을 추가했습니다.');
        } catch (error) { toast(errorMessage(error)); }
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
        toast(editDayId ? '날짜 정보를 저장했습니다.' : '새 날짜를 추가했습니다. ‘장소 추가’로 일정을 채우세요.');
    };

    const deleteDay = async () => {
        if (!editDay) return;
        const ok = await confirm({
            title: `'${editDay.title || shortDate(editDay.date) || '이 날짜'}'을(를) 삭제할까요?`,
            message: `이 날짜의 일정 ${editDay.stops.length}곳도 함께 삭제됩니다. 여행 공통 후보함은 유지됩니다.`,
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

    // ── 화면 조각 ──
    // 넓은 화면(일반 구성)과 휴대폰(지도 + 바텀시트 구성)이 같은 조각을 배치만 다르게 해서 씁니다.

    /** 상단 바: 저장 상태 + 저장·백업 + 설정 */
    const header = (
        <AppHeader>
            {syncState === 'conflict' ? (
                // 충돌을 '나중에'로 미뤘다면 여기를 눌러 선택창을 다시 엽니다.
                <button type="button" role="status" className="text-[11px] font-semibold text-danger underline max-tab:text-[10px]" onClick={() => requestConflictPrompt(trip.id)}>
                    {saveStatus}
                </button>
            ) : (
                // 실패 사유는 마우스를 올리면 보이게 합니다. (휴대폰에서는 공간이 좁아 숨김)
                <span role="status" title={syncMessage || undefined} className={`text-[11px] max-tab:text-[10px] max-phone:hidden ${syncState === 'error' ? 'text-danger' : 'text-muted'}`}>
                    {saveStatus}
                    {/* 클라우드 저장 완료면 초록 체크 SVG 아이콘 */}
                    {syncState === 'saved' && <Check className="icon ml-0.5 text-green" />}
                </span>
            )}
            <button type="button" className={headerButton} onClick={() => setStorageOpen(true)}><Cloud className="size-5 shrink-0" />저장·백업</button>
            <button type="button" className={headerIconButton} onClick={onOpenSettings} aria-label="설정" title="설정"><Settings className="size-5 shrink-0" /></button>
        </AppHeader>
    );

    /** 여행 소개: 여행 목록 링크, 제목, 여행 정보 편집 (휴대폰에서는 바텀시트 맨 아래) */
    const introSection = (
        <section className="flex items-center justify-between gap-5 pt-10 pb-9 max-tab:py-[26px] print:py-[15px]">
            <div className="min-w-0">
                <a href="#/" className="mb-3 inline-block text-[11px] text-muted no-underline print:hidden"><ArrowLeft className="icon mr-0.5" />여행 목록</a>
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
    );

    /** 날짜 탭 (날짜가 많으면 가로 스크롤). [scrollbar-width:none]: 가로 스크롤은 유지하되 스크롤 막대는 숨깁니다. */
    const dayTabs = <DayTabs days={trip.days} selectedId={day?.id} activeRef={activeChipRef} onSelect={selectDay} onAdd={() => setEditDayId(null)} />;

    const candidateList = <>
        <p className="mb-3 text-[11px] text-muted">여행 전체에서 공유하는 장소 후보입니다. 방문을 정하면 ‘일정에 추가’에서 날짜와 순서를 선택하세요.</p>
        {filteredFoods.length ? filteredFoods.map(food => (
            <FoodCard key={food.id} food={food} selected={food.id === selectedId} onFocus={id => focusItem(day?.stops.find(stop => stop.sourceCandidateId === id)?.id ?? id)} onEdit={id => setEditFoodId(id)} onSchedule={setScheduleCandidateId} scheduled={trip.days.some(item => item.stops.some(stop => stop.sourceCandidateId === food.id))} />
        )) : <Empty>{trip.candidates?.length ? '검색된 후보가 없습니다.' : '아직 장소 후보가 없습니다. ‘후보 추가’로 모아보세요.'}</Empty>}
    </>;

    /** 날짜가 하나도 없을 때도 여행 공통 후보는 관리할 수 있습니다. */
    const noDays = (
        <div className="my-10 rounded-xl border border-dashed border-line p-10 text-center">
            <p className="mb-4 text-muted">날짜를 정하기 전에도 장소 후보를 모아둘 수 있습니다.</p>
            <button type="button" className="btn btn-primary" onClick={() => setEditDayId(null)}><Plus className="icon" />첫 날짜 추가</button>
            <button type="button" className="btn btn-outline ml-2" onClick={() => setEditFoodId(null)}><Plus className="icon" />후보 추가</button>
            <div className="mt-5 text-left">{candidateList}</div>
        </div>
    );

    // 아래 조각들은 날짜가 있을 때만 씁니다. (day 가 null 이면 null)
    const contextAddButton = (
        <button type="button" className="btn btn-primary shrink-0 gap-1 whitespace-nowrap px-2.5 py-2 text-[11px]" onClick={() => view === 'food' ? setEditFoodId(null) : openStopEdit(null)}>
            <Plus className="size-4" />{view === 'food' ? '후보 추가' : '일정 추가'}
        </button>
    );
    /** 선택한 날짜 제목 + 날짜 편집·장소 추가 버튼 (일반 구성) */
    const dayHeading = day && (
        <div className="mt-[29px] mb-5 flex items-center justify-between gap-3 max-tab:mt-[23px] max-tab:mb-4">
            <div className="min-w-0">
                <p className="eyebrow max-phone:text-[9px]">{view === 'food' ? '여행 전체 공통' : [day.subtitle, day.hotel].filter(Boolean).join(' · ')}</p>
                <h2 className="m-0 flex items-center gap-1 text-[23px] leading-[1.4] font-semibold tracking-[-0.8px] max-phone:text-[21px]">
                    <span>{view === 'food' ? '장소 후보' : day.title}</span>
                    {view === 'route' && <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full" onClick={() => setEditDayId(day.id)} aria-label="날짜 편집" title="날짜 편집"><Pencil className="size-4" /></button>}
                </h2>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 print:hidden">
                {contextAddButton}
            </div>
        </div>
    );

    /** 지도 (휴대폰: 영역을 꽉 채우는 fill 모드 + 바텀시트 높이만큼 아래 여백) */
    const tripMap = day && (
        <TripMap
            stops={day.stops}
            foods={trip.candidates ?? []}
            selectedId={selectedId}
            focusRequest={focusRequest}
            onSelect={onMapSelect}
            onStopDetail={openDetail}
            onFoodEdit={id => setEditFoodId(id)}
            onOpenSettings={onOpenSettings}
            fill={phoneLayout}
            desktop={desktopLayout}
            bottomInset={bottomInset}
        />
    );

    /** 비용 합계·주의 문구·여행 인원·안내 (넓은 화면은 지도 아래, 휴대폰은 바텀시트 목록 아래) */
    const dayInfo = day && (
        <>
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
                    여행 메모 편집<ArrowUpRight className="icon" />
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
        </>
    );

    /** 일정 / 맛집 탭과 목록 */
    const listSection = day && (
        <section className="min-w-0">
            {/* 탭 줄 고정 위치: 휴대폰은 바텀시트 목록 맨 위(top-0), 좁은 화면은 상단 바·날짜 탭 아래 */}
            <div
                className={`mb-3.5 flex min-w-0 justify-between gap-2.5 print:hidden ${phoneLayout || desktopLayout ? 'flex-col items-stretch' : 'flex-wrap items-center'} ${
                    phoneLayout || desktopLayout ? 'sticky top-0 z-[2] bg-bg py-[9px]' : 'max-tab:sticky max-tab:top-[52px] max-tab:z-[2] max-tab:bg-bg max-tab:py-[9px] max-phone:top-[75px]'
                }`}
            >
                <div className="flex gap-[18px] border-b border-line max-phone:gap-[15px]">
                    {(
                        [
                            ['route', `일정 ${day.stops.length}`],
                            ['food', `장소 후보 ${trip.candidates?.length ?? 0}`],
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
                <div className="flex min-w-0 items-center gap-1.5">
                    {/* 순서 편집 중에는 검색으로 일부만 보이면 순서가 헷갈리므로 검색칸을 숨깁니다. */}
                    {!reorder && (
                        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[7px] bg-[#eceee7] px-2.5 py-1">
                            {/* 돋보기 SVG 아이콘 (장식용) */}
                            <Search className="icon shrink-0 text-[12px] text-muted" />
                            <input
                                type="search"
                                placeholder={view === 'food' ? '후보 검색' : '장소 검색'}
                                aria-label={view === 'food' ? '후보 검색' : '장소 검색'}
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                className="w-full min-w-0 border-0 bg-transparent p-[3px] text-[11px]"
                            />
                        </label>
                    )}
                    {view === 'route' && (
                        <button
                            type="button"
                            className={`btn btn-mini shrink-0 whitespace-nowrap ${reorder ? 'bg-green text-white' : ''}`}
                            onClick={toggleReorder}
                            disabled={!reorder && day.stops.length < 2}
                        >
                            {reorder ? (
                                <>
                                    <Check className="icon" />완료
                                </>
                            ) : (
                                <>
                                    <ArrowUpDown className="icon" />순서 편집
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {view === 'food' ? (
                candidateList
            ) : reorder ? (
                <>
                    <p className="mb-3 text-[11px] text-muted">왼쪽 손잡이를 끌어 순서를 바꾸세요. 바뀐 순서는 바로 저장됩니다.</p>
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
                <Empty>{day.stops.length ? '검색 결과가 없습니다.' : '아직 장소가 없습니다. ‘장소 추가’로 일정을 채우세요.'}</Empty>
            )}
        </section>
    );

    /** 모달 모음 (두 구성 공통) */
    const dialogs = (
        <>
            {schedulingCandidate && <CandidateScheduleDialog key={schedulingCandidate.id} candidate={schedulingCandidate} days={trip.days} initialDayId={day?.id ?? ''} onClose={() => setScheduleCandidateId(null)} onSave={addCandidateToSchedule} />}
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
                saveStatus={saveStatus}
            />
        </>
    );

    // ── PC: 왼쪽 일정 목록 / 오른쪽 지도. 전체 탭 없이 날짜별로 선택합니다. ──
    if (desktopLayout && day) {
        return <>
            <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
                <div className="shrink-0">{header}</div>
                <main className="flex min-h-0 flex-1 overflow-hidden">
                    <aside aria-label="여행 일정 목록" className="flex min-w-0 w-[360px] shrink-0 flex-col overflow-hidden border-r border-line bg-bg wide:w-[390px]">
                        {dayTabs}
                        <div ref={desktopScrollerRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-5 wrap-anywhere">
                            <div className="flex items-center gap-1.5 py-4">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] text-muted" title={trip.title}>{view === 'food' ? '여행 전체 공통' : trip.title}</p>
                                    <div className="flex min-w-0 items-center gap-1">
                                        <h1 className="min-w-0 truncate text-[19px] font-semibold" title={view === 'food' ? '장소 후보' : day.title}>{view === 'food' ? '장소 후보' : day.title}</h1>
                                        {view === 'route' && <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full" onClick={() => setEditDayId(day.id)} aria-label="날짜 편집" title="날짜 편집"><Pencil className="size-4" /></button>}
                                    </div>
                                </div>
                                {contextAddButton}
                            </div>
                            {listSection}
                            <div className="mt-5">{dayInfo}</div>
                            <div className="mt-5 border-t border-line pt-3">
                                <button type="button" className="btn btn-mini" onClick={() => setInfoOpen(true)}>여행 정보 편집</button>
                                <details className="mt-3 text-[12px]"><summary className="cursor-pointer text-muted">여행 소개</summary><p className="mt-2 whitespace-pre-wrap">{trip.tagline}</p><p className="mt-1 whitespace-pre-wrap">{trip.notes}</p></details>
                            </div>
                        </div>
                    </aside>
                    <section aria-label="일별 여행 지도" className="min-h-0 min-w-0 flex-1">{tripMap}</section>
                </main>
            </div>
            {dialogs}
        </>;
    }

    // ── 휴대폰 구성: 낮은 상단 바 + 날짜 칩 고정, 남은 화면 전체가 지도, 목록은 지도 위 바텀시트 ──
    if (phoneLayout && day) {
        /** 휴대폰 상단 바: 뒤로(여행 목록) / 여행 제목(길면 …) / 충돌 알림 / 저장·백업 / 설정. 아이콘은 모두 lucide SVG */
        const phoneHeader = (
            <header className="flex h-[52px] shrink-0 items-center gap-1 border-b border-line bg-paper px-1.5">
                <a href="#/" aria-label="여행 목록으로" className={`${PHONE_ICON_BUTTON} text-ink no-underline`}><ArrowLeft className="size-5" /></a>
                {/* min-w-0 + truncate: 남는 폭만큼만 차지하고 넘치면 … 으로 줄입니다. */}
                <strong className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-[-0.4px]">{trip.title}</strong>
                {syncState === 'conflict' && (
                    // 충돌을 '나중에'로 미뤘을 때만 보이는 알림 (눌러서 선택창 다시 열기)
                    <button type="button" className="shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-danger underline" onClick={() => requestConflictPrompt(trip.id)}>
                        <TriangleAlert className="icon mr-0.5" />충돌
                    </button>
                )}
                <button type="button" className={PHONE_ICON_BUTTON} onClick={() => setStorageOpen(true)} aria-label="저장·백업" title={saveStatus}><Cloud className="size-5" /></button>
                <button type="button" className={PHONE_ICON_BUTTON} onClick={onOpenSettings} aria-label="설정"><Settings className="size-5" /></button>
            </header>
        );

        /**
         * 휴대폰 날짜 칩: 한 줄 ‘DAY 1 · 10.31(토)’. 칩이 화면보다 많으면 좌우로 스와이프해서 넘깁니다.
         * (overflow-x-auto 가로 스크롤, 스크롤 막대는 숨김. scroll-px: 자동 스크롤 때 칩이 화면 끝에 붙지 않게 좌우 여백 유지)
         */
        const phoneDayTabs = dayTabs;

        /** 시트 머리: 경로 설명 1줄 + 날짜 제목 1줄(길면 …) + 연필(날짜 편집) / 더하기(장소 추가) 아이콘 버튼 */
        const eyebrow = [day.subtitle, day.hotel].filter(Boolean).join(' · ');
        const phoneDayHeading = (
            <div className="flex items-center gap-1.5 px-[15px] pb-2.5">
                <div className="min-w-0 flex-1">
                    {/* title: 잘린 전체 문구를 길게 누르거나 마우스를 올리면 볼 수 있게 */}
                    {(eyebrow || view === 'food') && <p className="eyebrow mb-0.5 truncate text-[9px]" title={view === 'food' ? '여행 전체 공통' : eyebrow}>{view === 'food' ? '여행 전체 공통' : eyebrow}</p>}
                    <div className="flex min-w-0 items-center gap-1">
                        <h2 className="m-0 min-w-0 truncate text-[18px] leading-[1.35] font-semibold tracking-[-0.6px]" title={view === 'food' ? '장소 후보' : day.title}>{view === 'food' ? '장소 후보' : day.title}</h2>
                        {view === 'route' && <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full" onClick={() => setEditDayId(day.id)} aria-label="날짜 편집" title="날짜 편집"><Pencil className="size-4" /></button>}
                    </div>
                </div>
                {contextAddButton}
            </div>
        );

        return (
            <>
                {/* h-dvh: 주소창이 접히고 펴지는 것까지 반영한 실제 화면 높이. 페이지 자체는 스크롤되지 않습니다. */}
                <div className="flex h-dvh flex-col overflow-hidden">
                    {phoneHeader}
                    {phoneDayTabs}
                    {/* relative: 지도 위에 바텀시트를 겹쳐 놓는 기준 영역 */}
                    <div className="relative min-h-0 flex-1">
                        {tripMap}
                        <BottomSheet
                            snap={sheetSnap}
                            onSnapChange={setSheetSnap}
                            onHeightsChange={setSheetHeights}
                            scrollerRef={sheetScrollerRef}
                            header={phoneDayHeading}
                        >
                            {listSection}
                            <div className="mt-6">{dayInfo}</div>
                            <div className="mt-4 border-t border-line">{introSection}</div>
                        </BottomSheet>
                    </div>
                </div>
                {dialogs}
            </>
        );
    }

    // ── 일반 구성 (태블릿·PC, 또는 날짜가 없는 휴대폰) ──
    return (
        <>
            {header}

            <main className="mx-auto max-w-[1500px] px-[5%] max-tab:px-[22px] max-phone:px-[15px] wide:px-[50px]">
                {introSection}
                {dayTabs}

                {!day ? (
                    noDays
                ) : (
                    <>
                        {dayHeading}

                        <section className="grid grid-cols-[minmax(320px,0.9fr)_minmax(400px,1.1fr)] items-start gap-7 max-tab:grid-cols-1 max-tab:gap-[22px] print:block">
                            {/* ── 왼쪽: 지도·비용·안내 ── */}
                            <aside className="sticky top-5 max-tab:static print:hidden">
                                {tripMap}
                                {dayInfo}
                            </aside>

                            {/* ── 오른쪽: 일정 / 맛집 목록 ── */}
                            {listSection}
                        </section>
                    </>
                )}
            </main>

            <footer className="mx-[5%] mt-10 mb-5 border-t border-line pt-5 text-[10px] text-muted max-phone:text-[9px] print:hidden">
                TRIP TRACKER
            </footer>

            {dialogs}
        </>
    );
}

/** 목록이 비었을 때 안내 */
function Empty({ children }: { children: string }) {
    return <div className="p-[35px] text-center text-muted">{children}</div>;
}
