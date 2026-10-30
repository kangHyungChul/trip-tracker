// Supabase 자동 동기화 엔진 (React 와 무관한 모듈 싱글턴).
//
// 기본 원칙
//  - 기기 저장(localStorage)은 "캐시 + 오프라인 대기열"입니다. 화면은 항상 기기 캐시를 먼저 보여주고,
//    편집하면 캐시에 쓰고 약 1초 모아서 Supabase 에 올립니다. (markDirty → push)
//  - 여행마다 "마지막으로 맞춘 revision"과 "아직 안 올린 변경(dirty)"을 기록합니다. (syncKey)
//  - 올릴 때 그 revision 을 함께 보내, 다른 기기가 먼저 바꿨으면 DB 가 거부합니다 → 충돌(conflict) 이벤트 →
//    화면(SyncCoordinator)이 "클라우드 내용 불러오기 / 내 내용으로 덮어쓰기"를 묻습니다.
//  - 네트워크 오류면 기기에 둔 채 일정 시간 뒤·온라인 복귀 시 다시 올립니다.
//  - 첫 화면 진입·온라인 복귀·창 포커스 때 syncAll 이 클라우드 목록과 기기 캐시를 맞춥니다.
//    (다른 기기에서 추가·수정·삭제한 여행 반영, 한 번도 안 올린 기기 여행은 자동 업로드)

import {
    cloudUrl, ConflictError, deleteCloudTrip, fetchCloudTrip, InvalidRequestError, isCloudEnabled, listCloudTrips, saveCloudTrip,
    type CloudRow,
} from './cloudTrips';
import { PENDING_DELETES_KEY, readItem, removeItem, syncKey, writeItem } from './storage';
import { deleteTrip as deleteLocalTrip, listTripIds, readTrip, writeTrip } from './tripStore';
import type { Trip } from '../types';

/** 편집 후 업로드까지 기다리는 시간 (연속 편집을 한 번에 모아 올림) */
const DEBOUNCE_MS = 1000;
/** 네트워크 오류 후 다시 시도하기까지 기다리는 시간 */
const RETRY_MS = 15000;

// ───────────────────────── 동기화 기록 (기기 저장) ─────────────────────────

/** 여행 1개의 동기화 기록 */
interface SyncMeta {
    url: string;      // 어느 Supabase 프로젝트 기준인지 (프로젝트를 바꾸면 기록 무효)
    revision: number; // 마지막으로 클라우드와 맞춘 revision (0 = 아직 올린 적 없음)
    dirty: boolean;   // 기기에만 있고 아직 올리지 못한 변경이 있는지
}

function readMeta(id: string): SyncMeta | null {
    try {
        const value = JSON.parse(readItem(syncKey(id)) ?? 'null') as SyncMeta | null;
        return value && typeof value.revision === 'number' ? value : null;
    } catch {
        return null;
    }
}

const writeMeta = (id: string, meta: SyncMeta) => writeItem(syncKey(id), JSON.stringify(meta));

/** 현재 프로젝트 기준으로 맞춘 revision. 기록이 없거나 다른 프로젝트 것이면 null (= 한 번도 안 올림) */
const syncedRevision = (meta: SyncMeta | null) => (meta && meta.url === cloudUrl() && meta.revision > 0 ? meta.revision : null);

