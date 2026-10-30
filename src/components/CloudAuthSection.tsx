// Supabase 연결 설정·이메일 로그인·로그아웃 영역.
// 여행 화면과 첫 화면의 저장·백업 모달에서 함께 쓰고, 로그인 후 보여줄 버튼은 children 으로 받습니다.

import { useState, type ReactNode } from 'react';
import { useToast } from '../hooks/useToast';
import type { Cloud } from '../hooks/useCloud';
import type { useRunner } from '../hooks/useRunner';

interface CloudAuthSectionProps {
    cloud: Cloud;
    /** 모달 전체에서 공유하는 비동기 작업 실행기 (중복 클릭 방지) */
    runner: ReturnType<typeof useRunner>;
    /** 로그인한 뒤 보여줄 내용 (클라우드 저장·불러오기 버튼 등) */
    children: ReactNode;
}

const desc = 'text-[12px] text-muted';

export function CloudAuthSection({ cloud, runner, children }: CloudAuthSectionProps) {
    const toast = useToast();
    const { pending, run } = runner;
    // 연결 설정 입력값 (현재 설정으로 시작)
    const [url, setUrl] = useState(cloud.config.url);
    const [key, setKey] = useState(cloud.config.key);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');

    // 상단 상태 문구
    const status = cloud.user
        ? `로그인됨 · ${cloud.user.email || '내 계정'} / 클라우드는 버튼으로 저장·불러옵니다.`
        : cloud.connected
          ? 'Supabase 연결됨. 이메일로 로그인하면 내 여행만 저장됩니다.'
          : '지금은 기기 저장 모드입니다. Supabase 연결 설정 후 클라우드 저장을 사용할 수 있습니다.';

    return (
        <>
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
                                toast('로그인했습니다.');
                            })}
                        >
                            코드 확인
                        </button>
                    </div>
                </div>
            )}

            {/* 로그인 후: 부모가 넘긴 클라우드 동작 + 로그아웃 */}
            {cloud.user && (
                <div>
                    {children}
                    <button type="button" className="btn btn-text" onClick={() => run('logout', cloud.logout)}>로그아웃</button>
                </div>
            )}
        </>
    );
}
