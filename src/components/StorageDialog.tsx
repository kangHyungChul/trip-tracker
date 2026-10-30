// 저장·백업 모달: JSON 백업/불러오기, Supabase 연결 설정, 로그인, 클라우드 저장/불러오기, 초기화.

import { useState, type ChangeEvent } from 'react';
import { clone, parseTrip } from '../lib/trip';
import { useToast } from '../hooks/useToast';
import type { useCloud } from '../hooks/useCloud';
import { Modal, ModalHead } from './Modal';
import type { Trip } from '../types';

interface StorageDialogProps {
    open: boolean;
    onClose: () => void;
    /** 최신 여행 데이터 읽기 */
    getTrip: () => Trip;
    /** 여행 데이터 통째로 교체 (불러오기·초기화·클라우드) */
    replace: (trip: Trip) => void;
    /** 기기 저장이 잠겨 있는지 */
    isSaveBlocked: () => boolean;
    /** useCloud 훅의 반환값 */
    cloud: ReturnType<typeof useCloud>;
    /** 초기화에 쓰는 원래 추천 일정 */
    seed: Trip;
}

/** 불러오기 파일 최대 크기 (3MB, Supabase 테이블 제한과 동일) */
const MAX_IMPORT_BYTES = 3_000_000;

const errorMessage = (error: unknown) => (error instanceof Error && error.message) || '요청에 실패했습니다.';

