/**
 * 国际化系统
 * 管理多语言切换和翻译
 */
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';

/** 语言类型 */
export type Locale = 'zh-CN' | 'en-US' | 'ja-JP';

/** 语言包映射 */
const locales = {
    'zh-CN': zhCN,
    'en-US': enUS,
    'ja-JP': jaJP
};

/** 当前语言 */
let currentLocale: Locale = 'zh-CN';

/** 语言变化回调 */
type LocaleChangeCallback = (locale: Locale) => void;
const subscribers: LocaleChangeCallback[] = [];

/**
 * 获取当前语言
 */
export function getLocale(): Locale {
    return currentLocale;
}

/**
 * 设置语言
 */
export function setLocale(locale: Locale): void {
    if (locales[locale]) {
        currentLocale = locale;
        localStorage.setItem('pet-locale', locale);
        subscribers.forEach(callback => callback(locale));
    }
}

/**
 * 订阅语言变化
 */
export function subscribeLocaleChange(callback: LocaleChangeCallback): () => void {
    subscribers.push(callback);
    return () => {
        const index = subscribers.indexOf(callback);
        if (index > -1) {
            subscribers.splice(index, 1);
        }
    };
}

/**
 * 初始化语言
 */
export function initLocale(): void {
    const saved = localStorage.getItem('pet-locale') as Locale;
    if (saved && locales[saved]) {
        currentLocale = saved;
    } else {
        // 根据浏览器语言自动选择
        const browserLang = navigator.language;
        if (browserLang.startsWith('zh')) {
            currentLocale = 'zh-CN';
        } else if (browserLang.startsWith('ja')) {
            currentLocale = 'ja-JP';
        } else {
            currentLocale = 'en-US';
        }
    }
}

/**
 * 获取翻译
 * 支持嵌套路径，如 'dialogue.idle'
 */
export function t(path: string, params?: Record<string, string | number>): string {
    const keys = path.split('.');
    let value: any = locales[currentLocale];
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            console.warn(`[i18n] Missing translation: ${path}`);
            return path;
        }
    }
    
    if (typeof value !== 'string') {
        console.warn(`[i18n] Translation is not a string: ${path}`);
        return path;
    }
    
    // 替换参数，如 {count} -> 5
    if (params) {
        return value.replace(/\{(\w+)\}/g, (_, key) => {
            return params[key]?.toString() || `{${key}}`;
        });
    }
    
    return value;
}

/**
 * 获取随机对话
 * 如果指定的 category 不存在，fallback 到 'idle'
 */
export function getRandomDialogue(category: string): string {
    const dialogues = locales[currentLocale].dialogue as any;
    const path = category.split('.');
    let value: any = dialogues;
    
    for (const key of path) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            // fallback 到 idle
            const fallback = (dialogues as any)?.idle;
            if (Array.isArray(fallback) && fallback.length > 0) {
                return fallback[Math.floor(Math.random() * fallback.length)];
            }
            return '';
        }
    }
    
    if (Array.isArray(value) && value.length > 0) {
        return value[Math.floor(Math.random() * value.length)];
    }
    
    return '';
}

/**
 * 获取问候语
 */
export function getGreeting(): string {
    const hour = new Date().getHours();
    const greetings = locales[currentLocale].greeting;
    
    if (hour >= 5 && hour < 12) {
        return greetings.morning[Math.floor(Math.random() * greetings.morning.length)];
    } else if (hour >= 12 && hour < 14) {
        return greetings.noon[Math.floor(Math.random() * greetings.noon.length)];
    } else if (hour >= 14 && hour < 18) {
        return greetings.afternoon[Math.floor(Math.random() * greetings.afternoon.length)];
    } else if (hour >= 18 && hour < 22) {
        return greetings.evening[Math.floor(Math.random() * greetings.evening.length)];
    } else {
        return greetings.night[Math.floor(Math.random() * greetings.night.length)];
    }
}

/**
 * 获取可用语言列表
 */
export function getAvailableLocales(): Array<{ value: Locale; label: string }> {
    return [
        { value: 'zh-CN', label: '简体中文' },
        { value: 'en-US', label: 'English' },
        { value: 'ja-JP', label: '日本語' }
    ];
}

initLocale();
