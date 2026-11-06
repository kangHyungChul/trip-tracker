/// <reference types="vitest/config" />
// ↑ vite 설정 안의 test 항목(Vitest 설정)에 타입을 붙이기 위한 참조입니다.
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Vite 설정 파일은 Node 가 직접 읽으므로 .ts 확장자까지 적어야 합니다.
import { checkPublicKey } from './src/lib/supabaseKey.ts';
import { resolveShortMapsLink } from './api/resolve-maps-url.ts';

/**
 * 개발 서버 전용 미들웨어: 배포 환경의 Vercel 서버 함수(/api/resolve-maps-url)와 같은 동작을 로컬에서 제공합니다.
 * (npm run dev 에서는 Vercel 함수가 실행되지 않으므로 같은 함수를 직접 호출)
 */
function devMapsLinkApi(): Plugin {
    return {
        name: 'dev-resolve-maps-url',
        configureServer(server) {
            server.middlewares.use('/api/resolve-maps-url', async (req, res) => {
                // req.url 은 마운트 경로 뒤의 나머지("?url=…")만 담고 있어 임의의 기준 주소를 붙여 해석합니다.
                const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url') ?? '';
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                try {
                    res.end(JSON.stringify({ url: await resolveShortMapsLink(target) }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                }
            });
        },
    };
}

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
        // react(): JSX 변환과 Fast Refresh, tailwindcss(): Tailwind v4 CSS 생성, devMapsLinkApi(): 짧은 링크 풀기(개발용)
        plugins: [react(), tailwindcss(), devMapsLinkApi()],
        build: {
            // Supabase SDK·지도·날짜 선택기·일정 데이터를 합치면 기본 경고 기준(500KB)을 넘으므로 올립니다.
            chunkSizeWarningLimit: 900,
        },
        test: {
            // 순수 함수와 서버 렌더링 마크업 검증은 DOM 없는 node 환경에서 실행합니다.
            environment: 'node',
            include: ['src/**/*.test.{ts,tsx}'],
        },
    };
});
