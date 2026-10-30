// 아이콘 PNG 생성 스크립트: `npm run icons`
// public/icon.svg, public/favicon.svg(원본)를 읽어 홈 화면·탭에 필요한 크기의 PNG로 변환합니다.
// SVG를 고친 뒤 다시 실행하면 PNG가 덮어써집니다.
import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

// public 폴더 경로 (이 스크립트 기준 ../public)
const PUBLIC_DIR = new URL('../public/', import.meta.url);

// [원본 SVG, 출력 파일 이름, 한 변 크기(px)]
const TARGETS = [
    ['icon.svg', 'apple-touch-icon.png', 180], // iOS ‘홈 화면에 추가’ 아이콘
    ['icon.svg', 'icon-192.png', 192],         // Android 홈 화면 아이콘
    ['icon.svg', 'icon-512.png', 512],         // Android 스플래시·고해상도 아이콘
    ['favicon.svg', 'favicon-32.png', 32],     // SVG 파비콘을 지원하지 않는 브라우저용
];

for (const [source, output, size] of TARGETS) {
    // SVG 텍스트를 읽고, 가로 폭을 size로 맞춰 렌더링 (세로는 비율대로 같은 크기)
    const svg = await readFile(new URL(source, PUBLIC_DIR), 'utf8');
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
    await writeFile(new URL(output, PUBLIC_DIR), png);
    console.log(`${output} (${size}×${size})`);
}
