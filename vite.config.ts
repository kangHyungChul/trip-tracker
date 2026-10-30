/// <reference types="vitest/config" />
// ↑ vite 설정 안의 test 항목(Vitest 설정)에 타입을 붙이기 위한 참조입니다.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Vite 설정 파일은 Node 가 직접 읽으므로 .ts 확장자까지 적어야 합니다.
import { checkPublicKey } from './src/lib/supabaseKey.ts';

// Vite 설정 파일.
// mode(development/production)에 맞는 .env 값을 읽어 Supabase 키가 공개 키인지 빌드 전에 검사합니다.
export default defineConfig(({ mode }) => {
    // 세 번째 인자 'VITE_' : VITE_ 로 시작하는 변수만 읽습니다. (브라우저 번들에 들어가는 값과 동일)
    // process.env 도 함께 반영되므로 Vercel 환경변수도 여기서 검사됩니다.
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    // 신형 publishable 키 우선, 없으면 구형 anon JWT 키를 사용합니다.
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
    if (key) {
        const problem = checkPublicKey(key);
        // 비밀 키가 번들에 포함되는 것을 막기 위해 빌드/개발 서버 시작 자체를 중단합니다.
        if (problem) throw new Error(`[Supabase 키 검사 실패] ${problem}`);
    }

    return {
        // react(): JSX 변환과 Fast Refresh, tailwindcss(): Tailwind v4 CSS 생성
        plugins: [react(), tailwindcss()],
        build: {
            // Supabase SDK·Leaflet·일정 데이터를 합치면 약 670KB(gzip 약 200KB)라 기본 경고 기준(500KB)을 올립니다.
            chunkSizeWarningLimit: 800,
        },
        test: {
            // 순수 함수 테스트만 하므로 DOM 없는 node 환경으로 충분합니다.
            environment: 'node',
            include: ['src/**/*.test.ts'],
        },
    };
});