/** 오프라인 중 삭제해 아직 클라우드에 반영 못 한 여행 ID 들 */
function readPendingDeletes(): string[] {
    try {
        const value = JSON.parse(readItem(PENDING_DELETES_KEY) ?? '[]') as unknown;
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}
const writePendingDeletes = (ids: string[]) => (ids.length ? writeItem(PENDING_DELETES_KEY, JSON.stringify(ids)) : removeItem(PENDING_DELETES_KEY));

// ───────────────────────── 기기·클라우드 비교 (순수 함수) ─────────────────────────

/** 기기 쪽 상태 */
export interface LocalState {
    exists: boolean;         // 기기에 여행이 있는지
    revision: number | null; // 마지막으로 맞춘 revision (null = 한 번도 안 올림)
    dirty: boolean;          // 안 올린 변경이 있는지
    sameContent: boolean;    // 클라우드 내용과 같은지 (updatedAt 제외)
}
/** 클라우드 쪽 상태 (행이 없으면 null) */
export interface RemoteState {
    revision: number;
    deleted: boolean; // 휴지통에 있는지
}
/**
 * 할 일
 *  - download: 클라우드 내용을 기기에 받기
 *  - upload: 기기 내용을 올리기 (클라우드가 바뀌었으면 DB 가 충돌로 거부 → 사용자에게 물음)
 *  - adopt: 내용이 같으므로 revision 기록만 맞추기
 *  - delete-local: 다른 기기에서 삭제됨 → 기기 캐시에서도 삭제
 */
export type SyncAction = 'none' | 'download' | 'upload' | 'adopt' | 'delete-local';

export function reconcile(local: LocalState, remote: RemoteState | null): SyncAction {
    // 클라우드에 없거나 휴지통에 있음
    if (!remote || remote.deleted) {
        if (!local.exists) return 'none';
        // 맞춘 적 있고 그 뒤 기기 변경이 없으면 → 다른 기기가 삭제한 것
        if (local.revision !== null && !local.dirty) return 'delete-local';
        // 한 번도 안 올렸거나(새 여행·처음 연결) 기기 변경이 있음 → 올림 (휴지통 행이 있으면 충돌로 물어봄)
        return 'upload';
    }
    if (!local.exists) return 'download';
    // 처음 연결한 기기에 같은 ID 여행이 있음: 내용이 같으면 기록만 맞추고, 다르면 올려서 충돌로 물어봄
    if (local.revision === null) return local.sameContent ? 'adopt' : 'upload';
    if (local.dirty) return 'upload';
    if (remote.revision > local.revision) return 'download';
    return 'none';
}

/** 두 여행 내용이 같은지 (마지막 수정 시각은 기기마다 달라 비교에서 제외) */
export const sameTrip = (a: Trip, b: Trip) => JSON.stringify({ ...a, updatedAt: undefined }) === JSON.stringify({ ...b, updatedAt: undefined });

// ───────────────────────── 상태·이벤트 구독 ─────────────────────────

/**
 * 여행별 저장 상태
 *  - local: Supabase 미설정 (기기에만 저장)
 *  - pending: 올릴 변경이 있음 (곧 저장)   - saving: 저장 중   - saved: 클라우드와 같음
 *  - offline: 오프라인이라 대기 중          - error: 실패 (message 참고)
 *  - conflict: 다른 기기 변경과 충돌, 사용자 선택 필요
 */
export type SyncState = 'local' | 'pending' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';
export interface SyncStatus {
    state: SyncState;
    message: string;
}

const statuses = new Map<string, SyncStatus>();
const statusListeners = new Set<() => void>();

function setStatus(id: string, state: SyncState, message = '') {
    statuses.set(id, { state, message });
    statusListeners.forEach(listener => listener());
}

/**
 * 여행의 현재 저장 상태. useSyncExternalStore 가 같은 객체를 받아야 다시 그리지 않으므로,
 * 처음 물을 때 계산한 값을 Map 에 넣어 두고 이후에는 같은 객체를 돌려줍니다.
 */
export function getSyncStatus(id: string): SyncStatus {
    let status = statuses.get(id);
    if (!status) {
        const meta = readMeta(id);
        const state: SyncState = !isCloudEnabled() ? 'local' : meta?.dirty || syncedRevision(meta) === null ? 'pending' : 'saved';
        status = { state, message: '' };
        statuses.set(id, status);
    }
    return status;
}

export function subscribeSyncStatus(listener: () => void) {
    statusListeners.add(listener);
    return () => void statusListeners.delete(listener);
}

/**
 * 화면에 알릴 사건
 *  - conflict: 사용자 선택이 필요한 충돌 발생
 *  - remote: 클라우드 내용으로 기기 캐시가 바뀜 (trip = 새 내용, null = 삭제됨)
 */
export type SyncEvent = { type: 'conflict'; id: string } | { type: 'remote'; id: string; trip: Trip | null };
const eventListeners = new Set<(event: SyncEvent) => void>();
const emit = (event: SyncEvent) => eventListeners.forEach(listener => listener(event));

export function onSyncEvent(listener: (event: SyncEvent) => void) {
    eventListeners.add(listener);
    return () => void eventListeners.delete(listener);
}

// ───────────────────────── 업로드 ─────────────────────────

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Set<string>();   // 지금 올리는 중인 여행
const rerun = new Set<string>();     // 올리는 도중 또 바뀌어 끝난 뒤 한 번 더 올릴 여행
const conflicts = new Set<string>(); // 사용자 선택을 기다리는 충돌 여행 (해결 전까지 업로드 보류)
// 여행별 편집 횟수 (올리는 도중 새 편집이 있었는지 판단용, 메모리에만 보관)
const editCount = new Map<string, number>();

function schedule(id: string, delay: number) {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => {
        timers.delete(id);
        void push(id);
    }, delay));
}

