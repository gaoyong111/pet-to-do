/**
 * 自然语言意图识别 — 将口语化输入映射为内建命令
 */

export interface ChatCommandIntent {
    command: '/task' | '/remind' | '/todo';
    args: string;
}

const TODO_PATTERNS = [
    /^(今日|今天).{0,4}(任务|待办|todo)/i,
    /^(查看|看看|显示|打开).{0,4}(今日|今天)?.{0,4}(任务|待办|todo)/i,
    /^有什么.{0,4}(任务|待办)/,
    /^(任务|待办)列表$/,
];

const TASK_PATTERNS: RegExp[] = [
    /^(帮我|请帮我|请)?(记|添加|创建|新增|记一下|记下)(一个|一条)?(任务|待办)[：:，,\s]+(.+)/,
    /^(帮我|请)?记(一下|下)[：:，,\s]+(.+)/,
    /^待办[：:，,\s]+(.+)/,
    /^任务[：:，,\s]+(.+)/,
];

const REMIND_PREFIX = /^(提醒我?|记得提醒|别忘了|定时提醒?|记得)[：:，,\s]+(.+)/;
const REMIND_SUFFIX = /^(.+?)(点|时).{0,6}(提醒|叫我|通知)/;
const REMIND_AFTER = /^(.+?)后提醒(我)?$/;

/**
 * 检测自然语言是否对应 /task、/remind、/todo
 * 以 / 开头的输入由 ChatInput 的 parseCommand 处理，此处跳过
 */
export function detectChatIntent(text: string): ChatCommandIntent | null {
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith('/')) return null;

    for (const p of TODO_PATTERNS) {
        if (p.test(trimmed)) return { command: '/todo', args: '' };
    }

    for (const p of TASK_PATTERNS) {
        const m = trimmed.match(p);
        if (m) {
            const args = (m[m.length - 1] || '').trim();
            if (args && !/^(任务|待办)$/.test(args)) {
                return { command: '/task', args };
            }
        }
    }

    const prefixMatch = trimmed.match(REMIND_PREFIX);
    if (prefixMatch?.[2]?.trim()) {
        return { command: '/remind', args: prefixMatch[2].trim() };
    }

    const suffixMatch = trimmed.match(REMIND_SUFFIX);
    if (suffixMatch) {
        const args = trimmed.replace(/(提醒|叫我|通知)$/, '').trim();
        if (args) return { command: '/remind', args };
    }

    const afterMatch = trimmed.match(REMIND_AFTER);
    if (afterMatch?.[1]?.trim()) {
        return { command: '/remind', args: afterMatch[1].trim() };
    }

    return null;
}
