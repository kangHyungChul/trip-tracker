// Supabase 연결·로그인·클라우드 저장/불러오기 훅.
// 클라우드 저장은 자동이 아니라 사용자가 버튼을 눌렀을 때만 수행합니다.
// revision 비교로 오래된 기기가 새 데이터를 덮어쓰지 못하게 합니다. (supabase/schema.sql 의 save_travel_plan 참고)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { CLOUD_TRIP_KEY, getSupabaseClient, loadSupabaseConfig, type SupabaseConfig } from '../lib/supabase';
import { checkPublicKey, normalizeSupabaseURL } from '../lib/supabaseKey';
import { CLOUD_BASE_KEY, readItem, removeItem, SUPABASE_CONFIG_KEY, writeItem } from '../lib/storage';
import { parseTrip } from '../lib/trip';
import { useToast } from './useToast';
import type { Trip } from '../types';

/** 이 기기가 마지막으로 동기화한 클라우드 상태 */
interface CloudBase {
    url: string;      // 어느 Supabase 프로젝트였는지
    user: string;     // 어느 사용자였는지
    revision: number; // 그때의 revision
}

/** 저장된 CloudBase 를 읽습니다. 형식이 이상하면 null */
function loadBase(): CloudBase | null {
    try {
        const value = JSON.parse(readItem(CLOUD_BASE_KEY) ?? 'null') as CloudBase | null;
        return value && typeof value.revision === 'number' ? value : null;
    } catch {
        return null;
    }
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useCloud() {
    const toast = useToast();
    const [config, setConfig] = useState<SupabaseConfig>(loadSupabaseConfig);
    const [user, setUser] = useState<User | null>(null);
    const baseRef = useRef<CloudBase | null>(loadBase());

    // 설정이 바뀔 때만 클라이언트를 다시 계산합니다. URL 형식이 잘못되면 createClient 가 예외를 던집니다.
    const { client, connectError } = useMemo(() => {
        try {
            return { client: getSupabaseClient(config), connectError: '' };
        } catch (error) {
            return { client: null, connectError: errorMessage(error) };
        }
    }, [config]);

    useEffect(() => {
        if (connectError) toast('Supabase 연결 실패: ' + connectError);
    }, [connectError, toast]);

    // 로그인 상태 구독: 매직 링크로 돌아오거나 토큰이 갱신·만료될 때 user 를 갱신합니다.
    useEffect(() => {
        if (!client) return;
        let cancelled = false; // 정리된 뒤 늦게 도착한 응답을 무시하기 위한 플래그
        const { data } = client.auth.onAuthStateChange((_event, session) => {
            if (!cancelled) setUser(session?.user ?? null);
        });
        client.auth.getSession().then(({ data: result, error }) => {
            if (cancelled) return;
            if (error) toast('Supabase 연결 실패: ' + error.message);
            setUser(result.session?.user ?? null);
        });
        return () => {
            cancelled = true;
            data.subscription.unsubscribe();
            setUser(null);
        };
    }, [client, toast]);

    /** 동기화 기준 revision 을 기록합니다. (저장 실패해도 동작은 계속되도록 writeItem 사용) */
    const rememberBase = useCallback((base: CloudBase | null) => {
        baseRef.current = base;
        if (base) writeItem(CLOUD_BASE_KEY, JSON.stringify(base));
        else removeItem(CLOUD_BASE_KEY);
    }, []);

    /** 화면에서 입력한 연결 설정을 검증·저장하고 다시 연결합니다. 문제가 있으면 Error 를 던집니다. */
    const saveConfig = useCallback(async (urlInput: string, keyInput: string) => {
        const url = normalizeSupabaseURL(urlInput);
        if (!url) throw new Error('https://프로젝트.supabase.co 형식의 URL을 입력하세요.');
        const key = keyInput.trim();
        if (!key) throw new Error('공개 publishable 또는 anon 키를 입력하세요.');
        const problem = checkPublicKey(key);
        if (problem) throw new Error(problem);
        // 다른 프로젝트로 바꾸는 것이므로 기존 로그인과 동기화 기준을 정리합니다.
        await client?.auth.signOut();
        if (!writeItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, key }))) throw new Error('연결 설정을 기기에 저장하지 못했습니다.');
        rememberBase(null);
        setConfig({ url, key });
    }, [client, rememberBase]);

    /** 연결되지 않았으면 오류 */
    const requireClient = useCallback(() => {
        if (!client) throw new Error('Supabase 연결 설정이 필요합니다.');
        return client;
    }, [client]);

    /** 이메일 로그인 링크(또는 인증 코드) 발송 */
    const sendLoginLink = useCallback(async (emailInput: string) => {
        const supabase = requireClient();
        const email = emailInput.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일 주소를 확인하세요.');
        // 링크를 누르면 지금 보고 있는 앱 주소로 돌아오게 합니다. (Supabase Redirect URLs 에 등록 필요)
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
    }, [requireClient]);

    /** 이메일 인증 코드로 로그인 */
    const verifyCode = useCallback(async (email: string, token: string) => {
        const supabase = requireClient();
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
        if (error) throw error;
    }, [requireClient]);

    const logout = useCallback(async () => {
        await client?.auth.signOut();
        setUser(null);
    }, [client]);

    /** 서버에 현재 로그인 사용자를 다시 확인합니다. (세션 만료 대비) */
    const requireUser = useCallback(async () => {
        const supabase = requireClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error('로그인을 먼저 해주세요.');
        return { supabase, user: data.user };
    }, [requireClient]);

    /**
     * 클라우드 일정을 가져와 검증합니다. (아직 기기에 적용하지 않음)
     * 사용자가 교체를 확인한 뒤 commitLoaded 를 호출해야 revision 이 기록됩니다.
     */
    const fetchCloudTrip = useCallback(async () => {
        const { supabase, user: current } = await requireUser();
        const { data, error } = await supabase
            .from('travel_plans')
            .select('payload,revision,updated_at')
            .eq('user_id', current.id)
            .eq('trip_key', CLOUD_TRIP_KEY)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('클라우드에 저장된 일정이 없습니다. 현재 일정을 먼저 저장하세요.');
        // 이전 버전 앱이 저장한 version 1 데이터도 자동 변환됩니다.
        const trip = parseTrip(data.payload);
        const commitLoaded = () => rememberBase({ url: config.url, user: current.id, revision: data.revision as number });
        return { trip, commitLoaded };
    }, [requireUser, rememberBase, config.url]);

    /** 현재 일정을 클라우드에 저장합니다. 다른 기기가 먼저 저장했다면 충돌 오류를 던집니다. */
    const saveToCloud = useCallback(async (trip: Trip) => {
        const { supabase, user: current } = await requireUser();
        const base = baseRef.current;
        // 같은 프로젝트·같은 사용자로 동기화한 적이 있으면 그 revision 을, 아니면 0(최초 저장)을 기대값으로 보냅니다.
        const expected = base && base.user === current.id && base.url === config.url ? base.revision : 0;
        const { data, error } = await supabase.rpc('save_travel_plan', {
            p_trip_key: CLOUD_TRIP_KEY,
            p_payload: trip,
            p_expected_revision: expected,
        });
        if (error) {
            if (error.message.includes('revision_conflict')) {
                throw new Error('다른 기기에 더 새 일정이 있습니다. 현재 내용을 JSON 백업한 뒤 클라우드를 불러오고 다시 수정하세요.');
            }
            throw error;
        }
        rememberBase({ url: config.url, user: current.id, revision: data as number });
    }, [requireUser, rememberBase, config.url]);

    return {
        config,
        connected: !!client,
        user: client ? user : null,
        saveConfig,
        sendLoginLink,
        verifyCode,
        logout,
        fetchCloudTrip,
        saveToCloud,
    };
}