/**
 * 기기 캐시에 저장한 직후 호출: "올릴 변경 있음"으로 기록하고 잠시 뒤 업로드를 예약합니다.
 * 같은 여행을 연속으로 편집하면 예약이 미뤄져 마지막 내용만 한 번 올라갑니다.
 */
export function markDirty(id: string) {
    editCount.set(id, (editCount.get(id) ?? 0) + 1);
    const meta = readMeta(id);
    writeMeta(id, { url: meta?.url ?? cloudUrl(), revision: meta?.revision ?? 0, dirty: true });
    if (!isCloudEnabled()) {
        setStatus(id, 'local');
        return;
    }
    if (conflicts.has(id)) return; // 충돌 해결 전에는 올리지 않음 (상태는 conflict 유지)
    setStatus(id, 'pending');
    schedule(id, DEBOUNCE_MS);
}

/** 기기 캐시의 여행 1개를 클라우드에 올립니다. */
async function push(id: string): Promise<void> {
    if (!isCloudEnabled() || conflicts.has(id)) return;
    if (running.has(id)) {
        rerun.add(id); // 이미 올리는 중이면 끝난 뒤 다시
        return;
    }
    const stored = readTrip(id);
    if (stored.status !== 'ok') return; // 삭제됐거나 손상된 여행은 올리지 않음
    const meta = readMeta(id);
    const base = syncedRevision(meta);
    if (meta && !meta.dirty && base !== null) {
        setStatus(id, 'saved'); // 이미 클라우드와 같음
        return;
    }

    running.add(id);
    const countAtStart = editCount.get(id) ?? 0;
    setStatus(id, 'saving');
    try {
        const revision = await saveCloudTrip(stored.trip, base ?? 0);
        if (readTrip(id).status !== 'ok') return; // 올리는 사이 기기에서 삭제됨
        // 올리는 도중 새 편집이 있었으면 그 내용은 아직 안 올라갔으므로 dirty 유지 후 다시 예약
        const changed = (editCount.get(id) ?? 0) !== countAtStart;
        writeMeta(id, { url: cloudUrl(), revision, dirty: changed });
        if (changed) {
            setStatus(id, 'pending');
            schedule(id, 300);
        } else {
            setStatus(id, 'saved');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof ConflictError) {
            conflicts.add(id);
            setStatus(id, 'conflict', message);
            emit({ type: 'conflict', id });
        } else if (error instanceof InvalidRequestError) {
            setStatus(id, 'error', message); // 재시도해도 같은 결과이므로 다음 편집 때까지 대기
        } else {
            // 네트워크 등 일시 오류: 기기에 둔 채 나중에 다시
            setStatus(id, navigator.onLine === false ? 'offline' : 'error', message);
            schedule(id, RETRY_MS);
        }
    } finally {
        running.delete(id);
        if (rerun.delete(id)) void push(id);
    }
}

// ───────────────────────── 클라우드 → 기기 맞추기 ─────────────────────────

/** 여행 1개를 클라우드 행과 비교해 필요한 동작을 실행합니다. */
function applyRow(id: string, row: CloudRow | null) {
    if (running.has(id) || conflicts.has(id)) return; // 업로드 중·충돌 대기 중에는 건드리지 않음
    const stored = readTrip(id);
    if (stored.status === 'broken') return; // 손상된 기기 데이터는 사용자가 직접 처리 (원문 보존)
    const meta = readMeta(id);
    const local: LocalState = {
        exists: stored.status === 'ok',
        revision: syncedRevision(meta),
        dirty: meta?.dirty ?? false,
        sameContent: stored.status === 'ok' && !!row?.trip && sameTrip(stored.trip, row.trip),
    };
    const remote: RemoteState | null = row ? { revision: row.revision, deleted: row.deletedAt !== null } : null;

    switch (reconcile(local, remote)) {
        case 'download':
            if (!row?.trip) return; // 클라우드 데이터를 읽을 수 없으면 기기 것을 유지
            writeTrip(row.trip);
            writeMeta(id, { url: cloudUrl(), revision: row.revision, dirty: false });
            setStatus(id, 'saved');
            emit({ type: 'remote', id, trip: row.trip });
            break;
        case 'adopt':
            writeMeta(id, { url: cloudUrl(), revision: row!.revision, dirty: false });
            setStatus(id, 'saved');
            break;
        case 'upload':
            if (meta?.dirty !== true) writeMeta(id, { url: meta?.url ?? cloudUrl(), revision: meta?.revision ?? 0, dirty: true });
            void push(id);
            break;
        case 'delete-local':
            deleteLocalTrip(id);
            statuses.delete(id);
            emit({ type: 'remote', id, trip: null });
            break;
    }
}

