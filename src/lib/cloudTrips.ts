// Supabase 공용 여행 저장소(public.trips) 요청 모음.
// 로그인 없이 공개 키로 접근합니다. 쓰기는 DB 함수(save_trip / delete_trip / restore_trip)로만 합니다.
// (테이블·함수 정의: supabase/migrations/20261031010000_shared_trips.sql)

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, loadSupabaseConfig } from './supabase';
import { parseTrip } from './trip';
import type { Trip } from '../types';

/** 저장 시 DB revision 이 앱이 알던 값과 달라 거부됨 (다른 기기가 먼저 저장·삭제함) */
export class ConflictError extends Error {}
/** DB 가 요청 형식을 거부함 (마이그레이션 미적용·잘못된 ID 등). 재시도해도 소용없는 오류 */
export class InvalidRequestError extends Error {}

/** 클라우드 행 1개 */
export interface CloudRow {
    id: string;
    revision: number;
    updatedAt: string;
    /** 휴지통에 있으면 삭제 시각, 아니면 null */
    deletedAt: string | null;
    /** 형식이 올바르면 검증된 여행, 읽지 못하면 null */
    trip: Trip | null;
    /** trip 이 null 일 때 사유 */
    error: string;
}

// 연결 설정은 페이지를 열 때 한 번 정합니다. (설정을 바꾸면 새로고침으로 적용)
const config = loadSupabaseConfig();
let client: SupabaseClient | null = null;
let connectError = '';
try {
    client = getSupabaseClient(config);
} catch (error) {
    // URL 형식이 잘못되면 createClient 가 예외를 던집니다. 이때는 기기 저장만 사용합니다.
    connectError = error instanceof Error ? error.message : String(error);
}

/** Supabase 를 쓸 수 있는지 (URL·키가 설정되어 있고 클라이언트 생성 성공) */
export const isCloudEnabled = () => client !== null;
/** 현재 연결한 Supabase 프로젝트 URL (동기화 기록이 어느 프로젝트 것인지 구분용) */
export const cloudUrl = () => config.url;
/** 연결 설정 오류 문구 (없으면 빈 문자열) */
export const cloudConnectError = () => connectError;

function requireClient(): SupabaseClient {
    if (!client) throw new Error('Supabase 연결 설정이 없습니다.');
    return client;
}

/** DB 행 → CloudRow (여행 ID 는 행 id 로 고정, 예전 형식 payload 도 자동 변환) */
function toRow(row: { id: string; payload: unknown; revision: number; updated_at: string; deleted_at: string | null }): CloudRow {
    const base = { id: row.id, revision: row.revision, updatedAt: row.updated_at, deletedAt: row.deleted_at };
    try {
        return { ...base, trip: parseTrip(row.payload, { id: row.id }), error: '' };
    } catch (error) {
        return { ...base, trip: null, error: error instanceof Error ? error.message : String(error) };
    }
}

const COLUMNS = 'id,payload,revision,updated_at,deleted_at';

/** 삭제되지 않은 모든 여행 (최근 수정 순) */
export async function listCloudTrips(): Promise<CloudRow[]> {
    const { data, error } = await requireClient().from('trips').select(COLUMNS).is('deleted_at', null).order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toRow);
}

/** 휴지통의 여행 (최근 삭제 순, 최대 50개) */
export async function listDeletedTrips(): Promise<CloudRow[]> {
    const { data, error } = await requireClient()
        .from('trips')
        .select(COLUMNS)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toRow);
}

/** 여행 1개 (휴지통 포함). 없으면 null */
export async function fetchCloudTrip(id: string): Promise<CloudRow | null> {
    const { data, error } = await requireClient().from('trips').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toRow(data) : null;
}

/** DB 함수 오류 문구를 앱 오류 종류로 바꿉니다. */
function mapRpcError(error: { message: string }): Error {
    if (error.message.includes('revision_conflict')) return new ConflictError('다른 기기에서 이 여행이 먼저 수정되었습니다.');
    if (error.message.includes('invalid_request')) return new InvalidRequestError('Supabase 가 요청을 거부했습니다. 최신 마이그레이션(npm run db:push)을 적용했는지 확인하세요.');
    if (error.message.includes('not_found')) return new InvalidRequestError('휴지통에서 여행을 찾지 못했습니다.');
    // 함수가 아예 없을 때 (마이그레이션 미적용) PostgREST 가 내는 문구
    if (/could not find the function|schema cache/i.test(error.message)) {
        return new InvalidRequestError('Supabase 에 trips 저장 함수가 없습니다. npm run db:push 로 마이그레이션을 적용하세요.');
    }
    return new Error(error.message);
}

/**
 * 여행 저장. expected = 이 기기가 마지막으로 맞춘 revision (처음 올리면 0).
 * @returns 저장 후 새 revision
 * @throws ConflictError 다른 기기가 먼저 저장·삭제한 경우
 */
export async function saveCloudTrip(trip: Trip, expected: number): Promise<number> {
    const { data, error } = await requireClient().rpc('save_trip', { p_id: trip.id, p_payload: trip, p_expected_revision: expected });
    if (error) throw mapRpcError(error);
    return data as number;
}

/** 휴지통으로 보내기 (이미 없거나 삭제된 여행이면 아무 일 없음) */
export async function deleteCloudTrip(id: string): Promise<void> {
    const { error } = await requireClient().rpc('delete_trip', { p_id: id });
    if (error) throw mapRpcError(error);
}

/** 휴지통에서 복구. @returns 새 revision */
export async function restoreCloudTrip(id: string): Promise<number> {
    const { data, error } = await requireClient().rpc('restore_trip', { p_id: id });
    if (error) throw mapRpcError(error);
    return data as number;
}
