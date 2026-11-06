// 설정 모달: Google Maps API 키·Map ID, Supabase 연결(URL·공개 키) 관리.
// 화면에서 입력한 값은 이 기기에만 저장되며, 환경변수 값보다 우선합니다.
// Google 지도 스크립트·Supabase 연결은 페이지를 열 때 한 번 정해지므로 저장 후 새로고침으로 적용합니다.

import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { cloudConnectError, isCloudEnabled } from '../lib/cloudTrips';
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
    'no-key': '지도 연결이 필요합니다.',
    NOT_LOADED: '불러오기 전',
    LOADING: '불러오는 중…',
    LOADED: '지도를 이용할 수 있습니다.',
    FAILED: '지도를 연결하지 못했습니다.',
    AUTH_FAILURE: '지도 연결 정보를 확인해 주세요.',
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
            title: '별도로 입력한 지도 연결을 해제할까요?',
            message: '기본 지도 연결로 돌아갑니다. 기본 연결이 없으면 지도가 표시되지 않습니다.',
            confirmLabel: '연결 해제',
            danger: true,
        });
        if (!ok) return;
        clearGoogleMapsConfig();
        toast('삭제했습니다. 새로고침 후 적용됩니다.');
        setTimeout(() => location.reload(), 600);
    };

    const sourceText = config.source === 'device' ? '별도로 연결됨' : config.source === 'env' ? '기본 연결 사용 중' : '연결 안 됨';
    return (
        <form onSubmit={save}>
            <ModalHead id="settings-heading" eyebrow="SETTINGS" title="설정" onClose={onClose} />
            <h3 className="mx-[25px] mt-[22px] mb-0 text-[15px] font-bold max-phone:mx-[18px]">Google 지도</h3>
            <div className="px-[25px] py-[22px] text-[12px] max-phone:p-[18px]">
                <div className="mb-4 grid gap-1 rounded-[10px] bg-[#f2f4ee] p-3">
                    <span>
                        <b>{STATUS_TEXT[status] ?? '지도 연결 확인 중'}</b>
                        {/* 정상 동작이면 초록 체크 SVG 아이콘 */}
                        {status === 'LOADED' && <Check className="icon ml-1 text-green" />}
                    </span>
                </div>
                <details>
                <summary className="mb-3 cursor-pointer font-semibold">지도 연결 변경</summary>
                <p className="mb-3 text-muted">{sourceText}{config.apiKey ? ` · ${mask(config.apiKey)}` : ''}</p>
                <label className="field">
                    지도 연결 키 {config.apiKey && '(비워 두면 현재 연결 유지)'}
                    {/* type="password": 입력 중 화면에 키가 그대로 보이지 않게 합니다. */}
                    <input type="password" autoComplete="off" placeholder="AIza…" value={apiKey} onChange={event => setApiKey(event.target.value)} />
                </label>
                <label className="field">
                    지도 스타일 코드 (선택)
                    <input autoComplete="off" value={mapId} onChange={event => setMapId(event.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                {config.source === 'device' && (
                    <button type="button" className="btn btn-danger" onClick={clear} title={hasEnvGoogleKey() ? '기본 연결로 되돌리기' : undefined}>
                        별도 연결 해제
                    </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={!apiKey && !config.apiKey}>지도 연결 저장</button>
                </div>
                </details>
                <SupabaseSection />
            </div>
            <ModalFooter>
                <button type="button" className="btn btn-outline" onClick={onClose}>닫기</button>
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
        if (!normalized) return toast('여행 저장 서비스의 주소를 확인해 주세요.');
        const problem = checkPublicKey(key.trim());
        if (problem) return toast('공유용 연결 키를 확인해 주세요. 관리용 키는 사용할 수 없습니다.');
        writeItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url: normalized, key: key.trim() }));
        toast('저장했습니다. 새로고침 후 적용됩니다.');
        setTimeout(() => location.reload(), 600);
    };

    const clear = async () => {
        const ok = await confirm({
            title: '별도로 입력한 저장 연결을 해제할까요?',
            message: '저장된 여행은 삭제되지 않습니다. 기본 연결이 없으면 이후 변경은 이 기기에만 저장됩니다.',
            confirmLabel: '연결 해제',
            danger: true,
        });
        if (!ok) return;
        removeItem(SUPABASE_CONFIG_KEY);
        toast('삭제했습니다. 새로고침 후 적용됩니다.');
        setTimeout(() => location.reload(), 600);
    };

    // 현재 연결 상태: 연결됨(프로젝트 주소 앞부분) / 설정 오류 / 미설정
    const status = isCloudEnabled()
        ? '여행을 저장하고 다른 기기에서 이어서 볼 수 있습니다.'
        : cloudConnectError()
          ? '여행 저장 연결을 확인해 주세요.'
          : '여행은 이 기기에 저장됩니다.';

    return (
        <section className="mt-6 border-t border-line pt-5">
            <h3 className="mt-0 mb-2 text-[15px] font-bold">여행 저장</h3>
            <p className="mb-3 rounded-[10px] bg-[#f2f4ee] p-3">{status}</p>
            <details>
            <summary className="mb-3 cursor-pointer font-semibold">저장 연결 변경</summary>
            <label className="field">
                저장 서비스 주소
                <input type="url" placeholder="https://…" autoComplete="off" value={url} onChange={event => setUrl(event.target.value)} />
            </label>
            <label className="field">
                공유용 연결 키
                <input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline" disabled={!url || !key} onClick={save}>저장 연결 적용</button>
                {hasDeviceConfig && <button type="button" className="btn btn-danger" onClick={clear}>별도 연결 해제</button>}
            </div>
            </details>
        </section>
    );
}