/** 오프라인 중 삭제한 여행들을 클라우드 휴지통으로 보냅니다. 실패한 것은 다음에 다시 시도합니다. */
async function flushDeletes() {
    for (const id of readPendingDeletes()) {
        try {
            await deleteCloudTrip(id);
            writePendingDeletes(readPendingDeletes().filter(item => item !== id));
        } catch {
            return; // 네트워크 오류면 나머지도 실패할 가능성이 높으므로 다음 기회에
        }
    }
}

let syncing: Promise<void> | null = null;

/**
 * 클라우드 전체 목록과 기기 캐시를 맞춥니다. (동시에 여러 번 불러도 한 번만 실행)
 * 네트워크 오류면 예외를 던집니다. (호출한 화면이 안내)
 */
export function syncAll(): Promise<void> {
    if (!isCloudEnabled()) return Promise.resolve();
    syncing ??= (async () => {
        await flushDeletes();
        const rows = await listCloudTrips();
        const pendingDeletes = readPendingDeletes();
        const remoteById = new Map(rows.map(row => [row.id, row]));
        // 기기에만 있는 여행 + 클라우드에만 있는 여행 + 양쪽에 있는 여행 모두 검사
        const ids = new Set([...listTripIds(), ...remoteById.keys()]);
        for (const id of ids) {
            if (pendingDeletes.includes(id)) continue; // 이 기기에서 지웠는데 아직 반영 전
            applyRow(id, remoteById.get(id) ?? null);
        }
    })().finally(() => {
        syncing = null;
    });
    return syncing;
}

/** 여행 1개만 클라우드와 맞춥니다. (기기에 없는 여행 주소로 바로 들어왔을 때 등) */
export async function syncOne(id: string): Promise<void> {
    if (!isCloudEnabled() || readPendingDeletes().includes(id)) return;
    applyRow(id, await fetchCloudTrip(id));
}

// ───────────────────────── 삭제·충돌 해결 ─────────────────────────

/**
 * 여행 삭제: 기기 캐시에서 지우고 클라우드는 휴지통으로 보냅니다.
 * 오프라인이면 삭제 대기열에 넣어 두고 연결되면 반영합니다.
 */
export async function removeTrip(id: string): Promise<void> {
    clearTimeout(timers.get(id));
    timers.delete(id);
    conflicts.delete(id);
    deleteLocalTrip(id);
    statuses.delete(id);
    if (!isCloudEnabled()) return;
    writePendingDeletes([...readPendingDeletes().filter(item => item !== id), id]);
    await flushDeletes();
}

/** 충돌 중인 여행 ID 목록 (화면이 늦게 구독을 시작해도 놓치지 않도록) */
export const pendingConflicts = () => [...conflicts];

/** 충돌 선택창을 다시 띄워 달라고 요청 (사용자가 '나중에'로 닫은 뒤 상태 표시를 눌렀을 때) */
export const requestConflictPrompt = (id: string) => {
    if (conflicts.has(id)) emit({ type: 'conflict', id });
};

/**
 * 충돌 해결
 *  - mine: 클라우드 최신 revision 을 기준으로 기기 내용을 다시 올림 (클라우드 변경을 덮어씀, 휴지통에 있었으면 복구됨)
 *  - cloud: 클라우드 내용을 기기에 받음 (휴지통에 있거나 없으면 기기에서도 삭제)
 */
export async function resolveConflict(id: string, choice: 'mine' | 'cloud'): Promise<void> {
    const row = await fetchCloudTrip(id);
    conflicts.delete(id);
    if (choice === 'mine') {
        writeMeta(id, { url: cloudUrl(), revision: row?.revision ?? 0, dirty: true });
        await push(id);
        return;
    }
    if (row && !row.deletedAt && row.trip) {
        writeTrip(row.trip);
        writeMeta(id, { url: cloudUrl(), revision: row.revision, dirty: false });
        setStatus(id, 'saved');
        emit({ type: 'remote', id, trip: row.trip });
    } else {
        deleteLocalTrip(id);
        statuses.delete(id);
        emit({ type: 'remote', id, trip: null });
    }
}

/** 휴지통에서 복구한 여행을 기기 캐시에 넣고 동기화 기록을 맞춥니다. */
export function adoptRestored(trip: Trip, revision: number) {
    writeTrip(trip);
    writeMeta(trip.id, { url: cloudUrl(), revision, dirty: false });
    setStatus(trip.id, 'saved');
    emit({ type: 'remote', id: trip.id, trip });
}
