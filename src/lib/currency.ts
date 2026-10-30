// 여행별 통화(화폐 단위) 도우미.
// 통화는 ISO 4217 세 글자 코드(KRW, JPY, USD …)로 저장하고,
// 표시는 브라우저 내장 Intl API 로 기호·자릿수·이름을 자동으로 맞춥니다. (₩1,950 / ¥1,950 / $19.5)

/** 새 여행의 기본 통화 */
export const DEFAULT_CURRENCY = 'KRW';
/** 통화 필드가 없던 예전 데이터의 통화 (기존 앱은 엔화 고정이었음) */
export const LEGACY_CURRENCY = 'JPY';
/** 통화 코드 형식: 영문 대문자 세 글자 */
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** 선택 목록에 보여줄 자주 쓰는 통화 (목록에 없으면 코드를 직접 입력) */
export const PRESET_CURRENCIES = [
    'KRW', 'JPY', 'USD', 'EUR', 'CNY', 'TWD', 'HKD', 'THB', 'VND', 'PHP',
    'SGD', 'MYR', 'IDR', 'GBP', 'AUD', 'CAD', 'NZD', 'CHF',
] as const;

/** 입력값을 통화 코드 형태로 정리 (앞뒤 공백 제거 + 대문자) */
export const normalizeCurrency = (value: string) => value.trim().toUpperCase();

/** 올바른 통화 코드인지 (형식 + 브라우저가 아는 통화인지) */
export function isCurrencyCode(value: string): boolean {
    if (!CURRENCY_PATTERN.test(value)) return false;
    // Intl.supportedValuesOf: 브라우저가 지원하는 통화 목록. 오래된 환경에서는 없으므로 형식만 확인합니다.
    const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : null;
    return supported ? supported.includes(value) : true;
}

/** 통화 한국어 이름 (예: JPY → "일본 엔화"). 알 수 없으면 코드 그대로 */
export function currencyName(code: string): string {
    try {
        return new Intl.DisplayNames(['ko'], { type: 'currency' }).of(code) ?? code;
    } catch {
        return code;
    }
}

/**
 * 금액 표시 형식기. 같은 통화는 매번 새로 만들지 않도록 캐시합니다.
 *  - currencyDisplay 'narrowSymbol': JP¥ 대신 ¥, US$ 대신 $ 처럼 짧은 기호
 *  - minimumFractionDigits 0: 소수 자릿수가 있는 통화(USD 등)도 정수 금액은 "$20" 처럼 짧게
 */
const formatters = new Map<string, Intl.NumberFormat>();
function formatter(code: string): Intl.NumberFormat {
    let result = formatters.get(code);
    if (!result) {
        try {
            result = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0 });
        } catch {
            // 잘못된 코드여도 화면이 깨지지 않도록 숫자만 표시하는 형식기로 대체
            result = new Intl.NumberFormat('ko-KR');
        }
        formatters.set(code, result);
    }
    return result;
}

/** 금액 + 통화 기호 (예: formatMoney(1950, 'JPY') → "¥1,950") */
export const formatMoney = (amount: number, code: string) => formatter(code).format(amount);

/** 통화 기호만 (예: KRW → "₩", 기호가 없는 통화는 코드) */
export function currencySymbol(code: string): string {
    // formatToParts: 형식화 결과를 조각으로 나눠 그중 통화 기호 부분만 꺼냅니다.
    return formatter(code).formatToParts(0).find(part => part.type === 'currency')?.value ?? code;
}

/** 소수 금액을 입력할 수 있는 통화인지 (USD·EUR 등 = true, KRW·JPY = false) → 입력칸 step 결정 */
export const allowsDecimals = (code: string) => (formatter(code).resolvedOptions().maximumFractionDigits ?? 0) > 0;
