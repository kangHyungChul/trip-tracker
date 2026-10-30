// ⚙ 설정 모달: Google Maps API 키·Map ID 관리.
// 화면에서 입력한 키는 이 기기에만 저장되며, 환경변수 키보다 우선합니다.
// Google 지도 스크립트는 한 페이지에서 한 번만 불러올 수 있어 저장 후 새로고침으로 적용합니다.

import { useState, type FormEvent } from 'react';
import { clearGoogleMapsConfig, DEMO_MAP_ID, hasEnvGoogleKey, saveGoogleMapsConfig } from '../lib/googleMaps';
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
    LOADED: '정상 동작 중 ✓',
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
            <ModalHead id="settings-heading" eyebrow="SETTINGS" title="Google 지도 설정" onClose={onClose} />
            <div className="px-[25px] py-[22px] text-[12px] max-phone:p-[18px]">
                <div className="mb-4 grid gap-1 rounded-[10px] bg-[#f2f4ee] p-3">
                    <span>상태: <b>{STATUS_TEXT[status] ?? status}</b></span>
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
                    <b>웹사이트(HTTP 리퍼러) 제한</b>과 <b>Maps JavaScript API · Places API (New)</b> 로 API 제한을 꼭 걸어 두세요.
                </p>
            </div>
            <ModalFooter>
                {config.source === 'device' && (
                    <button type="button" className="btn btn-danger mr-auto" onClick={clear} title={hasEnvGoogleKey() ? '환경변수 키로 돌아갑니다' : undefined}>
                        기기 키 삭제
                    </button>
                )}
                <button type="button" className="btn btn-outline" onClick={onClose}>닫기</button>
                <button type="submit" className="btn btn-primary" disabled={!apiKey && !config.apiKey}>저장 후 새로고침</button>
            </ModalFooter>
        </form>
    );
}
