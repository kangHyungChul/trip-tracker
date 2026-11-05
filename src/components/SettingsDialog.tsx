// 설정 모달: Google Maps API 키·Map ID, Supabase 연결(URL·공개 키) 관리.
// 화면에서 입력한 값은 이 기기에만 저장되며, 환경변수 값보다 우선합니다.
// Google 지도 스크립트·Supabase 연결은 페이지를 열 때 한 번 정해지므로 저장 후 새로고침으로 적용합니다.

import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { cloudConnectError, cloudUrl, isCloudEnabled } from '../lib/cloudTrips';
import { clearGoogleMapsConfig, DEMO_MAP_ID, hasEnvGoogleKey, saveGoogleMapsConfig } from '../lib/googleMaps';
import { readItem, removeItem, SUPABASE_CONFIG_KEY, writeItem } from '../lib/storage';
import { checkPublicKey, normalizeSupabaseURL } from '../lib/supabaseKey';
import { useConfirm } from '../hooks/useConfirm';
import { useMaps } from '../hooks/useMaps';
import { useToast } from '../hooks/useToast';
import { Modal, ModalFooter, ModalHead } from './Modal';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
}

export function SettingsDialog(props: SettingsDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="settings-heading">
            <SettingsForm {...props} />
        </Modal>
    );
}

/** 키 앞 6자리·뒤 4자리만 보여주기 (화면 엿보기 방지) */
const mask = (key: string) => (key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : '••••');

/** 로드 상태 → 안내 문구 */
const STATUS_TEXT: Record<string, string> = {
    'no-key': '키 없음 · 지도를 표시할 수 없습니다.',
    NOT_LOADED: '불러오기 전',
    LOADING: '불러오는 중…',
    LOADED: '정상 동작 중',
    FAILED: '불러오기 실패 · 네트워크나 키를 확인하세요.',
    AUTH_FAILURE: '키 인증 실패 · 키, 허용 웹사이트(리퍼러), API 사용 설정을 확인하세요.',
};

function SettingsForm({ onClose }: SettingsDialogProps) {
    const toast = useToast();
    const confirm = useConfirm(); // 앱 자체 확인창
    const { status, config } = useMaps();
    const [apiKey, setApiKey] = useState('');
    // 기본 데모 ID 는 입력칸에 굳이 보여주지 않습니다.
    const [mapId, setMapId] = useState(config.source === 'device' && config.mapId !== DEMO_MAP_ID ? config.mapId : '');

    const save = (event: FormEvent) => {
        event.preventDefault();
        try {
            // 키 입력칸을 비워 두면 현재 키를 유지하고 Map ID 만 바꿉니다.
            saveGoogleMapsConfig(apiKey || config.apiKey, mapId);
            toast('저장했습니다. 새로고침 후 적용됩니다.');
            setTimeout(() => location.reload(), 600); // 토스트를 잠깐 보여준 뒤 새로고침
        } catch (error) {
            toast(error instanceof Error ? error.message : String(error));
        }
    };

    const clear = async () => {
        const ok = await confirm({
            title: '이 기기에 저장한 Google 키를 삭제할까요?',
            message: '환경변수 키가 있으면 그 키로, 없으면 지도 없이 동작합니다.',
            confirmLabel: '키 삭제',
            danger: true,
        });
        if (!ok) return;
        clearGoogleMapsConfig();
        toast('삭제했습니다. 새로고침 후 적용됩니다.');
        setTimeout(() => location.reload(), 600);
    };

    const sourceText = config.source === 'device' ? '이 기기에 저장한 키' : config.source === 'env' ? '환경변수(.env.local / Vercel) 키' : '없음';
    return (
        <form onSubmit={save}>
            <ModalHead id="settings-heading" eyebrow="SETTINGS" title="설정" onClose={onClose} />
            <h3 className="mx-[25px] mt-[22px] mb-0 text-[15px] font-bold max-phone:mx-[18px]">Google 지도</h3>
            <div className="px-[25px] py-[22px] text-[12px] max-phone:p-[18px]">
                <div className="mb-4 grid gap-1 rounded-[10px] bg-[#f2f4ee] p-3">
                    <span>
                        상태: <b>{STATUS_TEXT[status] ?? status}</b>
                        {/* 정상 동작이면 초록 체크 SVG 아이콘 */}
                        {status === 'LOADED' && <Check className="icon ml-1 text-green" />}
                    </span>
                    <span>사용 중인 키: {sourceText}{config.apiKey ? ` (${mask(config.apiKey)})` : ''}</span>
                    <span>Map ID: {config.mapId === DEMO_MAP_ID ? '기본 데모 ID' : config.mapId}</span>
                </div>
                <label className="field">
                    새 Google Maps API 키 {config.apiKey && '(비워 두면 현재 키 유지)'}
                    {/* type="password": 입력 중 화면에 키가 그대로 보이지 않게 합니다. */}
                    <input type="password" autoComplete="off" placeholder="AIza…" value={apiKey} onChange={event => setApiKey(event.target.value)} />
                </label>
                <label className="field">
                    Map ID (선택 · 비우면 기본 데모 ID)
                    <input autoComplete="off" value={mapId} onChange={event => setMapId(event.target.value)} />
                </label>
                <p className="text-muted">
                    키는 이 기기 브라우저에만 저장됩니다. 브라우저용 키는 어떤 방식이든 노출되므로 Google Cloud 콘솔에서{' '}
                    <b>웹사이트(HTTP 리퍼러) 제한</b>과 <b>Maps JavaScript API · Places API (New) · Routes API</b> 로 API 제한을 꼭 걸어 두세요.
                </p>
                <p className="text-muted">실제 경로 표시에는 Routes API 사용 설정과 결제 연결이 필요합니다. Google Cloud에서 ComputeRoutes 할당량을 일일 300회·분당 30회로 제한하고 예산 알림을 설정하세요. 무료 사용량은 지도·장소 검색과 별도입니다.</p>
                <SupabaseSection />
            </div>
            <ModalFooter>
                {config.source === 'device' && (
                    <button type="button" className="btn btn-danger mr-auto" onClick={clear} title={hasEnvGoogleKey() ? '환경변수 키로 돌아갑니다' : undefined}>
                        기기 키 삭제
                    </button>
                )}
                <button type="button" className="btn btn-outline" onClick={onClose}>닫기</button>
                <button type="submit" className="btn btn-primary" disabled={!apiKey && !config.apiKey}>지도 설정 저장 후 새로고침</button>
            </ModalFooter>
        </form>
    );
}