/** 현재 일정을 JSON 파일로 내려받기 */
function exportTrip(trip: Trip) {
    const blob = new Blob([JSON.stringify(trip, null, 4)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kagoshima-trip-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    // 다운로드가 시작된 뒤 임시 URL 메모리를 해제합니다.
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function StorageDialog(props: StorageDialogProps) {
    return (
        <Modal open={props.open} onClose={props.onClose} labelledBy="storage-heading">
            <StorageBody {...props} />
        </Modal>
    );
}

function StorageBody({ onClose, getTrip, replace, isSaveBlocked, cloud, seed }: StorageDialogProps) {
    const toast = useToast();
    // 연결 설정 입력값 (현재 설정으로 시작)
    const [url, setUrl] = useState(cloud.config.url);
    const [key, setKey] = useState(cloud.config.key);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    // 요청 진행 중인 버튼 이름. 진행 중에는 버튼을 비활성화해 중복 클릭을 막습니다.
    const [pending, setPending] = useState<string | null>(null);

    /** 비동기 작업 실행: 중복 실행 방지 + 오류는 토스트로 표시 + 끝나면 버튼 해제 */
    const run = async (name: string, action: () => Promise<void>) => {
        if (pending) return;
        setPending(name);
        try {
            await action();
        } catch (error) {
            toast(errorMessage(error));
        } finally {
            setPending(null);
        }
    };

    /** 백업 파일 불러오기: 검증(v1 은 자동 변환) → 사용자 확인 → 교체 */
    const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) return;
        try {
            if (file.size > MAX_IMPORT_BYTES) throw new Error('백업 파일은 3MB 이하만 가능합니다.');
            const candidate = parseTrip(JSON.parse(await file.text()));
            if (!confirm('현재 기기 일정을 백업 파일로 교체할까요? 필요하면 먼저 JSON 백업을 내려받으세요.')) return;
            replace(candidate);
            toast('백업을 불러왔습니다. 클라우드 저장은 별도로 실행하세요.');
        } catch (error) {
            toast('불러오기 실패: ' + errorMessage(error));
        } finally {
            // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 값을 비웁니다.
            input.value = '';
        }
    };

    const reset = () => {
        if (!confirm('기기 일정을 원래 추천안으로 초기화할까요? 수정 내용은 사라집니다.')) return;
        replace(clone(seed)); // 원본 추천 일정 객체가 공유되지 않도록 복사본으로 교체
        toast('원래 추천 일정으로 초기화했습니다.');
    };

    // 클라우드 영역 상단 상태 문구
    const status = cloud.user
        ? `로그인됨 · ${cloud.user.email || '내 계정'} / 클라우드는 버튼으로 저장·불러옵니다.`
        : cloud.connected
          ? 'Supabase 연결됨. 이메일로 로그인하면 내 일정만 저장됩니다.'
          : '지금은 기기 저장 모드입니다. Supabase 연결 설정 후 클라우드 저장을 사용할 수 있습니다.';

    const block = 'mb-[22px] border-b border-line pb-[22px] last:mb-0 last:border-0 last:pb-0';
    const desc = 'text-[12px] text-muted';

    return (
        <>
            <ModalHead id="storage-heading" eyebrow="YOUR TRAVEL NOTE" title="저장과 백업" onClose={onClose} />
            <div className="px-[25px] py-[22px] max-phone:p-[18px]">
                <section className={block}>
                    <h3 className="mb-2 text-[16px] font-bold">이 기기에 자동 저장</h3>
                    <p className={desc}>수정 내용은 이 브라우저에 저장됩니다. 기기를 바꾸기 전 JSON 백업을 내려받거나 클라우드에 저장하세요.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                        <button type="button" className="btn btn-primary" onClick={() => exportTrip(getTrip())}>↓ JSON 백업</button>
                        {/* 파일 입력칸은 숨기고 라벨을 버튼처럼 보이게 합니다. 라벨 클릭 = 파일 선택 */}
                        <label className="btn btn-outline">
                            ↑ 백업 불러오기
                            <input type="file" accept=".json,application/json" hidden onChange={importFile} />
                        </label>
                    </div>
                </section>

                <section className={block}>
                    <h3 className="mb-2 text-[16px] font-bold">Supabase · 다른 기기에서도 이어보기</h3>
                    <p className={desc}>{status}</p>
                    <details className="my-[15px] text-[12px]">
                        <summary className="mb-3 cursor-pointer">Supabase 연결 설정</summary>
                        <label className="field">
                            프로젝트 URL
                            <input type="url" placeholder="https://프로젝트.supabase.co" value={url} onChange={e => setUrl(e.target.value)} />
                        </label>
                        <label className="field">
                            공개 Publishable / anon 키
                            <input placeholder="sb_publishable_… 또는 anon JWT" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} />
                        </label>
                        <button
                            type="button"
                            className="btn btn-outline"
                            disabled={!!pending}
                            onClick={() => run('config', async () => {
                                await cloud.saveConfig(url, key);
                                toast('연결 설정을 저장했습니다.');
                            })}
                        >
                            연결 설정 저장
                        </button>
                        <p className={desc}>공개 키만 사용하세요. SQL 설정은 README와 supabase/schema.sql에 있습니다. 서버 비밀 키는 입력하지 않습니다.</p>
                    </details>

                    {/* 연결됐지만 로그인 전: 이메일 로그인 영역 */}
                    {cloud.connected && !cloud.user && (
                        <div className="mt-5">
                            <label className="field">
                                로그인 이메일
                                <input type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
                            </label>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!!pending}
                                onClick={() => run('login', async () => {
                                    await cloud.sendLoginLink(email);
                                    toast('로그인 이메일을 보냈습니다. 링크 또는 인증 코드를 확인하세요.');
                                })}
                            >
                                이메일 로그인 링크 받기
                            </button>
                            <p className={desc}>도착한 링크를 이 앱을 사용 중인 브라우저에서 여세요. 인증 코드를 사용하도록 설정했다면 아래에 입력할 수 있습니다.</p>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <input
                                    className="min-w-[100px] flex-1"
                                    placeholder="이메일 인증 코드"
                                    autoComplete="one-time-code"
                                    aria-label="이메일 인증 코드"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    disabled={!!pending}
                                    onClick={() => run('verify', async () => {
                                        await cloud.verifyCode(email, otp);
                                        toast('로그인했습니다. 클라우드 불러오기 또는 저장을 선택하세요.');
                                    })}
                                >
                                    코드 확인
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 로그인 후: 클라우드 저장·불러오기 */}
                    {cloud.user && (
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    disabled={!!pending}
                                    onClick={() => run('load', async () => {
                                        const { trip, commitLoaded } = await cloud.fetchCloudTrip();
                                        if (!confirm('클라우드 일정으로 기기 일정을 교체할까요? 현재 수정안이 필요하면 먼저 JSON 백업을 만드세요.')) return;
                                        replace(trip);
                                        commitLoaded(); // 기기 일정 교체가 끝난 뒤에만 revision 을 기록
                                        toast('클라우드 일정을 불러왔습니다.');
                                    })}
                                >
                                    ☁ 클라우드 불러오기
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={!!pending}
                                    onClick={() => run('save', async () => {
                                        // 기기 저장에 문제가 있으면 잘못된 데이터를 올리지 않도록 막습니다.
                                        if (isSaveBlocked()) throw new Error('먼저 기기 저장 문제를 해결하거나 백업을 불러오세요.');
                                        await cloud.saveToCloud(getTrip());
                                        toast('클라우드에 저장했습니다. 다른 기기에서 같은 이메일로 불러오세요.');
                                    })}
                                >
                                    ☁ 클라우드에 저장
                                </button>
                            </div>
                            <p className={desc}>기기 저장과 클라우드 저장은 별개입니다. 다른 기기에서 수정했다면 먼저 불러오세요. 충돌 시 덮어쓰지 않습니다.</p>
                            <button type="button" className="btn btn-text" onClick={() => run('logout', cloud.logout)}>로그아웃</button>
                        </div>
                    )}
                </section>

                <section className={block}>
                    <button type="button" className="btn btn-danger" onClick={reset}>원래 추천 일정으로 초기화</button>
                    <p className={desc}>초기화 전에 백업을 권장합니다. 클라우드의 일정은 별도 저장 전까지 변경되지 않습니다.</p>
                </section>
            </div>
        </>
    );
}