/**
 * Supabase 연결 설정 영역. (지도 설정 form 안에 있으므로 버튼은 모두 type="button" 으로 제출을 막습니다)
 * 환경변수(.env.local / Vercel)에 넣었다면 여기서 입력하지 않아도 됩니다.
 */
function SupabaseSection() {
    const toast = useToast();
    const confirm = useConfirm();
    const hasDeviceConfig = readItem(SUPABASE_CONFIG_KEY) !== null; // 이 기기에 직접 입력한 설정이 있는지
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');

    const save = () => {
        const normalized = normalizeSupabaseURL(url);
        if (!normalized) return toast('https://프로젝트.supabase.co 형식의 URL을 입력하세요.');
        const problem = checkPublicKey(key.trim());
        if (problem) return toast(problem);
        writeItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url: normalized, key: key.trim() }));
        toast('저장했습니다. 새로고침 후 적용됩니다.');
        setTimeout(() => location.reload(), 600);
    };

    const clear = async () => {
        const ok = await confirm({
            title: '이 기기에 저장한 Supabase 연결 설정을 삭제할까요?',
            message: '환경변수 설정이 있으면 그 설정으로, 없으면 기기에만 저장하는 모드로 동작합니다. 클라우드 데이터는 지워지지 않습니다.',
            confirmLabel: '설정 삭제',
            danger: true,
        });
        if (!ok) return;
        removeItem(SUPABASE_CONFIG_KEY);
        toast('삭제했습니다. 새로고침 후 적용됩니다.');
        setTimeout(() => location.reload(), 600);
    };

    // 현재 연결 상태: 연결됨(프로젝트 주소 앞부분) / 설정 오류 / 미설정
    const status = isCloudEnabled()
        ? `연결됨 · ${new URL(cloudUrl()).hostname.split('.')[0]} (${hasDeviceConfig ? '이 기기 설정' : '환경변수'})`
        : cloudConnectError()
          ? `설정 오류 · ${cloudConnectError()}`
          : '미설정 · 이 기기에만 저장 중';

    return (
        <section className="mt-6 border-t border-line pt-5">
            <h3 className="mt-0 mb-2 text-[15px] font-bold">Supabase (클라우드 자동 저장)</h3>
            <p className="mb-3 rounded-[10px] bg-[#f2f4ee] p-3">상태: <b>{status}</b></p>
            <label className="field">
                프로젝트 URL
                <input type="url" placeholder="https://프로젝트.supabase.co" autoComplete="off" value={url} onChange={event => setUrl(event.target.value)} />
            </label>
            <label className="field">
                공개 Publishable 키
                <input type="password" placeholder="sb_publishable_…" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline" disabled={!url || !key} onClick={save}>연결 설정 저장 후 새로고침</button>
                {hasDeviceConfig && <button type="button" className="btn btn-danger" onClick={clear}>기기 설정 삭제</button>}
            </div>
            <p className="text-muted">
                공개 키만 입력하세요. 서버 비밀 키(sb_secret_, service_role)는 거부됩니다. DB 준비는 README 의 ‘Supabase 설정’을 참고하세요.
            </p>
        </section>
    );
}
